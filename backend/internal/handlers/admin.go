package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"rapidsale/backend/internal/models"
)

// ---------- dashboard ----------

func (h *Handler) AdminStats(c *gin.Context) {
	count := func(model any, where string, args ...any) int64 {
		var n int64
		q := h.DB.Model(model)
		if where != "" {
			q = q.Where(where, args...)
		}
		q.Count(&n)
		return n
	}
	weekAgo := time.Now().AddDate(0, 0, -7)

	type statusCount struct {
		Status string `json:"status"`
		N      int64  `json:"count"`
	}
	byStatus := []statusCount{}
	h.DB.Model(&models.Listing{}).Select("status, COUNT(*) AS n").Group("status").Scan(&byStatus)

	type dayCount struct {
		Day string `json:"day"`
		N   int64  `json:"count"`
	}
	perDay := []dayCount{}
	h.DB.Model(&models.Listing{}).Unscoped().
		Select("DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS n").
		Where("created_at >= ?", time.Now().AddDate(0, 0, -14)).Group("day").Order("day").Scan(&perDay)

	type catCount struct {
		CategoryID uint   `json:"category_id"`
		Name       string `json:"name"`
		N          int64  `json:"count"`
	}
	var catRows []struct {
		CategoryID uint
		N          int64
	}
	h.DB.Model(&models.Listing{}).Select("category_id, COUNT(*) AS n").Where("status = ?", models.ListingActive).
		Group("category_id").Scan(&catRows)
	rootCounts := map[uint]int64{}
	for _, r := range catRows {
		if path := h.Catalog.CategoryPath(r.CategoryID); len(path) > 0 {
			rootCounts[path[0].ID] += r.N
		}
	}
	topCats := []catCount{}
	for id, n := range rootCounts {
		if cat := h.Catalog.CategoryByID(id); cat != nil {
			topCats = append(topCats, catCount{CategoryID: id, Name: cat.Name, N: n})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"users": gin.H{
			"total":     count(&models.User{}, ""),
			"active":    count(&models.User{}, "status = ?", models.UserActive),
			"banned":    count(&models.User{}, "status = ?", models.UserBanned),
			"pending":   count(&models.User{}, "status = ?", models.UserPending),
			"new_7days": count(&models.User{}, "created_at >= ?", weekAgo),
		},
		"listings": gin.H{
			"total":     count(&models.Listing{}, ""),
			"new_7days": count(&models.Listing{}, "created_at >= ?", weekAgo),
			"by_status": byStatus,
			"per_day":   perDay,
		},
		"reports_open":   count(&models.Report{}, "status = ?", models.ReportOpen),
		"conversations":  count(&models.Conversation{}, ""),
		"messages":       count(&models.Message{}, ""),
		"top_categories": topCats,
	})
}

// ---------- users ----------

func (h *Handler) AdminListUsers(c *gin.Context) {
	page, limit, offset := pagination(c)
	q := h.DB.Model(&models.User{})
	if s := strings.TrimSpace(c.Query("q")); s != "" {
		like := "%" + s + "%"
		q = q.Where("name LIKE ? OR email LIKE ? OR phone LIKE ?", like, like, like)
	}
	if s := c.Query("status"); s != "" {
		q = q.Where("status = ?", s)
	}
	if s := c.Query("role_id"); s != "" {
		q = q.Where("role_id = ?", s)
	}
	var total int64
	q.Count(&total)
	var users []models.User
	if err := q.Preload("Role").Order("id DESC").Limit(limit).Offset(offset).Find(&users).Error; err != nil {
		serverError(c, err)
		return
	}
	type row struct {
		models.User
		Listings int64 `json:"listings"`
	}
	out := make([]row, len(users))
	for i, u := range users {
		out[i].User = u
		h.DB.Model(&models.Listing{}).Where("user_id = ?", u.ID).Count(&out[i].Listings)
	}
	c.JSON(http.StatusOK, paged(out, total, page, limit))
}

type adminUserReq struct {
	Status *string `json:"status" binding:"omitempty,oneof=active banned pending"`
	RoleID *uint   `json:"role_id"`
}

