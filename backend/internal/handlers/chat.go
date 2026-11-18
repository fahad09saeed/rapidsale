package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"gorm.io/gorm"

	"rapidsale/backend/internal/models"
	"rapidsale/backend/internal/ws"
)

type listingMini struct {
	ID     uint64 `json:"id"`
	Title  string `json:"title"`
	Price  int64  `json:"price"`
	Status string `json:"status"`
	Image  string `json:"image"`
}

type conversationView struct {
	ID            uint64            `json:"id"`
	Listing       *listingMini      `json:"listing"`
	OtherUser     models.PublicUser `json:"other_user"`
	Role          string            `json:"role"` // buying | selling
	LastMessage   string            `json:"last_message"`
	LastMessageAt *time.Time        `json:"last_message_at"`
	Unread        int               `json:"unread"`
	CreatedAt     time.Time         `json:"created_at"`
}

func (h *Handler) convView(cv *models.Conversation, me uint64) conversationView {
	v := conversationView{ID: cv.ID, LastMessage: cv.LastMessage, LastMessageAt: cv.LastMessageAt, CreatedAt: cv.CreatedAt}
	if cv.BuyerID == me {
		v.Role, v.Unread = "buying", cv.BuyerUnread
		if cv.Seller != nil {
			v.OtherUser = cv.Seller.Public()
		}
	} else {
		v.Role, v.Unread = "selling", cv.SellerUnread
		if cv.Buyer != nil {
			v.OtherUser = cv.Buyer.Public()
		}
	}
	v.OtherUser.Online = h.Hub.IsOnline(v.OtherUser.ID)
	if l := cv.Listing; l != nil {
		v.Listing = &listingMini{ID: l.ID, Title: l.Title, Price: l.Price, Status: l.Status}
		if len(l.Images) > 0 {
			v.Listing.Image = l.Images[0].URL
		}
		if l.DeletedAt.Valid {
			v.Listing.Status = "deleted"
		}
	}
	return v
}

func (h *Handler) convQuery() *gorm.DB {
	return h.DB.Preload("Listing", func(db *gorm.DB) *gorm.DB { return db.Unscoped() }).
		Preload("Listing.Images", orderImages).Preload("Buyer").Preload("Seller")
}

// loadConversation loads a conversation the current user participates in.
func (h *Handler) loadConversation(c *gin.Context) (*models.Conversation, bool) {
	id, ok := paramID(c, "id")
	if !ok {
		return nil, false
	}
	me := currentUser(c).ID
	var cv models.Conversation
	if err := h.convQuery().Where("buyer_id = ? OR seller_id = ?", me, me).First(&cv, id).Error; err != nil {
		fail(c, http.StatusNotFound, "conversation not found")
		return nil, false
	}
	return &cv, true
}

func (h *Handler) ListConversations(c *gin.Context) {
	me := currentUser(c).ID
	q := h.convQuery().Where("buyer_id = ? OR seller_id = ?", me, me)
	switch c.Query("role") {
	case "buying":
		q = h.convQuery().Where("buyer_id = ?", me)
	case "selling":
		q = h.convQuery().Where("seller_id = ?", me)
	}
	var convs []models.Conversation
	if err := q.Where("last_message_at IS NOT NULL").Order("last_message_at DESC").Limit(200).Find(&convs).Error; err != nil {
		serverError(c, err)
		return
	}
	out := make([]conversationView, len(convs))
	for i := range convs {
		out[i] = h.convView(&convs[i], me)
	}
	c.JSON(http.StatusOK, out)
}

func (h *Handler) GetConversation(c *gin.Context) {
	cv, ok := h.loadConversation(c)
	if !ok {
		return
	}
	c.JSON(http.StatusOK, h.convView(cv, currentUser(c).ID))
}

func (h *Handler) UnreadCount(c *gin.Context) {
	me := currentUser(c).ID
	var total struct{ N int64 }
	h.DB.Model(&models.Conversation{}).
		Select("COALESCE(SUM(CASE WHEN buyer_id = ? THEN buyer_unread ELSE seller_unread END),0) AS n", me).
		Where("buyer_id = ? OR seller_id = ?", me, me).Scan(&total)
	c.JSON(http.StatusOK, gin.H{"unread": total.N})
}

type startConvReq struct {
	ListingID uint64 `json:"listing_id" binding:"required"`
	Body      string `json:"body" binding:"required,min=1,max=2000"`
}

// StartConversation opens (or reuses) a chat with a listing's seller and sends the first message.
func (h *Handler) StartConversation(c *gin.Context) {
	u := currentUser(c)
	var req startConvReq
	if !bind(c, &req) {
		return
	}
	var l models.Listing
	if err := h.DB.First(&l, req.ListingID).Error; err != nil || l.Status != models.ListingActive {
		fail(c, http.StatusNotFound, "this listing is not available")
		return
	}
	if l.UserID == u.ID {
		fail(c, http.StatusBadRequest, "you cannot message yourself")
		return
	}
	cv := models.Conversation{ListingID: l.ID, BuyerID: u.ID, SellerID: l.UserID}
	if err := h.DB.Where("listing_id = ? AND buyer_id = ?", l.ID, u.ID).FirstOrCreate(&cv).Error; err != nil {
		serverError(c, err)
		return
	}
	msg, err := h.postMessage(&cv, u.ID, req.Body, "")
	if err != nil {
		serverError(c, err)
		return
	}
	h.convQuery().First(&cv, cv.ID)
	c.JSON(http.StatusCreated, gin.H{"conversation": h.convView(&cv, u.ID), "message": msg})
}

