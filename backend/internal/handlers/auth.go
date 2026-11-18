package handlers

import (
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"rapidsale/backend/internal/auth"
	"rapidsale/backend/internal/models"
	"rapidsale/backend/internal/otp"
)

// dummyHash is compared against when a user does not exist to keep timing uniform.
var dummyHash, _ = auth.HashPassword("timing-equalizer-password")

func (h *Handler) sendOTP(c *gin.Context, target, purpose, message string) {
	code, err := h.OTP.Send(c.Request.Context(), target, purpose)
	if err != nil {
		h.otpError(c, err)
		return
	}
	resp := gin.H{"message": message, "target": target, "purpose": purpose}
	if h.Cfg.OTPDebug {
		resp["dev_code"] = code
	}
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) otpError(c *gin.Context, err error) {
	switch {
	case otp.IsRateLimit(err):
		fail(c, http.StatusTooManyRequests, err.Error())
	case otp.IsUserError(err):
		fail(c, http.StatusBadRequest, err.Error())
	default:
		log.Printf("otp delivery failed: %v", err)
		fail(c, http.StatusBadGateway, "could not send the verification code, please try again")
	}
}

func (h *Handler) userByTarget(target, kind string) (*models.User, error) {
	var u models.User
	col := "phone"
	if kind == auth.KindEmail {
		col = "email"
	}
	if err := h.DB.Preload("Role.Permissions").Where(col+" = ?", target).First(&u).Error; err != nil {
		return nil, err
	}
	return &u, nil
}

func (h *Handler) userRole() (*models.Role, error) {
	var r models.Role
	err := h.DB.Where("name = ?", models.RoleUser).First(&r).Error
	return &r, err
}

func (h *Handler) issueTokens(c *gin.Context, user *models.User) {
	if err := h.DB.Preload("Role.Permissions").First(user, user.ID).Error; err != nil {
		serverError(c, err)
		return
	}
	access, exp, err := h.JWT.Issue(user.ID, user.Role.Name)
	if err != nil {
		serverError(c, err)
		return
	}
	refresh := auth.RandomToken(32)
	rt := models.RefreshToken{
		UserID: user.ID, TokenHash: auth.SHA256Hex(refresh), ExpiresAt: time.Now().Add(h.Cfg.RefreshTTL),
		UserAgent: truncate(c.Request.UserAgent(), 255), IP: c.ClientIP(),
	}
	if err := h.DB.Create(&rt).Error; err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"access_token": access, "refresh_token": refresh, "expires_at": exp, "user": newMeView(user),
	})
}

// ---------- registration ----------

type registerReq struct {
	Name     string `json:"name" binding:"required,min=2,max=120"`
	Email    string `json:"email" binding:"omitempty,max=191"`
	Phone    string `json:"phone" binding:"omitempty,max=20"`
	Password string `json:"password" binding:"required,min=8,max=72"`
}

func (h *Handler) Register(c *gin.Context) {
	var req registerReq
	if !bind(c, &req) {
		return
	}
	if req.Email == "" && req.Phone == "" {
		fail(c, http.StatusBadRequest, "phone number or email is required")
		return
	}
	var email, phone *string
	conds, args := "", []any{}
	if req.Email != "" {
		e, err := auth.NormalizeEmail(req.Email)
		if err != nil {
			fail(c, http.StatusBadRequest, err.Error())
			return
		}
		email = &e
		conds, args = "email = ?", append(args, e)
	}
	if req.Phone != "" {
		p, err := auth.NormalizePhone(req.Phone)
		if err != nil {
			fail(c, http.StatusBadRequest, "invalid phone number, use format 03XXXXXXXXX")
			return
		}
		phone = &p
		if conds != "" {
			conds += " OR "
		}
		conds += "phone = ?"
		args = append(args, p)
	}

	var matches []models.User
	if err := h.DB.Where(conds, args...).Find(&matches).Error; err != nil {
		serverError(c, err)
		return
	}
	for _, m := range matches {
		if m.Status != models.UserPending {
			fail(c, http.StatusConflict, "an account with this phone number or email already exists")
			return
		}
	}
	if len(matches) > 1 {
		fail(c, http.StatusConflict, "this phone number and email belong to different pending accounts")
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		serverError(c, err)
		return
	}
	if len(matches) == 1 {
		// Re-registration of an unverified account: refresh its details.
		u := matches[0]
		err = h.DB.Model(&u).Updates(map[string]any{
			"name": req.Name, "email": email, "phone": phone, "password_hash": hash,
		}).Error
	} else {
		role, rerr := h.userRole()
		if rerr != nil {
			serverError(c, errors.New("default role missing: run the seeder"))
			return
		}
		err = h.DB.Create(&models.User{
			Name: req.Name, Email: email, Phone: phone, PasswordHash: hash, RoleID: role.ID, Status: models.UserPending,
		}).Error
	}
	if err != nil {
		serverError(c, err)
		return
	}

	target := ""
	if phone != nil {
		target = *phone
	} else {
		target = *email
	}
	h.sendOTP(c, target, otp.PurposeRegister, "verification code sent")
}