func (h *Handler) AdminUpdateUser(c *gin.Context) {
	me := currentUser(c)
	id, ok := paramID(c, "id")
	if !ok {
		return
	}
	var req adminUserReq
	if !bind(c, &req) {
		return
	}
	var target models.User
	if err := h.DB.Preload("Role").First(&target, id).Error; err != nil {
		fail(c, http.StatusNotFound, "user not found")
		return
	}
	if target.ID == me.ID {
		fail(c, http.StatusBadRequest, "you cannot change your own account here")
		return
	}
	if target.IsSuperAdmin() && !me.IsSuperAdmin() {
		fail(c, http.StatusForbidden, "only a superadmin can modify a superadmin")
		return
	}
	updates := map[string]any{}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.RoleID != nil {
		var role models.Role
		if err := h.DB.First(&role, *req.RoleID).Error; err != nil {
			fail(c, http.StatusBadRequest, "role not found")
			return
		}
		// Granting staff roles requires roles.manage; superadmin can only be granted by a superadmin.
		if role.Name != models.RoleUser && !me.Can(models.PermRolesManage) {
			fail(c, http.StatusForbidden, "you cannot assign staff roles")
			return
		}
		if role.Name == models.RoleSuperAdmin && !me.IsSuperAdmin() {
			fail(c, http.StatusForbidden, "only a superadmin can grant superadmin")
			return
		}
		updates["role_id"] = role.ID
	}
	if len(updates) == 0 {
		fail(c, http.StatusBadRequest, "nothing to update")
		return
	}
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&target).Updates(updates).Error; err != nil {
			return err
		}
		if req.Status != nil && *req.Status == models.UserBanned {
			// Kick the user out and hide their listings.
			if err := tx.Model(&models.RefreshToken{}).Where("user_id = ? AND revoked_at IS NULL", target.ID).
				Update("revoked_at", time.Now()).Error; err != nil {
				return err
			}
			return tx.Model(&models.Listing{}).Where("user_id = ? AND status = ?", target.ID, models.ListingActive).
				Update("status", models.ListingInactive).Error
		}
		return nil
	})
	if err != nil {
		serverError(c, err)
		return
	}
	h.DB.Preload("Role").First(&target, target.ID)
	c.JSON(http.StatusOK, target)
}

// ---------- listings moderation ----------

func (h *Handler) AdminListListings(c *gin.Context) {
	page, limit, offset := pagination(c)
	q := h.DB.Model(&models.Listing{})
	if s := c.Query("status"); s != "" {
		q = q.Where("status = ?", s)
	}
	if s := strings.TrimSpace(c.Query("q")); s != "" {
		q = q.Where("title LIKE ?", "%"+s+"%")
	}
	if s := c.Query("user_id"); s != "" {
		q = q.Where("user_id = ?", s)
	}
	var total int64
	q.Count(&total)
	var items []models.Listing
	if err := q.Preload("Images", orderImages).Preload("User").Preload("Category").Preload("Location").
		Order("id DESC").Limit(limit).Offset(offset).Find(&items).Error; err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, paged(items, total, page, limit))
}

type moderateReq struct {
	Status       *string `json:"status" binding:"omitempty,oneof=active rejected inactive pending sold expired"`
	RejectReason string  `json:"reject_reason" binding:"max=500"`
	IsFeatured   *bool   `json:"is_featured"`
}

