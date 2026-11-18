package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"rapidsale/backend/internal/auth"
	"rapidsale/backend/internal/models"
	"rapidsale/backend/internal/otp"
)

type profileReq struct {
	Name       string `json:"name" binding:"required,min=2,max=120"`
	About      string `json:"about" binding:"max=1000"`
	AvatarURL  string `json:"avatar_url" binding:"max=500"`
	LocationID *uint  `json:"location_id"`
}

func (h *Handler) UpdateProfile(c *gin.Context) {
	u := currentUser(c)
	var req profileReq
	if !bind(c, &req) {
		return
	}
	if req.LocationID != nil && h.Catalog.LocationByID(*req.LocationID) == nil {
		fail(c, http.StatusBadRequest, "invalid location")
		return
	}
	if err := h.DB.Model(u).Updates(map[string]any{
		"name": req.Name, "about": req.About, "avatar_url": req.AvatarURL, "location_id": req.LocationID,
	}).Error; err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, newMeView(u))
}

type passwordReq struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=8,max=72"`
}

func (h *Handler) ChangePassword(c *gin.Context) {
	u := currentUser(c)
	var req passwordReq
	if !bind(c, &req) {
		return
	}
	if !auth.CheckPassword(u.PasswordHash, req.CurrentPassword) {
		fail(c, http.StatusBadRequest, "current password is incorrect")
		return
	}
	hash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		serverError(c, err)
		return
	}
	if err := h.DB.Model(u).Update("password_hash", hash).Error; err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "password changed"})
}

// RequestContactChange sends a code to a new phone/email to add or replace it.
func (h *Handler) RequestContactChange(c *gin.Context) {
	var req targetReq
	if !bind(c, &req) {
		return
	}
	target, kind, err := auth.NormalizeTarget(req.Target)
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	if existing, err := h.userByTarget(target, kind); err == nil && existing.ID != currentUser(c).ID {
		fail(c, http.StatusConflict, "this "+kind+" is already used by another account")
		return
	}
	h.sendOTP(c, target, otp.PurposeContact, "verification code sent")
}

func (h *Handler) VerifyContactChange(c *gin.Context) {
	u := currentUser(c)
	var req verifyReq
	if !bind(c, &req) {
		return
	}
	target, kind, err := auth.NormalizeTarget(req.Target)
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.OTP.Verify(target, otp.PurposeContact, req.Code); err != nil {
		h.otpError(c, err)
		return
	}
	now := time.Now()
	updates := map[string]any{"phone": target, "phone_verified_at": now}
	if kind == auth.KindEmail {
		updates = map[string]any{"email": target, "email_verified_at": now}
	}
	if err := h.DB.Model(u).Updates(updates).Error; err != nil {
		fail(c, http.StatusConflict, "this "+kind+" is already used by another account")
		return
	}
	h.DB.Preload("Role.Permissions").First(u, u.ID)
	c.JSON(http.StatusOK, newMeView(u))
}

// PublicProfile shows a user's public info and listing count.
func (h *Handler) PublicProfile(c *gin.Context) {
	id, ok := paramID(c, "id")
	if !ok {
		return
	}
	var u models.User
	if err := h.DB.Where("status = ?", models.UserActive).First(&u, id).Error; err != nil {
		fail(c, http.StatusNotFound, "user not found")
		return
	}
	var count int64
	h.DB.Model(&models.Listing{}).Where("user_id = ? AND status = ?", u.ID, models.ListingActive).Count(&count)
	pub := u.Public()
	pub.Online = h.Hub.IsOnline(u.ID)
	c.JSON(http.StatusOK, gin.H{"user": pub, "active_listings": count})
}

// ---------- favorites ----------

func (h *Handler) AddFavorite(c *gin.Context) {
	id, ok := paramID(c, "id")
	if !ok {
		return
	}
	var l models.Listing
	if err := h.DB.Select("id").First(&l, id).Error; err != nil {
		fail(c, http.StatusNotFound, "listing not found")
		return
	}
	fav := models.Favorite{UserID: currentUser(c).ID, ListingID: id}
	if err := h.DB.Where(fav).FirstOrCreate(&fav).Error; err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"favorite": true})
}

func (h *Handler) RemoveFavorite(c *gin.Context) {
	id, ok := paramID(c, "id")
	if !ok {
		return
	}
	h.DB.Where("user_id = ? AND listing_id = ?", currentUser(c).ID, id).Delete(&models.Favorite{})
	c.JSON(http.StatusOK, gin.H{"favorite": false})
}

func (h *Handler) MyFavorites(c *gin.Context) {
	u := currentUser(c)
	page, limit, offset := pagination(c)
	q := h.DB.Model(&models.Listing{}).
		Joins("JOIN favorites f ON f.listing_id = listings.id AND f.user_id = ?", u.ID)
	var total int64
	q.Count(&total)
	var items []models.Listing
	if err := q.Preload("Images", orderImages).Preload("Location").
		Order("f.created_at DESC").Limit(limit).Offset(offset).Find(&items).Error; err != nil {
		serverError(c, err)
		return
	}
	for i := range items {
		items[i].IsFavorite = true
		sanitizeListing(&items[i], u)
	}
	c.JSON(http.StatusOK, paged(items, total, page, limit))
}

func orderImages(db *gorm.DB) *gorm.DB { return db.Order("sort_order ASC, id ASC") }
