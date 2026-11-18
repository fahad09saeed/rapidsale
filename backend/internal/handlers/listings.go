package handlers

import (
	"fmt"
	"net/http"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"rapidsale/backend/internal/auth"
	"rapidsale/backend/internal/models"
)

// ---------- catalog endpoints ----------

func (h *Handler) Categories(c *gin.Context) {
	c.JSON(http.StatusOK, h.Catalog.CategoryTree(false))
}

func (h *Handler) CategoryDetail(c *gin.Context) {
	cat := h.Catalog.CategoryBySlug(c.Param("slug"))
	if cat == nil || !cat.IsActive {
		fail(c, http.StatusNotFound, "category not found")
		return
	}
	cp := *cat
	cp.Attributes = h.Catalog.EffectiveAttributes(cat.ID)
	var children []*models.Category
	for _, ch := range cat.Children {
		if ch.IsActive {
			x := *ch
			x.Children = nil
			children = append(children, &x)
		}
	}
	cp.Children = children
	c.JSON(http.StatusOK, gin.H{"category": cp, "path": h.Catalog.CategoryPath(cat.ID)})
}

func (h *Handler) Locations(c *gin.Context) {
	c.JSON(http.StatusOK, h.Catalog.LocationTree())
}

// ---------- helpers ----------

// sanitizeListing hides contact details unless the viewer may see them.
func sanitizeListing(l *models.Listing, viewer *models.User) {
	l.HasPhone = l.ShowPhone && l.ContactPhone != ""
	isOwner := viewer != nil && viewer.ID == l.UserID
	if isOwner {
		return
	}
	if !l.ShowPhone || viewer == nil {
		l.ContactPhone = ""
	}
	if l.Status != models.ListingRejected {
		l.RejectReason = ""
	}
}

func (h *Handler) markFavorites(items []models.Listing, u *models.User) {
	if u == nil || len(items) == 0 {
		return
	}
	ids := make([]uint64, len(items))
	for i, l := range items {
		ids[i] = l.ID
	}
	var favIDs []uint64
	h.DB.Model(&models.Favorite{}).Where("user_id = ? AND listing_id IN ?", u.ID, ids).Pluck("listing_id", &favIDs)
	for i := range items {
		items[i].IsFavorite = slices.Contains(favIDs, items[i].ID)
	}
}

var attrKeyRe = regexp.MustCompile(`^[a-z0-9_]{1,60}$`)

// fulltextQuery turns user input into a MySQL boolean-mode query; empty if no usable words.
func fulltextQuery(q string) string {
	words := strings.FieldsFunc(q, func(r rune) bool { return !unicode.IsLetter(r) && !unicode.IsDigit(r) })
	var parts []string
	for _, w := range words {
		if len([]rune(w)) >= 3 {
			parts = append(parts, "+"+w+"*")
		}
	}
	return strings.Join(parts, " ")
}

// ---------- search ----------

