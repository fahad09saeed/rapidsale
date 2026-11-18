package handlers

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"rapidsale/backend/internal/auth"
	"rapidsale/backend/internal/models"
)

// ---------- uploads ----------

const maxUploadBytes = 8 << 20

var imageExt = map[string]string{
	"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif",
}

func (h *Handler) Upload(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadBytes+1024)
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		fail(c, http.StatusBadRequest, "file is required (max 8 MB)")
		return
	}
	defer file.Close()
	if header.Size > maxUploadBytes {
		fail(c, http.StatusBadRequest, "file is too large (max 8 MB)")
		return
	}
	data, err := io.ReadAll(io.LimitReader(file, maxUploadBytes+1))
	if err != nil || len(data) > maxUploadBytes {
		fail(c, http.StatusBadRequest, "file is too large (max 8 MB)")
		return
	}
	ctype := http.DetectContentType(data)
	ext, ok := imageExt[ctype]
	if !ok {
		fail(c, http.StatusBadRequest, "only JPEG, PNG, WEBP or GIF images are allowed")
		return
	}
	folder := c.DefaultQuery("folder", "listings")
	if folder != "listings" && folder != "avatars" && folder != "chat" {
		folder = "listings"
	}
	now := time.Now()
	key := fmt.Sprintf("%s/%04d/%02d/%s%s", folder, now.Year(), now.Month(), auth.RandomToken(16), ext)
	url, err := h.Storage.Put(c.Request.Context(), key, bytes.NewReader(data), ctype)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"url": url})
}

// ---------- reports ----------

type reportReq struct {
	ListingID *uint64 `json:"listing_id"`
	UserID    *uint64 `json:"user_id"`
	Reason    string  `json:"reason" binding:"required,oneof=spam fraud offensive duplicate wrong_category sold prohibited other"`
	Details   string  `json:"details" binding:"max=2000"`
}

func (h *Handler) CreateReport(c *gin.Context) {
	u := currentUser(c)
	var req reportReq
	if !bind(c, &req) {
		return
	}
	if req.ListingID == nil && req.UserID == nil {
		fail(c, http.StatusBadRequest, "listing_id or user_id is required")
		return
	}
	r := models.Report{ReporterID: u.ID, Reason: req.Reason, Details: req.Details, Status: models.ReportOpen}
	if req.ListingID != nil {
		var l models.Listing
		if err := h.DB.Select("id", "user_id").First(&l, *req.ListingID).Error; err != nil {
			fail(c, http.StatusNotFound, "listing not found")
			return
		}
		r.ListingID, r.ReportedUserID = &l.ID, &l.UserID
	} else {
		var target models.User
		if err := h.DB.Select("id").First(&target, *req.UserID).Error; err != nil {
			fail(c, http.StatusNotFound, "user not found")
			return
		}
		r.ReportedUserID = &target.ID
	}
	if r.ReportedUserID != nil && *r.ReportedUserID == u.ID {
		fail(c, http.StatusBadRequest, "you cannot report yourself")
		return
	}
	if err := h.DB.Create(&r).Error; err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "thanks, our team will review this report"})
}