func (h *Handler) AdminModerateListing(c *gin.Context) {
	id, ok := paramID(c, "id")
	if !ok {
		return
	}
	var req moderateReq
	if !bind(c, &req) {
		return
	}
	var l models.Listing
	if err := h.DB.First(&l, id).Error; err != nil {
		fail(c, http.StatusNotFound, "listing not found")
		return
	}
	updates := map[string]any{}
	if req.Status != nil {
		updates["status"] = *req.Status
		updates["reject_reason"] = ""
		if *req.Status == models.ListingRejected {
			if strings.TrimSpace(req.RejectReason) == "" {
				fail(c, http.StatusBadRequest, "reject_reason is required when rejecting")
				return
			}
			updates["reject_reason"] = req.RejectReason
		}
		if *req.Status == models.ListingActive && (l.ExpiresAt == nil || l.ExpiresAt.Before(time.Now())) {
			updates["expires_at"] = time.Now().AddDate(0, 0, h.Cfg.ListingTTLDays)
		}
	}
	if req.IsFeatured != nil {
		updates["is_featured"] = *req.IsFeatured
	}
	if len(updates) == 0 {
		fail(c, http.StatusBadRequest, "nothing to update")
		return
	}
	if err := h.DB.Model(&l).Updates(updates).Error; err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, l)
}

func (h *Handler) AdminDeleteListing(c *gin.Context) {
	id, ok := paramID(c, "id")
	if !ok {
		return
	}
	if err := h.DB.Delete(&models.Listing{}, id).Error; err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "listing deleted"})
}

// ---------- reports ----------

func (h *Handler) AdminListReports(c *gin.Context) {
	page, limit, offset := pagination(c)
	q := h.DB.Model(&models.Report{})
	if s := c.DefaultQuery("status", models.ReportOpen); s != "all" {
		q = q.Where("status = ?", s)
	}
	var total int64
	q.Count(&total)
	var items []models.Report
	if err := q.Preload("Reporter").Preload("ReportedUser").
		Preload("Listing", func(db *gorm.DB) *gorm.DB { return db.Unscoped() }).
		Order("id DESC").Limit(limit).Offset(offset).Find(&items).Error; err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, paged(items, total, page, limit))
}

type resolveReportReq struct {
	Status    string `json:"status" binding:"required,oneof=open resolved dismissed"`
	AdminNote string `json:"admin_note" binding:"max=1000"`
}

