import { FormEvent, useEffect, useMemo, useState, type Dispatch, type KeyboardEvent, type MouseEvent, type SetStateAction } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  HelpCircle,
  LayoutGrid,
  Lock,
  LogIn,
  Megaphone,
  Plus,
  Power,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  UsersRound,
  X,
  type LucideIcon
} from "lucide-react";
import clsx from "clsx";
import { SectionHeading, StatusPill } from "../components/Layout";
import { api, isNotFoundError } from "../lib/api";
import type {
  AdminStats,
  AdminUser,
  AnnouncementResult,
  CommitteeMember,
  CreateAdminUserPayload,
  Event,
  EventRules,
  FAQ,
  FAQPayload,
  SubmissionStageInput,
  Team,
  TeamDetail,
  TimelineItem,
  TimelineItemInput
} from "../lib/types";

type Tab = "overview" | "event-switch" | "event" | "peserta" | "panitia" | "jadwal" | "submission" | "faq" | "pengumuman" | "akun";
type EventAction = { type: "lock" | "activate"; event: Event } | null;

const emptyStats: AdminStats = {
  events: 0,
  teams: 0,
  pending: 0,
  submissions: 0,
  finalists: 0,
  winners: 0
};

const tabs: Array<{ id: Tab; label: string; icon: LucideIcon; superOnly?: boolean }> = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "event-switch", label: "Event Aktif", icon: Power, superOnly: true },
  { id: "event", label: "Event", icon: CalendarClock, superOnly: true },
  { id: "peserta", label: "Peserta", icon: UsersRound },
  { id: "panitia", label: "Panitia", icon: UserCog },
  { id: "jadwal", label: "Jadwal", icon: ClipboardList },
  { id: "submission", label: "Submission", icon: FileSpreadsheet },
  { id: "faq", label: "FAQ", icon: HelpCircle },
  { id: "pengumuman", label: "Pengumuman", icon: Megaphone },
  { id: "akun", label: "Akun Admin", icon: ShieldCheck }
];

const emptyTimelineItem = (sortOrder: number): TimelineItemInput => ({
  label: "",
  startDate: "",
  endDate: "",
  description: "",
  sortOrder
});

const emptyRules: EventRules = {
  eventId: "",
  minTeamMembers: 2,
  maxTeamMembers: 3
};

const emptySubmissionStage = (sortOrder: number): SubmissionStageInput => ({
  key: "",
  label: "",
  sortOrder,
  isOpen: true,
  requiresApproval: sortOrder > 1
});

const emptyFAQForm = (eventId = "", sortOrder = 1): FAQPayload => ({
  eventId,
  question: "",
  answer: "",
  sortOrder,
  isPublished: true
});

