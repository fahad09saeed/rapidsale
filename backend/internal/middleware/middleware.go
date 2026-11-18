package middleware

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
	"gorm.io/gorm"

	"rapidsale/backend/internal/auth"
	"rapidsale/backend/internal/models"
)

const userKey = "user"

// CurrentUser returns the authenticated user or nil.
func CurrentUser(c *gin.Context) *models.User {
	if v, ok := c.Get(userKey); ok {
		if u, ok := v.(*models.User); ok {
			return u
		}
	}
	return nil
}

func bearerToken(c *gin.Context) string {
	h := c.GetHeader("Authorization")
	if strings.HasPrefix(h, "Bearer ") {
		return strings.TrimSpace(h[7:])
	}
	return ""
}

// Auth authenticates the request. When required is false, anonymous requests pass through.
func Auth(db *gorm.DB, jwt *auth.JWTManager, required bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		tok := bearerToken(c)
		if tok == "" {
			if required {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
				return
			}
			c.Next()
			return
		}
		claims, err := jwt.Parse(tok)
		if err != nil {
			if required {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token", "code": "token_invalid"})
				return
			}
			c.Next()
			return
		}
		var u models.User
		if err := db.Preload("Role.Permissions").First(&u, claims.UserID).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "account not found", "code": "token_invalid"})
			return
		}
		if u.Status == models.UserBanned {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "your account has been suspended", "code": "banned"})
			return
		}
		now := time.Now()
		if u.LastSeenAt == nil || now.Sub(*u.LastSeenAt) > 5*time.Minute {
			db.Model(&u).UpdateColumn("last_seen_at", now)
			u.LastSeenAt = &now
		}
		c.Set(userKey, &u)
		c.Next()
	}
}

// RequirePermission ensures the authenticated user has all the given permissions.
func RequirePermission(perms ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		u := CurrentUser(c)
		if u == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}
		for _, p := range perms {
			if !u.Can(p) {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "you do not have permission to do this"})
				return
			}
		}
		c.Next()
	}
}

// RateLimit is a simple per-IP token bucket limiter (per process).
func RateLimit(perMinute int, burst int) gin.HandlerFunc {
	type entry struct {
		lim  *rate.Limiter
		seen time.Time
	}
	var (
		mu      sync.Mutex
		clients = map[string]*entry{}
	)
	go func() {
		for range time.Tick(5 * time.Minute) {
			mu.Lock()
			for k, e := range clients {
				if time.Since(e.seen) > 10*time.Minute {
					delete(clients, k)
				}
			}
			mu.Unlock()
		}
	}()
	return func(c *gin.Context) {
		ip := c.ClientIP()
		mu.Lock()
		e, ok := clients[ip]
		if !ok {
			e = &entry{lim: rate.NewLimiter(rate.Limit(float64(perMinute)/60.0), burst)}
			clients[ip] = e
		}
		e.seen = time.Now()
		allowed := e.lim.Allow()
		mu.Unlock()
		if !allowed {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "too many requests, slow down"})
			return
		}
		c.Next()
	}
}
