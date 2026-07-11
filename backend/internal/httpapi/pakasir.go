package httpapi

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"net/url"
	"strings"
	"time"

	"pointproject/backend/internal/models"
)

type pakasirClient struct {
	slug   string
	apiKey string
	amount int
	http   *http.Client
}

type pakasirPaymentEnvelope struct {
	Payment pakasirPayment `json:"payment"`
}

type pakasirTransactionEnvelope struct {
	Transaction pakasirTransaction `json:"transaction"`
}

type pakasirPayment struct {
	Project       string `json:"project"`
	OrderID       string `json:"order_id"`
	Amount        int    `json:"amount"`
	Fee           int    `json:"fee"`
	TotalPayment  int    `json:"total_payment"`
	PaymentMethod string `json:"payment_method"`
	PaymentNumber string `json:"payment_number"`
	ExpiredAt     string `json:"expired_at"`
}

type pakasirTransaction struct {
	Project       string `json:"project"`
	OrderID       string `json:"order_id"`
	Amount        int    `json:"amount"`
	Status        string `json:"status"`
	PaymentMethod string `json:"payment_method"`
	CompletedAt   string `json:"completed_at"`
}

func newPakasirClient(slug, apiKey string, amount int) *pakasirClient {
	return &pakasirClient{
		slug:   strings.TrimSpace(slug),
		apiKey: strings.TrimSpace(apiKey),
		amount: amount,
		http:   &http.Client{Timeout: 18 * time.Second},
	}
}

func (c *pakasirClient) Configured() bool {
	return c != nil && c.slug != "" && c.apiKey != "" && c.amount > 0
}

func (c *pakasirClient) PaymentURL(orderID string) string {
	query := url.Values{}
	query.Set("order_id", orderID)
	query.Set("qris_only", "1")
	return fmt.Sprintf("https://app.pakasir.com/pay/%s/%d?%s", url.PathEscape(c.slug), c.amount, query.Encode())
}