func (h *Handler) AdminUpdateReport(c *gin.Context) {
	id, ok := paramID(c, "id")
	if !ok {
		return
	}
	var req resolveReportReq
	if !bind(c, &req) {
		return
	}
	me := currentUser(c)
	updates := map[string]any{"status": req.Status, "admin_note": req.AdminNote}
	if req.Status != models.ReportOpen {
		updates["resolved_by_id"] = me.ID
		updates["resolved_at"] = time.Now()
	} else {
		updates["resolved_by_id"] = nil
		updates["resolved_at"] = nil
	}
	res := h.DB.Model(&models.Report{}).Where("id = ?", id).Updates(updates)
	if res.Error != nil {
		serverError(c, res.Error)
		return
	}
	if res.RowsAffected == 0 {
		fail(c, http.StatusNotFound, "report not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "report updated"})
}

// ---------- categories ----------

func (h *Handler) AdminCategories(c *gin.Context) {
	tree := h.Catalog.CategoryTree(true)
	var attach func([]*models.Category)
	attach = func(nodes []*models.Category) {
		for _, n := range nodes {
			var attrs []models.CategoryAttribute
			h.DB.Where("category_id = ?", n.ID).Order("sort_order, id").Find(&attrs)
			n.Attributes = attrs
			attach(n.Children)
		}
	}
	attach(tree)
	c.JSON(http.StatusOK, tree)
}

type categoryReq struct {
	ParentID    *uint  `json:"parent_id"`
	Name        string `json:"name" binding:"required,min=2,max=120"`
	Slug        string `json:"slug" binding:"max=160"`
	Icon        string `json:"icon" binding:"max=60"`
	Description string `json:"description" binding:"max=500"`
	SortOrder   int    `json:"sort_order"`
	IsActive    *bool  `json:"is_active"`
}

func (h *Handler) categoryFromReq(req categoryReq, cat *models.Category) string {
	if req.ParentID != nil {
		p := h.Catalog.CategoryByID(*req.ParentID)
		if p == nil {
			return "parent category not found"
		}
		if cat.ID != 0 && (p.ID == cat.ID || containsUint(h.Catalog.CategoryDescendantIDs(cat.ID), p.ID)) {
			return "a category cannot be moved under itself"
		}
	}
	slug := slugify(req.Slug)
	if slug == "" {
		slug = slugify(req.Name)
		if req.ParentID != nil {
			slug = h.Catalog.CategoryByID(*req.ParentID).Slug + "-" + slug
		}
	}
	cat.ParentID, cat.Name, cat.Slug, cat.Icon = req.ParentID, req.Name, slug, req.Icon
	cat.Description, cat.SortOrder = req.Description, req.SortOrder
	if req.IsActive != nil {
		cat.IsActive = *req.IsActive
	} else if cat.ID == 0 {
		cat.IsActive = true
	}
	return ""
}

func containsUint(s []uint, v uint) bool {
	for _, x := range s {
		if x == v {
			return true
		}
	}
	return false
}

func (h *Handler) AdminCreateCategory(c *gin.Context) {
	var req categoryReq
	if !bind(c, &req) {
		return
	}
	var cat models.Category
	if msg := h.categoryFromReq(req, &cat); msg != "" {
		fail(c, http.StatusBadRequest, msg)
		return
	}
	if err := h.DB.Select("*").Omit("id").Create(&cat).Error; err != nil {
		fail(c, http.StatusConflict, "a category with this slug already exists")
		return
	}
	_ = h.Catalog.Reload()
	c.JSON(http.StatusCreated, cat)
}

func (h *Handler) AdminUpdateCategory(c *gin.Context) {
	id, ok := paramID(c, "id")
	if !ok {
		return
	}
	var req categoryReq
	if !bind(c, &req) {
		return
	}
	var cat models.Category
	if err := h.DB.First(&cat, id).Error; err != nil {
		fail(c, http.StatusNotFound, "category not found")
		return
	}
	if req.Slug == "" {
		req.Slug = cat.Slug
	}
	if msg := h.categoryFromReq(req, &cat); msg != "" {
		fail(c, http.StatusBadRequest, msg)
		return
	}
	if err := h.DB.Select("parent_id", "name", "slug", "icon", "description", "sort_order", "is_active").
		Updates(&cat).Error; err != nil {
		fail(c, http.StatusConflict, "a category with this slug already exists")
		return
	}
	_ = h.Catalog.Reload()
	c.JSON(http.StatusOK, cat)
}

func (h *Handler) AdminDeleteCategory(c *gin.Context) {
	id, ok := paramID(c, "id")
	if !ok {
		return
	}
	var n int64
	h.DB.Model(&models.Category{}).Where("parent_id = ?", id).Count(&n)
	if n > 0 {
		fail(c, http.StatusConflict, "delete or move the sub-categories first")
		return
	}
	h.DB.Unscoped().Model(&models.Listing{}).Where("category_id = ?", id).Count(&n)
	if n > 0 {
		fail(c, http.StatusConflict, "this category has listings; deactivate it instead")
		return
	}
	if err := h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("category_id = ?", id).Delete(&models.CategoryAttribute{}).Error; err != nil {
			return err
		}
		return tx.Delete(&models.Category{}, id).Error
	}); err != nil {
		serverError(c, err)
		return
	}
	_ = h.Catalog.Reload()
	c.JSON(http.StatusOK, gin.H{"message": "category deleted"})
}

type attributeReq struct {
	Key        string   `json:"key" binding:"required,max=60"`
	Label      string   `json:"label" binding:"required,max=120"`
	Type       string   `json:"type" binding:"required,oneof=text number select boolean"`
	Options    []string `json:"options"`
	Required   bool     `json:"required"`
	Filterable bool     `json:"filterable"`
	Unit       string   `json:"unit" binding:"max=30"`
	SortOrder  int      `json:"sort_order"`
}

func (r *attributeReq) validate() string {
	r.Key = strings.ReplaceAll(slugify(r.Key), "-", "_")
	if !attrKeyRe.MatchString(r.Key) {
		return "key must contain only lowercase letters, digits and underscores"
	}
	if r.Type == models.AttrSelect && len(r.Options) == 0 {
		return "select attributes need at least one option"
	}
	if r.Type != models.AttrSelect {
		r.Options = nil
	}
	return ""
}

