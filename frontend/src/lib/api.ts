import type {
  AdminStats,
  AdminRedeemCode,
  AdminUser,
  Announcement,
  Category,
  ClaimAdminRedeemPayload,
  ClaimAdminRedeemResponse,
  CommitteeMember,
  CreateAdminRedeemCodePayload,
  CreateAdminUserPayload,
  Event,
  EventDocument,
  EventDocumentInput,
  EventRegistrationSettings,
  EventRegistrationSettingsPayload,
  EventPaymentSettings,
  EventPaymentSettingsPayload,
  FAQ,
  FAQPayload,
  EventRules,
  EventRulesPayload,
  JudgeAssessmentPayload,
  LoginResponse,
  ParticipantDashboard,
  PublicTeamScoreSummary,
  PublicTeam,
  RegistrationPayment,
  RegistrationPaymentCheckPayload,
  RegistrationPaymentPayload,
  RegistrationOTPPayload,
  RegistrationOTPResponse,
  RegistrationPayload,
  RubricQuestion,
  RubricQuestionInput,
  Submission,
  SubmissionPayload,
  SubmissionStage,
  SubmissionStageInput,
  Team,
  TeamDetail,
  TimelineItemInput,
  TimelineItem,
} from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/api";
const FILE_CDN_URL = (
  import.meta.env.VITE_FILE_CDN_URL ?? "https://cdn.pointproject.web.id"
).replace(/\/+$/, "");

type APIEnvelope<T> = {
  data?: T;
  error?: string;
};

async function request<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  // bikin headers sementara, set content-type kalo bukan FormData
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const raw = await response.text();
  let payload: APIEnvelope<T> = {};
  if (raw) {
    try {
      payload = JSON.parse(raw) as APIEnvelope<T>;
    } catch {
      payload = { error: raw.trim() };
    }
  }
  if (!response.ok) {
    throw new Error(payload.error ?? `API request failed (${response.status})`);
  }
  return payload.data as T;
}

