package models

// Permission names used by route guards. Superadmin implicitly has all of them.
const (
	PermAdminAccess      = "admin.access"
	PermUsersView        = "users.view"
	PermUsersManage      = "users.manage"
	PermRolesManage      = "roles.manage"
	PermListingsModerate = "listings.moderate"
	PermListingsManage   = "listings.manage"
	PermReportsManage    = "reports.manage"
	PermCategoriesManage = "categories.manage"
	PermLocationsManage  = "locations.manage"
)

// PermissionCatalog lists all permissions with descriptions (seeded into the DB).
var PermissionCatalog = []Permission{
	{Name: PermAdminAccess, Description: "Access the admin panel and dashboard statistics"},
	{Name: PermUsersView, Description: "View user accounts"},
	{Name: PermUsersManage, Description: "Ban/unban users and change their roles"},
	{Name: PermRolesManage, Description: "Create and edit roles and their permissions"},
	{Name: PermListingsModerate, Description: "Approve, reject and feature listings"},
	{Name: PermListingsManage, Description: "Edit or delete any listing"},
	{Name: PermReportsManage, Description: "Review and resolve abuse reports"},
	{Name: PermCategoriesManage, Description: "Manage categories and their attributes"},
	{Name: PermLocationsManage, Description: "Manage locations"},
}

// DefaultRoles maps seeded roles to their permissions.
var DefaultRoles = []struct {
	Name, Description string
	Permissions       []string
}{
	{RoleSuperAdmin, "Full access to everything", nil}, // implicit all
	{RoleAdmin, "Administrator (everything except role management)", []string{
		PermAdminAccess, PermUsersView, PermUsersManage, PermListingsModerate, PermListingsManage,
		PermReportsManage, PermCategoriesManage, PermLocationsManage,
	}},
	{RoleModerator, "Moderates listings and reports", []string{
		PermAdminAccess, PermUsersView, PermListingsModerate, PermReportsManage,
	}},
	{RoleUser, "Regular public user", nil},
}
