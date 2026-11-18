// Package seed fills the database with roles, permissions, the superadmin account,
// all categories (with attributes), locations, and optional demo data. It is idempotent.
package seed

import (
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"rapidsale/backend/internal/auth"
	"rapidsale/backend/internal/config"
	"rapidsale/backend/internal/models"
)

var slugRe = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(s string) string {
	return strings.Trim(slugRe.ReplaceAllString(strings.ToLower(s), "-"), "-")
}

func Run(db *gorm.DB, cfg *config.Config, demo bool) error {
	steps := []struct {
		name string
		fn   func() error
	}{
		{"roles & permissions", func() error { return seedRBAC(db) }},
		{"superadmin", func() error { return seedSuperAdmin(db, cfg) }},
		{"categories", func() error { return seedCategories(db) }},
		{"locations", func() error { return seedLocations(db) }},
	}
	if demo {
		steps = append(steps, struct {
			name string
			fn   func() error
		}{"demo data", func() error { return seedDemo(db, cfg) }})
	}
	for _, s := range steps {
		if err := s.fn(); err != nil {
			return fmt.Errorf("seed %s: %w", s.name, err)
		}
		log.Printf("seeded %s", s.name)
	}
	return nil
}

func seedRBAC(db *gorm.DB) error {
	for _, p := range models.PermissionCatalog {
		p := p
		if err := db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "name"}},
			DoUpdates: clause.AssignmentColumns([]string{"description"}),
		}).Create(&p).Error; err != nil {
			return err
		}
	}
	for _, r := range models.DefaultRoles {
		role := models.Role{Name: r.Name}
		if err := db.Where("name = ?", r.Name).Attrs(models.Role{Description: r.Description, IsSystem: true}).
			FirstOrCreate(&role).Error; err != nil {
			return err
		}
		db.Model(&role).Updates(map[string]any{"description": r.Description, "is_system": true})
		// Only set permissions on first creation of a role's permission set, so admin edits survive re-seeding.
		if len(r.Permissions) > 0 && db.Model(&role).Association("Permissions").Count() == 0 {
			var perms []models.Permission
			db.Where("name IN ?", r.Permissions).Find(&perms)
			if err := db.Model(&role).Association("Permissions").Replace(perms); err != nil {
				return err
			}
		}
	}
	return nil
}

func seedSuperAdmin(db *gorm.DB, cfg *config.Config) error {
	var role models.Role
	if err := db.Where("name = ?", models.RoleSuperAdmin).First(&role).Error; err != nil {
		return err
	}
	email, err := auth.NormalizeEmail(cfg.SuperAdminEmail)
	if err != nil {
		return fmt.Errorf("SUPERADMIN_EMAIL: %w", err)
	}
	var existing models.User
	if db.Where("email = ?", email).First(&existing).Error == nil {
		return db.Model(&existing).Updates(map[string]any{"role_id": role.ID, "status": models.UserActive}).Error
	}
	hash, err := auth.HashPassword(cfg.SuperAdminPassword)
	if err != nil {
		return err
	}
	now := time.Now()
	u := models.User{Name: cfg.SuperAdminName, Email: &email, PasswordHash: hash, RoleID: role.ID,
		Status: models.UserActive, EmailVerifiedAt: &now}
	if cfg.SuperAdminPhone != "" {
		if p, err := auth.NormalizePhone(cfg.SuperAdminPhone); err == nil {
			u.Phone, u.PhoneVerifiedAt = &p, &now
		}
	}
	if err := db.Create(&u).Error; err != nil {
		return err
	}
	log.Printf("created superadmin %s (change the password after first login!)", email)
	return nil
}

func seedCategories(db *gorm.DB) error {
	used := map[string]bool{}
	var walk func(nodes []catSeed, parent *models.Category) error
	walk = func(nodes []catSeed, parent *models.Category) error {
		for i, n := range nodes {
			slug := slugify(n.Name)
			if used[slug] && parent != nil {
				slug = parent.Slug + "-" + slug
			}
			used[slug] = true

			cat := models.Category{Slug: slug}
			var parentID *uint
			if parent != nil {
				parentID = &parent.ID
			}
			if err := db.Where("slug = ?", slug).
				Attrs(models.Category{Name: n.Name, ParentID: parentID, Icon: n.Icon, SortOrder: i, IsActive: true}).
				FirstOrCreate(&cat).Error; err != nil {
				return err
			}
			db.Model(&cat).Updates(map[string]any{"name": n.Name, "parent_id": parentID, "icon": n.Icon, "sort_order": i})

			for j, a := range n.Attrs {
				a.CategoryID = cat.ID
				a.SortOrder = j
				if err := db.Clauses(clause.OnConflict{
					Columns:   []clause.Column{{Name: "category_id"}, {Name: "key"}},
					DoUpdates: clause.AssignmentColumns([]string{"label", "type", "options", "required", "filterable", "unit", "sort_order"}),
				}).Create(&a).Error; err != nil {
					return err
				}
			}
			if err := walk(n.Children, &cat); err != nil {
				return err
			}
		}
		return nil
	}
	return walk(Categories, nil)
}

func upsertLocation(db *gorm.DB, name, slug, typ string, parentID *uint, order int) (*models.Location, error) {
	loc := models.Location{Slug: slug}
	err := db.Where("slug = ?", slug).
		Attrs(models.Location{Name: name, Type: typ, ParentID: parentID, SortOrder: order}).
		FirstOrCreate(&loc).Error
	return &loc, err
}

func seedLocations(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		for i, p := range Locations {
			prov, err := upsertLocation(tx, p.Name, slugify(p.Name), "province", nil, i)
			if err != nil {
				return err
			}
			for j, c := range p.Cities {
				city, err := upsertLocation(tx, c.Name, slugify(c.Name), "city", &prov.ID, j)
				if err != nil {
					return err
				}
				for k, a := range c.Areas {
					if _, err := upsertLocation(tx, a, city.Slug+"-"+slugify(a), "area", &city.ID, k); err != nil {
						return err
					}
				}
			}
		}
		return nil
	})
}
