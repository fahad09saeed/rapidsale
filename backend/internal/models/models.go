package models

import (
	"time"

	"gorm.io/gorm"
)

// Role names that the system relies on.
const (
	RoleSuperAdmin = "superadmin"
	RoleAdmin      = "admin"
	RoleModerator  = "moderator"
	RoleUser       = "user"
)

// User statuses.
const (
	UserPending = "pending" // registered, contact not verified yet
	UserActive  = "active"
	UserBanned  = "banned"
)

// Listing statuses.
const (
	ListingPending  = "pending"
	ListingActive   = "active"
	ListingRejected = "rejected"
	ListingSold     = "sold"
	ListingExpired  = "expired"
	ListingInactive = "inactive" // hidden by owner
)

// Report statuses.
const (
	ReportOpen      = "open"
	ReportResolved  = "resolved"
	ReportDismissed = "dismissed"
)

type Permission struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	Name        string `gorm:"size:100;uniqueIndex;not null" json:"name"`
	Description string `gorm:"size:255" json:"description"`
}

type Role struct {
	ID          uint         `gorm:"primaryKey" json:"id"`
	Name        string       `gorm:"size:50;uniqueIndex;not null" json:"name"`
	Description string       `gorm:"size:255" json:"description"`
	IsSystem    bool         `gorm:"not null;default:false" json:"is_system"`
	Permissions []Permission `gorm:"many2many:role_permissions;constraint:OnDelete:CASCADE" json:"permissions,omitempty"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
}

// Can reports whether the role grants a permission. Superadmin is granted everything.
func (r *Role) Can(perm string) bool {
	if r == nil {
		return false
	}
	if r.Name == RoleSuperAdmin {
		return true
	}
	for _, p := range r.Permissions {
		if p.Name == perm {
			return true
		}
	}
	return false
}

type User struct {
	ID              uint64     `gorm:"primaryKey" json:"id"`
	Name            string     `gorm:"size:120;not null" json:"name"`
	Email           *string    `gorm:"size:191;uniqueIndex" json:"email,omitempty"`
	Phone           *string    `gorm:"size:20;uniqueIndex" json:"phone,omitempty"`
	PasswordHash    string     `gorm:"size:255" json:"-"`
	AvatarURL       string     `gorm:"size:500" json:"avatar_url"`
	About           string     `gorm:"size:1000" json:"about"`
	RoleID          uint       `gorm:"index;not null" json:"role_id"`
	Role            *Role      `json:"role,omitempty"`
	Status          string     `gorm:"size:20;index;not null;default:pending" json:"status"`
	EmailVerifiedAt *time.Time `json:"email_verified_at,omitempty"`
	PhoneVerifiedAt *time.Time `json:"phone_verified_at,omitempty"`
	LocationID      *uint      `json:"location_id,omitempty"`
	LastSeenAt      *time.Time `json:"last_seen_at,omitempty"`
	CreatedAt       time.Time  `gorm:"index" json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

func (u *User) Can(perm string) bool { return u != nil && u.Role.Can(perm) }

func (u *User) IsSuperAdmin() bool {
	return u != nil && u.Role != nil && u.Role.Name == RoleSuperAdmin
}

// PublicUser is the safe projection of a user shown to other people.
type PublicUser struct {
	ID         uint64     `json:"id"`
	Name       string     `json:"name"`
	AvatarURL  string     `json:"avatar_url"`
	About      string     `json:"about"`
	Verified   bool       `json:"verified"`
	LastSeenAt *time.Time `json:"last_seen_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	Online     bool       `json:"online"`
}

func (u *User) Public() PublicUser {
	return PublicUser{
		ID: u.ID, Name: u.Name, AvatarURL: u.AvatarURL, About: u.About,
		Verified:   u.PhoneVerifiedAt != nil || u.EmailVerifiedAt != nil,
		LastSeenAt: u.LastSeenAt, CreatedAt: u.CreatedAt,
	}
}

type OTPCode struct {
	ID         uint64    `gorm:"primaryKey"`
	Target     string    `gorm:"size:191;index:idx_otp_target_purpose;not null"`
	Purpose    string    `gorm:"size:30;index:idx_otp_target_purpose;not null"`
	CodeHash   string    `gorm:"size:64;not null"`
	Attempts   int       `gorm:"not null;default:0"`
	ExpiresAt  time.Time `gorm:"not null"`
	ConsumedAt *time.Time
	CreatedAt  time.Time `gorm:"index"`
}

type RefreshToken struct {
	ID        uint64    `gorm:"primaryKey"`
	UserID    uint64    `gorm:"index;not null"`
	TokenHash string    `gorm:"size:64;uniqueIndex;not null"`
	ExpiresAt time.Time `gorm:"not null"`
	RevokedAt *time.Time
	UserAgent string `gorm:"size:255"`
	IP        string `gorm:"size:64"`
	CreatedAt time.Time
}

type Location struct {
	ID        uint        `gorm:"primaryKey" json:"id"`
	ParentID  *uint       `gorm:"index" json:"parent_id"`
	Name      string      `gorm:"size:120;not null" json:"name"`
	Slug      string      `gorm:"size:160;uniqueIndex;not null" json:"slug"`
	Type      string      `gorm:"size:20;not null" json:"type"` // province | city | area
	SortOrder int         `gorm:"not null;default:0" json:"sort_order"`
	Children  []*Location `gorm:"-" json:"children,omitempty"`
}

type Category struct {
	ID          uint                `gorm:"primaryKey" json:"id"`
	ParentID    *uint               `gorm:"index" json:"parent_id"`
	Name        string              `gorm:"size:120;not null" json:"name"`
	Slug        string              `gorm:"size:160;uniqueIndex;not null" json:"slug"`
	Icon        string              `gorm:"size:60" json:"icon"`
	Description string              `gorm:"size:500" json:"description,omitempty"`
	SortOrder   int                 `gorm:"not null;default:0" json:"sort_order"`
	IsActive    bool                `gorm:"not null;default:true" json:"is_active"`
	Attributes  []CategoryAttribute `gorm:"constraint:OnDelete:CASCADE" json:"attributes,omitempty"`
	Children    []*Category         `gorm:"-" json:"children,omitempty"`
}

// Attribute types.
const (
	AttrText    = "text"
	AttrNumber  = "number"
	AttrSelect  = "select"
	AttrBoolean = "boolean"
)

// CategoryAttribute is a dynamic field for listings in a category (inherited by sub-categories).
type CategoryAttribute struct {
	ID         uint     `gorm:"primaryKey" json:"id"`
	CategoryID uint     `gorm:"uniqueIndex:idx_cat_attr_key;not null" json:"category_id"`
	Key        string   `gorm:"size:60;uniqueIndex:idx_cat_attr_key;not null" json:"key"`
	Label      string   `gorm:"size:120;not null" json:"label"`
	Type       string   `gorm:"size:20;not null" json:"type"`
	Options    []string `gorm:"type:json;serializer:json" json:"options,omitempty"`
	Required   bool     `gorm:"not null;default:false" json:"required"`
	Filterable bool     `gorm:"not null;default:false" json:"filterable"`
	Unit       string   `gorm:"size:30" json:"unit,omitempty"`
	SortOrder  int      `gorm:"not null;default:0" json:"sort_order"`
}

type Listing struct {
	ID           uint64         `gorm:"primaryKey" json:"id"`
	UserID       uint64         `gorm:"index;not null" json:"user_id"`
	User         *User          `json:"user,omitempty"`
	CategoryID   uint           `gorm:"index;not null" json:"category_id"`
	Category     *Category      `json:"category,omitempty"`
	LocationID   uint           `gorm:"index;not null" json:"location_id"`
	Location     *Location      `json:"location,omitempty"`
	Title        string         `gorm:"size:150;not null;index:idx_listings_fulltext,class:FULLTEXT" json:"title"`
	Description  string         `gorm:"type:text;not null;index:idx_listings_fulltext,class:FULLTEXT" json:"description"`
	Price        int64          `gorm:"index;not null;default:0" json:"price"`
	Negotiable   bool           `gorm:"not null;default:false" json:"negotiable"`
	Condition    string         `gorm:"size:20" json:"condition"`
	Status       string         `gorm:"size:20;index;not null" json:"status"`
	Attributes   map[string]any `gorm:"type:json;serializer:json" json:"attributes"`
	ContactName  string         `gorm:"size:120" json:"contact_name"`
	ContactPhone string         `gorm:"size:20" json:"contact_phone,omitempty"`
	ShowPhone    bool           `gorm:"not null;default:false" json:"show_phone"`
	IsFeatured   bool           `gorm:"index;not null;default:false" json:"is_featured"`
	Views        uint64         `gorm:"not null;default:0" json:"views"`
	RejectReason string         `gorm:"size:500" json:"reject_reason,omitempty"`
	ExpiresAt    *time.Time     `gorm:"index" json:"expires_at,omitempty"`
	Images       []ListingImage `gorm:"constraint:OnDelete:CASCADE" json:"images"`
	CreatedAt    time.Time      `gorm:"index" json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`

	IsFavorite bool `gorm:"-" json:"is_favorite"`
	HasPhone   bool `gorm:"-" json:"has_phone"`
}

type ListingImage struct {
	ID        uint64 `gorm:"primaryKey" json:"id"`
	ListingID uint64 `gorm:"index;not null" json:"-"`
	URL       string `gorm:"size:500;not null" json:"url"`
	SortOrder int    `gorm:"not null;default:0" json:"sort_order"`
}

type Favorite struct {
	UserID    uint64   `gorm:"primaryKey" json:"user_id"`
	ListingID uint64   `gorm:"primaryKey;index" json:"listing_id"`
	Listing   *Listing `json:"listing,omitempty"`
	CreatedAt time.Time
}

type Conversation struct {
	ID            uint64     `gorm:"primaryKey" json:"id"`
	ListingID     uint64     `gorm:"uniqueIndex:idx_conv_listing_buyer;not null" json:"listing_id"`
	Listing       *Listing   `json:"listing,omitempty"`
	BuyerID       uint64     `gorm:"uniqueIndex:idx_conv_listing_buyer;index;not null" json:"buyer_id"`
	Buyer         *User      `gorm:"foreignKey:BuyerID" json:"buyer,omitempty"`
	SellerID      uint64     `gorm:"index;not null" json:"seller_id"`
	Seller        *User      `gorm:"foreignKey:SellerID" json:"seller,omitempty"`
	LastMessage   string     `gorm:"size:500" json:"last_message"`
	LastMessageAt *time.Time `gorm:"index" json:"last_message_at"`
	BuyerUnread   int        `gorm:"not null;default:0" json:"-"`
	SellerUnread  int        `gorm:"not null;default:0" json:"-"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

type Message struct {
	ID             uint64     `gorm:"primaryKey" json:"id"`
	ConversationID uint64     `gorm:"index;not null" json:"conversation_id"`
	SenderID       uint64     `gorm:"not null" json:"sender_id"`
	Body           string     `gorm:"type:text;not null" json:"body"`
	ImageURL       string     `gorm:"size:500" json:"image_url,omitempty"`
	ReadAt         *time.Time `json:"read_at"`
	CreatedAt      time.Time  `gorm:"index" json:"created_at"`
}

type Report struct {
	ID             uint64     `gorm:"primaryKey" json:"id"`
	ReporterID     uint64     `gorm:"index;not null" json:"reporter_id"`
	Reporter       *User      `gorm:"foreignKey:ReporterID" json:"reporter,omitempty"`
	ListingID      *uint64    `gorm:"index" json:"listing_id,omitempty"`
	Listing        *Listing   `json:"listing,omitempty"`
	ReportedUserID *uint64    `gorm:"index" json:"reported_user_id,omitempty"`
	ReportedUser   *User      `gorm:"foreignKey:ReportedUserID" json:"reported_user,omitempty"`
	Reason         string     `gorm:"size:50;not null" json:"reason"`
	Details        string     `gorm:"size:2000" json:"details"`
	Status         string     `gorm:"size:20;index;not null;default:open" json:"status"`
	AdminNote      string     `gorm:"size:1000" json:"admin_note,omitempty"`
	ResolvedByID   *uint64    `json:"resolved_by_id,omitempty"`
	ResolvedAt     *time.Time `json:"resolved_at,omitempty"`
	CreatedAt      time.Time  `gorm:"index" json:"created_at"`
}

// All returns every model, in dependency order, for migrations.
func All() []any {
	return []any{
		&Permission{}, &Role{}, &Location{}, &User{}, &OTPCode{}, &RefreshToken{},
		&Category{}, &CategoryAttribute{}, &Listing{}, &ListingImage{}, &Favorite{},
		&Conversation{}, &Message{}, &Report{},
	}
}
