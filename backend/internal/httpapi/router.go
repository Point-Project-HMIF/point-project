package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"log"
	"math/big"
	"mime/multipart"
	"net"
	"net/http"
	"net/mail"
	"net/url"
	"path/filepath"
	"runtime/debug"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/golang-jwt/jwt/v5"
	"github.com/resend/resend-go/v3"
	"golang.org/x/crypto/bcrypt"

	"pointproject/backend/internal/instagram"
	"pointproject/backend/internal/models"
	"pointproject/backend/internal/repository"
)

type Server struct {
	store     repository.Store
	jwtSecret []byte
	mailer    registrationMailer
	files     submissionFileStorage
	instagram *instagram.Syncer
}

type registrationMailer interface {
	SendRegistrationOTP(ctx context.Context, to, name, code string) error
}

type resendRegistrationMailer struct {
	client *resend.Client
	from   string
}

type submissionFileStorage interface {
	UploadSubmissionFile(ctx context.Context, team models.Team, stage, field string, header *multipart.FileHeader) (string, error)
	UploadAnnouncementImage(ctx context.Context, header *multipart.FileHeader) (string, error)
	DownloadSubmissionFile(ctx context.Context, key string) (submissionFileDownload, error)
}

type submissionFileDownload struct {
	Body          io.ReadCloser
	ContentType   string
	ContentLength int64
}

type r2SubmissionFileStorage struct {
	client        *s3.Client
	bucket        string
	publicBaseURL string
	objectPrefix  string
}

type contextKey string

const adminRoleContextKey contextKey = "adminRole"
const maxSubmissionUploadBytes int64 = 80 << 20

func newRegistrationMailer(apiKey, from string) registrationMailer {
	apiKey = strings.TrimSpace(apiKey)
	from = strings.TrimSpace(from)
	if apiKey == "" || from == "" {
		return nil
	}
	return &resendRegistrationMailer{
		client: resend.NewClient(apiKey),
		from:   from,
	}
}

func newSubmissionFileStorage(endpoint, bucket, accessKeyID, secretAccessKey, publicBaseURL, objectPrefix string) submissionFileStorage {
	endpoint = strings.TrimSpace(endpoint)
	bucket = strings.TrimSpace(bucket)
	accessKeyID = strings.TrimSpace(accessKeyID)
	secretAccessKey = strings.TrimSpace(secretAccessKey)
	if endpoint == "" || bucket == "" || accessKeyID == "" || secretAccessKey == "" {
		return nil
	}
	cfg := aws.Config{
		Region:      "auto",
		Credentials: credentials.NewStaticCredentialsProvider(accessKeyID, secretAccessKey, ""),
	}
	client := s3.NewFromConfig(cfg, func(options *s3.Options) {
		options.BaseEndpoint = aws.String(endpoint)
		options.UsePathStyle = true
	})
	return &r2SubmissionFileStorage{
		client:        client,
		bucket:        bucket,
		publicBaseURL: strings.TrimRight(strings.TrimSpace(publicBaseURL), "/"),
		objectPrefix:  normalizeObjectPrefix(objectPrefix),
	}
}

func (s *r2SubmissionFileStorage) UploadSubmissionFile(ctx context.Context, team models.Team, stage, field string, header *multipart.FileHeader) (string, error) {
	if header == nil {
		return "", nil
	}
	file, err := header.Open()
	if err != nil {
		return "", err
	}
	defer file.Close()

	teamFolder := slugifyPathPart(team.Name)
	if teamFolder == "" {
		teamFolder = "tim"
	}
	if len(team.ID) >= 8 {
		teamFolder += "-" + team.ID[:8]
	}
	ext := cleanFileExt(header.Filename)
	base := slugifyPathPart(strings.TrimSuffix(header.Filename, filepath.Ext(header.Filename)))
	if base == "" {
		base = field
	}
	key := fmt.Sprintf("submissions/%s/%s/%s-%d-%s%s", teamFolder, slugifyPathPart(stage), slugifyPathPart(field), time.Now().UnixNano(), base, ext)
	if s.objectPrefix != "" {
		key = s.objectPrefix + "/" + key
	}
	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	if _, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        file,
		ContentType: aws.String(contentType),
	}); err != nil {
		return "", err
	}
	if s.publicBaseURL != "" {
		return s.publicBaseURL + "/" + key, nil
	}
	return "/api/files/r2/" + key, nil
}

