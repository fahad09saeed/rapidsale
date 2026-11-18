package handlers

import (
	"github.com/gin-gonic/gin"

	mw "rapidsale/backend/internal/middleware"
	"rapidsale/backend/internal/models"
)

func (h *Handler) Routes(r *gin.Engine) {
	optionalAuth := mw.Auth(h.DB, h.JWT, false)
	requireAuth := mw.Auth(h.DB, h.JWT, true)
	authLimiter := mw.RateLimit(30, 10)
	perm := mw.RequirePermission

	api := r.Group("/api")
	api.GET("/health", h.Health)
	api.GET("/ws", h.WebSocket)

	a := api.Group("/auth", authLimiter)
	a.POST("/register", h.Register)
	a.POST("/verify", h.VerifyRegistration)
	a.POST("/resend-otp", h.ResendOTP)
	a.POST("/login", h.Login)
	a.POST("/otp-login/request", h.RequestLoginOTP)
	a.POST("/otp-login/verify", h.VerifyLoginOTP)
	a.POST("/forgot-password", h.ForgotPassword)
	a.POST("/reset-password", h.ResetPassword)
	a.POST("/refresh", h.Refresh)
	a.POST("/logout", h.Logout)
	api.GET("/auth/me", requireAuth, h.Me)

	// Public catalog
	api.GET("/categories", h.Categories)
	api.GET("/categories/:slug", h.CategoryDetail)
	api.GET("/locations", h.Locations)
	api.GET("/listings", optionalAuth, h.SearchListings)
	api.GET("/listings/:id", optionalAuth, h.GetListing)
	api.GET("/users/:id", h.PublicProfile)

	// Authenticated user
	u := api.Group("", requireAuth)
	u.PUT("/me", h.UpdateProfile)
	u.PUT("/me/password", h.ChangePassword)
	u.POST("/me/contact/request", authLimiter, h.RequestContactChange)
	u.POST("/me/contact/verify", authLimiter, h.VerifyContactChange)
	u.GET("/me/listings", h.MyListings)
	u.GET("/me/favorites", h.MyFavorites)

	u.POST("/uploads", mw.RateLimit(60, 20), h.Upload)

	u.POST("/listings", mw.RateLimit(20, 5), h.CreateListing)
	u.PUT("/listings/:id", h.UpdateListing)
	u.DELETE("/listings/:id", h.DeleteListing)
	u.PATCH("/listings/:id/status", h.SetListingStatus)
	u.POST("/listings/:id/favorite", h.AddFavorite)
	u.DELETE("/listings/:id/favorite", h.RemoveFavorite)

	u.GET("/conversations", h.ListConversations)
	u.GET("/conversations/unread-count", h.UnreadCount)
	u.POST("/conversations", mw.RateLimit(30, 10), h.StartConversation)
	u.GET("/conversations/:id", h.GetConversation)
	u.GET("/conversations/:id/messages", h.ListMessages)
	u.POST("/conversations/:id/messages", mw.RateLimit(120, 30), h.SendMessage)
	u.POST("/conversations/:id/read", h.MarkRead)

	u.POST("/reports", mw.RateLimit(10, 5), h.CreateReport)

	// Admin (RBAC)
	ad := api.Group("/admin", requireAuth, perm(models.PermAdminAccess))
	ad.GET("/stats", h.AdminStats)

	ad.GET("/users", perm(models.PermUsersView), h.AdminListUsers)
	ad.PATCH("/users/:id", perm(models.PermUsersManage), h.AdminUpdateUser)

	ad.GET("/listings", perm(models.PermListingsModerate), h.AdminListListings)
	ad.PATCH("/listings/:id", perm(models.PermListingsModerate), h.AdminModerateListing)
	ad.DELETE("/listings/:id", perm(models.PermListingsManage), h.AdminDeleteListing)

	ad.GET("/reports", perm(models.PermReportsManage), h.AdminListReports)
	ad.PATCH("/reports/:id", perm(models.PermReportsManage), h.AdminUpdateReport)

	cm := perm(models.PermCategoriesManage)
	ad.GET("/categories", cm, h.AdminCategories)
	ad.POST("/categories", cm, h.AdminCreateCategory)
	ad.PUT("/categories/:id", cm, h.AdminUpdateCategory)
	ad.DELETE("/categories/:id", cm, h.AdminDeleteCategory)
	ad.POST("/categories/:id/attributes", cm, h.AdminCreateAttribute)
	ad.PUT("/attributes/:id", cm, h.AdminUpdateAttribute)
	ad.DELETE("/attributes/:id", cm, h.AdminDeleteAttribute)

	lm := perm(models.PermLocationsManage)
	ad.POST("/locations", lm, h.AdminCreateLocation)
	ad.PUT("/locations/:id", lm, h.AdminUpdateLocation)
	ad.DELETE("/locations/:id", lm, h.AdminDeleteLocation)

	rm := perm(models.PermRolesManage)
	ad.GET("/roles", h.AdminRoles) // read-only list is needed to assign roles
	ad.GET("/permissions", rm, h.AdminPermissions)
	ad.POST("/roles", rm, h.AdminCreateRole)
	ad.PUT("/roles/:id", rm, h.AdminUpdateRole)
	ad.DELETE("/roles/:id", rm, h.AdminDeleteRole)
}
