package models

import "time"

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

type EventDocument struct {
	ID          string `json:"id"`
	EventID     string `json:"eventId"`
	Label       string `json:"label"`
	URL         string `json:"url"`
	Type        string `json:"type"`
	RequiredFor string `json:"requiredFor"`
	SortOrder   int    `json:"sortOrder"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

type EventDocumentInput struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	URL         string `json:"url"`
	Type        string `json:"type"`
	RequiredFor string `json:"requiredFor"`
	SortOrder   int    `json:"sortOrder"`
}

type ReplaceEventDocumentsRequest struct {
	Items []EventDocumentInput `json:"items"`
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

type EventRegistrationSettings struct {
	EventID      string `json:"eventId"`
	CurrentBatch int    `json:"currentBatch"`
	UpdatedAt    string `json:"updatedAt"`
}

type EventRegistrationSettingsRequest struct {
	CurrentBatch int `json:"currentBatch"`
}

type EventPaymentSettings struct {
	EventID   string `json:"eventId"`
	Amount    int    `json:"amount"`
	IsEnabled bool   `json:"isEnabled"`
	UpdatedAt string `json:"updatedAt"`
}

type EventPaymentSettingsRequest struct {
	Amount    int  `json:"amount"`
	IsEnabled bool `json:"isEnabled"`
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

type PublicTeam struct {
	ID                 string `json:"id"`
	EventID            string `json:"eventId"`
	CategoryName       string `json:"categoryName"`
	Name               string `json:"name"`
	Batch              int    `json:"batch"`
	Institution        string `json:"institution"`
	VerificationStatus string `json:"verificationStatus"`
	CreatedAt          string `json:"createdAt"`
}

type RegistrationRequest struct {
	EventID        string       `json:"eventId"`
	CategoryID     string       `json:"categoryId"`
	Name           string       `json:"name"`
	Batch          int          `json:"batch"`
	LeaderName     string       `json:"leaderName"`
	LeaderEmail    string       `json:"leaderEmail"`
	LeaderPhone    string       `json:"leaderPhone"`
	Institution    string       `json:"institution"`
	Members        []TeamMember `json:"members"`
	ProposalURL    string       `json:"proposalUrl"`
	PrototypeURL   string       `json:"prototypeUrl"`
	OTPCode        string       `json:"otpCode"`
	PaymentOrderID string       `json:"paymentOrderId"`
}

type RegistrationOTPRequest struct {
	EventID     string `json:"eventId"`
	LeaderName  string `json:"leaderName"`
	LeaderEmail string `json:"leaderEmail"`
}

type RegistrationOTPResponse struct {
	Message   string `json:"message"`
	ExpiresIn int    `json:"expiresIn"`
}

type RegistrationPaymentRequest struct {
	EventID     string `json:"eventId"`
	TeamName    string `json:"teamName"`
	LeaderName  string `json:"leaderName"`
	LeaderEmail string `json:"leaderEmail"`
}

type RegistrationPaymentCheckRequest struct {
	EventID     string `json:"eventId"`
	LeaderEmail string `json:"leaderEmail"`
	OrderID     string `json:"orderId"`
}

type RegistrationPayment struct {
	OrderID       string `json:"orderId"`
	EventID       string `json:"eventId"`
	LeaderEmail   string `json:"leaderEmail"`
	TeamName      string `json:"teamName"`
	Amount        int    `json:"amount"`
	Fee           int    `json:"fee"`
	TotalPayment  int    `json:"totalPayment"`
	PaymentMethod string `json:"paymentMethod"`
	PaymentNumber string `json:"paymentNumber"`
	PaymentURL    string `json:"paymentUrl"`
	Status        string `json:"status"`
	ExpiredAt     string `json:"expiredAt"`
	CompletedAt   string `json:"completedAt"`
	CreatedAt     string `json:"createdAt"`
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
	Reason       string `json:"reason"`
	PreviewURL   string `json:"previewUrl"`
	PPTURL       string `json:"pptUrl"`
	PosterURL    string `json:"posterUrl"`
	ProposalURL  string `json:"proposalUrl"`
	ReportURL    string `json:"reportUrl"`
}

type Announcement struct {
	ID          string               `json:"id"`
	EventID     string               `json:"eventId"`
	Type        string               `json:"type"`
	Title       string               `json:"title"`
	Body        string               `json:"body"`
	PublishedAt string               `json:"publishedAt"`
	Source      string               `json:"source"`
	SourceID    string               `json:"sourceId"`
	SourceURL   string               `json:"sourceUrl"`
	ImageURL    string               `json:"imageUrl"`
	MediaType   string               `json:"mediaType"`
	Results     []AnnouncementResult `json:"results"`
}

type InstagramAnnouncementInput struct {
	EventID     string
	SourceID    string
	SourceURL   string
	ImageURL    string
	MediaType   string
	Title       string
	Body        string
	PublishedAt time.Time
}

type InstagramSyncResult struct {
	Fetched int `json:"fetched"`
	Saved   int `json:"saved"`
	Skipped int `json:"skipped"`
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

type RubricQuestion struct {
	ID          string `json:"id"`
	EventID     string `json:"eventId"`
	Question    string `json:"question"`
	Description string `json:"description"`
	MaxScore    int    `json:"maxScore"`
	SortOrder   int    `json:"sortOrder"`
	IsActive    bool   `json:"isActive"`
}

type RubricQuestionInput struct {
	ID          string `json:"id"`
	Question    string `json:"question"`
	Description string `json:"description"`
	MaxScore    int    `json:"maxScore"`
	SortOrder   int    `json:"sortOrder"`
	IsActive    bool   `json:"isActive"`
}

type ReplaceRubricQuestionsRequest struct {
	Items []RubricQuestionInput `json:"items"`
}

type JudgeScoreInput struct {
	QuestionID string `json:"questionId"`
	Score      int    `json:"score"`
}

type JudgeAssessmentRequest struct {
	Notes  string            `json:"notes"`
	Scores []JudgeScoreInput `json:"scores"`
}

type JudgeAssessmentScore struct {
	Question RubricQuestion `json:"question"`
	Score    int            `json:"score"`
}

type JudgeAssessment struct {
	ID         string                 `json:"id"`
	TeamID     string                 `json:"teamId"`
	JudgeID    string                 `json:"judgeId"`
	JudgeName  string                 `json:"judgeName"`
	Notes      string                 `json:"notes"`
	TotalScore int                    `json:"totalScore"`
	Scores     []JudgeAssessmentScore `json:"scores"`
	UpdatedAt  string                 `json:"updatedAt"`
}

type TeamDetail struct {
	Event            Event                 `json:"event"`
	Category         Category              `json:"category"`
	Team             Team                  `json:"team"`
	Submissions      []Submission          `json:"submissions"`
	SubmissionStages []TeamSubmissionStage `json:"submissionStages"`
	RubricQuestions  []RubricQuestion      `json:"rubricQuestions"`
	Assessments      []JudgeAssessment     `json:"assessments"`
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
	Name      string               `json:"name"`
	Theme     string               `json:"theme"`
	Year      int                  `json:"year"`
	StartDate string               `json:"startDate"`
	EndDate   string               `json:"endDate"`
	Status    string               `json:"status"`
	Documents []EventDocumentInput `json:"documents"`
}

type CreateAnnouncementRequest struct {
	EventID  string               `json:"eventId"`
	Type     string               `json:"type"`
	Title    string               `json:"title"`
	Body     string               `json:"body"`
	ImageURL string               `json:"imageUrl"`
	Results  []AnnouncementResult `json:"results"`
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

type AdminRedeemCode struct {
	ID           string `json:"id"`
	Code         string `json:"code"`
	ClaimURL     string `json:"claimUrl"`
	Role         string `json:"role"`
	Division     string `json:"division"`
	MaxClaims    int    `json:"maxClaims"`
	ClaimedCount int    `json:"claimedCount"`
	Status       string `json:"status"`
	ExpiresAt    string `json:"expiresAt"`
	CreatedBy    string `json:"createdBy"`
	CreatedAt    string `json:"createdAt"`
}

type CreateAdminRedeemCodeRequest struct {
	Role      string `json:"role"`
	Division  string `json:"division"`
	MaxClaims int    `json:"maxClaims"`
	ExpiresAt string `json:"expiresAt"`
}

type ClaimAdminRedeemRequest struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

type ClaimAdminRedeemResponse struct {
	User            AdminUser `json:"user"`
	InitialPassword string    `json:"initialPassword"`
	Message         string    `json:"message"`
}