func (h *Handler) AdminCreateAttribute(c *gin.Context) {
	id, ok := paramID(c, "id")
	if !ok {
		return
	}
	if h.Catalog.CategoryByID(uint(id)) == nil {
		fail(c, http.StatusNotFound, "category not found")
		return
	}
	var req attributeReq
	if !bind(c, &req) {
		return
	}
	if msg := req.validate(); msg != "" {
		fail(c, http.StatusBadRequest, msg)
		return
	}
	a := models.CategoryAttribute{CategoryID: uint(id), Key: req.Key, Label: req.Label, Type: req.Type,
		Options: req.Options, Required: req.Required, Filterable: req.Filterable, Unit: req.Unit, SortOrder: req.SortOrder}
	if err := h.DB.Create(&a).Error; err != nil {
		fail(c, http.StatusConflict, "an attribute with this key already exists in this category")
		return
	}
	_ = h.Catalog.Reload()
	c.JSON(http.StatusCreated, a)
}

func (h *Handler) AdminUpdateAttribute(c *gin.Context) {
	id, ok := paramID(c, "id")
	if !ok {
		return
	}
	var req attributeReq
	if !bind(c, &req) {
		return
	}
	if msg := req.validate(); msg != "" {
		fail(c, http.StatusBadRequest, msg)
		return
	}
	var a models.CategoryAttribute
	if err := h.DB.First(&a, id).Error; err != nil {
		fail(c, http.StatusNotFound, "attribute not found")
		return
	}
	a.Key, a.Label, a.Type, a.Options = req.Key, req.Label, req.Type, req.Options
	a.Required, a.Filterable, a.Unit, a.SortOrder = req.Required, req.Filterable, req.Unit, req.SortOrder
	if err := h.DB.Select("*").Updates(&a).Error; err != nil {
		fail(c, http.StatusConflict, "an attribute with this key already exists in this category")
		return
	}
	_ = h.Catalog.Reload()
	c.JSON(http.StatusOK, a)
}

func (h *Handler) AdminDeleteAttribute(c *gin.Context) {
	id, ok := paramID(c, "id")
	if !ok {
		return
	}
	h.DB.Delete(&models.CategoryAttribute{}, id)
	_ = h.Catalog.Reload()
	c.JSON(http.StatusOK, gin.H{"message": "attribute deleted"})
}

// ---------- locations ----------

type locationReq struct {
	ParentID  *uint  `json:"parent_id"`
	Name      string `json:"name" binding:"required,min=2,max=120"`
	Type      string `json:"type" binding:"required,oneof=province city area"`
	SortOrder int    `json:"sort_order"`
}

func (h *Handler) AdminCreateLocation(c *gin.Context) {
	var req locationReq
	if !bind(c, &req) {
		return
	}
	slug := slugify(req.Name)
	if req.ParentID != nil {
		p := h.Catalog.LocationByID(*req.ParentID)
		if p == nil {
			fail(c, http.StatusBadRequest, "parent location not found")
			return
		}
		slug = p.Slug + "-" + slug
	}
	loc := models.Location{ParentID: req.ParentID, Name: req.Name, Slug: slug, Type: req.Type, SortOrder: req.SortOrder}
	if err := h.DB.Create(&loc).Error; err != nil {
		fail(c, http.StatusConflict, "this location already exists")
		return
	}
	_ = h.Catalog.Reload()
	c.JSON(http.StatusCreated, loc)
}

func (h *Handler) AdminUpdateLocation(c *gin.Context) {
	id, ok := paramID(c, "id")
	if !ok {
		return
	}
	var req locationReq
	if !bind(c, &req) {
		return
	}
	res := h.DB.Model(&models.Location{}).Where("id = ?", id).
		Updates(map[string]any{"name": req.Name, "type": req.Type, "sort_order": req.SortOrder})
	if res.Error != nil {
		serverError(c, res.Error)
		return
	}
	_ = h.Catalog.Reload()
	c.JSON(http.StatusOK, gin.H{"message": "location updated"})
}

