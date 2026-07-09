package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"pointproject/backend/internal/models"
)

type PostgresStore struct {
	db *pgxpool.Pool
}

func NewPostgresStore(db *pgxpool.Pool) *PostgresStore {
	return &PostgresStore{db: db}
}

func (s *PostgresStore) ListEvents(ctx context.Context) ([]models.Event, error) {
	rows, err := s.db.Query(ctx, `
		select id::text, name, theme, year,
		       to_char(starts_at, 'YYYY-MM-DD'),
		       to_char(ends_at, 'YYYY-MM-DD'),
		       status
		from events
		order by year desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	events := make([]models.Event, 0)
	for rows.Next() {
		var event models.Event
		if err := rows.Scan(&event.ID, &event.Name, &event.Theme, &event.Year, &event.StartDate, &event.EndDate, &event.Status); err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	return events, rows.Err()
}

func (s *PostgresStore) ActiveEvent(ctx context.Context) (models.Event, error) {
	event, err := s.scanEvent(ctx, `
		select id::text, name, theme, year,
		       to_char(starts_at, 'YYYY-MM-DD'),
		       to_char(ends_at, 'YYYY-MM-DD'),
		       status
		from events
		order by case when status = 'aktif' then 0 else 1 end, year desc
		limit 1
	`)
	if err != nil {
		return models.Event{}, err
	}
	return event, nil
}

func (s *PostgresStore) GetEvent(ctx context.Context, eventID string) (models.Event, error) {
	return s.scanEvent(ctx, `
		select id::text, name, theme, year,
		       to_char(starts_at, 'YYYY-MM-DD'),
		       to_char(ends_at, 'YYYY-MM-DD'),
		       status
		from events
		where id = $1
	`, eventID)
}

func (s *PostgresStore) scanEvent(ctx context.Context, query string, args ...any) (models.Event, error) {
	var event models.Event
	if err := s.db.QueryRow(ctx, query, args...).Scan(
		&event.ID,
		&event.Name,
		&event.Theme,
		&event.Year,
		&event.StartDate,
		&event.EndDate,
		&event.Status,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return models.Event{}, errors.New("event not found")
		}
		return models.Event{}, err
	}
	return event, nil
}

func (s *PostgresStore) ListCategories(ctx context.Context, eventID string) ([]models.Category, error) {
	rows, err := s.db.Query(ctx, `
		select id::text, event_id::text, name, description, requirements
		from categories
		where event_id = $1
		order by name
	`, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := make([]models.Category, 0)
	for rows.Next() {
		category, err := scanCategory(rows)
		if err != nil {
			return nil, err
		}
		categories = append(categories, category)
	}
	return categories, rows.Err()
}

func (s *PostgresStore) GetCategory(ctx context.Context, categoryID string) (models.Category, error) {
	row := s.db.QueryRow(ctx, `
		select id::text, event_id::text, name, description, requirements
		from categories
		where id = $1
	`, categoryID)
	category, err := scanCategory(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Category{}, errors.New("category not found")
	}
	return category, err
}

type categoryScanner interface {
	Scan(dest ...any) error
}

func scanCategory(row categoryScanner) (models.Category, error) {
	var category models.Category
	var raw []byte
	if err := row.Scan(&category.ID, &category.EventID, &category.Name, &category.Description, &raw); err != nil {
		return models.Category{}, err
	}
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &category.Requirements)
	}
	return category, nil
}

func (s *PostgresStore) ListTimeline(ctx context.Context, eventID string) ([]models.TimelineItem, error) {
	rows, err := s.db.Query(ctx, `
		select id::text, event_id::text, label,
		       to_char(starts_at, 'YYYY-MM-DD'),
		       to_char(ends_at, 'YYYY-MM-DD'),
		       description, sort_order
		from timeline_items
		where event_id = $1
		order by sort_order
	`, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.TimelineItem, 0)
	for rows.Next() {
		var item models.TimelineItem
		if err := rows.Scan(&item.ID, &item.EventID, &item.Label, &item.StartDate, &item.EndDate, &item.Description, &item.SortOrder); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *PostgresStore) ReplaceTimeline(ctx context.Context, eventID string, items []models.TimelineItemInput) ([]models.TimelineItem, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `delete from timeline_items where event_id = $1`, eventID); err != nil {
		return nil, err
	}

	for index, item := range items {
		sortOrder := item.SortOrder
		if sortOrder == 0 {
			sortOrder = index + 1
		}
		if strings.TrimSpace(item.Label) == "" {
			return nil, errors.New("label jadwal wajib diisi")
		}
		if strings.TrimSpace(item.StartDate) == "" || strings.TrimSpace(item.EndDate) == "" {
			return nil, errors.New("tanggal mulai dan selesai jadwal wajib diisi")
		}
		if _, err := tx.Exec(ctx, `
			insert into timeline_items (event_id, label, starts_at, ends_at, description, sort_order)
			values ($1, $2, $3, $4, $5, $6)
		`,
			eventID,
			strings.TrimSpace(item.Label),
			strings.TrimSpace(item.StartDate),
			strings.TrimSpace(item.EndDate),
			strings.TrimSpace(item.Description),
			sortOrder,
		); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.ListTimeline(ctx, eventID)
}

func (s *PostgresStore) ListCommittee(ctx context.Context, eventID string) ([]models.CommitteeMember, error) {
	rows, err := s.db.Query(ctx, `
		select id::text, event_id::text, name, identity, position, division
		from committee_members
		where event_id = $1
		order by division, position
	`, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	members := make([]models.CommitteeMember, 0)
	for rows.Next() {
		var member models.CommitteeMember
		if err := rows.Scan(&member.ID, &member.EventID, &member.Name, &member.Identity, &member.Position, &member.Division); err != nil {
			return nil, err
		}
		members = append(members, member)
	}
	return members, rows.Err()
}

func (s *PostgresStore) GetEventRules(ctx context.Context, eventID string) (models.EventRules, error) {
	var rules models.EventRules
	err := s.db.QueryRow(ctx, `
		select event_id::text, min_team_members, max_team_members
		from event_rules
		where event_id = $1
	`, eventID).Scan(&rules.EventID, &rules.MinTeamMembers, &rules.MaxTeamMembers)
	if errors.Is(err, pgx.ErrNoRows) {
		return s.UpdateEventRules(ctx, eventID, models.EventRulesRequest{MinTeamMembers: 2, MaxTeamMembers: 3})
	}
	if err != nil {
		return models.EventRules{}, err
	}
	return rules, nil
}

func (s *PostgresStore) UpdateEventRules(ctx context.Context, eventID string, input models.EventRulesRequest) (models.EventRules, error) {
	if input.MinTeamMembers == 0 {
		input.MinTeamMembers = 2
	}
	if input.MaxTeamMembers == 0 {
		input.MaxTeamMembers = 3
	}
	if input.MinTeamMembers < 1 {
		return models.EventRules{}, errors.New("minimal anggota tim paling sedikit 1")
	}
	if input.MaxTeamMembers < input.MinTeamMembers {
		return models.EventRules{}, errors.New("maksimal anggota tim tidak boleh lebih kecil dari minimal")
	}

	var rules models.EventRules
	if err := s.db.QueryRow(ctx, `
		insert into event_rules (event_id, min_team_members, max_team_members)
		values ($1, $2, $3)
		on conflict (event_id) do update
		set min_team_members = excluded.min_team_members,
		    max_team_members = excluded.max_team_members,
		    updated_at = now()
		returning event_id::text, min_team_members, max_team_members
	`, eventID, input.MinTeamMembers, input.MaxTeamMembers).Scan(
		&rules.EventID,
		&rules.MinTeamMembers,
		&rules.MaxTeamMembers,
	); err != nil {
		return models.EventRules{}, err
	}
	return rules, nil
}

func (s *PostgresStore) ListSubmissionStages(ctx context.Context, eventID string) ([]models.SubmissionStage, error) {
	rows, err := s.db.Query(ctx, `
		select id::text, event_id::text, key, label, sort_order, is_open, requires_approval
		from submission_stages
		where event_id = $1
		order by sort_order, created_at
	`, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stages := make([]models.SubmissionStage, 0)
	for rows.Next() {
		stage, err := scanSubmissionStage(rows)
		if err != nil {
			return nil, err
		}
		stages = append(stages, stage)
	}
	return stages, rows.Err()
}

func (s *PostgresStore) ReplaceSubmissionStages(ctx context.Context, eventID string, items []models.SubmissionStageInput) ([]models.SubmissionStage, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `delete from submission_stages where event_id = $1`, eventID); err != nil {
		return nil, err
	}

	for index, item := range items {
		key := submissionStageKey(item.Key, item.Label)
		if key == "" {
			return nil, errors.New("nama tahap upload wajib diisi")
		}
		label := strings.TrimSpace(item.Label)
		if label == "" {
			label = key
		}
		sortOrder := item.SortOrder
		if sortOrder == 0 {
			sortOrder = index + 1
		}
		if _, err := tx.Exec(ctx, `
			insert into submission_stages (event_id, key, label, sort_order, is_open, requires_approval)
			values ($1, $2, $3, $4, $5, $6)
		`, eventID, key, label, sortOrder, item.IsOpen, item.RequiresApproval); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.ListSubmissionStages(ctx, eventID)
}

func (s *PostgresStore) SetTeamStageAccess(ctx context.Context, teamID string, input models.TeamStageAccessRequest) (models.TeamDetail, error) {
	team, err := s.getTeam(ctx, teamID)
	if err != nil {
		return models.TeamDetail{}, err
	}
	if strings.TrimSpace(input.StageID) == "" {
		return models.TeamDetail{}, errors.New("tahap upload wajib dipilih")
	}

	result, err := s.db.Exec(ctx, `
		insert into team_stage_access (team_id, stage_id, is_allowed)
		select $1, id, $3
		from submission_stages
		where id = $2 and event_id = $4
		on conflict (team_id, stage_id) do update
		set is_allowed = excluded.is_allowed,
		    updated_at = now()
	`, teamID, input.StageID, input.IsAllowed, team.EventID)
	if err != nil {
		return models.TeamDetail{}, err
	}
	if result.RowsAffected() == 0 {
		return models.TeamDetail{}, errors.New("tahap upload tidak ditemukan untuk event tim")
	}
	return s.GetTeamDetail(ctx, teamID)
}

func scanSubmissionStage(row interface{ Scan(dest ...any) error }) (models.SubmissionStage, error) {
	var stage models.SubmissionStage
	if err := row.Scan(
		&stage.ID,
		&stage.EventID,
		&stage.Key,
		&stage.Label,
		&stage.SortOrder,
		&stage.IsOpen,
		&stage.RequiresApproval,
	); err != nil {
		return models.SubmissionStage{}, err
	}
	return stage, nil
}

func (s *PostgresStore) ListFAQs(ctx context.Context, eventID string, includeHidden bool) ([]models.FAQ, error) {
	query := `
		select id::text, event_id::text, question, answer, sort_order, is_published
		from faqs
		where event_id = $1
	`
	if !includeHidden {
		query += " and is_published = true"
	}
	query += " order by sort_order, created_at"

	rows, err := s.db.Query(ctx, query, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	faqs := make([]models.FAQ, 0)
	for rows.Next() {
		faq, err := scanFAQ(rows)
		if err != nil {
			return nil, err
		}
		faqs = append(faqs, faq)
	}
	return faqs, rows.Err()
}

func (s *PostgresStore) CreateFAQ(ctx context.Context, input models.FAQInput) (models.FAQ, error) {
	if strings.TrimSpace(input.EventID) == "" {
		return models.FAQ{}, errors.New("event FAQ wajib dipilih")
	}
	if strings.TrimSpace(input.Question) == "" {
		return models.FAQ{}, errors.New("pertanyaan FAQ wajib diisi")
	}
	row := s.db.QueryRow(ctx, `
		insert into faqs (event_id, question, answer, sort_order, is_published)
		values ($1, $2, $3, $4, $5)
		returning id::text, event_id::text, question, answer, sort_order, is_published
	`,
		strings.TrimSpace(input.EventID),
		strings.TrimSpace(input.Question),
		strings.TrimSpace(input.Answer),
		input.SortOrder,
		input.IsPublished,
	)
	return scanFAQ(row)
}

func (s *PostgresStore) UpdateFAQ(ctx context.Context, faqID string, input models.FAQInput) (models.FAQ, error) {
	if strings.TrimSpace(input.Question) == "" {
		return models.FAQ{}, errors.New("pertanyaan FAQ wajib diisi")
	}
	row := s.db.QueryRow(ctx, `
		update faqs
		set question = $2,
		    answer = $3,
		    sort_order = $4,
		    is_published = $5,
		    updated_at = now()
		where id = $1
		returning id::text, event_id::text, question, answer, sort_order, is_published
	`,
		faqID,
		strings.TrimSpace(input.Question),
		strings.TrimSpace(input.Answer),
		input.SortOrder,
		input.IsPublished,
	)
	faq, err := scanFAQ(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.FAQ{}, errors.New("FAQ not found")
	}
	return faq, err
}

func (s *PostgresStore) DeleteFAQ(ctx context.Context, faqID string) error {
	result, err := s.db.Exec(ctx, `delete from faqs where id = $1`, faqID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return errors.New("FAQ not found")
	}
	return nil
}

func scanFAQ(row interface{ Scan(dest ...any) error }) (models.FAQ, error) {
	var faq models.FAQ
	if err := row.Scan(&faq.ID, &faq.EventID, &faq.Question, &faq.Answer, &faq.SortOrder, &faq.IsPublished); err != nil {
		return models.FAQ{}, err
	}
	return faq, nil
}

func (s *PostgresStore) ListAnnouncements(ctx context.Context, eventID, kind string) ([]models.Announcement, error) {
	query := `
		select id::text, event_id::text, type, title, body,
		       to_char(published_at, 'YYYY-MM-DD'),
		       results
		from announcements
		where event_id = $1
	`
	args := []any{eventID}
	if kind != "" {
		args = append(args, kind)
		query += " and type = $2"
	}
	query += " order by published_at desc"

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	announcements := make([]models.Announcement, 0)
	for rows.Next() {
		announcement, err := scanAnnouncement(rows)
		if err != nil {
			return nil, err
		}
		announcements = append(announcements, announcement)
	}
	return announcements, rows.Err()
}

func scanAnnouncement(row interface{ Scan(dest ...any) error }) (models.Announcement, error) {
	var announcement models.Announcement
	var raw []byte
	if err := row.Scan(
		&announcement.ID,
		&announcement.EventID,
		&announcement.Type,
		&announcement.Title,
		&announcement.Body,
		&announcement.PublishedAt,
		&raw,
	); err != nil {
		return models.Announcement{}, err
	}
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &announcement.Results)
	}
	if announcement.Results == nil {
		announcement.Results = []models.AnnouncementResult{}
	}
	return announcement, nil
}

func (s *PostgresStore) CreateTeam(ctx context.Context, input models.RegistrationRequest) (models.Team, error) {
	eventID := input.EventID
	if eventID == "" {
		event, err := s.ActiveEvent(ctx)
		if err != nil {
			return models.Team{}, err
		}
		eventID = event.ID
	}

	categoryID := input.CategoryID
	if categoryID == "" {
		categories, err := s.ListCategories(ctx, eventID)
		if err != nil {
			return models.Team{}, err
		}
		if len(categories) == 0 {
			return models.Team{}, errors.New("category not found")
		}
		categoryID = categories[0].ID
	}
	category, err := s.GetCategory(ctx, categoryID)
	if err != nil {
		return models.Team{}, err
	}

	rules, err := s.GetEventRules(ctx, eventID)
	if err != nil {
		return models.Team{}, err
	}
	input.Members = normalizeTeamMembers(input)
	memberCount := len(input.Members)
	if memberCount < rules.MinTeamMembers || memberCount > rules.MaxTeamMembers {
		return models.Team{}, fmt.Errorf(
			"jumlah anggota tim harus %d-%d orang termasuk ketua",
			rules.MinTeamMembers,
			rules.MaxTeamMembers,
		)
	}

	members, err := json.Marshal(input.Members)
	if err != nil {
		return models.Team{}, err
	}
	if input.Batch == 0 {
		input.Batch = 1
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return models.Team{}, err
	}
	defer tx.Rollback(ctx)

	var team models.Team
	var created time.Time
	if err := tx.QueryRow(ctx, `
		insert into teams (
			event_id, category_id, name, batch, leader_name, leader_email,
			leader_phone, institution, members, verification_status
		)
		values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
		returning id::text, event_id::text, category_id::text, name, batch,
		          leader_name, leader_email, leader_phone, institution,
		          verification_status, created_at
	`,
		eventID,
		categoryID,
		strings.TrimSpace(input.Name),
		input.Batch,
		strings.TrimSpace(input.LeaderName),
		strings.TrimSpace(input.LeaderEmail),
		strings.TrimSpace(input.LeaderPhone),
		strings.TrimSpace(input.Institution),
		members,
	).Scan(
		&team.ID,
		&team.EventID,
		&team.CategoryID,
		&team.Name,
		&team.Batch,
		&team.LeaderName,
		&team.LeaderEmail,
		&team.LeaderPhone,
		&team.Institution,
		&team.VerificationStatus,
		&created,
	); err != nil {
		return models.Team{}, err
	}

	team.CategoryName = category.Name
	team.Members = input.Members
	team.CreatedAt = created.Format(time.RFC3339)

	if input.ProposalURL != "" || input.PrototypeURL != "" {
		stageKey, err := s.firstSubmissionStageKey(ctx, eventID)
		if err != nil {
			return models.Team{}, err
		}
		if _, err := tx.Exec(ctx, `
			insert into submissions (team_id, stage, proposal_url, prototype_url, status)
			values ($1, $2, $3, $4, 'submitted')
		`, team.ID, stageKey, strings.TrimSpace(input.ProposalURL), strings.TrimSpace(input.PrototypeURL)); err != nil {
			return models.Team{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return models.Team{}, err
	}
	return team, nil
}

func (s *PostgresStore) GetDashboard(ctx context.Context, teamID string) (models.Dashboard, error) {
	team, err := s.getTeam(ctx, teamID)
	if err != nil {
		return models.Dashboard{}, err
	}
	event, err := s.GetEvent(ctx, team.EventID)
	if err != nil {
		return models.Dashboard{}, err
	}
	category, err := s.GetCategory(ctx, team.CategoryID)
	if err != nil {
		return models.Dashboard{}, err
	}
	submissions, err := s.listSubmissions(ctx, teamID)
	if err != nil {
		return models.Dashboard{}, err
	}
	announcements, err := s.ListAnnouncements(ctx, team.EventID, "")
	if err != nil {
		return models.Dashboard{}, err
	}
	rules, err := s.GetEventRules(ctx, team.EventID)
	if err != nil {
		return models.Dashboard{}, err
	}
	stages, err := s.teamSubmissionStages(ctx, team)
	if err != nil {
		return models.Dashboard{}, err
	}

	return models.Dashboard{
		Event:            event,
		Category:         category,
		Team:             team,
		Submissions:      submissions,
		Announcements:    announcements,
		Rules:            rules,
		SubmissionStages: stages,
	}, nil
}

func (s *PostgresStore) GetTeamDetail(ctx context.Context, teamID string) (models.TeamDetail, error) {
	team, err := s.getTeam(ctx, teamID)
	if err != nil {
		return models.TeamDetail{}, err
	}
	event, err := s.GetEvent(ctx, team.EventID)
	if err != nil {
		return models.TeamDetail{}, err
	}
	category, err := s.GetCategory(ctx, team.CategoryID)
	if err != nil {
		return models.TeamDetail{}, err
	}
	submissions, err := s.listSubmissions(ctx, teamID)
	if err != nil {
		return models.TeamDetail{}, err
	}
	stages, err := s.teamSubmissionStages(ctx, team)
	if err != nil {
		return models.TeamDetail{}, err
	}
	return models.TeamDetail{
		Event:            event,
		Category:         category,
		Team:             team,
		Submissions:      submissions,
		SubmissionStages: stages,
	}, nil
}

func (s *PostgresStore) getTeam(ctx context.Context, teamID string) (models.Team, error) {
	row := s.db.QueryRow(ctx, `
		select t.id::text, t.event_id::text, t.category_id::text, c.name,
		       t.name, t.batch, t.leader_name, t.leader_email, t.leader_phone,
		       t.institution, t.members, t.verification_status, t.created_at
		from teams t
		join categories c on c.id = t.category_id
		where t.id = $1
	`, teamID)

	team, err := scanTeam(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Team{}, errors.New("team not found")
	}
	return team, err
}

func scanTeam(row interface{ Scan(dest ...any) error }) (models.Team, error) {
	var team models.Team
	var raw []byte
	var created time.Time
	if err := row.Scan(
		&team.ID,
		&team.EventID,
		&team.CategoryID,
		&team.CategoryName,
		&team.Name,
		&team.Batch,
		&team.LeaderName,
		&team.LeaderEmail,
		&team.LeaderPhone,
		&team.Institution,
		&raw,
		&team.VerificationStatus,
		&created,
	); err != nil {
		return models.Team{}, err
	}
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &team.Members)
	}
	if team.Members == nil {
		team.Members = []models.TeamMember{}
	}
	team.Members = ensureLeaderMember(team)
	team.CreatedAt = created.Format(time.RFC3339)
	return team, nil
}

func normalizeTeamMembers(input models.RegistrationRequest) []models.TeamMember {
	team := models.Team{
		LeaderName:  strings.TrimSpace(input.LeaderName),
		LeaderEmail: strings.TrimSpace(input.LeaderEmail),
		Members:     cleanTeamMembers(input.Members),
	}
	return ensureLeaderMember(team)
}

func cleanTeamMembers(members []models.TeamMember) []models.TeamMember {
	cleaned := make([]models.TeamMember, 0, len(members))
	for _, member := range members {
		member.Name = strings.TrimSpace(member.Name)
		member.Email = strings.TrimSpace(member.Email)
		member.Role = strings.TrimSpace(member.Role)
		if member.Name == "" {
			continue
		}
		cleaned = append(cleaned, member)
	}
	return cleaned
}

func ensureLeaderMember(team models.Team) []models.TeamMember {
	leader := models.TeamMember{
		Name:  strings.TrimSpace(team.LeaderName),
		Email: strings.TrimSpace(team.LeaderEmail),
		Role:  "Ketua",
	}
	members := make([]models.TeamMember, 0, len(team.Members)+1)
	if leader.Name != "" {
		members = append(members, leader)
	}
	for _, member := range cleanTeamMembers(team.Members) {
		if sameTeamMember(leader, member) {
			continue
		}
		members = append(members, member)
	}
	return members
}

func sameTeamMember(a, b models.TeamMember) bool {
	if a.Email != "" && b.Email != "" {
		return strings.EqualFold(a.Email, b.Email)
	}
	return strings.EqualFold(strings.TrimSpace(a.Name), strings.TrimSpace(b.Name))
}

func (s *PostgresStore) teamSubmissionStages(ctx context.Context, team models.Team) ([]models.TeamSubmissionStage, error) {
	stages, err := s.ListSubmissionStages(ctx, team.EventID)
	if err != nil {
		return nil, err
	}
	accessRows, err := s.db.Query(ctx, `
		select stage_id::text, is_allowed
		from team_stage_access
		where team_id = $1
	`, team.ID)
	if err != nil {
		return nil, err
	}
	defer accessRows.Close()

	access := map[string]bool{}
	for accessRows.Next() {
		var stageID string
		var allowed bool
		if err := accessRows.Scan(&stageID, &allowed); err != nil {
			return nil, err
		}
		access[stageID] = allowed
	}
	if err := accessRows.Err(); err != nil {
		return nil, err
	}

	items := make([]models.TeamSubmissionStage, 0, len(stages))
	for _, stage := range stages {
		items = append(items, buildSubmissionPermission(team, stage, access[stage.ID]))
	}
	return items, nil
}

func (s *PostgresStore) submissionPermission(ctx context.Context, team models.Team, stageKey string) (models.TeamSubmissionStage, error) {
	stages, err := s.teamSubmissionStages(ctx, team)
	if err != nil {
		return models.TeamSubmissionStage{}, err
	}
	for _, item := range stages {
		if item.Stage.Key == stageKey || item.Stage.ID == stageKey {
			return item, nil
		}
	}
	return models.TeamSubmissionStage{}, errors.New("tahap upload tidak ditemukan")
}

func buildSubmissionPermission(team models.Team, stage models.SubmissionStage, allowed bool) models.TeamSubmissionStage {
	item := models.TeamSubmissionStage{
		Stage:     stage,
		IsAllowed: allowed,
		CanSubmit: true,
	}
	if team.VerificationStatus != "verified" {
		item.CanSubmit = false
		item.Reason = "tim harus diverifikasi panitia sebelum mengirim submission"
		return item
	}
	if !stage.IsOpen {
		item.CanSubmit = false
		item.Reason = "tahap upload belum dibuka oleh admin"
		return item
	}
	if stage.RequiresApproval && !allowed {
		item.CanSubmit = false
		item.Reason = "tim belum lolos atau belum diberi akses untuk tahap ini"
		return item
	}
	return item
}

func (s *PostgresStore) firstSubmissionStageKey(ctx context.Context, eventID string) (string, error) {
	stages, err := s.ListSubmissionStages(ctx, eventID)
	if err != nil {
		return "", err
	}
	if len(stages) == 0 {
		return "awal", nil
	}
	return stages[0].Key, nil
}

func (s *PostgresStore) firstSubmissionStageKeyForTeam(ctx context.Context, teamID string) (string, error) {
	team, err := s.getTeam(ctx, teamID)
	if err != nil {
		return "", err
	}
	return s.firstSubmissionStageKey(ctx, team.EventID)
}

func submissionStageKey(key, label string) string {
	value := strings.TrimSpace(key)
	if value == "" {
		value = strings.TrimSpace(label)
	}
	var builder strings.Builder
	lastDash := false
	for _, r := range strings.ToLower(value) {
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			builder.WriteRune(r)
			lastDash = false
		case !lastDash && builder.Len() > 0:
			builder.WriteRune('-')
			lastDash = true
		}
	}
	return strings.Trim(builder.String(), "-")
}

func (s *PostgresStore) listSubmissions(ctx context.Context, teamID string) ([]models.Submission, error) {
	rows, err := s.db.Query(ctx, `
		select id::text, team_id::text, stage,
		       coalesce(proposal_url, ''),
		       coalesce(prototype_url, ''),
		       coalesce(ppt_url, ''),
		       coalesce(report_url, ''),
		       coalesce(poster_url, ''),
		       status,
		       submitted_at
		from submissions
		where team_id = $1
		order by submitted_at desc
	`, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	submissions := make([]models.Submission, 0)
	for rows.Next() {
		var submission models.Submission
		var submitted time.Time
		if err := rows.Scan(
			&submission.ID,
			&submission.TeamID,
			&submission.Stage,
			&submission.ProposalURL,
			&submission.PrototypeURL,
			&submission.PPTURL,
			&submission.ReportURL,
			&submission.PosterURL,
			&submission.Status,
			&submitted,
		); err != nil {
			return nil, err
		}
		submission.SubmittedAt = submitted.Format(time.RFC3339)
		submissions = append(submissions, submission)
	}
	return submissions, rows.Err()
}

func (s *PostgresStore) CreateSubmission(ctx context.Context, teamID string, input models.SubmissionRequest) (models.Submission, error) {
	if input.Stage == "" {
		stageKey, err := s.firstSubmissionStageKeyForTeam(ctx, teamID)
		if err != nil {
			return models.Submission{}, err
		}
		input.Stage = stageKey
	}
	team, err := s.getTeam(ctx, teamID)
	if err != nil {
		return models.Submission{}, err
	}
	permission, err := s.submissionPermission(ctx, team, input.Stage)
	if err != nil {
		return models.Submission{}, err
	}
	if !permission.CanSubmit {
		return models.Submission{}, errors.New(permission.Reason)
	}
	input.Stage = permission.Stage.Key
	var submission models.Submission
	var submitted time.Time
	if err := s.db.QueryRow(ctx, `
		insert into submissions (
			team_id, stage, proposal_url, prototype_url, ppt_url, report_url, poster_url, status
		)
		values ($1, $2, nullif($3, ''), nullif($4, ''), nullif($5, ''), nullif($6, ''), nullif($7, ''), 'submitted')
		returning id::text, team_id::text, stage,
		          coalesce(proposal_url, ''),
		          coalesce(prototype_url, ''),
		          coalesce(ppt_url, ''),
		          coalesce(report_url, ''),
		          coalesce(poster_url, ''),
		          status, submitted_at
	`,
		teamID,
		input.Stage,
		strings.TrimSpace(input.ProposalURL),
		strings.TrimSpace(input.PrototypeURL),
		strings.TrimSpace(input.PPTURL),
		strings.TrimSpace(input.ReportURL),
		strings.TrimSpace(input.PosterURL),
	).Scan(
		&submission.ID,
		&submission.TeamID,
		&submission.Stage,
		&submission.ProposalURL,
		&submission.PrototypeURL,
		&submission.PPTURL,
		&submission.ReportURL,
		&submission.PosterURL,
		&submission.Status,
		&submitted,
	); err != nil {
		return models.Submission{}, err
	}
	submission.SubmittedAt = submitted.Format(time.RFC3339)
	return submission, nil
}

func (s *PostgresStore) FindAdminByEmail(ctx context.Context, email string) (models.AdminAccount, error) {
	var account models.AdminAccount
	err := s.db.QueryRow(ctx, `
		select id::text, name, coalesce(nim, ''), email, role, division, password_hash
		from admin_users
		where lower(email) = lower($1)
	`, email).Scan(
		&account.ID,
		&account.Name,
		&account.NIM,
		&account.Email,
		&account.Role,
		&account.Division,
		&account.PasswordHash,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.AdminAccount{}, errors.New("admin not found")
	}
	return account, err
}

func (s *PostgresStore) ListAdminUsers(ctx context.Context) ([]models.AdminUser, error) {
	rows, err := s.db.Query(ctx, `
		select id::text, name, coalesce(nim, ''), email, role, division
		from admin_users
		order by created_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := make([]models.AdminUser, 0)
	for rows.Next() {
		var user models.AdminUser
		if err := rows.Scan(&user.ID, &user.Name, &user.NIM, &user.Email, &user.Role, &user.Division); err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, rows.Err()
}

func (s *PostgresStore) CreateAdminUser(ctx context.Context, input models.CreateAdminUserRequest) (models.AdminUser, error) {
	name := strings.TrimSpace(input.Name)
	nim := strings.TrimSpace(input.NIM)
	if name == "" || nim == "" {
		return models.AdminUser{}, errors.New("nama dan NIM wajib diisi")
	}
	role := strings.TrimSpace(input.Role)
	if role == "" {
		role = "admin"
	}
	password := input.Password
	if password == "" {
		password = nim
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return models.AdminUser{}, err
	}
	email := adminStudentEmail(name, nim)

	var user models.AdminUser
	if err := s.db.QueryRow(ctx, `
		insert into admin_users (name, nim, email, password_hash, role, division)
		values ($1, $2, $3, $4, $5, $6)
		returning id::text, name, coalesce(nim, ''), email, role, division
	`,
		name,
		nim,
		email,
		string(hash),
		role,
		strings.TrimSpace(input.Division),
	).Scan(&user.ID, &user.Name, &user.NIM, &user.Email, &user.Role, &user.Division); err != nil {
		return models.AdminUser{}, err
	}
	return user, nil
}

func adminStudentEmail(name, nim string) string {
	var builder strings.Builder
	lastDot := false
	for _, r := range strings.ToLower(name) {
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			builder.WriteRune(r)
			lastDot = false
		case !lastDot && builder.Len() > 0:
			builder.WriteRune('.')
			lastDot = true
		}
	}
	localName := strings.Trim(builder.String(), ".")
	if localName == "" {
		localName = "panitia"
	}
	return fmt.Sprintf("%s.%s@student.itera.ac.id", localName, digitsOnly(nim))
}

func digitsOnly(value string) string {
	var builder strings.Builder
	for _, r := range value {
		if unicode.IsDigit(r) {
			builder.WriteRune(r)
		}
	}
	if builder.Len() == 0 {
		return strings.ToLower(strings.TrimSpace(value))
	}
	return builder.String()
}

func (s *PostgresStore) AdminStats(ctx context.Context) (models.AdminStats, error) {
	var stats models.AdminStats
	if err := s.db.QueryRow(ctx, `
		select
			(select count(*) from events),
			(select count(*) from teams),
			(select count(*) from teams where verification_status = 'pending'),
			(select count(*) from submissions),
			(select coalesce(sum(jsonb_array_length(results)), 0) from announcements where type = 'finalis'),
			(select coalesce(sum(jsonb_array_length(results)), 0) from announcements where type = 'pemenang')
	`).Scan(
		&stats.Events,
		&stats.Teams,
		&stats.Pending,
		&stats.Submissions,
		&stats.Finalists,
		&stats.Winners,
	); err != nil {
		return models.AdminStats{}, err
	}
	return stats, nil
}

func (s *PostgresStore) ListTeams(ctx context.Context, filters models.TeamFilters) ([]models.Team, error) {
	query := `
		select t.id::text, t.event_id::text, t.category_id::text, c.name,
		       t.name, t.batch, t.leader_name, t.leader_email, t.leader_phone,
		       t.institution, t.members, t.verification_status, t.created_at
		from teams t
		join categories c on c.id = t.category_id
		where 1=1
	`
	args := []any{}
	add := func(condition string, value any) {
		args = append(args, value)
		query += fmt.Sprintf(" and %s $%d", condition, len(args))
	}
	if filters.EventID != "" {
		add("t.event_id =", filters.EventID)
	}
	if filters.Batch != 0 {
		add("t.batch =", filters.Batch)
	}
	if filters.Status != "" {
		add("t.verification_status =", filters.Status)
	}
	if filters.Search != "" {
		args = append(args, "%"+strings.ToLower(filters.Search)+"%")
		query += fmt.Sprintf(" and lower(t.name || ' ' || t.leader_name || ' ' || t.institution || ' ' || t.leader_email) like $%d", len(args))
	}
	query += " order by t.created_at desc"

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	teams := make([]models.Team, 0)
	for rows.Next() {
		team, err := scanTeam(rows)
		if err != nil {
			return nil, err
		}
		teams = append(teams, team)
	}
	return teams, rows.Err()
}

func (s *PostgresStore) UpdateTeamStatus(ctx context.Context, teamID, status string) (models.Team, error) {
	if status == "" {
		status = "verified"
	}
	if _, err := s.db.Exec(ctx, `
		update teams
		set verification_status = $2, updated_at = now()
		where id = $1
	`, teamID, status); err != nil {
		return models.Team{}, err
	}
	return s.getTeam(ctx, teamID)
}

func (s *PostgresStore) CreateEvent(ctx context.Context, input models.CreateEventRequest) (models.Event, error) {
	if input.Status == "" {
		input.Status = "draft"
	}
	var event models.Event
	if err := s.db.QueryRow(ctx, `
		insert into events (name, theme, year, starts_at, ends_at, status)
		values ($1, $2, $3, $4, $5, $6)
		returning id::text, name, theme, year,
		          to_char(starts_at, 'YYYY-MM-DD'),
		          to_char(ends_at, 'YYYY-MM-DD'),
		          status
	`,
		strings.TrimSpace(input.Name),
		strings.TrimSpace(input.Theme),
		input.Year,
		input.StartDate,
		input.EndDate,
		input.Status,
	).Scan(
		&event.ID,
		&event.Name,
		&event.Theme,
		&event.Year,
		&event.StartDate,
		&event.EndDate,
		&event.Status,
	); err != nil {
		return models.Event{}, err
	}
	return event, nil
}

func (s *PostgresStore) CreateAnnouncement(ctx context.Context, input models.CreateAnnouncementRequest) (models.Announcement, error) {
	if input.Type == "" {
		input.Type = "finalis"
	}
	results, err := json.Marshal(input.Results)
	if err != nil {
		return models.Announcement{}, err
	}
	row := s.db.QueryRow(ctx, `
		insert into announcements (event_id, type, title, body, results)
		values ($1, $2, $3, $4, $5)
		returning id::text, event_id::text, type, title, body,
		          to_char(published_at, 'YYYY-MM-DD'),
		          results
	`,
		input.EventID,
		strings.TrimSpace(input.Type),
		strings.TrimSpace(input.Title),
		strings.TrimSpace(input.Body),
		results,
	)
	return scanAnnouncement(row)
}
