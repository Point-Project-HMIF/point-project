package models

type Event struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Theme     string `json:"theme"`
	Year      int    `json:"year"`
	StartDate string `json:"startDate"`
	EndDate   string `json:"endDate"`
	Status    string `json:"status"`
	LockedAt  string `json:"lockedAt"`
}

type Category struct {
	ID           string   `json:"id"`
	EventID      string   `json:"eventId"`
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	Requirements []string `json:"requirements"`
}

type TimelineItem struct {
	ID          string `json:"id"`
	EventID     string `json:"eventId"`
	Label       string `json:"label"`
	StartDate   string `json:"startDate"`
	EndDate     string `json:"endDate"`
	Description string `json:"description"`
	SortOrder   int    `json:"sortOrder"`
}

type TimelineItemInput struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	StartDate   string `json:"startDate"`
	EndDate     string `json:"endDate"`
	Description string `json:"description"`
	SortOrder   int    `json:"sortOrder"`
}

type ReplaceTimelineRequest struct {
	Items []TimelineItemInput `json:"items"`
}

type CommitteeMember struct {
	ID       string `json:"id"`
	EventID  string `json:"eventId"`
	Name     string `json:"name"`
	Identity string `json:"identity"`
	Position string `json:"position"`
	Division string `json:"division"`
}

type FAQ struct {
	ID          string `json:"id"`
	EventID     string `json:"eventId"`
	Question    string `json:"question"`
	Answer      string `json:"answer"`
	SortOrder   int    `json:"sortOrder"`
	IsPublished bool   `json:"isPublished"`
}

type FAQInput struct {
	EventID     string `json:"eventId"`
	Question    string `json:"question"`
	Answer      string `json:"answer"`
	SortOrder   int    `json:"sortOrder"`
	IsPublished bool   `json:"isPublished"`
}

type EventRules struct {
	EventID        string `json:"eventId"`
	MinTeamMembers int    `json:"minTeamMembers"`
	MaxTeamMembers int    `json:"maxTeamMembers"`
}

type EventRulesRequest struct {
	MinTeamMembers int `json:"minTeamMembers"`
	MaxTeamMembers int `json:"maxTeamMembers"`
}

type SubmissionStage struct {
	ID               string `json:"id"`
	EventID          string `json:"eventId"`
	Key              string `json:"key"`
	Label            string `json:"label"`
	SortOrder        int    `json:"sortOrder"`
	IsOpen           bool   `json:"isOpen"`
	RequiresApproval bool   `json:"requiresApproval"`
}

type SubmissionStageInput struct {
	ID               string `json:"id"`
	Key              string `json:"key"`
	Label            string `json:"label"`
	SortOrder        int    `json:"sortOrder"`
	IsOpen           bool   `json:"isOpen"`
	RequiresApproval bool   `json:"requiresApproval"`
}

type ReplaceSubmissionStagesRequest struct {
	Items []SubmissionStageInput `json:"items"`
}

type TeamSubmissionStage struct {
	Stage     SubmissionStage `json:"stage"`
	IsAllowed bool            `json:"isAllowed"`
	CanSubmit bool            `json:"canSubmit"`
	Reason    string          `json:"reason"`
}

type TeamStageAccessRequest struct {
	StageID   string `json:"stageId"`
	IsAllowed bool   `json:"isAllowed"`
}