func (h *Handler) SearchListings(c *gin.Context) {
	viewer := currentUser(c)
	page, limit, offset := pagination(c)
	empty := func() { c.JSON(http.StatusOK, paged([]models.Listing{}, 0, page, limit)) }

	q := h.DB.Model(&models.Listing{}).Where("listings.status = ?", models.ListingActive)

	if slug := c.Query("category"); slug != "" {
		cat := h.Catalog.CategoryBySlug(slug)
		if cat == nil {
			empty()
			return
		}
		q = q.Where("category_id IN ?", h.Catalog.CategoryDescendantIDs(cat.ID))
	}
	if slug := c.Query("location"); slug != "" {
		loc := h.Catalog.LocationBySlug(slug)
		if loc == nil {
			empty()
			return
		}
		q = q.Where("location_id IN ?", h.Catalog.LocationDescendantIDs(loc.ID))
	}
	if v, err := strconv.ParseInt(c.Query("min_price"), 10, 64); err == nil {
		q = q.Where("price >= ?", v)
	}
	if v, err := strconv.ParseInt(c.Query("max_price"), 10, 64); err == nil {
		q = q.Where("price <= ?", v)
	}
	if v := c.Query("condition"); v != "" {
		q = q.Where("`condition` = ?", v)
	}
	if c.Query("featured") == "1" || c.Query("featured") == "true" {
		q = q.Where("is_featured = ?", true)
	}
	if v, err := strconv.ParseUint(c.Query("user_id"), 10, 64); err == nil {
		q = q.Where("user_id = ?", v)
	}
	if text := strings.TrimSpace(c.Query("q")); text != "" {
		if ft := fulltextQuery(text); ft != "" {
			q = q.Where("MATCH(title, description) AGAINST (? IN BOOLEAN MODE)", ft)
		} else {
			q = q.Where("title LIKE ?", "%"+strings.ReplaceAll(text, "%", `\%`)+"%")
		}
	}
	// Dynamic attribute filters: attr.<key>=value, attr_min.<key>=n, attr_max.<key>=n
	for key, vals := range c.Request.URL.Query() {
		if len(vals) == 0 || vals[0] == "" {
			continue
		}
		var prefix string
		for _, p := range []string{"attr.", "attr_min.", "attr_max."} {
			if strings.HasPrefix(key, p) {
				prefix = p
			}
		}
		if prefix == "" {
			continue
		}
		k := strings.TrimPrefix(key, prefix)
		if !attrKeyRe.MatchString(k) {
			continue
		}
		path := fmt.Sprintf(`'$.%s'`, k)
		switch prefix {
		case "attr.":
			q = q.Where("JSON_UNQUOTE(JSON_EXTRACT(attributes, "+path+")) IN ?", vals)
		case "attr_min.":
			if n, err := strconv.ParseFloat(vals[0], 64); err == nil {
				q = q.Where("CAST(JSON_EXTRACT(attributes, "+path+") AS DECIMAL(20,2)) >= ?", n)
			}
		case "attr_max.":
			if n, err := strconv.ParseFloat(vals[0], 64); err == nil {
				q = q.Where("CAST(JSON_EXTRACT(attributes, "+path+") AS DECIMAL(20,2)) <= ?", n)
			}
		}
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		serverError(c, err)
		return
	}

	order := "is_featured DESC, created_at DESC"
	switch c.Query("sort") {
	case "oldest":
		order = "created_at ASC"
	case "price_asc":
		order = "price ASC, created_at DESC"
	case "price_desc":
		order = "price DESC, created_at DESC"
	case "newest":
		order = "created_at DESC"
	}

	var items []models.Listing
	if err := q.Preload("Images", orderImages).Preload("Location").Preload("Category").
		Order(order).Limit(limit).Offset(offset).Find(&items).Error; err != nil {
		serverError(c, err)
		return
	}
	for i := range items {
		sanitizeListing(&items[i], viewer)
	}
	h.markFavorites(items, viewer)
	c.JSON(http.StatusOK, paged(items, total, page, limit))
}

// ---------- detail ----------

func (h *Handler) GetListing(c *gin.Context) {
	id, ok := paramID(c, "id")
	if !ok {
		return
	}
	viewer := currentUser(c)
	var l models.Listing
	if err := h.DB.Preload("Images", orderImages).Preload("Location").Preload("Category").First(&l, id).Error; err != nil {
		fail(c, http.StatusNotFound, "listing not found")
		return
	}
	isOwner := viewer != nil && viewer.ID == l.UserID
	canModerate := viewer.Can(models.PermListingsModerate)
	if l.Status != models.ListingActive && l.Status != models.ListingSold && !isOwner && !canModerate {
		fail(c, http.StatusNotFound, "listing not found")
		return
	}
	// nv=1 is used by server-side rendering so views are only counted once, by the browser.
	if !isOwner && c.Query("nv") == "" {
		h.DB.Model(&models.Listing{}).Where("id = ?", l.ID).UpdateColumn("views", gorm.Expr("views + 1"))
		l.Views++
	}

	var seller models.User
	h.DB.First(&seller, l.UserID)
	sellerView := seller.Public()
	sellerView.Online = h.Hub.IsOnline(seller.ID)
	var sellerActive int64
	h.DB.Model(&models.Listing{}).Where("user_id = ? AND status = ?", seller.ID, models.ListingActive).Count(&sellerActive)

	var related []models.Listing
	h.DB.Preload("Images", orderImages).Preload("Location").
		Where("category_id = ? AND status = ? AND id <> ?", l.CategoryID, models.ListingActive, l.ID).
		Order("created_at DESC").Limit(8).Find(&related)
	for i := range related {
		sanitizeListing(&related[i], viewer)
	}

	items := []models.Listing{l}
	h.markFavorites(items, viewer)
	l = items[0]
	sanitizeListing(&l, viewer)

	c.JSON(http.StatusOK, gin.H{
		"listing":         l,
		"seller":          sellerView,
		"seller_listings": sellerActive,
		"category_path":   h.Catalog.CategoryPath(l.CategoryID),
		"location_path":   h.Catalog.LocationPath(l.LocationID),
		"attribute_defs":  h.Catalog.EffectiveAttributes(l.CategoryID),
		"related":         related,
	})
}

// ---------- create / update ----------

