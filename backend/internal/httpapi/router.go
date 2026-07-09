package httpapi

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"pointproject/backend/internal/models"
	"pointproject/backend/internal/repository"
)

type Server struct {
	store     repository.Store
	jwtSecret []byte
}

func NewRouter(store repository.Store, jwtSecret string, allowedOrigins []string) http.Handler {
	if len(allowedOrigins) == 0 {
		allowedOrigins = []string{"http://localhost:5173"}
	}

	server := &Server{
		store:     store,
		jwtSecret: []byte(jwtSecret),
	}

	r := chi.NewRouter()
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
		r.Post("/registrations", server.createRegistration)
		r.Get("/participants/{teamID}/dashboard", server.participantDashboard)
		r.Post("/participants/{teamID}/submissions", server.createSubmission)

		r.Post("/admin/login", server.adminLogin)
		r.Group(func(r chi.Router) {
			r.Use(server.requireAdmin)
			r.Get("/admin/stats", server.adminStats)
			r.Get("/admin/teams", server.listTeams)
			r.Get("/admin/teams/{teamID}", server.teamDetail)
			r.Patch("/admin/teams/{teamID}/verify", server.verifyTeam)
			r.Patch("/admin/teams/{teamID}/stage-access", server.setTeamStageAccess)
			r.Post("/admin/events", server.createEvent)
			r.Put("/admin/events/{eventID}/timeline", server.replaceTimeline)
			r.Get("/admin/events/{eventID}/rules", server.eventRules)
			r.Put("/admin/events/{eventID}/rules", server.updateEventRules)
			r.Get("/admin/events/{eventID}/submission-stages", server.listSubmissionStages)
			r.Put("/admin/events/{eventID}/submission-stages", server.replaceSubmissionStages)
			r.Get("/admin/events/{eventID}/faqs", server.listAdminFAQs)
			r.Post("/admin/faqs", server.createFAQ)
			r.Put("/admin/faqs/{faqID}", server.updateFAQ)
			r.Delete("/admin/faqs/{faqID}", server.deleteFAQ)
			r.Post("/admin/announcements", server.createAnnouncement)
			r.Get("/admin/users", server.listAdminUsers)
			r.Post("/admin/users", server.createAdminUser)
		})
	})

	return r
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

func (s *Server) createRegistration(w http.ResponseWriter, r *http.Request) {
	var input models.RegistrationRequest
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if strings.TrimSpace(input.Name) == "" || strings.TrimSpace(input.LeaderName) == "" || strings.TrimSpace(input.LeaderEmail) == "" || strings.TrimSpace(input.Institution) == "" {
		writeMessage(w, http.StatusBadRequest, "nama tim, nama ketua, email ketua, dan asal instansi wajib diisi")
		return
	}
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

func (s *Server) createSubmission(w http.ResponseWriter, r *http.Request) {
	var input models.SubmissionRequest
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	submission, err := s.store.CreateSubmission(r.Context(), chi.URLParam(r, "teamID"), input)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeData(w, http.StatusCreated, submission)
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
		next.ServeHTTP(w, r)
	})
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