export function AdminPanel() {
  const [token, setToken] = useState(localStorage.getItem("pointproject.adminToken") ?? "");
  const [user, setUser] = useState<AdminUser | null>(() => {
    const raw = localStorage.getItem("pointproject.adminUser");
    return raw ? (JSON.parse(raw) as AdminUser) : null;
  });
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<AdminStats>(emptyStats);
  const [teams, setTeams] = useState<Team[]>([]);
  const [event, setEvent] = useState<Event | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [committee, setCommittee] = useState<CommitteeMember[]>([]);
  const [rules, setRules] = useState<EventRules>(emptyRules);
  const [rulesDraft, setRulesDraft] = useState({ minTeamMembers: 2, maxTeamMembers: 3 });
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [timelineDraft, setTimelineDraft] = useState<TimelineItemInput[]>([]);
  const [submissionStageDraft, setSubmissionStageDraft] = useState<SubmissionStageInput[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamDetail | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [switchingEvent, setSwitchingEvent] = useState(false);
  const [confirmAction, setConfirmAction] = useState<EventAction>(null);
  const [editingFaqId, setEditingFaqId] = useState("");
  const [login, setLogin] = useState({ email: "", password: "" });
  const [eventForm, setEventForm] = useState({
    name: "",
    theme: "",
    year: new Date().getFullYear() + 1,
    startDate: "",
    endDate: "",
    status: "draft"
  });
  const [adminForm, setAdminForm] = useState<CreateAdminUserPayload>({
    name: "",
    nim: "",
    role: "admin",
    division: "",
    password: ""
  });
  const [faqForm, setFaqForm] = useState<FAQPayload>(() => emptyFAQForm());
  const [announcementForm, setAnnouncementForm] = useState({
    type: "finalis",
    title: "",
    body: "",
    teamName: "",
    categoryName: "",
    institution: "",
    workTitle: "",
    prototypeUrl: ""
  });

  const generatedEmail = useMemo(() => {
    const name = adminForm.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "");
    const nim = adminForm.nim.replace(/\D/g, "");
    if (!name || !nim) return "";
    return `${name}.${nim}@student.itera.ac.id`;
  }, [adminForm.name, adminForm.nim]);

  const isSuperAdmin = user?.role === "super_admin";
  const visibleTabs = useMemo(() => tabs.filter((item) => !item.superOnly || isSuperAdmin), [isSuperAdmin]);

  const filteredTeams = useMemo(() => {
    const q = search.toLowerCase();
    return teams.filter((team) => {
      const matchesSearch =
        !q ||
        `${team.name} ${team.leaderName} ${team.institution} ${team.leaderEmail}`.toLowerCase().includes(q);
      const matchesStatus = !status || team.verificationStatus === status;
      return matchesSearch && matchesStatus;
    });
  }, [teams, search, status]);

  const statCards: Array<{ label: string; value: number; icon: LucideIcon }> = [
    { label: "Event", value: stats.events, icon: CalendarClock },
    { label: "Tim Terdaftar", value: stats.teams, icon: UsersRound },
    { label: "Menunggu Verifikasi", value: stats.pending, icon: ShieldCheck },
    { label: "Submission", value: stats.submissions, icon: FileSpreadsheet },
    { label: "Finalis", value: stats.finalists, icon: ClipboardList },
    { label: "Pemenang", value: stats.winners, icon: Megaphone }
  ];

  async function loadAdminData(nextToken = token) {
    if (!nextToken) return;
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const [nextStats, nextTeams, nextUsers, active, nextEvents] = await Promise.all([
        api.adminStats(nextToken),
        api.adminTeams(nextToken),
        api.adminUsers(nextToken),
        api.activeEvent(),
        api.events()
      ]);
      const [nextCommittee, nextTimeline, nextRules, nextSubmissionStages, nextFAQs] = await Promise.all([
        api.committee(active.id),
        api.timeline(active.id),
        api.rules(active.id).catch((err) => {
          if (isNotFoundError(err)) return { ...emptyRules, eventId: active.id };
          throw err;
        }),
        api.submissionStages(nextToken, active.id).catch((err) => {
          if (isNotFoundError(err)) return [];
          throw err;
        }),
        api.adminFaqs(nextToken, active.id).catch((err) => {
          if (isNotFoundError(err)) return [];
          throw err;
        })
      ]);
      setStats(nextStats);
      setTeams(nextTeams ?? []);
      setAdminUsers(nextUsers ?? []);
      setEvent(active);
      setEvents(nextEvents ?? []);
      setCommittee(nextCommittee ?? []);
      setTimeline(nextTimeline ?? []);
      setTimelineDraft((nextTimeline ?? []).map(timelineToInput));
      setRules(nextRules);
      setRulesDraft({
        minTeamMembers: nextRules.minTeamMembers,
        maxTeamMembers: nextRules.maxTeamMembers
      });
      setSubmissionStageDraft((nextSubmissionStages ?? []).map(submissionStageToInput));
      setFaqs(nextFAQs ?? []);
      setFaqForm((current) => ({
        ...current,
        eventId: active.id,
        sortOrder: current.eventId === active.id ? current.sortOrder : (nextFAQs ?? []).length + 1
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data admin.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) loadAdminData(token);
  }, []);

  useEffect(() => {
    if (!isSuperAdmin && (tab === "event" || tab === "event-switch")) {
      setTab("overview");
    }
  }, [isSuperAdmin, tab]);

  async function submitLogin(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await api.adminLogin(login.email, login.password);
      setToken(response.token);
      setUser(response.user);
      localStorage.setItem("pointproject.adminToken", response.token);
      localStorage.setItem("pointproject.adminUser", JSON.stringify(response.user));
      await loadAdminData(response.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login admin gagal.");
    } finally {
      setLoading(false);
    }
  }

  async function openTeamDetail(teamId: string) {
    setLoading(true);
    setError("");
    try {
      const detail = await api.adminTeamDetail(token, teamId);
      setSelectedTeam(normalizeTeamDetail(detail));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat detail tim.");
    } finally {
      setLoading(false);
    }
  }

  async function verify(teamId: string, nextStatus: string) {
    setLoading(true);
    setError("");
    try {
      const nextTeam = await api.verifyTeam(token, teamId, nextStatus);
      setTeams((current) => current.map((team) => (team.id === teamId ? nextTeam : team)));
      if (selectedTeam?.team.id === teamId) {
        setSelectedTeam({ ...selectedTeam, team: nextTeam });
      }
      setMessage(`Status ${nextTeam.name} diperbarui menjadi ${nextTeam.verificationStatus}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui status tim.");
    } finally {
      setLoading(false);
    }
  }

  async function createEvent(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    setLoading(true);
    setError("");
    try {
      const nextEvent = await api.createEvent(token, eventForm);
      await loadAdminData(token);
      setEventForm({
        name: "",
        theme: "",
        year: nextEvent.year + 1,
        startDate: "",
        endDate: "",
        status: "draft"
      });
      setMessage(`${nextEvent.name} berhasil dibuat. Aktifkan dari tab Event Aktif saat siap dipakai.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat event.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmEventAction() {
    if (!confirmAction) return;
    const action = confirmAction;
    setLoading(true);
    setSwitchingEvent(action.type === "activate");
    setError("");
    setMessage("");
    setConfirmAction(null);
    try {
      const nextEvent =
        action.type === "lock"
          ? await api.lockEvent(token, action.event.id)
          : await api.activateEvent(token, action.event.id);
      await loadAdminData(token);
      window.dispatchEvent(new CustomEvent("pointproject:event-changed"));
      setTab(action.type === "activate" ? "overview" : "event-switch");
      setMessage(
        action.type === "lock"
          ? `${nextEvent.name} sudah dikunci permanen dari admin.`
          : `${nextEvent.name} sekarang menjadi event aktif.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memproses event.");
    } finally {
      setSwitchingEvent(false);
      setLoading(false);
    }
  }

  async function saveTimeline() {
    if (!event) {
      setError("Event aktif belum dimuat.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const normalized = timelineDraft.map((item, index) => ({ ...item, sortOrder: index + 1 }));
      const nextTimeline = await api.updateTimeline(token, event.id, normalized);
      setTimeline(nextTimeline);
      setTimelineDraft(nextTimeline.map(timelineToInput));
      setMessage("Jadwal berhasil diperbarui.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan jadwal.");
    } finally {
      setLoading(false);
    }
  }

  async function saveRules() {
    if (!event) {
      setError("Event aktif belum dimuat.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const nextRules = await api.updateRules(token, event.id, rulesDraft);
      setRules(nextRules);
      setRulesDraft({
        minTeamMembers: nextRules.minTeamMembers,
        maxTeamMembers: nextRules.maxTeamMembers
      });
      setMessage("Aturan jumlah anggota berhasil diperbarui.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan aturan anggota.");
    } finally {
      setLoading(false);
    }
  }

  async function saveSubmissionStages() {
    if (!event) {
      setError("Event aktif belum dimuat.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const normalized = submissionStageDraft.map((item, index) => ({ ...item, sortOrder: index + 1 }));
      const nextStages = await api.updateSubmissionStages(token, event.id, normalized);
      setSubmissionStageDraft(nextStages.map(submissionStageToInput));
      setMessage("Tahap upload karya berhasil diperbarui.");
      if (selectedTeam) {
        const detail = await api.adminTeamDetail(token, selectedTeam.team.id);
        setSelectedTeam(normalizeTeamDetail(detail));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan tahap upload karya.");
    } finally {
      setLoading(false);
    }
  }

  async function setStageAccess(teamId: string, stageId: string, isAllowed: boolean) {
    setLoading(true);
    setError("");
    try {
      const detail = await api.updateTeamStageAccess(token, teamId, stageId, isAllowed);
      setSelectedTeam(normalizeTeamDetail(detail));
      setMessage(isAllowed ? "Akses tahap tim dibuka." : "Akses tahap tim ditutup.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui akses tahap tim.");
    } finally {
      setLoading(false);
    }
  }

  async function createAdmin(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    setLoading(true);
    setError("");
    try {
      const nextUser = await api.createAdminUser(token, adminForm);
      setAdminUsers((current) => [nextUser, ...current]);
      setAdminForm({ name: "", nim: "", role: "admin", division: "", password: "" });
      setMessage(`Akun ${nextUser.email} berhasil dibuat.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat akun panitia.");
    } finally {
      setLoading(false);
    }
  }

  async function saveFAQ(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    if (!event) {
      setError("Event aktif belum dimuat.");
      return;
    }
    setLoading(true);
    setError("");
    const payload: FAQPayload = {
      ...faqForm,
      eventId: event.id,
      question: faqForm.question.trim(),
      answer: faqForm.answer.trim(),
      sortOrder: Number(faqForm.sortOrder) || faqs.length + 1
    };
    try {
      const nextFAQ = editingFaqId
        ? await api.updateFaq(token, editingFaqId, payload)
        : await api.createFaq(token, payload);
      setFaqs((current) =>
        sortFAQs(editingFaqId ? current.map((faq) => (faq.id === nextFAQ.id ? nextFAQ : faq)) : [...current, nextFAQ])
      );
      setEditingFaqId("");
      setFaqForm(emptyFAQForm(event.id, faqs.length + (editingFaqId ? 1 : 2)));
      setMessage(editingFaqId ? "FAQ berhasil diperbarui." : "FAQ baru berhasil ditambahkan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan FAQ.");
    } finally {
      setLoading(false);
    }
  }

  function editFAQ(faq: FAQ) {
    setEditingFaqId(faq.id);
    setFaqForm({
      eventId: faq.eventId,
      question: faq.question,
      answer: faq.answer,
      sortOrder: faq.sortOrder,
      isPublished: faq.isPublished
    });
  }

  function cancelFAQEdit() {
    setEditingFaqId("");
    setFaqForm(emptyFAQForm(event?.id ?? "", faqs.length + 1));
  }

  async function deleteFAQ(faqId: string) {
    setLoading(true);
    setError("");
    try {
      await api.deleteFaq(token, faqId);
      setFaqs((current) => current.filter((faq) => faq.id !== faqId));
      if (editingFaqId === faqId) {
        cancelFAQEdit();
      }
      setMessage("FAQ berhasil dihapus.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus FAQ.");
    } finally {
      setLoading(false);
    }
  }

  async function createAnnouncement(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    if (!event) {
      setError("Event aktif belum dimuat.");
      return;
    }
    setLoading(true);
    setError("");
    const result: AnnouncementResult = {
      rank: announcementForm.type === "pemenang" ? 1 : 0,
      teamName: announcementForm.teamName,
      categoryName: announcementForm.categoryName,
      institution: announcementForm.institution,
      workTitle: announcementForm.workTitle,
      prototypeUrl: announcementForm.prototypeUrl
    };
    try {
      const announcement = await api.createAnnouncement(token, {
        eventId: event.id,
        type: announcementForm.type,
        title: announcementForm.title,
        body: announcementForm.body,
        results: result.teamName ? [result] : []
      });
      setMessage(`${announcement.title} berhasil dipublish.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat pengumuman.");
    } finally {
      setLoading(false);
    }
  }

  if (!token || !user) {
    return (
      <section className="py-14">
        <div className="mx-auto max-w-xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Admin Panel"
            title="Login Panitia"
            body="Panel ini digunakan untuk verifikasi peserta, jadwal, pembuatan akun, dan publikasi pengumuman."
          />
          <form onSubmit={submitLogin} className="mt-10 rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
            {error ? <p className="mb-4 rounded-md bg-coral/10 px-4 py-3 text-sm font-bold text-coral">{error}</p> : null}
            <div className="grid gap-4">
              <div>
                <label className="label" htmlFor="admin-email">
                  Email
                </label>
                <input
                  id="admin-email"
                  className="field"
                  type="email"
                  value={login.email}
                  onChange={(event) => setLogin((current) => ({ ...current, email: event.target.value }))}
                  placeholder="admin@pointproject.id"
                />
              </div>
              <div>
                <label className="label" htmlFor="admin-password">
                  Password
                </label>
                <input
                  id="admin-password"
                  className="field"
                  type="password"
                  value={login.password}
                  onChange={(event) => setLogin((current) => ({ ...current, password: event.target.value }))}
                  placeholder="Masukkan password"
                />
              </div>
              <button className="btn-primary" disabled={loading}>
                <LogIn size={18} />
                {loading ? "Memproses..." : "Masuk"}
              </button>
            </div>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section className="py-6 sm:py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink/55">Admin Panel</p>
            <h1 className="break-words text-2xl font-black sm:text-3xl">{event?.name ?? "Event belum dimuat"}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => loadAdminData()} disabled={loading}>
              <RefreshCw size={18} />
              Refresh
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                localStorage.removeItem("pointproject.adminToken");
                localStorage.removeItem("pointproject.adminUser");
                setToken("");
                setUser(null);
              }}
            >
              Keluar
            </button>
          </div>
        </div>

        {error ? <p className="mb-5 rounded-md bg-coral/10 px-4 py-3 text-sm font-bold text-coral">{error}</p> : null}
        {message ? <p className="mb-5 rounded-md bg-lagoon/10 px-4 py-3 text-sm font-bold text-lagoon">{message}</p> : null}
        {switchingEvent ? (
          <div className="mb-5 rounded-lg border border-lagoon/20 bg-lagoon/10 px-4 py-4 text-sm font-bold text-lagoon">
            Memuat event baru dan menyesuaikan tampilan website...
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-ink/10 bg-white p-2 shadow-soft sm:p-3">
            <nav className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
              {visibleTabs.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    className={clsx(
                      "flex min-w-0 items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-black transition",
                      tab === item.id ? "bg-ink text-white" : "text-ink/68 hover:bg-cloud hover:text-ink"
                    )}
                  >
                    <Icon className="shrink-0" size={18} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0">
            {tab === "overview" ? (
              <div className="grid gap-5 md:grid-cols-3">
                {statCards.map(({ label, value, icon: Icon }) => (
                  <article key={label} className="card">
                    <Icon className="text-lagoon" size={24} />
                    <p className="mt-4 text-3xl font-black">{value}</p>
                    <p className="mt-1 text-sm font-bold text-ink/55">{label}</p>
                  </article>
                ))}
              </div>
            ) : null}

            {tab === "peserta" ? (
              <div className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
                <div className={clsx("grid gap-5", selectedTeam && "xl:grid-cols-[minmax(0,1fr)_360px]")}>
                  <div className="min-w-0">
                    <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-3 text-ink/35" size={18} />
                        <input
                          className="field pl-10"
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Cari tim, ketua, instansi, email"
                        />
                      </div>
                      <select className="field" value={status} onChange={(event) => setStatus(event.target.value)}>
                        <option value="">Semua status</option>
                        <option value="pending">Pending</option>
                        <option value="verified">Verified</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                    <TeamTable
                      teams={filteredTeams}
                      onVerify={verify}
                      onDetail={openTeamDetail}
                      loading={loading}
                      selectedTeamId={selectedTeam?.team.id}
                    />
                  </div>
                  {selectedTeam ? (
                    <TeamDetailPanel
                      detail={selectedTeam}
                      onClose={() => setSelectedTeam(null)}
                      onStageAccess={setStageAccess}
                      loading={loading}
                      embedded
                    />
                  ) : null}
                </div>
              </div>
            ) : null}

            {tab === "event-switch" ? (
              <div className="grid gap-5">
                <article className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-lagoon">Event Aktif Saat Ini</p>
                      <h2 className="mt-3 break-words text-2xl font-black">{event?.name ?? "Belum ada event aktif"}</h2>
                      {event ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <StatusPill tone={event.status === "aktif" ? "teal" : "ink"}>{event.status}</StatusPill>
                          <StatusPill tone={event.lockedAt ? "coral" : "amber"}>
                            {event.lockedAt ? "Locked" : "Belum locked"}
                          </StatusPill>
                          <span className="text-sm font-bold text-ink/55">{formatEventDates(event)}</span>
                        </div>
                      ) : null}
                      <p className="mt-4 max-w-3xl text-sm leading-6 text-ink/65">
                        Lock event bersifat permanen dari admin. Setelah dikunci, super admin tidak dapat membuka lock lagi.
                        Untuk mengganti event aktif, lock event lama terlebih dahulu, lalu pilih event baru.
                      </p>
                    </div>
                    {event ? (
                      <button
                        type="button"
                        className="btn-secondary shrink-0 border-coral/30 text-coral hover:bg-coral/10"
                        disabled={loading || Boolean(event.lockedAt)}
                        onClick={() => setConfirmAction({ type: "lock", event })}
                      >
                        <Lock size={18} />
                        {event.lockedAt ? "Sudah Locked" : "Lock Event Ini"}
                      </button>
                    ) : null}
                  </div>
                </article>

                <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-xl font-black">Pilih Event yang Dipakai Website</h2>
                      <p className="mt-1 text-sm text-ink/60">Landing page, pendaftaran, dashboard, FAQ, jadwal, dan pengumuman mengikuti event aktif.</p>
                    </div>
                    <StatusPill tone="ink">{events.length} event</StatusPill>
                  </div>
                  <div className="mt-5 grid gap-3">
                    {events.map((item) => {
                      const isCurrent = item.id === event?.id;
                      const activeEventMustBeLocked = Boolean(event && !event.lockedAt && !isCurrent);
                      const disabledReason = item.lockedAt
                        ? "Event locked tidak bisa diaktifkan dari admin."
                        : activeEventMustBeLocked
                          ? "Lock event aktif saat ini terlebih dahulu."
                          : "";
                      return (
                        <article key={item.id} className={clsx("rounded-lg border p-4", isCurrent ? "border-lagoon/40 bg-lagoon/5" : "border-ink/10")}>
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusPill tone={item.status === "aktif" ? "teal" : item.status === "draft" ? "amber" : "ink"}>
                                  {item.status}
                                </StatusPill>
                                {item.lockedAt ? <StatusPill tone="coral">Locked</StatusPill> : null}
                                <span className="text-xs font-bold text-ink/45">{formatEventDates(item)}</span>
                              </div>
                              <h3 className="mt-3 break-words font-black">{item.name}</h3>
                              <p className="mt-1 break-words text-sm leading-6 text-ink/60">{item.theme}</p>
                              {disabledReason ? <p className="mt-2 text-xs font-bold text-coral">{disabledReason}</p> : null}
                            </div>
                            <button
                              type="button"
                              className="btn-primary shrink-0"
                              disabled={loading || isCurrent || Boolean(item.lockedAt) || activeEventMustBeLocked}
                              onClick={() => setConfirmAction({ type: "activate", event: item })}
                            >
                              <Power size={18} />
                              {isCurrent ? "Sedang Aktif" : "Gunakan Event Ini"}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                    {!events.length ? (
                      <article className="rounded-lg border border-dashed border-ink/20 p-8 text-center">
                        <p className="font-black">Belum ada event.</p>
                        <p className="mt-2 text-sm text-ink/60">Buat periode baru terlebih dahulu.</p>
                      </article>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "event" ? (
              <form onSubmit={createEvent} className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
                <h2 className="text-xl font-black">Buat Periode Baru</h2>
                <p className="mt-2 text-sm leading-6 text-ink/60">
                  Event baru dibuat sebagai draft atau arsip. Untuk menampilkan event baru ke website, gunakan tab Event Aktif.
                </p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <TextField label="Nama Event" value={eventForm.name} onChange={(value) => setEventForm((current) => ({ ...current, name: value }))} />
                  <TextField
                    label="Tahun"
                    type="number"
                    value={String(eventForm.year)}
                    onChange={(value) => setEventForm((current) => ({ ...current, year: Number(value) }))}
                  />
                  <div className="md:col-span-2">
                    <TextField
                      label="Tema"
                      value={eventForm.theme}
                      onChange={(value) => setEventForm((current) => ({ ...current, theme: value }))}
                    />
                  </div>
                  <TextField label="Tanggal Mulai" type="date" value={eventForm.startDate} onChange={(value) => setEventForm((current) => ({ ...current, startDate: value }))} />
                  <TextField label="Tanggal Selesai" type="date" value={eventForm.endDate} onChange={(value) => setEventForm((current) => ({ ...current, endDate: value }))} />
                  <div>
                    <label className="label" htmlFor="status">
                      Status
                    </label>
                    <select
                      id="status"
                      className="field"
                      value={eventForm.status}
                      onChange={(event) => setEventForm((current) => ({ ...current, status: event.target.value }))}
                    >
                      <option value="draft">Draft</option>
                      <option value="arsip">Arsip</option>
                    </select>
                  </div>
                </div>
                <div className="mt-5 flex justify-end">
                  <button className="btn-primary" disabled={loading}>
                    <CalendarClock size={18} />
                    Simpan Event
                  </button>
                </div>
              </form>
            ) : null}

            {tab === "panitia" ? (
              <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                <form onSubmit={createAdmin} className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
                  <h2 className="text-xl font-black">Tambah Akun Panitia</h2>
                  <div className="mt-5 grid gap-4">
                    <TextField label="Nama" value={adminForm.name} onChange={(value) => setAdminForm((current) => ({ ...current, name: value }))} />
                    <TextField label="NIM" value={adminForm.nim} onChange={(value) => setAdminForm((current) => ({ ...current, nim: value }))} />
                    <div>
                      <label className="label" htmlFor="admin-role">
                        Role
                      </label>
                      <select
                        id="admin-role"
                        className="field"
                        value={adminForm.role}
                        onChange={(event) => setAdminForm((current) => ({ ...current, role: event.target.value }))}
                      >
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                        <option value="juri">Juri</option>
                      </select>
                    </div>
                    <TextField label="Divisi" value={adminForm.division} onChange={(value) => setAdminForm((current) => ({ ...current, division: value }))} />
                    <TextField
                      label="Password Awal"
                      type="password"
                      value={adminForm.password}
                      onChange={(value) => setAdminForm((current) => ({ ...current, password: value }))}
                      placeholder="Kosongkan untuk memakai NIM"
                    />
                    <div className="rounded-md bg-cloud px-4 py-3 text-sm">
                      <span className="font-bold text-ink/55">Email:</span>{" "}
                      <span className="font-black">{generatedEmail || "nama.nim@student.itera.ac.id"}</span>
                    </div>
                  </div>
                  <div className="mt-5 flex justify-end">
                    <button className="btn-primary" disabled={loading}>
                      <UserPlus size={18} />
                      Buat Akun
                    </button>
                  </div>
                </form>
                <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
                  <h2 className="text-xl font-black">Akun Admin & Panitia</h2>
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-sm">
                      <thead className="border-b border-ink/10 text-xs uppercase text-ink/45">
                        <tr>
                          <th className="py-3 pr-4">Nama</th>
                          <th className="py-3 pr-4">Email</th>
                          <th className="py-3 pr-4">Role</th>
                          <th className="py-3 pr-4">Divisi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink/10">
                        {adminUsers.map((item) => (
                          <tr key={item.id}>
                            <td className="py-3 pr-4">
                              <p className="font-black">{item.name}</p>
                              <p className="text-xs text-ink/50">{item.nim || "-"}</p>
                            </td>
                            <td className="py-3 pr-4">{item.email}</td>
                            <td className="py-3 pr-4">{item.role}</td>
                            <td className="py-3 pr-4">{item.division || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "jadwal" ? (
              <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-black">Editor Jadwal</h2>
                    <p className="mt-1 text-sm text-ink/60">Semua tahap disimpan ke tabel timeline event aktif.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setTimelineDraft((current) => [...current, emptyTimelineItem(current.length + 1)])}
                    >
                      <Plus size={18} />
                      Tambah Tahap
                    </button>
                    <button type="button" className="btn-primary" onClick={saveTimeline} disabled={loading}>
                      <Save size={18} />
                      Simpan
                    </button>
                  </div>
                </div>
                <div className="mt-5 grid gap-4">
                  {timelineDraft.map((item, index) => (
                    <div key={index} className="rounded-lg border border-ink/10 bg-cloud p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm font-black">Tahap {index + 1}</p>
                        <button
                          type="button"
                          className="btn-secondary px-3 py-2"
                          onClick={() => setTimelineDraft((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        >
                          <Trash2 size={16} />
                          Hapus
                        </button>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <TextField label="Nama Tahap" value={item.label} onChange={(value) => updateTimelineDraft(index, "label", value, setTimelineDraft)} />
                        <TextField label="Urutan" type="number" value={String(index + 1)} onChange={() => undefined} disabled />
                        <TextField label="Tanggal Mulai" type="date" value={item.startDate} onChange={(value) => updateTimelineDraft(index, "startDate", value, setTimelineDraft)} />
                        <TextField label="Tanggal Selesai" type="date" value={item.endDate} onChange={(value) => updateTimelineDraft(index, "endDate", value, setTimelineDraft)} />
                        <div className="md:col-span-2">
                          <TextField label="Deskripsi" value={item.description} onChange={(value) => updateTimelineDraft(index, "description", value, setTimelineDraft)} />
                        </div>
                      </div>
                    </div>
                  ))}
                  {!timelineDraft.length ? (
                    <article className="rounded-lg border border-dashed border-ink/20 p-8 text-center">
                      <p className="font-black">Belum ada tahap jadwal.</p>
                      <p className="mt-2 text-sm text-ink/60">Tambahkan tahap baru lalu simpan untuk mengisi timeline event.</p>
                    </article>
                  ) : null}
                </div>

                <div className="mt-8 border-t border-ink/10 pt-8">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-xl font-black">Tahap Upload Karya</h2>
                      <p className="mt-1 text-sm text-ink/60">Tahap ini menentukan pilihan upload di dashboard peserta.</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setSubmissionStageDraft((current) => [...current, emptySubmissionStage(current.length + 1)])}
                      >
                        <Plus size={18} />
                        Tambah Tahap
                      </button>
                      <button type="button" className="btn-primary" onClick={saveSubmissionStages} disabled={loading}>
                        <Save size={18} />
                        Simpan Tahap
                      </button>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-4">
                    {submissionStageDraft.map((item, index) => (
                      <div key={index} className="rounded-lg border border-ink/10 bg-cloud p-4">
                        <div className="mb-4 flex items-center justify-between">
                          <p className="text-sm font-black">Tahap Upload {index + 1}</p>
                          <button
                            type="button"
                            className="btn-secondary px-3 py-2"
                            onClick={() => setSubmissionStageDraft((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                          >
                            <Trash2 size={16} />
                            Hapus
                          </button>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <TextField label="Nama Tahap" value={item.label} onChange={(value) => updateSubmissionStageDraft(index, "label", value, setSubmissionStageDraft)} />
                          <TextField label="Key Tahap" value={item.key} onChange={(value) => updateSubmissionStageDraft(index, "key", value, setSubmissionStageDraft)} placeholder="awal, final, semifinal" />
                          <TextField label="Urutan" type="number" value={String(index + 1)} onChange={() => undefined} disabled />
                          <label className="flex items-center gap-3 rounded-md bg-white px-4 py-3 text-sm font-bold">
                            <input
                              type="checkbox"
                              checked={item.isOpen}
                              onChange={(event) => updateSubmissionStageDraft(index, "isOpen", event.target.checked, setSubmissionStageDraft)}
                            />
                            Tahap dibuka
                          </label>
                          <label className="flex items-center gap-3 rounded-md bg-white px-4 py-3 text-sm font-bold md:col-span-2">
                            <input
                              type="checkbox"
                              checked={item.requiresApproval}
                              onChange={(event) => updateSubmissionStageDraft(index, "requiresApproval", event.target.checked, setSubmissionStageDraft)}
                            />
                            Wajib lolos/diberi akses oleh admin sebelum peserta bisa submit
                          </label>
                        </div>
                      </div>
                    ))}
                    {!submissionStageDraft.length ? (
                      <article className="rounded-lg border border-dashed border-ink/20 p-8 text-center">
                        <p className="font-black">Belum ada tahap upload.</p>
                        <p className="mt-2 text-sm text-ink/60">Tambahkan minimal satu tahap agar peserta bisa mengirim karya.</p>
                      </article>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "faq" ? (
              <div className="grid gap-5">
                <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-xl font-black">Aturan Jumlah Peserta</h2>
                      <p className="mt-1 text-sm text-ink/60">
                        Batas ini dihitung termasuk ketua. Sistem akan menolak pendaftaran di luar batas ini.
                      </p>
                    </div>
                    <StatusPill tone="teal">
                      {rules.minTeamMembers}-{rules.maxTeamMembers} orang
                    </StatusPill>
                  </div>
                  <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                    <TextField
                      label="Minimal Peserta"
                      type="number"
                      value={String(rulesDraft.minTeamMembers)}
                      onChange={(value) => setRulesDraft((current) => ({ ...current, minTeamMembers: Number(value) }))}
                    />
                    <TextField
                      label="Maksimal Peserta"
                      type="number"
                      value={String(rulesDraft.maxTeamMembers)}
                      onChange={(value) => setRulesDraft((current) => ({ ...current, maxTeamMembers: Number(value) }))}
                    />
                    <div className="flex items-end">
                      <button type="button" className="btn-primary w-full" onClick={saveRules} disabled={loading || !event}>
                        <Save size={18} />
                        Simpan
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
                  <form onSubmit={saveFAQ} className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
                    <h2 className="text-xl font-black">{editingFaqId ? "Edit FAQ" : "Tambah FAQ / Aturan"}</h2>
                    <div className="mt-5 grid gap-4">
                      <TextField
                        label="Pertanyaan"
                        value={faqForm.question}
                        onChange={(value) => setFaqForm((current) => ({ ...current, question: value }))}
                        placeholder="Contoh: Berapa jumlah anggota dalam satu tim?"
                      />
                      <TextAreaField
                        label="Jawaban / Aturan"
                        value={faqForm.answer}
                        onChange={(value) => setFaqForm((current) => ({ ...current, answer: value }))}
                        placeholder="Tulis aturan atau jawaban yang akan tampil di landing page."
                      />
                      <TextField
                        label="Urutan"
                        type="number"
                        value={String(faqForm.sortOrder)}
                        onChange={(value) => setFaqForm((current) => ({ ...current, sortOrder: Number(value) }))}
                      />
                      <label className="flex items-center gap-3 rounded-md bg-cloud px-4 py-3 text-sm font-bold">
                        <input
                          type="checkbox"
                          checked={faqForm.isPublished}
                          onChange={(event) => setFaqForm((current) => ({ ...current, isPublished: event.target.checked }))}
                        />
                        Tampilkan di halaman publik
                      </label>
                    </div>
                    <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                      {editingFaqId ? (
                        <button type="button" className="btn-secondary" onClick={cancelFAQEdit} disabled={loading}>
                          Batal
                        </button>
                      ) : null}
                      <button className="btn-primary" disabled={loading || !event}>
                        <Save size={18} />
                        {editingFaqId ? "Simpan Perubahan" : "Tambah FAQ"}
                      </button>
                    </div>
                  </form>

                <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-xl font-black">FAQ & Aturan Publik</h2>
                      <p className="mt-1 text-sm text-ink/60">{event?.name ?? "Event aktif"} memakai daftar ini secara dinamis.</p>
                    </div>
                    <StatusPill tone="ink">{faqs.length} item</StatusPill>
                  </div>
                  <div className="mt-5 grid gap-3">
                    {faqs.map((faq) => (
                      <article key={faq.id} className="rounded-lg border border-ink/10 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusPill tone={faq.isPublished ? "teal" : "ink"}>
                                {faq.isPublished ? "Published" : "Draft"}
                              </StatusPill>
                              <span className="text-xs font-bold text-ink/45">Urutan {faq.sortOrder}</span>
                            </div>
                            <h3 className="mt-3 break-words font-black">{faq.question}</h3>
                            <p className="mt-2 break-words text-sm leading-6 text-ink/65">{faq.answer || "-"}</p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button type="button" className="btn-secondary px-3 py-2" onClick={() => editFAQ(faq)} disabled={loading}>
                              Edit
                            </button>
                            <button type="button" className="btn-secondary px-3 py-2" onClick={() => deleteFAQ(faq.id)} disabled={loading}>
                              Hapus
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                    {!faqs.length ? (
                      <article className="rounded-lg border border-dashed border-ink/20 p-8 text-center">
                        <p className="font-black">Belum ada FAQ.</p>
                        <p className="mt-2 text-sm text-ink/60">Tambahkan aturan pertama untuk event aktif.</p>
                      </article>
                    ) : null}
                  </div>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "submission" ? (
              <div className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
                <div className={clsx("grid gap-5", selectedTeam && "xl:grid-cols-[minmax(0,1fr)_360px]")}>
                  <div className="min-w-0">
                    <h2 className="text-xl font-black">Rekap Submission</h2>
                    <TeamTable
                      teams={teams}
                      onVerify={verify}
                      onDetail={openTeamDetail}
                      loading={loading}
                      selectedTeamId={selectedTeam?.team.id}
                      compact
                    />
                  </div>
                  {selectedTeam ? (
                    <TeamDetailPanel
                      detail={selectedTeam}
                      onClose={() => setSelectedTeam(null)}
                      onStageAccess={setStageAccess}
                      loading={loading}
                      embedded
                    />
                  ) : null}
                </div>
              </div>
            ) : null}

            {tab === "pengumuman" ? (
              <form onSubmit={createAnnouncement} className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
                <h2 className="text-xl font-black">Publish Pengumuman</h2>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="announcement-type">
                      Jenis
                    </label>
                    <select
                      id="announcement-type"
                      className="field"
                      value={announcementForm.type}
                      onChange={(event) => setAnnouncementForm((current) => ({ ...current, type: event.target.value }))}
                    >
                      <option value="finalis">Finalis</option>
                      <option value="pemenang">Pemenang</option>
                      <option value="info">Info</option>
                    </select>
                  </div>
                  {[
                    ["title", "Judul"],
                    ["body", "Isi"],
                    ["teamName", "Nama Tim"],
                    ["categoryName", "Kategori"],
                    ["institution", "Instansi"],
                    ["workTitle", "Judul Karya"],
                    ["prototypeUrl", "Link Prototype"]
                  ].map(([key, label]) => (
                    <div key={key} className={key === "body" ? "md:col-span-2" : ""}>
                      <TextField
                        label={label}
                        value={(announcementForm as Record<string, string>)[key]}
                        onChange={(value) => setAnnouncementForm((current) => ({ ...current, [key]: value }))}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex justify-end">
                  <button className="btn-primary" disabled={loading}>
                    <Megaphone size={18} />
                    Publish
                  </button>
                </div>
              </form>
            ) : null}

            {tab === "akun" ? (
              <article className="card">
                <StatusPill tone={user.role === "super_admin" ? "ink" : "teal"}>{user.role}</StatusPill>
                <h2 className="mt-4 text-2xl font-black">{user.name}</h2>
                <p className="mt-2 text-sm text-ink/65">{user.email}</p>
                <p className="mt-1 text-sm text-ink/65">Divisi {user.division || "-"}</p>
              </article>
            ) : null}
          </div>
        </div>
        {confirmAction ? (
          <EventActionModal
            action={confirmAction}
            loading={loading}
            onCancel={() => setConfirmAction(null)}
            onConfirm={confirmEventAction}
          />
        ) : null}
      </div>
    </section>
  );
}

function timelineToInput(item: TimelineItem): TimelineItemInput {
  return {
    id: item.id,
    label: item.label,
    startDate: item.startDate,
    endDate: item.endDate,
    description: item.description,
    sortOrder: item.sortOrder
  };
}

function submissionStageToInput(item: SubmissionStageInput): SubmissionStageInput {
  return {
    id: item.id,
    key: item.key,
    label: item.label,
    sortOrder: item.sortOrder,
    isOpen: item.isOpen,
    requiresApproval: item.requiresApproval
  };
}

function normalizeTeamDetail(detail: TeamDetail): TeamDetail {
  return {
    ...detail,
    team: {
      ...detail.team,
      members: detail.team.members ?? []
    },
    submissions: detail.submissions ?? [],
    submissionStages: detail.submissionStages ?? []
  };
}

function sortFAQs(items: FAQ[]) {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.question.localeCompare(b.question));
}

function formatEventDates(event: Event) {
  return `${event.year} | ${event.startDate} - ${event.endDate}`;
}

function EventActionModal({
  action,
  loading,
  onCancel,
  onConfirm
}: {
  action: Exclude<EventAction, null>;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isLock = action.type === "lock";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/55 px-4 py-6">
      <article className="w-full max-w-lg rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <span className={clsx("grid h-10 w-10 shrink-0 place-items-center rounded-md", isLock ? "bg-coral/10 text-coral" : "bg-lagoon/10 text-lagoon")}>
            {isLock ? <Lock size={20} /> : <AlertTriangle size={20} />}
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-black">{isLock ? "Lock event ini?" : "Gunakan event ini?"}</h2>
            <p className="mt-2 break-words text-sm leading-6 text-ink/65">
              {isLock
                ? `${action.event.name} tahun ${action.event.year} akan dikunci permanen dari admin. Setelah dikunci, hanya developer yang bisa membuka lock lewat database.`
                : `${action.event.name} akan menjadi event aktif. Semua tampilan website akan memakai data event ini setelah proses selesai.`}
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
            Tidak
          </button>
          <button type="button" className={isLock ? "btn-secondary border-coral/30 text-coral hover:bg-coral/10" : "btn-primary"} onClick={onConfirm} disabled={loading}>
            {loading ? "Memproses..." : "Ya"}
          </button>
        </div>
      </article>
    </div>
  );
}

function updateTimelineDraft(
  index: number,
  key: Exclude<keyof TimelineItemInput, "sortOrder">,
  value: string,
  setTimelineDraft: Dispatch<SetStateAction<TimelineItemInput[]>>
) {
  setTimelineDraft((current) =>
    current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item))
  );
}

function updateSubmissionStageDraft<K extends Exclude<keyof SubmissionStageInput, "id" | "sortOrder">>(
  index: number,
  key: K,
  value: SubmissionStageInput[K],
  setSubmissionStageDraft: Dispatch<SetStateAction<SubmissionStageInput[]>>
) {
  setSubmissionStageDraft((current) =>
    current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item))
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="field disabled:bg-ink/5 disabled:text-ink/45"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className="field min-h-32 resize-y"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function TeamDetailPanel({
  detail,
  onClose,
  onStageAccess,
  loading,
  embedded = false
}: {
  detail: TeamDetail;
  onClose: () => void;
  onStageAccess: (teamId: string, stageId: string, isAllowed: boolean) => void;
  loading: boolean;
  embedded?: boolean;
}) {
  return (
    <article
      className={clsx(
        "min-w-0",
        embedded
          ? "border-t border-ink/10 pt-5 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0"
          : "rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:p-5"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <StatusPill tone={detail.team.verificationStatus === "verified" ? "teal" : detail.team.verificationStatus === "rejected" ? "coral" : "amber"}>
            {detail.team.verificationStatus}
          </StatusPill>
          <h2 className="mt-4 break-words text-xl font-black">{detail.team.name}</h2>
          <p className="mt-1 break-words text-sm text-ink/60">{detail.category.name}</p>
        </div>
        <button type="button" className="btn-secondary px-3 py-2" onClick={onClose} aria-label="Tutup detail tim">
          <X size={16} />
        </button>
      </div>

      <div className="mt-5 grid gap-3 border-t border-ink/10 pt-5 text-sm">
        <Info label="ID Tim" value={detail.team.id} />
        <Info label="Batch" value={`Batch ${detail.team.batch}`} />
        <Info label="Ketua" value={detail.team.leaderName} />
        <Info label="Email" value={detail.team.leaderEmail} />
        <Info label="WhatsApp" value={detail.team.leaderPhone || "-"} />
        <Info label="Instansi" value={detail.team.institution} />
      </div>

      <div className="mt-6">
        <p className="text-sm font-black">Anggota</p>
        <div className="mt-3 grid gap-3">
          {detail.team.members.map((member, index) => (
            <div key={`${member.email}-${index}`} className="rounded-md bg-cloud p-3 text-sm">
              <p className="font-black">
                {index + 1}. {member.name}
              </p>
              <p className="mt-1 text-ink/60">{member.email || "-"} - {member.role || "-"}</p>
            </div>
          ))}
          {!detail.team.members.length ? <p className="text-sm text-ink/60">Tidak ada anggota tambahan.</p> : null}
        </div>
      </div>

      <div className="mt-6">
        <p className="text-sm font-black">Submission</p>
        <div className="mt-3 grid gap-3">
          {detail.submissions.map((submission) => (
            <div key={submission.id} className="rounded-md border border-ink/10 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-black capitalize">{submission.stage}</p>
                <StatusPill tone="teal">{submission.status}</StatusPill>
              </div>
              <div className="mt-3 grid gap-2 text-ink/65">
                <Info label="Proposal" value={submission.proposalUrl || "-"} />
                <Info label="Prototype" value={submission.prototypeUrl || "-"} />
                <Info label="PPT" value={submission.pptUrl || "-"} />
                <Info label="Laporan" value={submission.reportUrl || "-"} />
                <Info label="Poster" value={submission.posterUrl || "-"} />
              </div>
            </div>
          ))}
          {!detail.submissions.length ? <p className="text-sm text-ink/60">Belum ada submission.</p> : null}
        </div>
      </div>

      <div className="mt-6">
        <p className="text-sm font-black">Akses Tahap Upload</p>
        <div className="mt-3 grid gap-3">
          {detail.submissionStages.map((item) => (
            <div key={item.stage.id} className="rounded-md border border-ink/10 p-3 text-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill tone={item.canSubmit ? "teal" : "amber"}>
                      {item.canSubmit ? "Bisa Submit" : "Tertutup"}
                    </StatusPill>
                    {item.stage.requiresApproval ? <StatusPill tone={item.isAllowed ? "teal" : "ink"}>{item.isAllowed ? "Lolos" : "Belum Lolos"}</StatusPill> : null}
                  </div>
                  <p className="mt-3 font-black">{item.stage.label}</p>
                  <p className="mt-1 text-ink/60">{item.reason || "Tahap terbuka untuk tim ini."}</p>
                </div>
                {item.stage.requiresApproval ? (
                  <button
                    type="button"
                    className="btn-secondary px-3 py-2"
                    disabled={loading}
                    onClick={() => onStageAccess(detail.team.id, item.stage.id, !item.isAllowed)}
                  >
                    {item.isAllowed ? "Tutup Akses" : "Buka Akses"}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {!detail.submissionStages.length ? <p className="text-sm text-ink/60">Belum ada tahap upload untuk event ini.</p> : null}
        </div>
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-bold text-ink/50">{label}:</span> <span className="break-words">{value}</span>
    </p>
  );
}

function TeamTable({
  teams,
  onVerify,
  onDetail,
  loading,
  selectedTeamId,
  compact = false
}: {
  teams: Team[];
  onVerify: (teamId: string, status: string) => void;
  onDetail: (teamId: string) => void;
  loading: boolean;
  selectedTeamId?: string;
  compact?: boolean;
}) {
  function openFromKeyboard(event: KeyboardEvent<HTMLElement>, teamId: string) {
    const target = event.target as HTMLElement;
    if (target.closest("button")) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onDetail(teamId);
  }

  function verifyFromButton(event: MouseEvent<HTMLButtonElement>, teamId: string, status: string) {
    event.stopPropagation();
    onVerify(teamId, status);
  }

  return (
    <>
      <div className="mt-5 grid gap-3 lg:hidden">
        {teams.map((team) => (
          <article
            key={team.id}
            role="button"
            tabIndex={0}
            aria-label={`Buka detail tim ${team.name}`}
            onClick={() => onDetail(team.id)}
            onKeyDown={(event) => openFromKeyboard(event, team.id)}
            className={clsx(
              "cursor-pointer rounded-lg border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-lagoon/35",
              selectedTeamId === team.id ? "border-lagoon bg-lagoon/5" : "border-ink/10 bg-white hover:border-lagoon/45 hover:bg-cloud"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words font-black">{team.name}</p>
                <p className="mt-1 break-words text-xs text-ink/50">{team.institution}</p>
              </div>
              <StatusPill tone={team.verificationStatus === "verified" ? "teal" : team.verificationStatus === "rejected" ? "coral" : "amber"}>
                {team.verificationStatus}
              </StatusPill>
            </div>

            <div className="mt-4 grid gap-2 rounded-md bg-cloud px-3 py-3 text-sm text-ink/70">
              <Info label="Kategori" value={team.categoryName} />
              <Info label="Batch" value={`Batch ${team.batch}`} />
              <Info label="Ketua" value={team.leaderName} />
            </div>

            {!compact ? (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  className="btn-secondary w-full px-3 py-2 sm:w-auto"
                  disabled={loading}
                  onClick={(event) => verifyFromButton(event, team.id, "verified")}
                >
                  <CheckCircle2 size={16} />
                  Verifikasi
                </button>
                <button
                  type="button"
                  className="btn-secondary w-full px-3 py-2 sm:w-auto"
                  disabled={loading}
                  onClick={(event) => verifyFromButton(event, team.id, "rejected")}
                >
                  Tolak
                </button>
              </div>
            ) : null}
          </article>
        ))}
        {!teams.length ? <p className="p-6 text-center text-sm text-ink/60">Belum ada peserta sesuai filter.</p> : null}
      </div>

      <div className="mt-5 hidden overflow-x-auto lg:block">
        <table className={clsx("w-full text-left text-sm", compact ? "min-w-[680px]" : "min-w-[760px] lg:min-w-[900px]")}>
          <thead className="border-b border-ink/10 text-xs uppercase text-ink/45">
            <tr>
              <th className="py-3 pr-4">Tim</th>
              <th className="py-3 pr-4">Kategori</th>
              <th className="py-3 pr-4">Batch</th>
              <th className="py-3 pr-4">Ketua</th>
              <th className="py-3 pr-4">Status</th>
              {!compact ? <th className="py-3 pr-4">Aksi</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {teams.map((team) => (
              <tr
                key={team.id}
                role="button"
                tabIndex={0}
                aria-label={`Buka detail tim ${team.name}`}
                onClick={() => onDetail(team.id)}
                onKeyDown={(event) => openFromKeyboard(event, team.id)}
                className={clsx(
                  "cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-lagoon/35",
                  selectedTeamId === team.id ? "bg-lagoon/5" : "hover:bg-cloud"
                )}
              >
                <td className="py-3 pr-4">
                  <p className="font-black">{team.name}</p>
                  <p className="text-xs text-ink/50">{team.institution}</p>
                </td>
                <td className="py-3 pr-4">{team.categoryName}</td>
                <td className="py-3 pr-4">Batch {team.batch}</td>
                <td className="py-3 pr-4">{team.leaderName}</td>
                <td className="py-3 pr-4">
                  <StatusPill tone={team.verificationStatus === "verified" ? "teal" : team.verificationStatus === "rejected" ? "coral" : "amber"}>
                    {team.verificationStatus}
                  </StatusPill>
                </td>
                {!compact ? (
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-secondary px-3 py-2"
                        disabled={loading}
                        onClick={(event) => verifyFromButton(event, team.id, "verified")}
                      >
                        <CheckCircle2 size={16} />
                        Verifikasi
                      </button>
                      <button
                        type="button"
                        className="btn-secondary px-3 py-2"
                        disabled={loading}
                        onClick={(event) => verifyFromButton(event, team.id, "rejected")}
                      >
                        Tolak
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
            {!teams.length ? (
              <tr>
                <td className="py-8 text-center text-ink/60" colSpan={compact ? 5 : 6}>
                  Belum ada peserta sesuai filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