func (h *Handler) AdminDeleteLocation(c *gin.Context) {
	id, ok := paramID(c, "id")
	if !ok {
		return
	}
	var n int64
	h.DB.Model(&models.Location{}).Where("parent_id = ?", id).Count(&n)
	if n == 0 {
		h.DB.Unscoped().Model(&models.Listing{}).Where("location_id = ?", id).Count(&n)
	}
	if n > 0 {
		fail(c, http.StatusConflict, "location is in use")
		return
	}
	h.DB.Delete(&models.Location{}, id)
	_ = h.Catalog.Reload()
	c.JSON(http.StatusOK, gin.H{"message": "location deleted"})
}

// ---------- roles & permissions ----------

func (h *Handler) AdminRoles(c *gin.Context) {
	var roles []models.Role
	h.DB.Preload("Permissions").Order("id").Find(&roles)
	type row struct {
		models.Role
		Users int64 `json:"users"`
	}
	out := make([]row, len(roles))
	for i, r := range roles {
		out[i].Role = r
		h.DB.Model(&models.User{}).Where("role_id = ?", r.ID).Count(&out[i].Users)
	}
	c.JSON(http.StatusOK, out)
}

func (h *Handler) AdminPermissions(c *gin.Context) {
	var perms []models.Permission
	h.DB.Order("name").Find(&perms)
	c.JSON(http.StatusOK, perms)
}

type roleReq struct {
	Name          string `json:"name" binding:"required,min=2,max=50"`
	Description   string `json:"description" binding:"max=255"`
	PermissionIDs []uint `json:"permission_ids"`
}

func (h *Handler) saveRole(c *gin.Context, role *models.Role, req roleReq) {
	var perms []models.Permission
	if len(req.PermissionIDs) > 0 {
		h.DB.Where("id IN ?", req.PermissionIDs).Find(&perms)
	}
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(role).Error; err != nil {
			return err
		}
		return tx.Model(role).Association("Permissions").Replace(perms)
	})
	if err != nil {
		fail(c, http.StatusConflict, "a role with this name already exists")
		return
	}
	h.DB.Preload("Permissions").First(role, role.ID)
	c.JSON(http.StatusOK, role)
}

func (h *Handler) AdminCreateRole(c *gin.Context) {
	var req roleReq
	if !bind(c, &req) {
		return
	}
	role := models.Role{Name: strings.ToLower(slugify(req.Name)), Description: req.Description}
	h.saveRole(c, &role, req)
}

func (h *Handler) AdminUpdateRole(c *gin.Context) {
	id, ok := paramID(c, "id")
	if !ok {
		return
	}
	var req roleReq
	if !bind(c, &req) {
		return
	}
	var role models.Role
	if err := h.DB.First(&role, id).Error; err != nil {
		fail(c, http.StatusNotFound, "role not found")
		return
	}
	if role.Name == models.RoleSuperAdmin {
		fail(c, http.StatusBadRequest, "the superadmin role always has every permission")
		return
	}
	if !role.IsSystem {
		role.Name = strings.ToLower(slugify(req.Name))
	}
	role.Description = req.Description
	h.saveRole(c, &role, req)
}

func (h *Handler) AdminDeleteRole(c *gin.Context) {
	id, ok := paramID(c, "id")
	if !ok {
		return
	}
	var role models.Role
	if err := h.DB.First(&role, id).Error; err != nil {
		fail(c, http.StatusNotFound, "role not found")
		return
	}
	if role.IsSystem {
		fail(c, http.StatusBadRequest, "system roles cannot be deleted")
		return
	}
	var n int64
	h.DB.Model(&models.User{}).Where("role_id = ?", role.ID).Count(&n)
	if n > 0 {
		fail(c, http.StatusConflict, "reassign this role's users first")
		return
	}
	h.DB.Model(&role).Association("Permissions").Clear()
	h.DB.Delete(&role)
	c.JSON(http.StatusOK, gin.H{"message": "role deleted"})
}
