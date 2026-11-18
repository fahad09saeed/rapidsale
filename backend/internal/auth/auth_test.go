package auth

import (
	"testing"
	"time"
)

func TestNormalizePhone(t *testing.T) {
	cases := map[string]string{
		"03001234567":     "+923001234567",
		"0300-1234567":    "+923001234567",
		"3001234567":      "+923001234567",
		"923001234567":    "+923001234567",
		"00923001234567":  "+923001234567",
		"+92 300 1234567": "+923001234567",
		"+14155552671":    "+14155552671",
	}
	for in, want := range cases {
		got, err := NormalizePhone(in)
		if err != nil || got != want {
			t.Errorf("NormalizePhone(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	for _, bad := range []string{"", "abc", "123", "+0300"} {
		if _, err := NormalizePhone(bad); err == nil {
			t.Errorf("NormalizePhone(%q) expected error", bad)
		}
	}
}

func TestNormalizeTarget(t *testing.T) {
	v, kind, err := NormalizeTarget("  Ali@Example.COM ")
	if err != nil || kind != KindEmail || v != "ali@example.com" {
		t.Fatalf("got %q %q %v", v, kind, err)
	}
	v, kind, err = NormalizeTarget("03001234567")
	if err != nil || kind != KindPhone || v != "+923001234567" {
		t.Fatalf("got %q %q %v", v, kind, err)
	}
}

func TestJWTRoundTrip(t *testing.T) {
	m := NewJWT("test-secret", time.Minute)
	tok, _, err := m.Issue(42, "user")
	if err != nil {
		t.Fatal(err)
	}
	c, err := m.Parse(tok)
	if err != nil || c.UserID != 42 || c.Role != "user" {
		t.Fatalf("parse: %+v %v", c, err)
	}
	if _, err := NewJWT("other-secret", time.Minute).Parse(tok); err == nil {
		t.Fatal("token signed with another secret must be rejected")
	}
	expired, _, _ := NewJWT("test-secret", -time.Minute).Issue(1, "user")
	if _, err := m.Parse(expired); err == nil {
		t.Fatal("expired token must be rejected")
	}
}

func TestPassword(t *testing.T) {
	h, err := HashPassword("Secret123!")
	if err != nil || !CheckPassword(h, "Secret123!") || CheckPassword(h, "wrong") {
		t.Fatal("password hashing broken")
	}
}
