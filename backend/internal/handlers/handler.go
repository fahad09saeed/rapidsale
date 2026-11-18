package handlers

import (
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"reflect"
	"regexp"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"
	"gorm.io/gorm"

	"rapidsale/backend/internal/auth"
	"rapidsale/backend/internal/catalog"
	"rapidsale/backend/internal/config"
	"rapidsale/backend/internal/middleware"
	"rapidsale/backend/internal/models"
	"rapidsale/backend/internal/otp"
	"rapidsale/backend/internal/storage"
	"rapidsale/backend/internal/ws"
)

type Handler struct {
	DB      *gorm.DB
	Cfg     *config.Config
	JWT     *auth.JWTManager
	OTP     *otp.Service
	Storage storage.Storage
	Hub     *ws.Hub
	Catalog *catalog.Catalog
}

func New(db *gorm.DB, cfg *config.Config, jwt *auth.JWTManager, o *otp.Service, st storage.Storage, hub *ws.Hub, cat *catalog.Catalog) *Handler {
	h := &Handler{DB: db, Cfg: cfg, JWT: jwt, OTP: o, Storage: st, Hub: hub, Catalog: cat}
	hub.OnMessage = h.handleWSMessage
	return h
}

func init() {
	// Report validation errors using JSON field names.
	if v, ok := binding.Validator.Engine().(*validator.Validate); ok {
		v.RegisterTagNameFunc(func(f reflect.StructField) string {
			name := strings.SplitN(f.Tag.Get("json"), ",", 2)[0]
			if name == "-" {
				return ""
			}
			return name
		})
	}
}

var currentUser = middleware.CurrentUser

func fail(c *gin.Context, status int, msg string) {
	c.AbortWithStatusJSON(status, gin.H{"error": msg})
}

func serverError(c *gin.Context, err error) {
	log.Printf("internal error on %s %s: %v", c.Request.Method, c.FullPath(), err)
	fail(c, http.StatusInternalServerError, "something went wrong, please try again")
}

func bind(c *gin.Context, v any) bool {
	if err := c.ShouldBindJSON(v); err != nil {
		fail(c, http.StatusBadRequest, validationMessage(err))
		return false
	}
	return true
}

func validationMessage(err error) string {
	var ve validator.ValidationErrors
	if errors.As(err, &ve) {
		msgs := make([]string, 0, len(ve))
		for _, fe := range ve {
			field := strings.ReplaceAll(fe.Field(), "_", " ")
			switch fe.Tag() {
			case "required":
				msgs = append(msgs, field+" is required")
			case "min":
				msgs = append(msgs, fmt.Sprintf("%s must be at least %s characters/value", field, fe.Param()))
			case "max":
				msgs = append(msgs, fmt.Sprintf("%s must be at most %s characters/value", field, fe.Param()))
			case "len":
				msgs = append(msgs, fmt.Sprintf("%s must be %s characters", field, fe.Param()))
			case "email":
				msgs = append(msgs, field+" must be a valid email")
			case "oneof":
				msgs = append(msgs, fmt.Sprintf("%s must be one of: %s", field, fe.Param()))
			case "numeric":
				msgs = append(msgs, field+" must contain only digits")
			default:
				msgs = append(msgs, field+" is invalid")
			}
		}
		return strings.Join(msgs, "; ")
	}
	return "invalid request body"
}

func paramID(c *gin.Context, name string) (uint64, bool) {
	id, err := strconv.ParseUint(c.Param(name), 10, 64)
	if err != nil || id == 0 {
		fail(c, http.StatusBadRequest, "invalid "+name)
		return 0, false
	}
	return id, true
}

func pagination(c *gin.Context) (page, limit, offset int) {
	page, _ = strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ = strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 20
	}
	return page, limit, (page - 1) * limit
}

type Paged struct {
	Items any   `json:"items"`
	Total int64 `json:"total"`
	Page  int   `json:"page"`
	Limit int   `json:"limit"`
	Pages int   `json:"pages"`
}

func paged(items any, total int64, page, limit int) Paged {
	return Paged{Items: items, Total: total, Page: page, Limit: limit, Pages: int(math.Ceil(float64(total) / float64(limit)))}
}

var slugStrip = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(s string) string {
	return strings.Trim(slugStrip.ReplaceAllString(strings.ToLower(s), "-"), "-")
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n])
}

func isNotFound(err error) bool { return errors.Is(err, gorm.ErrRecordNotFound) }

// Health reports API and database status.
func (h *Handler) Health(c *gin.Context) {
	sqlDB, err := h.DB.DB()
	if err == nil {
		err = sqlDB.PingContext(c.Request.Context())
	}
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "degraded", "db": "down"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok", "db": "up"})
}

// meView is the authenticated user's own profile including private fields and permissions.
type meView struct {
	*models.User
	RoleName    string   `json:"role_name"`
	Permissions []string `json:"permissions"`
}

func newMeView(u *models.User) meView {
	v := meView{User: u, Permissions: []string{}}
	if u.Role != nil {
		v.RoleName = u.Role.Name
		if u.Role.Name == models.RoleSuperAdmin {
			for _, p := range models.PermissionCatalog {
				v.Permissions = append(v.Permissions, p.Name)
			}
		} else {
			for _, p := range u.Role.Permissions {
				v.Permissions = append(v.Permissions, p.Name)
			}
		}
	}
	return v
}