async function downloadRequest(path: string, token?: string) {
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${API_URL}${path}`, { headers });
  if (!response.ok) {
    const raw = await response.text();
    let message = `API request failed (${response.status})`;
    if (raw) {
      try {
        const payload = JSON.parse(raw) as APIEnvelope<unknown>;
        message = payload.error ?? message;
      } catch {
        message = raw.trim() || message;
      }
    }
    throw new Error(message);
  }
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filenameMatch = disposition.match(
    /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i,
  );
  const filename = filenameMatch?.[1]
    ? decodeURIComponent(filenameMatch[1])
    : "point-project-export.xlsx";
  return {
    blob: await response.blob(),
    filename,
  };
}

export function isNotFoundError(error: unknown) {
  // helper: pembeda 404 sama error lain, dipake pas catch
  return error instanceof Error && /404|not found/i.test(error.message);
}

function encodePath(value: string) {
  return value
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

// fungsi untuk ubah URL file internal ke URL CDN publik
export function resolveFileURL(value: string) {
  const url = value.trim();
  if (!url) return "";
  const apiFileIndex = url.indexOf("/api/files/r2/");
  if (apiFileIndex >= 0) {
    return `${FILE_CDN_URL}/${encodePath(url.slice(apiFileIndex + "/api/files/r2/".length))}`;
  }
  if (url.startsWith("r2://")) {
    const withoutScheme = url.slice("r2://".length);
    const slashIndex = withoutScheme.indexOf("/");
    if (slashIndex === -1) return url;
    const key = withoutScheme.slice(slashIndex + 1);
    return `${FILE_CDN_URL}/${encodePath(key)}`;
  }
  if (/^https?:\/\//i.test(url)) return url;
  return url;
}

export const api = {
  events: () => request<Event[]>("/events"),
  activeEvent: () => request<Event>("/events/active"),
  categories: (eventId: string) =>
    request<Category[]>(`/events/${eventId}/categories`),
  timeline: (eventId: string) =>
    request<TimelineItem[]>(`/events/${eventId}/timeline`),
  committee: (eventId: string) =>
    request<CommitteeMember[]>(`/events/${eventId}/committee`),
  rules: (eventId: string) => request<EventRules>(`/events/${eventId}/rules`),
  registrationSettings: (eventId: string) =>
    request<EventRegistrationSettings>(
      `/events/${eventId}/registration-settings`,
    ),
  faqs: (eventId: string) => request<FAQ[]>(`/events/${eventId}/faqs`),
  publicRubricQuestions: (eventId: string) =>
    request<RubricQuestion[]>(`/events/${eventId}/rubric`),
  announcements: (eventId: string, type = "") =>
    request<Announcement[]>(
      `/events/${eventId}/announcements${type ? `?type=${type}` : ""}`,
    ),
  eventTeams: (eventId: string) =>
    request<PublicTeam[]>(`/events/${eventId}/teams`),
  publicTeamScoreSummary: (eventId: string, teamId: string) =>
    request<PublicTeamScoreSummary>(
      `/events/${eventId}/teams/${teamId}/score-summary`,
    ),
  requestRegistrationOTP: (payload: RegistrationOTPPayload) =>
    request<RegistrationOTPResponse>("/registrations/otp", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createRegistrationPayment: (payload: RegistrationPaymentPayload) =>
    request<RegistrationPayment>("/registrations/payment", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  checkRegistrationPayment: (payload: RegistrationPaymentCheckPayload) =>
    request<RegistrationPayment>("/registrations/payment/check", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  register: (payload: RegistrationPayload) =>
    request<Team>("/registrations", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  participantDashboard: (teamId: string) =>
    request<ParticipantDashboard>(`/participants/${teamId}/dashboard`),
  submitWork: (teamId: string, payload: SubmissionPayload) => {
    const formData = new FormData();
    formData.set("stage", payload.stage);
    if (payload.prototypeUrl?.trim()) {
      formData.set("prototypeUrl", payload.prototypeUrl.trim());
    }
    (["proposal", "ppt", "report", "poster"] as const).forEach((key) => {
      const file = payload[key];
      if (file) formData.set(key, file);
    });
    return request<Submission>(`/participants/${teamId}/submissions`, {
      method: "POST",
      body: formData,
    });
  },
  adminLogin: (email: string, password: string) =>
    request<LoginResponse>("/admin/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  adminStats: (token: string) => request<AdminStats>("/admin/stats", {}, token),
  exportAdminSpreadsheet: (token: string) =>
    downloadRequest("/admin/export.xlsx", token),
  adminTeams: (
    token: string,
    search = "",
    status = "",
    submittedOnly = false,
  ) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (submittedOnly) params.set("submittedOnly", "true");
    const qs = params.toString();
    return request<Team[]>(`/admin/teams${qs ? `?${qs}` : ""}`, {}, token);
  },
  adminTeamDetail: (token: string, teamId: string) =>
    request<TeamDetail>(`/admin/teams/${teamId}`, {}, token),
  deleteTeam: (token: string, teamId: string) =>
    request<{ message: string }>(
      `/admin/teams/${teamId}`,
      { method: "DELETE" },
      token,
    ),
  verifyTeam: (token: string, teamId: string, status = "verified") =>
    request<Team>(
      `/admin/teams/${teamId}/verify`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      token,
    ),
  createEvent: (
    token: string,
    payload: Partial<Event> & { documents?: EventDocumentInput[] },
  ) =>
    request<Event>(
      "/admin/events",
      { method: "POST", body: JSON.stringify(payload) },
      token,
    ),
  activateEvent: (token: string, eventId: string) =>
    request<Event>(
      `/admin/events/${eventId}/activate`,
      { method: "PATCH" },
      token,
    ),
  lockEvent: (token: string, eventId: string) =>
    request<Event>(`/admin/events/${eventId}/lock`, { method: "PATCH" }, token),
  eventDocuments: (token: string, eventId: string) =>
    request<EventDocument[]>(`/admin/events/${eventId}/documents`, {}, token),
  updateEventDocuments: (
    token: string,
    eventId: string,
    items: EventDocumentInput[],
  ) =>
    request<EventDocument[]>(
      `/admin/events/${eventId}/documents`,
      { method: "PUT", body: JSON.stringify({ items }) },
      token,
    ),
  uploadEventDocument: (token: string, eventId: string, file: File) => {
    const formData = new FormData();
    formData.set("file", file);
    return request<{ url: string }>(
      `/admin/events/${eventId}/documents/upload`,
      { method: "POST", body: formData },
      token,
    );
  },
  updateTimeline: (
    token: string,
    eventId: string,
    items: TimelineItemInput[],
  ) =>
    request<TimelineItem[]>(
      `/admin/events/${eventId}/timeline`,
      { method: "PUT", body: JSON.stringify({ items }) },
      token,
    ),
  updateRules: (token: string, eventId: string, payload: EventRulesPayload) =>
    request<EventRules>(
      `/admin/events/${eventId}/rules`,
      { method: "PUT", body: JSON.stringify(payload) },
      token,
    ),
  adminRegistrationSettings: (token: string, eventId: string) =>
    request<EventRegistrationSettings>(
      `/admin/events/${eventId}/registration-settings`,
      {},
      token,
    ),
  updateRegistrationSettings: (
    token: string,
    eventId: string,
    payload: EventRegistrationSettingsPayload,
  ) =>
    request<EventRegistrationSettings>(
      `/admin/events/${eventId}/registration-settings`,
      { method: "PUT", body: JSON.stringify(payload) },
      token,
    ),
  paymentSettings: (token: string, eventId: string) =>
    request<EventPaymentSettings>(
      `/admin/events/${eventId}/payment-settings`,
      {},
      token,
    ),
  updatePaymentSettings: (
    token: string,
    eventId: string,
    payload: EventPaymentSettingsPayload,
  ) =>
    request<EventPaymentSettings>(
      `/admin/events/${eventId}/payment-settings`,
      { method: "PUT", body: JSON.stringify(payload) },
      token,
    ),
  submissionStages: (token: string, eventId: string) =>
    request<SubmissionStage[]>(
      `/admin/events/${eventId}/submission-stages`,
      {},
      token,
    ),
  updateSubmissionStages: (
    token: string,
    eventId: string,
    items: SubmissionStageInput[],
  ) =>
    request<SubmissionStage[]>(
      `/admin/events/${eventId}/submission-stages`,
      { method: "PUT", body: JSON.stringify({ items }) },
      token,
    ),
  rubricQuestions: (token: string, eventId: string) =>
    request<RubricQuestion[]>(`/admin/events/${eventId}/rubric`, {}, token),
  updateRubricQuestions: (
    token: string,
    eventId: string,
    items: RubricQuestionInput[],
  ) =>
    request<RubricQuestion[]>(
      `/admin/events/${eventId}/rubric`,
      { method: "PUT", body: JSON.stringify({ items }) },
      token,
    ),
  updateTeamStageAccess: (
    token: string,
    teamId: string,
    stageId: string,
    isAllowed: boolean,
  ) =>
    request<TeamDetail>(
      `/admin/teams/${teamId}/stage-access`,
      { method: "PATCH", body: JSON.stringify({ stageId, isAllowed }) },
      token,
    ),
  saveJudgeAssessment: (
    token: string,
    teamId: string,
    payload: JudgeAssessmentPayload,
  ) =>
    request<TeamDetail>(
      `/admin/teams/${teamId}/assessment`,
      { method: "PUT", body: JSON.stringify(payload) },
      token,
    ),
  adminFaqs: (token: string, eventId: string) =>
    request<FAQ[]>(`/admin/events/${eventId}/faqs`, {}, token),
  createFaq: (token: string, payload: FAQPayload) =>
    request<FAQ>(
      "/admin/faqs",
      { method: "POST", body: JSON.stringify(payload) },
      token,
    ),
  updateFaq: (token: string, faqId: string, payload: FAQPayload) =>
    request<FAQ>(
      `/admin/faqs/${faqId}`,
      { method: "PUT", body: JSON.stringify(payload) },
      token,
    ),
  deleteFaq: (token: string, faqId: string) =>
    request<{ message: string }>(
      `/admin/faqs/${faqId}`,
      { method: "DELETE" },
      token,
    ),
  uploadAnnouncementImage: (token: string, file: File) => {
    const formData = new FormData();
    formData.set("image", file);
    return request<{ url: string }>(
      "/admin/announcements/image",
      { method: "POST", body: formData },
      token,
    );
  },
  createAnnouncement: (token: string, payload: Partial<Announcement>) =>
    request<Announcement>(
      "/admin/announcements",
      { method: "POST", body: JSON.stringify(payload) },
      token,
    ),
  adminUsers: (token: string) =>
    request<AdminUser[]>("/admin/users", {}, token),
  createAdminUser: (token: string, payload: CreateAdminUserPayload) =>
    request<AdminUser>(
      "/admin/users",
      { method: "POST", body: JSON.stringify(payload) },
      token,
    ),
  adminRedeemCodes: (token: string) =>
    request<AdminRedeemCode[]>("/admin/redeem-codes", {}, token),
  createAdminRedeemCode: (
    token: string,
    payload: CreateAdminRedeemCodePayload,
  ) =>
    request<AdminRedeemCode>(
      "/admin/redeem-codes",
      { method: "POST", body: JSON.stringify(payload) },
      token,
    ),
  claimAdminRedeem: (code: string, payload: ClaimAdminRedeemPayload) =>
    request<ClaimAdminRedeemResponse>(
      `/admin/redeem/${encodeURIComponent(code)}/claim`,
      { method: "POST", body: JSON.stringify(payload) },
    ),
};
