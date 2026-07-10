import type {
  AdminStats,
  AdminUser,
  Announcement,
  Category,
  CommitteeMember,
  CreateAdminUserPayload,
  Event,
  FAQ,
  FAQPayload,
  EventRules,
  EventRulesPayload,
  LoginResponse,
  ParticipantDashboard,
  RegistrationOTPPayload,
  RegistrationOTPResponse,
  RegistrationPayload,
  Submission,
  SubmissionPayload,
  SubmissionStage,
  SubmissionStageInput,
  Team,
  TeamDetail,
  TimelineItemInput,
  TimelineItem
} from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/api";
const FILE_CDN_URL = (import.meta.env.VITE_FILE_CDN_URL ?? "https://cdn.pointproject.web.id").replace(/\/+$/, "");

type APIEnvelope<T> = {
  data?: T;
  error?: string;
};

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
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

export function isNotFoundError(error: unknown) {
  return error instanceof Error && /404|not found/i.test(error.message);
}

function encodePath(value: string) {
  return value
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

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
  categories: (eventId: string) => request<Category[]>(`/events/${eventId}/categories`),
  timeline: (eventId: string) => request<TimelineItem[]>(`/events/${eventId}/timeline`),
  committee: (eventId: string) => request<CommitteeMember[]>(`/events/${eventId}/committee`),
  rules: (eventId: string) => request<EventRules>(`/events/${eventId}/rules`),
  faqs: (eventId: string) => request<FAQ[]>(`/events/${eventId}/faqs`),
  announcements: (eventId: string, type = "") =>
    request<Announcement[]>(`/events/${eventId}/announcements${type ? `?type=${type}` : ""}`),
  requestRegistrationOTP: (payload: RegistrationOTPPayload) =>
    request<RegistrationOTPResponse>("/registrations/otp", { method: "POST", body: JSON.stringify(payload) }),
  register: (payload: RegistrationPayload) =>
    request<Team>("/registrations", { method: "POST", body: JSON.stringify(payload) }),
  participantDashboard: (teamId: string) => request<ParticipantDashboard>(`/participants/${teamId}/dashboard`),
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
    return request<Submission>(`/participants/${teamId}/submissions`, { method: "POST", body: formData });
  },
  adminLogin: (email: string, password: string) =>
    request<LoginResponse>("/admin/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }),
  adminStats: (token: string) => request<AdminStats>("/admin/stats", {}, token),
  adminTeams: (token: string, search = "", status = "") => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    const qs = params.toString();
    return request<Team[]>(`/admin/teams${qs ? `?${qs}` : ""}`, {}, token);
  },
  adminTeamDetail: (token: string, teamId: string) => request<TeamDetail>(`/admin/teams/${teamId}`, {}, token),
  deleteTeam: (token: string, teamId: string) => request<{ message: string }>(`/admin/teams/${teamId}`, { method: "DELETE" }, token),
  verifyTeam: (token: string, teamId: string, status = "verified") =>
    request<Team>(
      `/admin/teams/${teamId}/verify`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      token
    ),
  createEvent: (token: string, payload: Partial<Event>) =>
    request<Event>("/admin/events", { method: "POST", body: JSON.stringify(payload) }, token),
  activateEvent: (token: string, eventId: string) =>
    request<Event>(`/admin/events/${eventId}/activate`, { method: "PATCH" }, token),
  lockEvent: (token: string, eventId: string) =>
    request<Event>(`/admin/events/${eventId}/lock`, { method: "PATCH" }, token),
  updateTimeline: (token: string, eventId: string, items: TimelineItemInput[]) =>
    request<TimelineItem[]>(
      `/admin/events/${eventId}/timeline`,
      { method: "PUT", body: JSON.stringify({ items }) },
      token
    ),
  updateRules: (token: string, eventId: string, payload: EventRulesPayload) =>
    request<EventRules>(`/admin/events/${eventId}/rules`, { method: "PUT", body: JSON.stringify(payload) }, token),
  submissionStages: (token: string, eventId: string) =>
    request<SubmissionStage[]>(`/admin/events/${eventId}/submission-stages`, {}, token),
  updateSubmissionStages: (token: string, eventId: string, items: SubmissionStageInput[]) =>
    request<SubmissionStage[]>(
      `/admin/events/${eventId}/submission-stages`,
      { method: "PUT", body: JSON.stringify({ items }) },
      token
    ),
  updateTeamStageAccess: (token: string, teamId: string, stageId: string, isAllowed: boolean) =>
    request<TeamDetail>(
      `/admin/teams/${teamId}/stage-access`,
      { method: "PATCH", body: JSON.stringify({ stageId, isAllowed }) },
      token
    ),
  adminFaqs: (token: string, eventId: string) => request<FAQ[]>(`/admin/events/${eventId}/faqs`, {}, token),
  createFaq: (token: string, payload: FAQPayload) =>
    request<FAQ>("/admin/faqs", { method: "POST", body: JSON.stringify(payload) }, token),
  updateFaq: (token: string, faqId: string, payload: FAQPayload) =>
    request<FAQ>(`/admin/faqs/${faqId}`, { method: "PUT", body: JSON.stringify(payload) }, token),
  deleteFaq: (token: string, faqId: string) => request<{ message: string }>(`/admin/faqs/${faqId}`, { method: "DELETE" }, token),
  createAnnouncement: (token: string, payload: Partial<Announcement>) =>
    request<Announcement>("/admin/announcements", { method: "POST", body: JSON.stringify(payload) }, token),
  adminUsers: (token: string) => request<AdminUser[]>("/admin/users", {}, token),
  createAdminUser: (token: string, payload: CreateAdminUserPayload) =>
    request<AdminUser>("/admin/users", { method: "POST", body: JSON.stringify(payload) }, token)
};
