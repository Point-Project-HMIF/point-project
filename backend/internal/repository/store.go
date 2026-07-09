package repository

import (
	"context"

	"pointproject/backend/internal/models"
)

type Store interface {
	ListEvents(ctx context.Context) ([]models.Event, error)
	ActiveEvent(ctx context.Context) (models.Event, error)
	GetEvent(ctx context.Context, eventID string) (models.Event, error)
	ListCategories(ctx context.Context, eventID string) ([]models.Category, error)
	GetCategory(ctx context.Context, categoryID string) (models.Category, error)
	ListTimeline(ctx context.Context, eventID string) ([]models.TimelineItem, error)
	ReplaceTimeline(ctx context.Context, eventID string, items []models.TimelineItemInput) ([]models.TimelineItem, error)
	ListCommittee(ctx context.Context, eventID string) ([]models.CommitteeMember, error)
	GetEventRules(ctx context.Context, eventID string) (models.EventRules, error)
	UpdateEventRules(ctx context.Context, eventID string, input models.EventRulesRequest) (models.EventRules, error)
	ListSubmissionStages(ctx context.Context, eventID string) ([]models.SubmissionStage, error)
	ReplaceSubmissionStages(ctx context.Context, eventID string, items []models.SubmissionStageInput) ([]models.SubmissionStage, error)
	SetTeamStageAccess(ctx context.Context, teamID string, input models.TeamStageAccessRequest) (models.TeamDetail, error)
	ListFAQs(ctx context.Context, eventID string, includeHidden bool) ([]models.FAQ, error)
	CreateFAQ(ctx context.Context, input models.FAQInput) (models.FAQ, error)
	UpdateFAQ(ctx context.Context, faqID string, input models.FAQInput) (models.FAQ, error)
	DeleteFAQ(ctx context.Context, faqID string) error
	ListAnnouncements(ctx context.Context, eventID, kind string) ([]models.Announcement, error)
	CreateTeam(ctx context.Context, input models.RegistrationRequest) (models.Team, error)
	GetDashboard(ctx context.Context, teamID string) (models.Dashboard, error)
	GetTeamDetail(ctx context.Context, teamID string) (models.TeamDetail, error)
	CreateSubmission(ctx context.Context, teamID string, input models.SubmissionRequest) (models.Submission, error)
	FindAdminByEmail(ctx context.Context, email string) (models.AdminAccount, error)
	ListAdminUsers(ctx context.Context) ([]models.AdminUser, error)
	CreateAdminUser(ctx context.Context, input models.CreateAdminUserRequest) (models.AdminUser, error)
	AdminStats(ctx context.Context) (models.AdminStats, error)
	ListTeams(ctx context.Context, filters models.TeamFilters) ([]models.Team, error)
	UpdateTeamStatus(ctx context.Context, teamID, status string) (models.Team, error)
	CreateEvent(ctx context.Context, input models.CreateEventRequest) (models.Event, error)
	CreateAnnouncement(ctx context.Context, input models.CreateAnnouncementRequest) (models.Announcement, error)
}