type verifyReq struct {
	Target string `json:"target" binding:"required"`
	Code   string `json:"code" binding:"required,len=6,numeric"`
}

func (h *Handler) VerifyRegistration(c *gin.Context) {
	var req verifyReq
	if !bind(c, &req) {
		return
	}
	target, kind, err := auth.NormalizeTarget(req.Target)
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.OTP.Verify(target, otp.PurposeRegister, req.Code); err != nil {
		h.otpError(c, err)
		return
	}
	user, err := h.userByTarget(target, kind)
	if err != nil {
		fail(c, http.StatusNotFound, "account not found")
		return
	}
	if user.Status == models.UserBanned {
		fail(c, http.StatusForbidden, "your account has been suspended")
		return
	}
	now := time.Now()
	updates := map[string]any{"status": models.UserActive}
	if kind == auth.KindPhone {
		updates["phone_verified_at"] = now
	} else {
		updates["email_verified_at"] = now
	}
	if err := h.DB.Model(user).Updates(updates).Error; err != nil {
		serverError(c, err)
		return
	}
	h.issueTokens(c, user)
}

type targetReq struct {
	Target  string `json:"target" binding:"required"`
	Purpose string `json:"purpose" binding:"omitempty,oneof=register login reset_password"`
}

// ResendOTP re-sends a code for registration, login or password reset.
func (h *Handler) ResendOTP(c *gin.Context) {
	var req targetReq
	if !bind(c, &req) {
		return
	}
	if req.Purpose == "" {
		req.Purpose = otp.PurposeRegister
	}
	target, kind, err := auth.NormalizeTarget(req.Target)
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	user, err := h.userByTarget(target, kind)
	if err != nil {
		if req.Purpose == otp.PurposeReset { // avoid account enumeration
			c.JSON(http.StatusOK, gin.H{"message": "if the account exists, a code has been sent", "target": target})
			return
		}
		fail(c, http.StatusNotFound, "no account found with this phone number or email")
		return
	}
	switch req.Purpose {
	case otp.PurposeRegister:
		if user.Status != models.UserPending {
			fail(c, http.StatusBadRequest, "this account is already verified, please log in")
			return
		}
	default:
		if user.Status != models.UserActive {
			fail(c, http.StatusForbidden, "this account cannot sign in")
			return
		}
	}
	h.sendOTP(c, target, req.Purpose, "verification code sent")
}

// ---------- login ----------

type loginReq struct {
	Identifier string `json:"identifier" binding:"required"`
	Password   string `json:"password" binding:"required"`
}

func (h *Handler) Login(c *gin.Context) {
	var req loginReq
	if !bind(c, &req) {
		return
	}
	target, kind, err := auth.NormalizeTarget(req.Identifier)
	var user *models.User
	if err == nil {
		user, err = h.userByTarget(target, kind)
	}
	if err != nil || user == nil {
		auth.CheckPassword(dummyHash, req.Password)
		fail(c, http.StatusUnauthorized, "incorrect phone/email or password")
		return
	}
	if !auth.CheckPassword(user.PasswordHash, req.Password) {
		fail(c, http.StatusUnauthorized, "incorrect phone/email or password")
		return
	}
	switch user.Status {
	case models.UserPending:
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"error": "please verify your account first", "code": "unverified", "target": target,
		})
		return
	case models.UserBanned:
		fail(c, http.StatusForbidden, "your account has been suspended")
		return
	}
	h.issueTokens(c, user)
}

// RequestLoginOTP starts a password-less login.
func (h *Handler) RequestLoginOTP(c *gin.Context) {
	var req targetReq
	if !bind(c, &req) {
		return
	}
	target, kind, err := auth.NormalizeTarget(req.Target)
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	user, err := h.userByTarget(target, kind)
	if err != nil {
		fail(c, http.StatusNotFound, "no account found, please register first")
		return
	}
	if user.Status != models.UserActive {
		fail(c, http.StatusForbidden, "this account cannot sign in")
		return
	}
	h.sendOTP(c, target, otp.PurposeLogin, "login code sent")
}

