package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"rapidsale/backend/internal/auth"
	"rapidsale/backend/internal/catalog"
	"rapidsale/backend/internal/config"
	"rapidsale/backend/internal/db"
	"rapidsale/backend/internal/handlers"
	"rapidsale/backend/internal/models"
	"rapidsale/backend/internal/otp"
	"rapidsale/backend/internal/storage"
	"rapidsale/backend/internal/ws"
)

func main() {
	cfg := config.Load()
	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}

	gdb, err := db.Connect(cfg)
	if err != nil {
		log.Fatal(err)
	}
	if cfg.AutoMigrate {
		if err := db.Migrate(gdb); err != nil {
			log.Fatalf("migrate: %v", err)
		}
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	store, err := storage.New(ctx, cfg)
	if err != nil {
		log.Fatalf("storage: %v", err)
	}
	cat, err := catalog.New(gdb)
	if err != nil {
		log.Fatalf("catalog: %v", err)
	}

	var sms, email otp.Sender = otp.ConsoleSender{Channel: "SMS"}, otp.ConsoleSender{Channel: "EMAIL"}
	if cfg.SMSProvider == "twilio" {
		sms = otp.TwilioSender{AccountSID: cfg.TwilioSID, AuthToken: cfg.TwilioToken, From: cfg.TwilioFrom}
	}
	if cfg.EmailProvider == "smtp" {
		email = otp.SMTPSender{Host: cfg.SMTPHost, Port: cfg.SMTPPort, User: cfg.SMTPUser, Password: cfg.SMTPPass,
			From: cfg.SMTPFrom, Subject: cfg.AppName + " verification code"}
	}
	otpSvc := otp.NewService(gdb, cfg.OTPSecret, otp.Router{SMS: sms, Email: email}, cfg.OTPTTL, cfg.AppName)

	h := handlers.New(gdb, cfg, auth.NewJWT(cfg.JWTSecret, cfg.AccessTTL), otpSvc, store, ws.NewHub(), cat)

	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	if err := r.SetTrustedProxies(cfg.TrustedProxies); err != nil {
		log.Fatalf("trusted proxies: %v", err)
	}
	r.MaxMultipartMemory = 8 << 20

	corsCfg := cors.Config{
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Authorization", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}
	if len(cfg.CORSOrigins) == 1 && cfg.CORSOrigins[0] == "*" {
		corsCfg.AllowAllOrigins = true
	} else {
		corsCfg.AllowOrigins = cfg.CORSOrigins
	}
	r.Use(cors.New(corsCfg))

	if cfg.StorageDriver != "s3" {
		r.Static("/uploads", cfg.UploadDir)
	}
	h.Routes(r)

	go expireListings(ctx, h)

	srv := &http.Server{Addr: ":" + cfg.Port, Handler: r, ReadHeaderTimeout: 10 * time.Second}
	go func() {
		log.Printf("%s API listening on :%s (%s)", cfg.AppName, cfg.Port, cfg.Env)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()

	<-ctx.Done()
	log.Println("shutting down...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}

// expireListings periodically marks listings past their expiry date as expired.
func expireListings(ctx context.Context, h *handlers.Handler) {
	run := func() {
		res := h.DB.Model(&models.Listing{}).
			Where("status = ? AND expires_at IS NOT NULL AND expires_at < ?", models.ListingActive, time.Now()).
			Update("status", models.ListingExpired)
		if res.RowsAffected > 0 {
			log.Printf("expired %d listings", res.RowsAffected)
		}
		h.DB.Where("expires_at < ?", time.Now().Add(-24*time.Hour)).Delete(&models.OTPCode{})
		h.DB.Where("expires_at < ?", time.Now()).Delete(&models.RefreshToken{})
	}
	run()
	t := time.NewTicker(time.Hour)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			run()
		}
	}
}
