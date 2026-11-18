package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	AppName string
	Env     string
	Port    string

	DSN         string
	AutoMigrate bool

	JWTSecret  string
	AccessTTL  time.Duration
	RefreshTTL time.Duration

	OTPSecret string
	OTPTTL    time.Duration
	OTPDebug  bool // include the code in API responses (development only)

	SMSProvider   string // console | twilio
	EmailProvider string // console | smtp
	TwilioSID     string
	TwilioToken   string
	TwilioFrom    string
	SMTPHost      string
	SMTPPort      string
	SMTPUser      string
	SMTPPass      string
	SMTPFrom      string

	CORSOrigins    []string
	TrustedProxies []string

	StorageDriver string // local | s3
	UploadDir     string
	PublicBaseURL string // public URL of the API host, used for local upload URLs
	S3Bucket      string
	S3Region      string
	S3PublicURL   string // e.g. https://bucket.s3.region.amazonaws.com or CloudFront URL

	AutoApproveListings bool
	ListingTTLDays      int

	SuperAdminName     string
	SuperAdminEmail    string
	SuperAdminPhone    string
	SuperAdminPassword string
}

func (c *Config) IsProduction() bool { return c.Env == "production" }

func Load() *Config {
	_ = godotenv.Load()

	dsn := os.Getenv("DB_DSN")
	if dsn == "" {
		dsn = fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=UTC&multiStatements=false",
			get("DB_USER", "rapidsale"), get("DB_PASSWORD", "rapidsale"),
			get("DB_HOST", "127.0.0.1"), get("DB_PORT", "3306"), get("DB_NAME", "rapidsale"))
	}

	env := get("APP_ENV", "development")
	cfg := &Config{
		AppName:     get("APP_NAME", "RapidSale"),
		Env:         env,
		Port:        get("PORT", "8080"),
		DSN:         dsn,
		AutoMigrate: getBool("AUTO_MIGRATE", true),

		JWTSecret:  get("JWT_SECRET", "dev-only-insecure-jwt-secret-change-me-please"),
		AccessTTL:  getDuration("ACCESS_TOKEN_TTL", 15*time.Minute),
		RefreshTTL: getDuration("REFRESH_TOKEN_TTL", 30*24*time.Hour),

		OTPSecret: get("OTP_SECRET", "dev-only-insecure-otp-secret"),
		OTPTTL:    getDuration("OTP_TTL", 5*time.Minute),
		OTPDebug:  getBool("OTP_DEBUG", env != "production"),

		SMSProvider:   get("SMS_PROVIDER", "console"),
		EmailProvider: get("EMAIL_PROVIDER", "console"),
		TwilioSID:     os.Getenv("TWILIO_ACCOUNT_SID"),
		TwilioToken:   os.Getenv("TWILIO_AUTH_TOKEN"),
		TwilioFrom:    os.Getenv("TWILIO_FROM"),
		SMTPHost:      os.Getenv("SMTP_HOST"),
		SMTPPort:      get("SMTP_PORT", "587"),
		SMTPUser:      os.Getenv("SMTP_USER"),
		SMTPPass:      os.Getenv("SMTP_PASSWORD"),
		SMTPFrom:      os.Getenv("SMTP_FROM"),

		CORSOrigins:    getList("CORS_ORIGINS", "http://localhost:3000"),
		TrustedProxies: getList("TRUSTED_PROXIES", "127.0.0.1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"),

		StorageDriver: get("STORAGE_DRIVER", "local"),
		UploadDir:     get("UPLOAD_DIR", "./uploads"),
		PublicBaseURL: strings.TrimRight(get("PUBLIC_BASE_URL", "http://localhost:8080"), "/"),
		S3Bucket:      os.Getenv("S3_BUCKET"),
		S3Region:      get("S3_REGION", "ap-south-1"),
		S3PublicURL:   strings.TrimRight(os.Getenv("S3_PUBLIC_URL"), "/"),

		AutoApproveListings: getBool("AUTO_APPROVE_LISTINGS", true),
		ListingTTLDays:      getInt("LISTING_TTL_DAYS", 30),

		SuperAdminName:     get("SUPERADMIN_NAME", "Super Admin"),
		SuperAdminEmail:    get("SUPERADMIN_EMAIL", "admin@rapidsale.local"),
		SuperAdminPhone:    os.Getenv("SUPERADMIN_PHONE"),
		SuperAdminPassword: get("SUPERADMIN_PASSWORD", "ChangeMe123!"),
	}

	if cfg.IsProduction() {
		if len(cfg.JWTSecret) < 32 || strings.HasPrefix(cfg.JWTSecret, "dev-only") {
			log.Fatal("JWT_SECRET must be set to a random value of at least 32 characters in production")
		}
		if len(cfg.OTPSecret) < 32 || strings.HasPrefix(cfg.OTPSecret, "dev-only") {
			log.Fatal("OTP_SECRET must be set to a random value of at least 32 characters in production")
		}
	}
	return cfg
}

func get(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

func getBool(key string, def bool) bool {
	if v, err := strconv.ParseBool(os.Getenv(key)); err == nil {
		return v
	}
	return def
}

func getInt(key string, def int) int {
	if v, err := strconv.Atoi(os.Getenv(key)); err == nil {
		return v
	}
	return def
}

func getDuration(key string, def time.Duration) time.Duration {
	if v, err := time.ParseDuration(os.Getenv(key)); err == nil {
		return v
	}
	return def
}

func getList(key, def string) []string {
	var out []string
	for _, s := range strings.Split(get(key, def), ",") {
		if s = strings.TrimSpace(s); s != "" {
			out = append(out, s)
		}
	}
	return out
}