func (c *pakasirClient) CreateQRIS(ctx context.Context, orderID string) (pakasirPayment, error) {
	payload := map[string]any{
		"project":  c.slug,
		"order_id": orderID,
		"amount":   c.amount,
		"api_key":  c.apiKey,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return pakasirPayment{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://app.pakasir.com/api/transactioncreate/qris", bytes.NewReader(body))
	if err != nil {
		return pakasirPayment{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return pakasirPayment{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return pakasirPayment{}, fmt.Errorf("Pakasir gagal membuat QRIS (%d)", resp.StatusCode)
	}
	var envelope pakasirPaymentEnvelope
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		return pakasirPayment{}, err
	}
	if envelope.Payment.OrderID == "" || envelope.Payment.PaymentNumber == "" {
		return pakasirPayment{}, errors.New("response Pakasir tidak berisi QRIS")
	}
	return envelope.Payment, nil
}

func (c *pakasirClient) Detail(ctx context.Context, orderID string, amount int) (pakasirTransaction, error) {
	query := url.Values{}
	query.Set("project", c.slug)
	query.Set("amount", fmt.Sprintf("%d", amount))
	query.Set("order_id", orderID)
	query.Set("api_key", c.apiKey)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://app.pakasir.com/api/transactiondetail?"+query.Encode(), nil)
	if err != nil {
		return pakasirTransaction{}, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return pakasirTransaction{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return pakasirTransaction{}, fmt.Errorf("Pakasir gagal mengecek pembayaran (%d)", resp.StatusCode)
	}
	var envelope pakasirTransactionEnvelope
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		return pakasirTransaction{}, err
	}
	if envelope.Transaction.OrderID == "" {
		return pakasirTransaction{}, errors.New("response status Pakasir tidak valid")
	}
	return envelope.Transaction, nil
}

func (s *Server) createRegistrationPayment(w http.ResponseWriter, r *http.Request) {
	if s.pakasir == nil || !s.pakasir.Configured() {
		writeMessage(w, http.StatusServiceUnavailable, "Pakasir belum dikonfigurasi. Isi PAKASIR_SLUG, PAKASIR_API_KEY, dan PAKASIR_AMOUNT.")
		return
	}
	var input models.RegistrationPaymentRequest
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	email, err := normalizeEmail(input.LeaderEmail)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if strings.TrimSpace(input.TeamName) == "" || strings.TrimSpace(input.LeaderName) == "" {
		writeMessage(w, http.StatusBadRequest, "nama tim dan nama ketua wajib diisi sebelum pembayaran")
		return
	}
	eventID, err := s.resolveRegistrationEventID(r.Context(), input.EventID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	exists, err := s.store.ParticipantEmailExists(r.Context(), eventID, email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	if exists {
		writeMessage(w, http.StatusConflict, "email ini sudah terdaftar sebagai peserta pada event ini")
		return
	}
	orderID, err := generatePakasirOrderID()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	pakasirPayment, err := s.pakasir.CreateQRIS(r.Context(), orderID)
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	amount := pakasirPayment.Amount
	if amount <= 0 {
		amount = s.pakasir.amount
	}
	totalPayment := pakasirPayment.TotalPayment
	if totalPayment <= 0 {
		totalPayment = amount + pakasirPayment.Fee
	}
	payment, err := s.store.SaveRegistrationPayment(r.Context(), models.RegistrationPayment{
		OrderID:       orderID,
		EventID:       eventID,
		LeaderEmail:   email,
		TeamName:      input.TeamName,
		Amount:        amount,
		Fee:           pakasirPayment.Fee,
		TotalPayment:  totalPayment,
		PaymentMethod: "qris",
		PaymentNumber: pakasirPayment.PaymentNumber,
		PaymentURL:    s.pakasir.PaymentURL(orderID),
		Status:        "pending",
		ExpiredAt:     pakasirPayment.ExpiredAt,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeData(w, http.StatusCreated, payment)
}

func (s *Server) checkRegistrationPayment(w http.ResponseWriter, r *http.Request) {
	if s.pakasir == nil || !s.pakasir.Configured() {
		writeMessage(w, http.StatusServiceUnavailable, "Pakasir belum dikonfigurasi")
		return
	}
	var input models.RegistrationPaymentCheckRequest
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	email, err := normalizeEmail(input.LeaderEmail)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	localPayment, err := s.store.GetRegistrationPayment(r.Context(), input.OrderID)
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	eventID, err := s.resolveRegistrationEventID(r.Context(), input.EventID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if localPayment.EventID != eventID || !strings.EqualFold(localPayment.LeaderEmail, email) {
		writeMessage(w, http.StatusBadRequest, "order pembayaran tidak cocok dengan email atau event")
		return
	}
	transaction, err := s.pakasir.Detail(r.Context(), localPayment.OrderID, localPayment.Amount)
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	status := normalizePakasirStatus(transaction.Status)
	completedAt := ""
	if status == "completed" {
		completedAt = transaction.CompletedAt
	}
	updated, err := s.store.UpdateRegistrationPaymentStatus(r.Context(), models.RegistrationPayment{
		OrderID:       localPayment.OrderID,
		Status:        status,
		PaymentMethod: transaction.PaymentMethod,
		CompletedAt:   completedAt,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeData(w, http.StatusOK, updated)
}

func (s *Server) resolveRegistrationEventID(ctx context.Context, eventID string) (string, error) {
	eventID = strings.TrimSpace(eventID)
	if eventID == "" {
		event, err := s.store.ActiveEvent(ctx)
		if err != nil {
			return "", err
		}
		return event.ID, nil
	}
	if _, err := s.store.GetEvent(ctx, eventID); err != nil {
		return "", err
	}
	return eventID, nil
}

func generatePakasirOrderID() (string, error) {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	var suffix strings.Builder
	for i := 0; i < 8; i++ {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))
		if err != nil {
			return "", err
		}
		suffix.WriteByte(alphabet[n.Int64()])
	}
	return "PP" + time.Now().Format("060102150405") + suffix.String(), nil
}

func normalizePakasirStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "completed", "paid", "success":
		return "completed"
	case "expired":
		return "expired"
	case "cancelled", "canceled":
		return "cancelled"
	case "failed":
		return "failed"
	default:
		return "pending"
	}
}