func (s *r2SubmissionFileStorage) UploadAnnouncementImage(ctx context.Context, header *multipart.FileHeader) (string, error) {
	if header == nil {
		return "", nil
	}
	file, err := header.Open()
	if err != nil {
		return "", err
	}
	defer file.Close()

	ext := cleanFileExt(header.Filename)
	base := slugifyPathPart(strings.TrimSuffix(header.Filename, filepath.Ext(header.Filename)))
	if base == "" {
		base = "pengumuman"
	}
	key := fmt.Sprintf("announcements/%d-%s%s", time.Now().UnixNano(), base, ext)
	if s.objectPrefix != "" {
		key = s.objectPrefix + "/" + key
	}
	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	if _, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        file,
		ContentType: aws.String(contentType),
	}); err != nil {
		return "", err
	}
	if s.publicBaseURL != "" {
		return s.publicBaseURL + "/" + key, nil
	}
	return "/api/files/r2/" + key, nil
}

func (s *r2SubmissionFileStorage) DownloadSubmissionFile(ctx context.Context, key string) (submissionFileDownload, error) {
	key = strings.Trim(strings.TrimSpace(key), "/")
	if key == "" || strings.Contains(key, "..") {
		return submissionFileDownload{}, fmt.Errorf("file tidak valid")
	}
	if s.objectPrefix != "" && key != s.objectPrefix && !strings.HasPrefix(key, s.objectPrefix+"/") {
		return submissionFileDownload{}, fmt.Errorf("file di luar folder upload")
	}
	object, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return submissionFileDownload{}, err
	}
	contentType := aws.ToString(object.ContentType)
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	var contentLength int64
	if object.ContentLength != nil {
		contentLength = *object.ContentLength
	}
	return submissionFileDownload{
		Body:          object.Body,
		ContentType:   contentType,
		ContentLength: contentLength,
	}, nil
}

func cleanFileExt(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	if len(ext) < 2 || len(ext) > 12 {
		return ""
	}
	for _, r := range ext[1:] {
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) {
			return ""
		}
	}
	return ext
}

func normalizeObjectPrefix(value string) string {
	parts := strings.Split(strings.Trim(value, "/ "), "/")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		if slug := slugifyPathPart(part); slug != "" {
			out = append(out, slug)
		}
	}
	return strings.Join(out, "/")
}

func slugifyPathPart(value string) string {
	var builder strings.Builder
	lastDash := false
	for _, r := range strings.ToLower(strings.TrimSpace(value)) {
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			builder.WriteRune(r)
			lastDash = false
		case r == '.' || r == '_':
			builder.WriteRune(r)
			lastDash = false
		case !lastDash && builder.Len() > 0:
			builder.WriteRune('-')
			lastDash = true
		}
	}
	return strings.Trim(builder.String(), "-")
}

func (m *resendRegistrationMailer) SendRegistrationOTP(ctx context.Context, to, name, code string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		name = "Peserta"
	}
	escapedCode := html.EscapeString(code)
	params := &resend.SendEmailRequest{
		From:    m.from,
		To:      []string{to},
		Subject: "Kode OTP Pendaftaran Point Project",
		Text: fmt.Sprintf(
			"Halo %s,\n\nKode verifikasi kamu adalah %s. Kode ini berlaku selama 10 menit dan hanya bisa digunakan sekali.\n\nJangan bagikan kode ini kepada siapa pun. Jika kamu tidak meminta kode ini, abaikan email ini.",
			name,
			code,
		),
		Html: fmt.Sprintf(`
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0; padding:0; background-color:#f4f4f5; font-family: Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5; padding:40px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden;">
            <tr>
              <td style="background-color:#111827; padding:24px 32px;">
                <span style="color:#ffffff; font-size:18px; font-weight:bold;">Point Project</span>
              </td>
            </tr>
            <tr>
              <td style="padding:40px 32px; text-align:center;">
                <h1 style="margin:0 0 12px 0; font-size:20px; color:#111827;">Kode Verifikasi Kamu</h1>
                <p style="margin:0 0 32px 0; font-size:14px; line-height:1.6; color:#6b7280;">
                  Gunakan kode di bawah ini untuk verifikasi akun. Kode berlaku selama 10 menit.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 32px auto;">
                  <tr>
                    <td style="background-color:#f4f4f5; border-radius:8px; padding:16px 32px;">
                      <span style="font-size:32px; font-weight:bold; letter-spacing:8px; color:#111827;">%s</span>
                    </td>
                  </tr>
                </table>
                <p style="margin:0; font-size:13px; line-height:1.5; color:#9ca3af;">
                  Jangan bagikan kode ini kepada siapa pun, termasuk pihak yang mengaku dari tim kami. Jika kamu tidak meminta kode ini, abaikan email ini.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background-color:#f9fafb; padding:20px 32px; text-align:center;">
                <p style="margin:0; font-size:12px; color:#9ca3af;">&copy; Point Project</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
		`, escapedCode),
	}
	_, err := m.client.Emails.SendWithContext(ctx, params)
	return err
}

