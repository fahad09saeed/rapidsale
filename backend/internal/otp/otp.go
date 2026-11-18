package otp

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"gorm.io/gorm"

	"rapidsale/backend/internal/models"
)

const (
	PurposeRegister = "register"
	PurposeLogin    = "login"
	PurposeReset    = "reset_password"
	PurposeContact  = "change_contact"
)

var (
	ErrCooldown        = errors.New("please wait a minute before requesting another code")
	ErrTooManyRequests = errors.New("too many codes requested, try again later")
	ErrInvalid         = errors.New("incorrect code")
	ErrExpired         = errors.New("code expired, request a new one")
	ErrTooManyAttempts = errors.New("too many incorrect attempts, request a new code")
	ErrNotFound        = errors.New("no active code, request a new one")
)

type Service struct {
	db          *gorm.DB
	secret      []byte
	sender      Sender
	ttl         time.Duration
	appName     string
	Cooldown    time.Duration
	MaxAttempts int
	HourlyLimit int
}

func NewService(db *gorm.DB, secret string, sender Sender, ttl time.Duration, appName string) *Service {
	return &Service{db: db, secret: []byte(secret), sender: sender, ttl: ttl, appName: appName,
		Cooldown: 60 * time.Second, MaxAttempts: 5, HourlyLimit: 6}
}

func (s *Service) hash(target, purpose, code string) string {
	mac := hmac.New(sha256.New, s.secret)
	mac.Write([]byte(target + "|" + purpose + "|" + code))
	return hex.EncodeToString(mac.Sum(nil))
}

// Send generates, stores and delivers a new code. It returns the plain code so that
// development builds can expose it; callers must not leak it in production.
func (s *Service) Send(ctx context.Context, target, purpose string) (string, error) {
	now := time.Now()

	var last models.OTPCode
	if err := s.db.Where("target = ? AND purpose = ?", target, purpose).Order("id DESC").First(&last).Error; err == nil {
		if now.Sub(last.CreatedAt) < s.Cooldown {
			return "", ErrCooldown
		}
	}
	var recent int64
	s.db.Model(&models.OTPCode{}).Where("target = ? AND created_at > ?", target, now.Add(-time.Hour)).Count(&recent)
	if recent >= int64(s.HourlyLimit) {
		return "", ErrTooManyRequests
	}

	code, err := randomDigits(6)
	if err != nil {
		return "", err
	}
	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.OTPCode{}).
			Where("target = ? AND purpose = ? AND consumed_at IS NULL", target, purpose).
			Update("consumed_at", now).Error; err != nil {
			return err
		}
		return tx.Create(&models.OTPCode{
			Target: target, Purpose: purpose, CodeHash: s.hash(target, purpose, code), ExpiresAt: now.Add(s.ttl),
		}).Error
	})
	if err != nil {
		return "", err
	}

	msg := fmt.Sprintf("%s: your verification code is %s. It expires in %d minutes. Never share this code with anyone.",
		s.appName, code, int(s.ttl.Minutes()))
	if err := s.sender.Send(ctx, target, msg); err != nil {
		return "", fmt.Errorf("deliver otp: %w", err)
	}
	return code, nil
}

// Verify checks a code and consumes it on success.
func (s *Service) Verify(target, purpose, code string) error {
	var rec models.OTPCode
	if err := s.db.Where("target = ? AND purpose = ? AND consumed_at IS NULL", target, purpose).
		Order("id DESC").First(&rec).Error; err != nil {
		return ErrNotFound
	}
	if time.Now().After(rec.ExpiresAt) {
		return ErrExpired
	}
	if rec.Attempts >= s.MaxAttempts {
		return ErrTooManyAttempts
	}
	if !hmac.Equal([]byte(s.hash(target, purpose, strings.TrimSpace(code))), []byte(rec.CodeHash)) {
		s.db.Model(&rec).UpdateColumn("attempts", gorm.Expr("attempts + 1"))
		return ErrInvalid
	}
	res := s.db.Model(&models.OTPCode{}).Where("id = ? AND consumed_at IS NULL", rec.ID).Update("consumed_at", time.Now())
	if res.Error != nil || res.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// IsUserError reports whether the error should be shown to the client as-is.
func IsUserError(err error) bool {
	for _, e := range []error{ErrCooldown, ErrTooManyRequests, ErrInvalid, ErrExpired, ErrTooManyAttempts, ErrNotFound} {
		if errors.Is(err, e) {
			return true
		}
	}
	return false
}

func IsRateLimit(err error) bool {
	return errors.Is(err, ErrCooldown) || errors.Is(err, ErrTooManyRequests)
}

func randomDigits(n int) (string, error) {
	var b strings.Builder
	for i := 0; i < n; i++ {
		d, err := rand.Int(rand.Reader, big.NewInt(10))
		if err != nil {
			return "", err
		}
		b.WriteByte(byte('0' + d.Int64()))
	}
	return b.String(), nil
}