type listingReq struct {
	CategoryID   uint           `json:"category_id" binding:"required"`
	LocationID   uint           `json:"location_id" binding:"required"`
	Title        string         `json:"title" binding:"required,min=5,max=150"`
	Description  string         `json:"description" binding:"required,min=20,max=5000"`
	Price        int64          `json:"price" binding:"min=0,max=100000000000"`
	Negotiable   bool           `json:"negotiable"`
	Condition    string         `json:"condition" binding:"omitempty,oneof=new used refurbished"`
	Attributes   map[string]any `json:"attributes"`
	Images       []string       `json:"images" binding:"max=12,dive,required,max=500"`
	ContactName  string         `json:"contact_name" binding:"max=120"`
	ContactPhone string         `json:"contact_phone" binding:"max=20"`
	ShowPhone    bool           `json:"show_phone"`
}

// validateListing checks category/location/attributes; returns cleaned attributes or an error message.
func (h *Handler) validateListing(req *listingReq) (map[string]any, string) {
	cat := h.Catalog.CategoryByID(req.CategoryID)
	if cat == nil || !cat.IsActive {
		return nil, "invalid category"
	}
	for _, ch := range cat.Children {
		if ch.IsActive {
			return nil, "please choose a sub-category"
		}
	}
	if h.Catalog.LocationByID(req.LocationID) == nil {
		return nil, "invalid location"
	}
	if req.ContactPhone != "" {
		p, err := auth.NormalizePhone(req.ContactPhone)
		if err != nil {
			return nil, "invalid contact phone number"
		}
		req.ContactPhone = p
	}
	req.Title = strings.TrimSpace(req.Title)
	req.Description = strings.TrimSpace(req.Description)

	clean := map[string]any{}
	for _, def := range h.Catalog.EffectiveAttributes(cat.ID) {
		raw, present := req.Attributes[def.Key]
		if present {
			if s, ok := raw.(string); ok && strings.TrimSpace(s) == "" {
				present = false
			}
			if raw == nil {
				present = false
			}
		}
		if !present {
			if def.Required {
				return nil, def.Label + " is required"
			}
			continue
		}
		switch def.Type {
		case models.AttrNumber:
			var n float64
			switch v := raw.(type) {
			case float64:
				n = v
			case string:
				f, err := strconv.ParseFloat(strings.TrimSpace(v), 64)
				if err != nil {
					return nil, def.Label + " must be a number"
				}
				n = f
			default:
				return nil, def.Label + " must be a number"
			}
			if n < 0 {
				return nil, def.Label + " cannot be negative"
			}
			clean[def.Key] = n
		case models.AttrSelect:
			s, ok := raw.(string)
			if !ok || !slices.Contains(def.Options, s) {
				return nil, def.Label + " has an invalid value"
			}
			clean[def.Key] = s
		case models.AttrBoolean:
			switch v := raw.(type) {
			case bool:
				clean[def.Key] = v
			case string:
				clean[def.Key] = v == "true" || v == "1" || v == "yes"
			default:
				return nil, def.Label + " must be yes or no"
			}
		default:
			s, ok := raw.(string)
			if !ok {
				s = fmt.Sprint(raw)
			}
			clean[def.Key] = truncate(strings.TrimSpace(s), 200)
		}
	}
	return clean, ""
}

func imagesFrom(urls []string) []models.ListingImage {
	out := make([]models.ListingImage, 0, len(urls))
	for i, u := range urls {
		out = append(out, models.ListingImage{URL: u, SortOrder: i})
	}
	return out
}

func (h *Handler) CreateListing(c *gin.Context) {
	u := currentUser(c)
	var req listingReq
	if !bind(c, &req) {
		return
	}
	attrs, msg := h.validateListing(&req)
	if msg != "" {
		fail(c, http.StatusBadRequest, msg)
		return
	}
	status := models.ListingPending
	if h.Cfg.AutoApproveListings {
		status = models.ListingActive
	}
	exp := time.Now().AddDate(0, 0, h.Cfg.ListingTTLDays)
	if req.ContactName == "" {
		req.ContactName = u.Name
	}
	l := models.Listing{
		UserID: u.ID, CategoryID: req.CategoryID, LocationID: req.LocationID, Title: req.Title,
		Description: req.Description, Price: req.Price, Negotiable: req.Negotiable, Condition: req.Condition,
		Status: status, Attributes: attrs, ContactName: req.ContactName, ContactPhone: req.ContactPhone,
		ShowPhone: req.ShowPhone, ExpiresAt: &exp, Images: imagesFrom(req.Images),
	}
	if err := h.DB.Create(&l).Error; err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, l)
}

