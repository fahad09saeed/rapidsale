package otp

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/smtp"
	"net/url"
	"strings"
	"time"
)

// Sender delivers a text message to a phone number or email address.
type Sender interface {
	Send(ctx context.Context, to, message string) error
}

// Router picks the SMS or email sender based on the target.
type Router struct {
	SMS   Sender
	Email Sender
}

func (r Router) Send(ctx context.Context, to, message string) error {
	if strings.Contains(to, "@") {
		return r.Email.Send(ctx, to, message)
	}
	return r.SMS.Send(ctx, to, message)
}

// ConsoleSender logs messages; useful for local development.
type ConsoleSender struct{ Channel string }

func (c ConsoleSender) Send(_ context.Context, to, message string) error {
	log.Printf("[%s -> %s] %s", c.Channel, to, message)
	return nil
}

// TwilioSender sends SMS through the Twilio REST API.
type TwilioSender struct {
	AccountSID, AuthToken, From string
	Client                      *http.Client
}

func (t TwilioSender) Send(ctx context.Context, to, message string) error {
	endpoint := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", t.AccountSID)
	form := url.Values{"To": {to}, "From": {t.From}, "Body": {message}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.SetBasicAuth(t.AccountSID, t.AuthToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	client := t.Client
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return fmt.Errorf("twilio: status %d: %s", resp.StatusCode, body)
	}
	return nil
}

// SMTPSender sends plain-text email (STARTTLS on port 587).
type SMTPSender struct {
	Host, Port, User, Password, From, Subject string
}

func (s SMTPSender) Send(_ context.Context, to, message string) error {
	var auth smtp.Auth
	if s.User != "" {
		auth = smtp.PlainAuth("", s.User, s.Password, s.Host)
	}
	msg := "From: " + s.From + "\r\n" +
		"To: " + to + "\r\n" +
		"Subject: " + s.Subject + "\r\n" +
		"MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n" +
		message + "\r\n"
	return smtp.SendMail(s.Host+":"+s.Port, auth, s.From, []string{to}, []byte(msg))
}