func (h *Handler) ListMessages(c *gin.Context) {
	cv, ok := h.loadConversation(c)
	if !ok {
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if limit < 1 || limit > 100 {
		limit = 50
	}
	q := h.DB.Where("conversation_id = ?", cv.ID)
	if before, err := strconv.ParseUint(c.Query("before_id"), 10, 64); err == nil {
		q = q.Where("id < ?", before)
	}
	var msgs []models.Message
	if err := q.Order("id DESC").Limit(limit).Find(&msgs).Error; err != nil {
		serverError(c, err)
		return
	}
	for i, j := 0, len(msgs)-1; i < j; i, j = i+1, j-1 {
		msgs[i], msgs[j] = msgs[j], msgs[i]
	}
	c.JSON(http.StatusOK, gin.H{"items": msgs, "has_more": len(msgs) == limit})
}

type sendMsgReq struct {
	Body     string `json:"body" binding:"max=2000"`
	ImageURL string `json:"image_url" binding:"max=500"`
}

func (h *Handler) SendMessage(c *gin.Context) {
	cv, ok := h.loadConversation(c)
	if !ok {
		return
	}
	var req sendMsgReq
	if !bind(c, &req) {
		return
	}
	if strings.TrimSpace(req.Body) == "" && req.ImageURL == "" {
		fail(c, http.StatusBadRequest, "message cannot be empty")
		return
	}
	msg, err := h.postMessage(cv, currentUser(c).ID, req.Body, req.ImageURL)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, msg)
}

// postMessage stores a message, bumps unread counters and pushes realtime events.
func (h *Handler) postMessage(cv *models.Conversation, senderID uint64, body, image string) (*models.Message, error) {
	body = strings.TrimSpace(body)
	msg := models.Message{ConversationID: cv.ID, SenderID: senderID, Body: body, ImageURL: image}
	preview := body
	if preview == "" {
		preview = "📷 Photo"
	}
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&msg).Error; err != nil {
			return err
		}
		counter := "seller_unread"
		if senderID == cv.SellerID {
			counter = "buyer_unread"
		}
		return tx.Model(&models.Conversation{}).Where("id = ?", cv.ID).Updates(map[string]any{
			"last_message":    truncate(preview, 500),
			"last_message_at": msg.CreatedAt,
			counter:           gorm.Expr(counter + " + 1"),
		}).Error
	})
	if err != nil {
		return nil, err
	}
	recipient := cv.BuyerID
	if senderID == cv.BuyerID {
		recipient = cv.SellerID
	}
	ev := ws.Event{Type: "message", Data: msg}
	h.Hub.SendToUser(recipient, ev)
	h.Hub.SendToUser(senderID, ev)
	return &msg, nil
}

func (h *Handler) MarkRead(c *gin.Context) {
	cv, ok := h.loadConversation(c)
	if !ok {
		return
	}
	me := currentUser(c).ID
	counter, other := "buyer_unread", cv.SellerID
	if me == cv.SellerID {
		counter, other = "seller_unread", cv.BuyerID
	}
	now := time.Now()
	h.DB.Model(&models.Conversation{}).Where("id = ?", cv.ID).UpdateColumn(counter, 0)
	h.DB.Model(&models.Message{}).Where("conversation_id = ? AND sender_id <> ? AND read_at IS NULL", cv.ID, me).
		Update("read_at", now)
	h.Hub.SendToUser(other, ws.Event{Type: "read", Data: gin.H{"conversation_id": cv.ID, "read_at": now}})
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// ---------- websocket ----------

func (h *Handler) upgrader() websocket.Upgrader {
	return websocket.Upgrader{
		ReadBufferSize: 1024, WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			if origin == "" { // native mobile clients
				return true
			}
			for _, o := range h.Cfg.CORSOrigins {
				if o == "*" || strings.EqualFold(o, origin) {
					return true
				}
			}
			return false
		},
	}
}

// WebSocket authenticates with ?token=<access token> (browsers cannot set headers on WS).
func (h *Handler) WebSocket(c *gin.Context) {
	claims, err := h.JWT.Parse(c.Query("token"))
	if err != nil {
		fail(c, http.StatusUnauthorized, "invalid token")
		return
	}
	var u models.User
	if err := h.DB.Select("id", "status").First(&u, claims.UserID).Error; err != nil || u.Status != models.UserActive {
		fail(c, http.StatusUnauthorized, "invalid token")
		return
	}
	up := h.upgrader()
	conn, err := up.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	h.Hub.Serve(conn, u.ID)
}

type wsInbound struct {
	Type           string `json:"type"`
	ConversationID uint64 `json:"conversation_id"`
}

// handleWSMessage relays typing indicators to the other participant.
func (h *Handler) handleWSMessage(client *ws.Client, raw []byte) {
	var in wsInbound
	if json.Unmarshal(raw, &in) != nil || in.Type != "typing" || in.ConversationID == 0 {
		return
	}
	var cv models.Conversation
	if err := h.DB.Select("id", "buyer_id", "seller_id").
		Where("buyer_id = ? OR seller_id = ?", client.UserID, client.UserID).First(&cv, in.ConversationID).Error; err != nil {
		return
	}
	other := cv.BuyerID
	if other == client.UserID {
		other = cv.SellerID
	}
	h.Hub.SendToUser(other, ws.Event{Type: "typing", Data: gin.H{"conversation_id": cv.ID, "user_id": client.UserID}})
}
