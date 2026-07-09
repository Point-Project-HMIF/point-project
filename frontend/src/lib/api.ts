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
  LoginResponse,
  ParticipantDashboard,
  RegistrationPayload,
  Submission,
  SubmissionPayload,
  Team,
  TeamDetail,
  TimelineItemInput,
  TimelineItem
} from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/api";

type APIEnvelope<T> = {
  data?: T;
  error?: string;
};

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const payload = (await response.json()) as APIEnvelope<T>;
  if (!response.ok) {
    throw new Error(payload.error ?? "API request failed");
  }
  return payload.data as T;
}

export const api = {
  events: () => request<Event[]>("/events"),
  activeEvent: () => request<Event>("/events/active"),
  categories: (eventId: string) => request<Category[]>(`/events/${eventId}/categories`),
  timeline: (eventId: string) => request<TimelineItem[]>(`/events/${eventId}/timeline`),
  committee: (eventId: string) => request<CommitteeMember[]>(`/events/${eventId}/committee`),
  faqs: (eventId: string) => request<FAQ[]>(`/events/${eventId}/faqs`),
  announcements: (eventId: string, type = "") =>
    request<Announcement[]>(`/events/${eventId}/announcements${type ? `?type=${type}` : ""}`),
  register: (payload: RegistrationPayload) =>
    request<Team>("/registrations", { method: "POST", body: JSON.stringify(payload) }),
  participantDashboard: (teamId: string) => request<ParticipantDashboard>(`/participants/${teamId}/dashboard`),
  submitWork: (teamId: string, payload: SubmissionPayload) =>
    request<Submission>(`/participants/${teamId}/submissions`, { method: "POST", body: JSON.stringify(payload) }),
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
  verifyTeam: (token: string, teamId: string, status = "verified") =>
    request<Team>(
      `/admin/teams/${teamId}/verify`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      token
    ),
  createEvent: (token: string, payload: Partial<Event>) =>
    request<Event>("/admin/events", { method: "POST", body: JSON.stringify(payload) }, token),
  updateTimeline: (token: string, eventId: string, items: TimelineItemInput[]) =>
    request<TimelineItem[]>(
      `/admin/events/${eventId}/timeline`,
      { method: "PUT", body: JSON.stringify({ items }) },
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