func (h *Handler) VerifyLoginOTP(c *gin.Context) {
	var req verifyReq
	if !bind(c, &req) {
		return
	}
	target, kind, err := auth.NormalizeTarget(req.Target)
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.OTP.Verify(target, otp.PurposeLogin, req.Code); err != nil {
		h.otpError(c, err)
		return
	}
	user, err := h.userByTarget(target, kind)
	if err != nil || user.Status != models.UserActive {
		fail(c, http.StatusForbidden, "this account cannot sign in")
		return
	}
	h.issueTokens(c, user)
}

// ---------- password reset ----------

func (h *Handler) ForgotPassword(c *gin.Context) {
	var req targetReq
	if !bind(c, &req) {
		return
	}
	target, kind, err := auth.NormalizeTarget(req.Target)
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	user, err := h.userByTarget(target, kind)
	if err != nil || user.Status == models.UserBanned {
		c.JSON(http.StatusOK, gin.H{"message": "if the account exists, a code has been sent", "target": target})
		return
	}
	h.sendOTP(c, target, otp.PurposeReset, "if the account exists, a code has been sent")
}

type resetReq struct {
	Target   string `json:"target" binding:"required"`
	Code     string `json:"code" binding:"required,len=6,numeric"`
	Password string `json:"password" binding:"required,min=8,max=72"`
}

func (h *Handler) ResetPassword(c *gin.Context) {
	var req resetReq
	if !bind(c, &req) {
		return
	}
	target, kind, err := auth.NormalizeTarget(req.Target)
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.OTP.Verify(target, otp.PurposeReset, req.Code); err != nil {
		h.otpError(c, err)
		return
	}
	user, err := h.userByTarget(target, kind)
	if err != nil {
		fail(c, http.StatusNotFound, "account not found")
		return
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		serverError(c, err)
		return
	}
	now := time.Now()
	err = h.DB.Transaction(func(tx *gorm.DB) error {
		updates := map[string]any{"password_hash": hash}
		// Receiving the code proves ownership of the contact, so a pending account becomes verified.
		if user.Status == models.UserPending {
			updates["status"] = models.UserActive
			if kind == auth.KindPhone {
				updates["phone_verified_at"] = now
			} else {
				updates["email_verified_at"] = now
			}
		}
		if err := tx.Model(user).Updates(updates).Error; err != nil {
			return err
		}
		return tx.Model(&models.RefreshToken{}).Where("user_id = ? AND revoked_at IS NULL", user.ID).
			Update("revoked_at", now).Error
	})
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "password updated, please log in"})
}

// ---------- tokens ----------

type refreshReq struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

func (h *Handler) Refresh(c *gin.Context) {
	var req refreshReq
	if !bind(c, &req) {
		return
	}
	var rt models.RefreshToken
	if err := h.DB.Where("token_hash = ?", auth.SHA256Hex(req.RefreshToken)).First(&rt).Error; err != nil {
		fail(c, http.StatusUnauthorized, "invalid session, please log in again")
		return
	}
	if rt.RevokedAt != nil {
		// Reuse of a rotated token suggests theft: revoke all sessions of this user.
		h.DB.Model(&models.RefreshToken{}).Where("user_id = ? AND revoked_at IS NULL", rt.UserID).Update("revoked_at", time.Now())
		fail(c, http.StatusUnauthorized, "session expired, please log in again")
		return
	}
	if time.Now().After(rt.ExpiresAt) {
		fail(c, http.StatusUnauthorized, "session expired, please log in again")
		return
	}
	res := h.DB.Model(&models.RefreshToken{}).Where("id = ? AND revoked_at IS NULL", rt.ID).Update("revoked_at", time.Now())
	if res.Error != nil || res.RowsAffected == 0 {
		fail(c, http.StatusUnauthorized, "session expired, please log in again")
		return
	}
	var user models.User
	if err := h.DB.First(&user, rt.UserID).Error; err != nil || user.Status != models.UserActive {
		fail(c, http.StatusUnauthorized, "account unavailable")
		return
	}
	h.issueTokens(c, &user)
}

func (h *Handler) Logout(c *gin.Context) {
	var req refreshReq
	if err := c.ShouldBindJSON(&req); err == nil {
		h.DB.Model(&models.RefreshToken{}).Where("token_hash = ? AND revoked_at IS NULL", auth.SHA256Hex(req.RefreshToken)).
			Update("revoked_at", time.Now())
	}
	c.JSON(http.StatusOK, gin.H{"message": "logged out"})
}

func (h *Handler) Me(c *gin.Context) {
	c.JSON(http.StatusOK, newMeView(currentUser(c)))
}