func NewRouter(
	store repository.Store,
	jwtSecret string,
	allowedOrigins []string,
	resendAPIKey,
	resendFrom,
	r2Endpoint,
	r2Bucket,
	r2AccessKeyID,
	r2SecretAccessKey,
	r2PublicBaseURL,
	r2ObjectPrefix string,
	instagramSyncer *instagram.Syncer,
) http.Handler {
	if len(allowedOrigins) == 0 {
		allowedOrigins = []string{"http://localhost:5173"}
	}

	server := &Server{
		store:     store,
		jwtSecret: []byte(jwtSecret),
		mailer:    newRegistrationMailer(resendAPIKey, resendFrom),
		files:     newSubmissionFileStorage(r2Endpoint, r2Bucket, r2AccessKeyID, r2SecretAccessKey, r2PublicBaseURL, r2ObjectPrefix),
		instagram: instagramSyncer,
	}
	server.startInstagramAutoSync()

	r := chi.NewRouter()
	r.Use(server.recoverPanic)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "time": time.Now().Format(time.RFC3339)})
	})

	r.Route("/api", func(r chi.Router) {
		r.Get("/events", server.listEvents)
		r.Get("/events/active", server.activeEvent)
		r.Get("/events/{eventID}/categories", server.listCategories)
		r.Get("/events/{eventID}/timeline", server.listTimeline)
		r.Get("/events/{eventID}/committee", server.listCommittee)
		r.Get("/events/{eventID}/rules", server.eventRules)
		r.Get("/events/{eventID}/faqs", server.listFAQs)
		r.Get("/events/{eventID}/announcements", server.listAnnouncements)
		r.Get("/files/r2/*", server.downloadR2File)
		r.Post("/registrations/otp", server.requestRegistrationOTP)
		r.Post("/registrations", server.createRegistration)
		r.Get("/participants/{teamID}/dashboard", server.participantDashboard)
		r.Post("/participants/{teamID}/submissions", server.createSubmission)

		r.Post("/admin/login", server.adminLogin)
		r.Group(func(r chi.Router) {
			r.Use(server.requireAdmin)
			r.Get("/admin/stats", server.adminStats)
			r.Get("/admin/teams", server.listTeams)
			r.Get("/admin/teams/{teamID}", server.teamDetail)
			r.Delete("/admin/teams/{teamID}", server.deleteTeam)
			r.Patch("/admin/teams/{teamID}/verify", server.verifyTeam)
			r.Patch("/admin/teams/{teamID}/stage-access", server.setTeamStageAccess)
			r.Post("/admin/events", server.createEvent)
			r.Patch("/admin/events/{eventID}/activate", server.activateEvent)
			r.Patch("/admin/events/{eventID}/lock", server.lockEvent)
			r.Put("/admin/events/{eventID}/timeline", server.replaceTimeline)
			r.Get("/admin/events/{eventID}/rules", server.eventRules)
			r.Put("/admin/events/{eventID}/rules", server.updateEventRules)
			r.Get("/admin/events/{eventID}/submission-stages", server.listSubmissionStages)
			r.Put("/admin/events/{eventID}/submission-stages", server.replaceSubmissionStages)
			r.Get("/admin/events/{eventID}/faqs", server.listAdminFAQs)
			r.Post("/admin/faqs", server.createFAQ)
			r.Put("/admin/faqs/{faqID}", server.updateFAQ)
			r.Delete("/admin/faqs/{faqID}", server.deleteFAQ)
			r.Post("/admin/announcements/image", server.uploadAnnouncementImage)
			r.Post("/admin/announcements", server.createAnnouncement)
			r.Post("/admin/instagram/sync", server.syncInstagramAnnouncements)
			r.Get("/admin/users", server.listAdminUsers)
			r.Post("/admin/users", server.createAdminUser)
		})
	})

	return r
}

