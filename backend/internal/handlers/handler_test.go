package handlers

import "testing"

func TestFulltextQuery(t *testing.T) {
	cases := map[string]string{
		"iphone 15 pro":        "+iphone* +pro*",
		"honda civic":          "+honda* +civic*",
		"a b":                  "",
		`x"); DROP TABLE x;--`: "+DROP* +TABLE*",
	}
	for in, want := range cases {
		if got := fulltextQuery(in); got != want {
			t.Errorf("fulltextQuery(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestSlugify(t *testing.T) {
	if got := slugify("Shops - Offices - Commercial Space"); got != "shops-offices-commercial-space" {
		t.Fatal(got)
	}
}

func TestAttrKeyRegex(t *testing.T) {
	for _, ok := range []string{"brand", "km_driven", "year2"} {
		if !attrKeyRe.MatchString(ok) {
			t.Errorf("%q should be valid", ok)
		}
	}
	for _, bad := range []string{"", "a.b", "x')", "Brand", "a b"} {
		if attrKeyRe.MatchString(bad) {
			t.Errorf("%q should be rejected", bad)
		}
	}
}
