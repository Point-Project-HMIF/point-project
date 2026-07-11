export type Event = {
  id: string;
  name: string;
  theme: string;
  year: number;
  startDate: string;
  endDate: string;
  status: "draft" | "aktif" | "arsip" | string;
  lockedAt: string;
};

export type Category = {
  id: string;
  eventId: string;
  name: string;
  description: string;
  requirements: string[];
};

export type TimelineItem = {
  id: string;
  eventId: string;
  label: string;
  startDate: string;
  endDate: string;
  description: string;
  sortOrder: number;
};

export type TimelineItemInput = {
  id?: string;
  label: string;
  startDate: string;
  endDate: string;
  description: string;
  sortOrder: number;
};

export type CommitteeMember = {
  id: string;
  eventId: string;
  name: string;
  identity: string;
  position: string;
  division: string;
};

export type FAQ = {
  id: string;
  eventId: string;
  question: string;
  answer: string;
  sortOrder: number;
  isPublished: boolean;
};

export type FAQPayload = {
  eventId: string;
  question: string;
  answer: string;
  sortOrder: number;
  isPublished: boolean;
};

export type EventRules = {
  eventId: string;
  minTeamMembers: number;
  maxTeamMembers: number;
};

export type EventRulesPayload = {
  minTeamMembers: number;
  maxTeamMembers: number;
};

export type EventPaymentSettings = {
  eventId: string;
  amount: number;
  isEnabled: boolean;
  updatedAt: string;
};

export type EventPaymentSettingsPayload = {
  amount: number;
  isEnabled: boolean;
};

export type SubmissionStage = {
  id: string;
  eventId: string;
  key: string;
  label: string;
  sortOrder: number;
  isOpen: boolean;
  requiresApproval: boolean;
};

export type SubmissionStageInput = {
  id?: string;
  key: string;
  label: string;
  sortOrder: number;
  isOpen: boolean;
  requiresApproval: boolean;
};

export type TeamSubmissionStage = {
  stage: SubmissionStage;
  isAllowed: boolean;
  canSubmit: boolean;
  reason: string;
};

export type TeamMember = {
  name: string;
  email: string;
  role: string;
};

export type Team = {
  id: string;
  eventId: string;
  categoryId: string;
  categoryName: string;
  name: string;
  batch: number;
  leaderName: string;
  leaderEmail: string;
  leaderPhone: string;
  institution: string;
  members: TeamMember[];
  verificationStatus: string;
  createdAt: string;
};

export type PublicTeam = {
  id: string;
  eventId: string;
  categoryName: string;
  name: string;
  batch: number;
  institution: string;
  verificationStatus: string;
  createdAt: string;
};

export type RegistrationPayload = {
  eventId: string;
  categoryId: string;
  name: string;
  batch: number;
  leaderName: string;
  leaderEmail: string;
  leaderPhone: string;
  institution: string;
  members: TeamMember[];
  paymentOrderId: string;
  otpCode: string;
};

export type RegistrationPaymentPayload = {
  eventId: string;
  teamName: string;
  leaderName: string;
  leaderEmail: string;
};

export type RegistrationPaymentCheckPayload = {
  eventId: string;
  leaderEmail: string;
  orderId: string;
};

export type RegistrationPayment = {
  orderId: string;
  eventId: string;
  leaderEmail: string;
  teamName: string;
  amount: number;
  fee: number;
  totalPayment: number;
  paymentMethod: string;
  paymentNumber: string;
  paymentUrl: string;
  status: string;
  expiredAt: string;
  completedAt: string;
  createdAt: string;
};

export type RegistrationOTPPayload = {
  eventId: string;
  leaderName: string;
  leaderEmail: string;
};

export type RegistrationOTPResponse = {
  message: string;
  expiresIn: number;
};

export type Submission = {
  id: string;
  teamId: string;
  stage: string;
  proposalUrl: string;
  prototypeUrl: string;
  pptUrl: string;
  reportUrl: string;
  posterUrl: string;
  status: string;
  submittedAt: string;
};

export type SubmissionPayload = {
  stage: string;
  proposal?: File | null;
  prototypeUrl?: string;
  ppt?: File | null;
  report?: File | null;
  poster?: File | null;
};

export type AnnouncementResult = {
  rank: number;
  teamName: string;
  categoryName: string;
  institution: string;
  workTitle: string;
  prototypeUrl: string;
  reason?: string;
  previewUrl?: string;
  pptUrl?: string;
  posterUrl?: string;
  proposalUrl?: string;
  reportUrl?: string;
};

export type Announcement = {
  id: string;
  eventId: string;
  type: "finalis" | "pemenang" | "info" | string;
  title: string;
  body: string;
  publishedAt: string;
  source?: string;
  sourceId?: string;
  sourceUrl?: string;
  imageUrl?: string;
  mediaType?: string;
  results: AnnouncementResult[];
};

export type ParticipantDashboard = {
  event: Event;
  category: Category;
  team: Team;
  submissions: Submission[];
  announcements: Announcement[];
  rules: EventRules;
  submissionStages: TeamSubmissionStage[];
};

export type TeamDetail = {
  event: Event;
  category: Category;
  team: Team;
  submissions: Submission[];
  submissionStages: TeamSubmissionStage[];
};

export type AdminUser = {
  id: string;
  name: string;
  nim: string;
  email: string;
  role: string;
  division: string;
};

export type CreateAdminUserPayload = {
  name: string;
  nim: string;
  role: string;
  division: string;
  password: string;
};

export type AdminRedeemCode = {
  id: string;
  code: string;
  claimUrl: string;
  role: string;
  division: string;
  maxClaims: number;
  claimedCount: number;
  status: string;
  expiresAt: string;
  createdBy: string;
  createdAt: string;
};

export type CreateAdminRedeemCodePayload = {
  role: string;
  division: string;
  maxClaims: number;
  expiresAt: string;
};

export type ClaimAdminRedeemPayload = {
  name: string;
  email: string;
};

export type ClaimAdminRedeemResponse = {
  user: AdminUser;
  initialPassword: string;
  message: string;
};

export type AdminStats = {
  events: number;
  teams: number;
  pending: number;
  submissions: number;
  finalists: number;
  winners: number;
};

export type LoginResponse = {
  token: string;
  user: AdminUser;
};