type TeamMember struct {
	Name  string `json:"name"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

type Team struct {
	ID                 string       `json:"id"`
	EventID            string       `json:"eventId"`
	CategoryID         string       `json:"categoryId"`
	CategoryName       string       `json:"categoryName"`
	Name               string       `json:"name"`
	Batch              int          `json:"batch"`
	LeaderName         string       `json:"leaderName"`
	LeaderEmail        string       `json:"leaderEmail"`
	LeaderPhone        string       `json:"leaderPhone"`
	Institution        string       `json:"institution"`
	Members            []TeamMember `json:"members"`
	VerificationStatus string       `json:"verificationStatus"`
	CreatedAt          string       `json:"createdAt"`
}

type RegistrationRequest struct {
	EventID      string       `json:"eventId"`
	CategoryID   string       `json:"categoryId"`
	Name         string       `json:"name"`
	Batch        int          `json:"batch"`
	LeaderName   string       `json:"leaderName"`
	LeaderEmail  string       `json:"leaderEmail"`
	LeaderPhone  string       `json:"leaderPhone"`
	Institution  string       `json:"institution"`
	Members      []TeamMember `json:"members"`
	ProposalURL  string       `json:"proposalUrl"`
	PrototypeURL string       `json:"prototypeUrl"`
	OTPCode      string       `json:"otpCode"`
}

type RegistrationOTPRequest struct {
	LeaderName  string `json:"leaderName"`
	LeaderEmail string `json:"leaderEmail"`
}

type RegistrationOTPResponse struct {
	Message   string `json:"message"`
	ExpiresIn int    `json:"expiresIn"`
}

type Submission struct {
	ID           string `json:"id"`
	TeamID       string `json:"teamId"`
	Stage        string `json:"stage"`
	ProposalURL  string `json:"proposalUrl"`
	PrototypeURL string `json:"prototypeUrl"`
	PPTURL       string `json:"pptUrl"`
	ReportURL    string `json:"reportUrl"`
	PosterURL    string `json:"posterUrl"`
	Status       string `json:"status"`
	SubmittedAt  string `json:"submittedAt"`
}

type SubmissionRequest struct {
	Stage        string `json:"stage"`
	ProposalURL  string `json:"proposalUrl"`
	PrototypeURL string `json:"prototypeUrl"`
	PPTURL       string `json:"pptUrl"`
	ReportURL    string `json:"reportUrl"`
	PosterURL    string `json:"posterUrl"`
}

type AnnouncementResult struct {
	Rank         int    `json:"rank"`
	TeamName     string `json:"teamName"`
	CategoryName string `json:"categoryName"`
	Institution  string `json:"institution"`
	WorkTitle    string `json:"workTitle"`
	PrototypeURL string `json:"prototypeUrl"`
}

type Announcement struct {
	ID          string               `json:"id"`
	EventID     string               `json:"eventId"`
	Type        string               `json:"type"`
	Title       string               `json:"title"`
	Body        string               `json:"body"`
	PublishedAt string               `json:"publishedAt"`
	Results     []AnnouncementResult `json:"results"`
}

type Dashboard struct {
	Event            Event                 `json:"event"`
	Category         Category              `json:"category"`
	Team             Team                  `json:"team"`
	Submissions      []Submission          `json:"submissions"`
	Announcements    []Announcement        `json:"announcements"`
	Rules            EventRules            `json:"rules"`
	SubmissionStages []TeamSubmissionStage `json:"submissionStages"`
}

type TeamDetail struct {
	Event            Event                 `json:"event"`
	Category         Category              `json:"category"`
	Team             Team                  `json:"team"`
	Submissions      []Submission          `json:"submissions"`
	SubmissionStages []TeamSubmissionStage `json:"submissionStages"`
}

type AdminUser struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	NIM      string `json:"nim"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	Division string `json:"division"`
}

type AdminAccount struct {
	AdminUser
	PasswordHash string
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string    `json:"token"`
	User  AdminUser `json:"user"`
}

type AdminStats struct {
	Events      int `json:"events"`
	Teams       int `json:"teams"`
	Pending     int `json:"pending"`
	Submissions int `json:"submissions"`
	Finalists   int `json:"finalists"`
	Winners     int `json:"winners"`
}

type TeamFilters struct {
	EventID string
	Batch   int
	Status  string
	Search  string
}

type CreateEventRequest struct {
	Name      string `json:"name"`
	Theme     string `json:"theme"`
	Year      int    `json:"year"`
	StartDate string `json:"startDate"`
	EndDate   string `json:"endDate"`
	Status    string `json:"status"`
}

type CreateAnnouncementRequest struct {
	EventID string               `json:"eventId"`
	Type    string               `json:"type"`
	Title   string               `json:"title"`
	Body    string               `json:"body"`
	Results []AnnouncementResult `json:"results"`
}

type VerifyTeamRequest struct {
	Status string `json:"status"`
}

type CreateAdminUserRequest struct {
	Name     string `json:"name"`
	NIM      string `json:"nim"`
	Role     string `json:"role"`
	Division string `json:"division"`
	Password string `json:"password"`
}