func (s *Server) recoverPanic(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				log.Printf("panic while handling %s %s: %v\n%s", r.Method, r.URL.Path, recovered, debug.Stack())
				writeMessage(w, http.StatusInternalServerError, "server error saat memproses request")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func (s *Server) listEvents(w http.ResponseWriter, r *http.Request) {
	events, err := s.store.ListEvents(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeData(w, http.StatusOK, events)
}

func (s *Server) activeEvent(w http.ResponseWriter, r *http.Request) {
	event, err := s.store.ActiveEvent(r.Context())
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	writeData(w, http.StatusOK, event)
}

func (s *Server) startInstagramAutoSync() {
	if s.instagram == nil || !s.instagram.Configured() || s.instagram.Interval() <= 0 {
		return
	}
	go func() {
		timer := time.NewTimer(8 * time.Second)
		defer timer.Stop()
		for {
			<-timer.C
			ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
			result, err := s.instagram.Sync(ctx)
			cancel()
			if err != nil {
				log.Printf("instagram sync failed: %v", err)
			} else {
				log.Printf("instagram sync complete: fetched=%d saved=%d skipped=%d", result.Fetched, result.Saved, result.Skipped)
			}
			timer.Reset(s.instagram.Interval())
		}
	}()
}

func (s *Server) syncInstagramAnnouncements(w http.ResponseWriter, r *http.Request) {
	if s.instagram == nil || !s.instagram.Configured() {
		writeMessage(w, http.StatusServiceUnavailable, "sinkronisasi Instagram belum dikonfigurasi")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 90*time.Second)
	defer cancel()
	result, err := s.instagram.Sync(ctx)
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	writeData(w, http.StatusOK, result)
}

func (s *Server) listCategories(w http.ResponseWriter, r *http.Request) {
	categories, err := s.store.ListCategories(r.Context(), chi.URLParam(r, "eventID"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeData(w, http.StatusOK, categories)
}

func (s *Server) listTimeline(w http.ResponseWriter, r *http.Request) {
	timeline, err := s.store.ListTimeline(r.Context(), chi.URLParam(r, "eventID"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeData(w, http.StatusOK, timeline)
}

func (s *Server) listCommittee(w http.ResponseWriter, r *http.Request) {
	committee, err := s.store.ListCommittee(r.Context(), chi.URLParam(r, "eventID"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeData(w, http.StatusOK, committee)
}

func (s *Server) eventRules(w http.ResponseWriter, r *http.Request) {
	rules, err := s.store.GetEventRules(r.Context(), chi.URLParam(r, "eventID"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeData(w, http.StatusOK, rules)
}

func (s *Server) listFAQs(w http.ResponseWriter, r *http.Request) {
	faqs, err := s.store.ListFAQs(r.Context(), chi.URLParam(r, "eventID"), false)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeData(w, http.StatusOK, faqs)
}

func (s *Server) listAnnouncements(w http.ResponseWriter, r *http.Request) {
	announcements, err := s.store.ListAnnouncements(r.Context(), chi.URLParam(r, "eventID"), r.URL.Query().Get("type"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeData(w, http.StatusOK, announcements)
}

func (s *Server) requestRegistrationOTP(w http.ResponseWriter, r *http.Request) {
	if s.mailer == nil {
		writeMessage(w, http.StatusServiceUnavailable, "layanan email OTP belum dikonfigurasi")
		return
	}
	var input models.RegistrationOTPRequest
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	email, err := normalizeEmail(input.LeaderEmail)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	eventID := strings.TrimSpace(input.EventID)
	if eventID == "" {
		event, err := s.store.ActiveEvent(r.Context())
		if err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		eventID = event.ID
	} else if _, err := s.store.GetEvent(r.Context(), eventID); err != nil {
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
	code, err := generateOTPCode()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	if err := s.store.CreateRegistrationOTP(r.Context(), email, code, clientIP(r), r.UserAgent()); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if err := s.mailer.SendRegistrationOTP(r.Context(), email, input.LeaderName, code); err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	writeData(w, http.StatusOK, models.RegistrationOTPResponse{
		Message:   "Kode OTP dikirim ke email ketua.",
		ExpiresIn: 600,
	})
}

func (s *Server) createRegistration(w http.ResponseWriter, r *http.Request) {
	var input models.RegistrationRequest
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if strings.TrimSpace(input.Name) == "" || strings.TrimSpace(input.LeaderName) == "" || strings.TrimSpace(input.LeaderEmail) == "" || strings.TrimSpace(input.LeaderPhone) == "" || strings.TrimSpace(input.Institution) == "" {
		writeMessage(w, http.StatusBadRequest, "nama tim, nama ketua, email ketua, WhatsApp, dan asal instansi wajib diisi")
		return
	}
	email, err := normalizeEmail(input.LeaderEmail)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	input.LeaderEmail = email
	team, err := s.store.CreateTeam(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeData(w, http.StatusCreated, team)
}

func (s *Server) participantDashboard(w http.ResponseWriter, r *http.Request) {
	dashboard, err := s.store.GetDashboard(r.Context(), chi.URLParam(r, "teamID"))
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	writeData(w, http.StatusOK, dashboard)
}

func (s *Server) downloadR2File(w http.ResponseWriter, r *http.Request) {
	if s.files == nil {
		writeMessage(w, http.StatusServiceUnavailable, "penyimpanan file R2 belum dikonfigurasi")
		return
	}
	key := strings.Trim(chi.URLParam(r, "*"), "/")
	file, err := s.files.DownloadSubmissionFile(r.Context(), key)
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	defer file.Body.Close()

	w.Header().Set("Content-Type", file.ContentType)
	w.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, filepath.Base(key)))
	if file.ContentLength > 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(file.ContentLength, 10))
	}
	if _, err := io.Copy(w, file.Body); err != nil {
		log.Printf("download r2 file %s: %v", key, err)
	}
}

func (s *Server) createSubmission(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
		s.createMultipartSubmission(w, r)
		return
	}
	var input models.SubmissionRequest
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	input.PrototypeURL = strings.TrimSpace(input.PrototypeURL)
	if input.PrototypeURL != "" && !isFigmaPrototypeURL(input.PrototypeURL) {
		writeMessage(w, http.StatusBadRequest, "link prototype harus menggunakan URL Figma yang valid")
		return
	}
	if strings.TrimSpace(input.ProposalURL) == "" && input.PrototypeURL == "" && strings.TrimSpace(input.PPTURL) == "" && strings.TrimSpace(input.ReportURL) == "" && strings.TrimSpace(input.PosterURL) == "" {
		writeMessage(w, http.StatusBadRequest, "isi link Figma prototype atau unggah minimal satu file karya")
		return
	}
	submission, err := s.store.CreateSubmission(r.Context(), chi.URLParam(r, "teamID"), input)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeData(w, http.StatusCreated, submission)
}

func (s *Server) createMultipartSubmission(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxSubmissionUploadBytes)
	if err := r.ParseMultipartForm(maxSubmissionUploadBytes); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	teamID := chi.URLParam(r, "teamID")
	detail, err := s.store.GetTeamDetail(r.Context(), teamID)
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	input := models.SubmissionRequest{
		Stage:        strings.TrimSpace(r.FormValue("stage")),
		PrototypeURL: strings.TrimSpace(r.FormValue("prototypeUrl")),
	}
	if input.PrototypeURL != "" && !isFigmaPrototypeURL(input.PrototypeURL) {
		writeMessage(w, http.StatusBadRequest, "link prototype harus menggunakan URL Figma yang valid")
		return
	}
	permission, err := resolveSubmissionPermission(detail, input.Stage)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if !permission.CanSubmit {
		writeMessage(w, http.StatusBadRequest, permission.Reason)
		return
	}
	input.Stage = permission.Stage.Key
	fileFields := map[string]*string{
		"proposal": &input.ProposalURL,
		"ppt":      &input.PPTURL,
		"report":   &input.ReportURL,
		"poster":   &input.PosterURL,
	}
	for field, target := range fileFields {
		header, err := firstMultipartFile(r, field)
		if err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		if header == nil {
			continue
		}
		if s.files == nil {
			writeMessage(w, http.StatusServiceUnavailable, "penyimpanan file R2 belum dikonfigurasi")
			return
		}
		url, err := s.files.UploadSubmissionFile(r.Context(), detail.Team, input.Stage, field, header)
		if err != nil {
			writeError(w, http.StatusBadGateway, err)
			return
		}
		*target = url
	}
	if input.ProposalURL == "" && input.PrototypeURL == "" && input.PPTURL == "" && input.ReportURL == "" && input.PosterURL == "" {
		writeMessage(w, http.StatusBadRequest, "isi link Figma prototype atau unggah minimal satu file karya")
		return
	}
	submission, err := s.store.CreateSubmission(r.Context(), teamID, input)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeData(w, http.StatusCreated, submission)
}

func resolveSubmissionPermission(detail models.TeamDetail, stageKey string) (models.TeamSubmissionStage, error) {
	if len(detail.SubmissionStages) == 0 {
		return models.TeamSubmissionStage{}, fmt.Errorf("belum ada tahap upload untuk event ini")
	}
	stageKey = strings.TrimSpace(stageKey)
	if stageKey == "" {
		for _, item := range detail.SubmissionStages {
			if item.CanSubmit {
				return item, nil
			}
		}
		return detail.SubmissionStages[0], nil
	}
	for _, item := range detail.SubmissionStages {
		if item.Stage.Key == stageKey || item.Stage.ID == stageKey {
			return item, nil
		}
	}
	return models.TeamSubmissionStage{}, fmt.Errorf("tahap upload tidak ditemukan")
}

func isFigmaPrototypeURL(value string) bool {
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil || parsed.Host == "" {
		return false
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return false
	}
	host := strings.ToLower(parsed.Hostname())
	return host == "figma.com" || strings.HasSuffix(host, ".figma.com")
}

func firstMultipartFile(r *http.Request, field string) (*multipart.FileHeader, error) {
	if r.MultipartForm == nil || r.MultipartForm.File == nil {
		return nil, nil
	}
	files := r.MultipartForm.File[field]
	if len(files) == 0 {
		return nil, nil
	}
	header := files[0]
	if header.Size <= 0 {
		return nil, fmt.Errorf("file %s kosong", field)
	}
	return header, nil
}

func (s *Server) adminLogin(w http.ResponseWriter, r *http.Request) {
	var input models.LoginRequest
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	account, err := s.store.FindAdminByEmail(r.Context(), input.Email)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(account.PasswordHash), []byte(input.Password)) != nil {
		writeMessage(w, http.StatusUnauthorized, "email atau password tidak valid")
		return
	}
	token, err := s.signAdminToken(account.AdminUser)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeData(w, http.StatusOK, models.LoginResponse{Token: token, User: account.AdminUser})
}

func (s *Server) adminStats(w http.ResponseWriter, r *http.Request) {
	stats, err := s.store.AdminStats(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeData(w, http.StatusOK, stats)
}

func (s *Server) listTeams(w http.ResponseWriter, r *http.Request) {
	batch, _ := strconv.Atoi(r.URL.Query().Get("batch"))
	teams, err := s.store.ListTeams(r.Context(), models.TeamFilters{
		EventID: r.URL.Query().Get("eventId"),
		Batch:   batch,
		Status:  r.URL.Query().Get("status"),
		Search:  r.URL.Query().Get("search"),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeData(w, http.StatusOK, teams)
}

func (s *Server) teamDetail(w http.ResponseWriter, r *http.Request) {
	detail, err := s.store.GetTeamDetail(r.Context(), chi.URLParam(r, "teamID"))
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	writeData(w, http.StatusOK, detail)
}

func (s *Server) deleteTeam(w http.ResponseWriter, r *http.Request) {
	if !requireSuperAdmin(w, r) {
		return
	}
	if err := s.store.DeleteTeam(r.Context(), chi.URLParam(r, "teamID")); err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	writeData(w, http.StatusOK, map[string]string{"message": "Tim berhasil dihapus"})
}

func (s *Server) verifyTeam(w http.ResponseWriter, r *http.Request) {
	var input models.VerifyTeamRequest
	_ = decodeJSON(r, &input)
	team, err := s.store.UpdateTeamStatus(r.Context(), chi.URLParam(r, "teamID"), input.Status)
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	writeData(w, http.StatusOK, team)
}

func (s *Server) setTeamStageAccess(w http.ResponseWriter, r *http.Request) {
	var input models.TeamStageAccessRequest
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	detail, err := s.store.SetTeamStageAccess(r.Context(), chi.URLParam(r, "teamID"), input)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeData(w, http.StatusOK, detail)
}

func (s *Server) createEvent(w http.ResponseWriter, r *http.Request) {
	if !requireSuperAdmin(w, r) {
		return
	}
	var input models.CreateEventRequest
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	event, err := s.store.CreateEvent(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeData(w, http.StatusCreated, event)
}

func (s *Server) activateEvent(w http.ResponseWriter, r *http.Request) {
	if !requireSuperAdmin(w, r) {
		return
	}
	event, err := s.store.ActivateEvent(r.Context(), chi.URLParam(r, "eventID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeData(w, http.StatusOK, event)
}

func (s *Server) lockEvent(w http.ResponseWriter, r *http.Request) {
	if !requireSuperAdmin(w, r) {
		return
	}
	event, err := s.store.LockEvent(r.Context(), chi.URLParam(r, "eventID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeData(w, http.StatusOK, event)
}

func (s *Server) replaceTimeline(w http.ResponseWriter, r *http.Request) {
	var input models.ReplaceTimelineRequest
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	items, err := s.store.ReplaceTimeline(r.Context(), chi.URLParam(r, "eventID"), input.Items)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeData(w, http.StatusOK, items)
}

func (s *Server) updateEventRules(w http.ResponseWriter, r *http.Request) {
	var input models.EventRulesRequest
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	rules, err := s.store.UpdateEventRules(r.Context(), chi.URLParam(r, "eventID"), input)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeData(w, http.StatusOK, rules)
}

func (s *Server) listSubmissionStages(w http.ResponseWriter, r *http.Request) {
	stages, err := s.store.ListSubmissionStages(r.Context(), chi.URLParam(r, "eventID"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeData(w, http.StatusOK, stages)
}

func (s *Server) replaceSubmissionStages(w http.ResponseWriter, r *http.Request) {
	var input models.ReplaceSubmissionStagesRequest
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	stages, err := s.store.ReplaceSubmissionStages(r.Context(), chi.URLParam(r, "eventID"), input.Items)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeData(w, http.StatusOK, stages)
}

func (s *Server) listAdminFAQs(w http.ResponseWriter, r *http.Request) {
	faqs, err := s.store.ListFAQs(r.Context(), chi.URLParam(r, "eventID"), true)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeData(w, http.StatusOK, faqs)
}

func (s *Server) createFAQ(w http.ResponseWriter, r *http.Request) {
	var input models.FAQInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	faq, err := s.store.CreateFAQ(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeData(w, http.StatusCreated, faq)
}

func (s *Server) updateFAQ(w http.ResponseWriter, r *http.Request) {
	var input models.FAQInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	faq, err := s.store.UpdateFAQ(r.Context(), chi.URLParam(r, "faqID"), input)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeData(w, http.StatusOK, faq)
}

func (s *Server) deleteFAQ(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteFAQ(r.Context(), chi.URLParam(r, "faqID")); err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	writeData(w, http.StatusOK, map[string]string{"message": "FAQ dihapus"})
}

func (s *Server) createAnnouncement(w http.ResponseWriter, r *http.Request) {
	var input models.CreateAnnouncementRequest
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	announcement, err := s.store.CreateAnnouncement(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeData(w, http.StatusCreated, announcement)
}

func (s *Server) uploadAnnouncementImage(w http.ResponseWriter, r *http.Request) {
	if s.files == nil {
		writeMessage(w, http.StatusServiceUnavailable, "penyimpanan file R2 belum dikonfigurasi")
		return
	}
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	file, header, err := r.FormFile("image")
	if err != nil {
		writeMessage(w, http.StatusBadRequest, "file gambar wajib diunggah")
		return
	}
	_ = file.Close()
	if header.Size > 6<<20 {
		writeMessage(w, http.StatusBadRequest, "ukuran gambar maksimal 6MB")
		return
	}
	if contentType := header.Header.Get("Content-Type"); contentType != "" && !strings.HasPrefix(contentType, "image/") {
		writeMessage(w, http.StatusBadRequest, "file harus berupa gambar")
		return
	}
	url, err := s.files.UploadAnnouncementImage(r.Context(), header)
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	writeData(w, http.StatusCreated, map[string]string{"url": url})
}

func (s *Server) listAdminUsers(w http.ResponseWriter, r *http.Request) {
	users, err := s.store.ListAdminUsers(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeData(w, http.StatusOK, users)
}

func (s *Server) createAdminUser(w http.ResponseWriter, r *http.Request) {
	var input models.CreateAdminUserRequest
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	user, err := s.store.CreateAdminUser(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeData(w, http.StatusCreated, user)
}

func (s *Server) requireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		tokenValue := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
		if tokenValue == "" || tokenValue == header {
			writeMessage(w, http.StatusUnauthorized, "token admin wajib dikirim")
			return
		}

		token, err := jwt.Parse(tokenValue, func(token *jwt.Token) (any, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrTokenSignatureInvalid
			}
			return s.jwtSecret, nil
		})
		if err != nil || !token.Valid {
			writeMessage(w, http.StatusUnauthorized, "token admin tidak valid")
			return
		}
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			writeMessage(w, http.StatusUnauthorized, "token admin tidak valid")
			return
		}
		role, _ := claims["role"].(string)
		ctx := context.WithValue(r.Context(), adminRoleContextKey, role)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func requireSuperAdmin(w http.ResponseWriter, r *http.Request) bool {
	if role, _ := r.Context().Value(adminRoleContextKey).(string); role == "super_admin" {
		return true
	}
	writeMessage(w, http.StatusForbidden, "hanya super admin yang dapat mengelola event")
	return false
}

func normalizeEmail(value string) (string, error) {
	email := strings.ToLower(strings.TrimSpace(value))
	if email == "" {
		return "", fmt.Errorf("email wajib diisi")
	}
	address, err := mail.ParseAddress(email)
	if err != nil || strings.ToLower(address.Address) != email {
		return "", fmt.Errorf("format email tidak valid")
	}
	return email, nil
}

func clientIP(r *http.Request) string {
	for _, header := range []string{"CF-Connecting-IP", "X-Real-IP", "X-Forwarded-For"} {
		value := strings.TrimSpace(r.Header.Get(header))
		if value == "" {
			continue
		}
		if header == "X-Forwarded-For" {
			value = strings.TrimSpace(strings.Split(value, ",")[0])
		}
		if ip := net.ParseIP(value); ip != nil {
			return ip.String()
		}
	}
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil {
		if ip := net.ParseIP(host); ip != nil {
			return ip.String()
		}
	}
	if ip := net.ParseIP(strings.TrimSpace(r.RemoteAddr)); ip != nil {
		return ip.String()
	}
	return ""
}

func generateOTPCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func (s *Server) signAdminToken(user models.AdminUser) (string, error) {
	claims := jwt.MapClaims{
		"sub":   user.ID,
		"email": user.Email,
		"role":  user.Role,
		"exp":   time.Now().Add(12 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

func decodeJSON(r *http.Request, dst any) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(dst)
}

func writeData(w http.ResponseWriter, status int, data any) {
	writeJSON(w, status, map[string]any{"data": data})
}

func writeMessage(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]any{"error": message})
}

func writeError(w http.ResponseWriter, status int, err error) {
	writeMessage(w, status, err.Error())
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