func (h *Handler) loadOwnedListing(c *gin.Context) (*models.Listing, bool) {
	id, ok := paramID(c, "id")
	if !ok {
		return nil, false
	}
	u := currentUser(c)
	var l models.Listing
	if err := h.DB.First(&l, id).Error; err != nil {
		fail(c, http.StatusNotFound, "listing not found")
		return nil, false
	}
	if l.UserID != u.ID && !u.Can(models.PermListingsManage) {
		fail(c, http.StatusForbidden, "you can only modify your own listings")
		return nil, false
	}
	return &l, true
}

func (h *Handler) UpdateListing(c *gin.Context) {
	l, ok := h.loadOwnedListing(c)
	if !ok {
		return
	}
	var req listingReq
	if !bind(c, &req) {
		return
	}
	attrs, msg := h.validateListing(&req)
	if msg != "" {
		fail(c, http.StatusBadRequest, msg)
		return
	}
	updates := map[string]any{
		"category_id": req.CategoryID, "location_id": req.LocationID, "title": req.Title,
		"description": req.Description, "price": req.Price, "negotiable": req.Negotiable,
		"condition": req.Condition, "contact_name": req.ContactName, "contact_phone": req.ContactPhone,
		"show_phone": req.ShowPhone,
	}
	// Edited listings go back to review when moderation is enabled.
	if !h.Cfg.AutoApproveListings && l.UserID == currentUser(c).ID &&
		(l.Status == models.ListingActive || l.Status == models.ListingRejected) {
		updates["status"] = models.ListingPending
	}
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(l).Updates(updates).Error; err != nil {
			return err
		}
		l.Attributes = attrs
		if err := tx.Model(l).Select("attributes").Updates(l).Error; err != nil {
			return err
		}
		if err := tx.Where("listing_id = ?", l.ID).Delete(&models.ListingImage{}).Error; err != nil {
			return err
		}
		if imgs := imagesFrom(req.Images); len(imgs) > 0 {
			for i := range imgs {
				imgs[i].ListingID = l.ID
			}
			return tx.Create(&imgs).Error
		}
		return nil
	})
	if err != nil {
		serverError(c, err)
		return
	}
	h.DB.Preload("Images", orderImages).Preload("Location").Preload("Category").First(l, l.ID)
	c.JSON(http.StatusOK, l)
}

func (h *Handler) DeleteListing(c *gin.Context) {
	l, ok := h.loadOwnedListing(c)
	if !ok {
		return
	}
	if err := h.DB.Delete(l).Error; err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "listing deleted"})
}

type ownerStatusReq struct {
	Status string `json:"status" binding:"required,oneof=sold inactive active"`
}

// SetListingStatus lets an owner mark sold, deactivate, or re-activate (renew) a listing.
func (h *Handler) SetListingStatus(c *gin.Context) {
	l, ok := h.loadOwnedListing(c)
	if !ok {
		return
	}
	var req ownerStatusReq
	if !bind(c, &req) {
		return
	}
	updates := map[string]any{"status": req.Status}
	if req.Status == models.ListingActive {
		switch l.Status {
		case models.ListingInactive, models.ListingExpired, models.ListingSold:
		default:
			fail(c, http.StatusBadRequest, "this listing cannot be re-activated")
			return
		}
		if !h.Cfg.AutoApproveListings {
			updates["status"] = models.ListingPending
		}
		updates["expires_at"] = time.Now().AddDate(0, 0, h.Cfg.ListingTTLDays)
	} else if l.Status == models.ListingRejected || l.Status == models.ListingPending {
		fail(c, http.StatusBadRequest, "this listing is not live")
		return
	}
	if err := h.DB.Model(l).Updates(updates).Error; err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": updates["status"]})
}

// MyListings returns all of the current user's listings, optionally filtered by status.
func (h *Handler) MyListings(c *gin.Context) {
	u := currentUser(c)
	page, limit, offset := pagination(c)
	q := h.DB.Model(&models.Listing{}).Where("user_id = ?", u.ID)
	if s := c.Query("status"); s != "" {
		q = q.Where("status = ?", s)
	}
	var total int64
	q.Count(&total)
	var items []models.Listing
	if err := q.Preload("Images", orderImages).Preload("Location").Preload("Category").
		Order("created_at DESC").Limit(limit).Offset(offset).Find(&items).Error; err != nil {
		serverError(c, err)
		return
	}
	type row struct {
		models.Listing
		Chats int64 `json:"chats"`
		Likes int64 `json:"likes"`
	}
	out := make([]row, len(items))
	for i, l := range items {
		out[i].Listing = l
		h.DB.Model(&models.Conversation{}).Where("listing_id = ?", l.ID).Count(&out[i].Chats)
		h.DB.Model(&models.Favorite{}).Where("listing_id = ?", l.ID).Count(&out[i].Likes)
	}
	c.JSON(http.StatusOK, paged(out, total, page, limit))
}
