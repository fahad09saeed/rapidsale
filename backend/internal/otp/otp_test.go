package otp

import "testing"

func TestRandomDigits(t *testing.T) {
	for i := 0; i < 100; i++ {
		c, err := randomDigits(6)
		if err != nil || len(c) != 6 {
			t.Fatalf("bad code %q %v", c, err)
		}
		for _, r := range c {
			if r < '0' || r > '9' {
				t.Fatalf("non-digit in %q", c)
			}
		}
	}
}

func TestHashBindsTargetAndPurpose(t *testing.T) {
	s := &Service{secret: []byte("k")}
	if s.hash("+923001234567", PurposeLogin, "123456") == s.hash("+923001234567", PurposeReset, "123456") {
		t.Fatal("codes for different purposes must not collide")
	}
}
