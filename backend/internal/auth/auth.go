package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/mail"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

const issuer = "rapidsale"

type JWTManager struct {
	secret []byte
	ttl    time.Duration
}

type Claims struct {
	UserID uint64 `json:"uid"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func NewJWT(secret string, ttl time.Duration) *JWTManager {
	return &JWTManager{secret: []byte(secret), ttl: ttl}
}

func (m *JWTManager) Issue(userID uint64, role string) (string, time.Time, error) {
	now := time.Now()
	exp := now.Add(m.ttl)
	claims := Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.FormatUint(userID, 10),
			Issuer:    issuer,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
		},
	}
	tok, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(m.secret)
	return tok, exp, err
}

func (m *JWTManager) Parse(token string) (*Claims, error) {
	claims := &Claims{}
	_, err := jwt.ParseWithClaims(token, claims, func(*jwt.Token) (any, error) { return m.secret, nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}), jwt.WithIssuer(issuer))
	if err != nil {
		return nil, err
	}
	return claims, nil
}

func HashPassword(p string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(p), 12)
	return string(b), err
}

func CheckPassword(hash, p string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(p)) == nil
}

// RandomToken returns a hex string of n random bytes.
func RandomToken(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}

func SHA256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

var (
	e164        = regexp.MustCompile(`^\+[1-9]\d{7,14}$`)
	phoneStrip  = strings.NewReplacer(" ", "", "-", "", "(", "", ")", "", ".", "")
	ErrBadPhone = errors.New("invalid phone number")
	ErrBadEmail = errors.New("invalid email address")
)

// NormalizePhone converts common Pakistani formats (03xx..., 92..., 0092...) to E.164.
func NormalizePhone(p string) (string, error) {
	p = phoneStrip.Replace(strings.TrimSpace(p))
	switch {
	case strings.HasPrefix(p, "00"):
		p = "+" + p[2:]
	case strings.HasPrefix(p, "03") && len(p) == 11:
		p = "+92" + p[1:]
	case strings.HasPrefix(p, "3") && len(p) == 10:
		p = "+92" + p
	case strings.HasPrefix(p, "92") && len(p) == 12:
		p = "+" + p
	}
	if !e164.MatchString(p) {
		return "", ErrBadPhone
	}
	return p, nil
}

func NormalizeEmail(e string) (string, error) {
	e = strings.ToLower(strings.TrimSpace(e))
	a, err := mail.ParseAddress(e)
	if err != nil || a.Address != e {
		return "", ErrBadEmail
	}
	return e, nil
}

// Target kinds.
const (
	KindEmail = "email"
	KindPhone = "phone"
)

// NormalizeTarget normalizes an identifier that is either an email or a phone number.
func NormalizeTarget(t string) (value, kind string, err error) {
	if strings.Contains(t, "@") {
		v, err := NormalizeEmail(t)
		return v, KindEmail, err
	}
	v, err := NormalizePhone(t)
	return v, KindPhone, err
}
