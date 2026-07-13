import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type MouseEvent,
  type SetStateAction,
} from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Download,
  ExternalLink,
  ClipboardList,
  Copy,
  CreditCard,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  ImagePlus,
  Link as LinkIcon,
  LayoutGrid,
  Lock,
  LogIn,
  Megaphone,
  Plus,
  Power,
  QrCode,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  UsersRound,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import { CustomSelect } from "../components/CustomSelect";
import { SectionHeading, StatusPill } from "../components/Layout";
import { api, isNotFoundError, resolveFileURL } from "../lib/api";
import { toastError, toastSuccess } from "../lib/toast";
import type {
  AdminRedeemCode,
  AdminStats,
  AdminUser,
  AnnouncementResult,
  CommitteeMember,
  CreateAdminRedeemCodePayload,
  CreateAdminUserPayload,
  Event,
  EventDocument,
  EventDocumentInput,
  EventRegistrationSettings,
  EventPaymentSettings,
  EventRules,
  FAQ,
  FAQPayload,
  JudgeAssessmentPayload,
  RubricQuestion,
  RubricQuestionInput,
  SubmissionStageInput,
  Team,
  TeamDetail,
  TimelineItem,
  TimelineItemInput,
} from "../lib/types";

type Tab =
  | "overview"
  | "event-switch"
  | "event"
  | "documents"
  | "payment"
  | "peserta"
  | "nilai"
  | "panitia"
  | "jadwal"
  | "submission"
  | "rubrik"
  | "faq"
  | "pengumuman"
  | "akun";
type EventAction = { type: "lock" | "activate"; event: Event } | null;
type ScoreRankingRow = {
  team: Team;
  judgeCount: number;
  totalScore: number;
  averageScore: number;
  maxScore: number;
  lastUpdated: string;
};

const emptyStats: AdminStats = {
  events: 0,
  teams: 0,
  pending: 0,
  submissions: 0,
  finalists: 0,
  winners: 0,
};

const tabs: Array<{
  id: Tab;
  label: string;
  icon: LucideIcon;
  superOnly?: boolean;
}> = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "event-switch", label: "Event Aktif", icon: Power, superOnly: true },
  { id: "event", label: "Event", icon: CalendarClock, superOnly: true },
  { id: "documents", label: "Dokumen Event", icon: FileText, superOnly: true },
  { id: "payment", label: "Payment", icon: CreditCard, superOnly: true },
  { id: "peserta", label: "Peserta", icon: UsersRound },
  { id: "nilai", label: "Ranking Nilai", icon: BarChart3 },
  { id: "panitia", label: "Panitia", icon: UserCog },
  { id: "jadwal", label: "Jadwal", icon: ClipboardList },
  { id: "submission", label: "Submission", icon: FileSpreadsheet },
  { id: "rubrik", label: "Rubrik Juri", icon: ClipboardList },
  { id: "faq", label: "FAQ", icon: HelpCircle },
  { id: "pengumuman", label: "Pengumuman", icon: Megaphone },
  { id: "akun", label: "Akun Admin", icon: ShieldCheck },
];

const emptyTimelineItem = (sortOrder: number): TimelineItemInput => ({
  label: "",
  startDate: "",
  endDate: "",
  description: "",
  sortOrder,
});

const emptyRules: EventRules = {
  eventId: "",
  minTeamMembers: 2,
  maxTeamMembers: 3,
};

const emptyRegistrationSettings: EventRegistrationSettings = {
  eventId: "",
  currentBatch: 1,
  updatedAt: "",
};

const emptyPaymentSettings: EventPaymentSettings = {
  eventId: "",
  amount: 0,
  isEnabled: true,
  updatedAt: "",
};

const emptySubmissionStage = (sortOrder: number): SubmissionStageInput => ({
  key: "",
  label: "",
  sortOrder,
  isOpen: true,
  requiresApproval: sortOrder > 1,
});

const emptyFAQForm = (eventId = "", sortOrder = 1): FAQPayload => ({
  eventId,
  question: "",
  answer: "",
  sortOrder,
  isPublished: true,
});

const emptyRubricQuestion = (sortOrder: number): RubricQuestionInput => ({
  question: "",
  description: "",
  maxScore: 100,
  sortOrder,
  isActive: true,
});

const requiredEventDocumentTemplates: EventDocumentInput[] = [
  {
    label: "Proposal",
    url: "",
    type: "link",
    requiredFor: "create",
    sortOrder: 1,
  },
  {
    label: "KAK acara puncak",
    url: "",
    type: "link",
    requiredFor: "lock",
    sortOrder: 2,
  },
  {
    label: "KAK final-pp",
    url: "",
    type: "link",
    requiredFor: "lock",
    sortOrder: 3,
  },
  {
    label: "KAK & SU",
    url: "",
    type: "link",
    requiredFor: "lock",
    sortOrder: 4,
  },
  { label: "LPJ", url: "", type: "link", requiredFor: "lock", sortOrder: 5 },
  { label: "BA", url: "", type: "link", requiredFor: "lock", sortOrder: 6 },
  {
    label: "Surat Media Partner",
    url: "",
    type: "link",
    requiredFor: "lock",
    sortOrder: 7,
  },
  { label: "TOR", url: "", type: "link", requiredFor: "lock", sortOrder: 8 },
  {
    label: "Surat Permohonan Juri",
    url: "",
    type: "link",
    requiredFor: "lock",
    sortOrder: 9,
  },
];

const emptyEventDocument = (sortOrder: number): EventDocumentInput => ({
  label: "",
  url: "",
  type: "link",
  requiredFor: "archive",
  sortOrder,
});

export function AdminPanel() {
  const [token, setToken] = useState(
    localStorage.getItem("pointproject.adminToken") ?? "",
  );
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
  const [rulesDraft, setRulesDraft] = useState({
    minTeamMembers: 2,
    maxTeamMembers: 3,
  });
  const [registrationSettings, setRegistrationSettings] =
    useState<EventRegistrationSettings>(emptyRegistrationSettings);
  const [registrationDraft, setRegistrationDraft] = useState({
    currentBatch: "1",
  });
  const [paymentSettings, setPaymentSettings] =
    useState<EventPaymentSettings>(emptyPaymentSettings);
  const [paymentDraft, setPaymentDraft] = useState({
    amount: "0",
    isEnabled: true,
  });
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [timelineDraft, setTimelineDraft] = useState<TimelineItemInput[]>([]);
  const [submissionStageDraft, setSubmissionStageDraft] = useState<
    SubmissionStageInput[]
  >([]);
  const [rubricDraft, setRubricDraft] = useState<RubricQuestionInput[]>([]);
  const [documentEventId, setDocumentEventId] = useState("");
  const [eventDocuments, setEventDocuments] = useState<EventDocument[]>([]);
  const [documentDraft, setDocumentDraft] = useState<EventDocumentInput[]>([]);
  const [uploadingDocumentIndex, setUploadingDocumentIndex] = useState<
    number | null
  >(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [redeemCodes, setRedeemCodes] = useState<AdminRedeemCode[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamDetail | null>(null);
  const [submissionTeams, setSubmissionTeams] = useState<Team[]>([]);
  const [scoreRanking, setScoreRanking] = useState<ScoreRankingRow[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [announcementTeamSearch, setAnnouncementTeamSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
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
    status: "draft",
    proposalUrl: "",
  });
  const [adminForm, setAdminForm] = useState<CreateAdminUserPayload>({
    name: "",
    nim: "",
    role: "admin",
    division: "",
    password: "",
  });
  const [redeemForm, setRedeemForm] = useState<CreateAdminRedeemCodePayload>({
    role: "panitia",
    division: "",
    maxClaims: 1,
    expiresAt: "",
  });
  const [faqForm, setFaqForm] = useState<FAQPayload>(() => emptyFAQForm());
  const [announcementForm, setAnnouncementForm] = useState({
    type: "finalis",
    rank: "1",
    title: "",
    body: "",
    teamId: "",
    reason: "",
  });
  const [announcementImage, setAnnouncementImage] = useState<File | null>(null);
  const [announcementImageInputKey, setAnnouncementImageInputKey] = useState(0);
  const teamDetailRef = useRef<HTMLDivElement | null>(null);

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
  const isJury = user?.role === "juri";
  const canManageRedeem = user?.role === "admin" || isSuperAdmin;
  const visibleTabs = useMemo(
    () =>
      isJury
        ? tabs.filter((item) => item.id === "submission")
        : tabs.filter(
            (item) =>
              (!item.superOnly || isSuperAdmin) &&
              (item.id !== "panitia" || canManageRedeem),
          ),
    [canManageRedeem, isJury, isSuperAdmin],
  );

  const filteredTeams = useMemo(() => {
    const q = search.toLowerCase();
    return teams.filter((team) => {
      const matchesSearch =
        !q ||
        `${team.name} ${team.leaderName} ${team.institution} ${team.leaderEmail}`
          .toLowerCase()
          .includes(q);
      const matchesStatus = !status || team.verificationStatus === status;
      return matchesSearch && matchesStatus;
    });
  }, [teams, search, status]);

  const filteredSubmissionTeams = useMemo(() => {
    const q = search.toLowerCase();
    return submissionTeams.filter((team) => {
      const matchesSearch =
        !q ||
        `${team.name} ${team.leaderName} ${team.institution} ${team.leaderEmail}`
          .toLowerCase()
          .includes(q);
      const matchesStatus = !status || team.verificationStatus === status;
      return matchesSearch && matchesStatus;
    });
  }, [submissionTeams, search, status]);

  const announcementTeams = useMemo(() => {
    const q = announcementTeamSearch.toLowerCase().trim();
    return teams
      .filter((team) => !event?.id || team.eventId === event.id)
      .filter(
        (team) =>
          !q ||
          `${team.name} ${team.leaderName} ${team.institution} ${team.categoryName}`
            .toLowerCase()
            .includes(q),
      );
  }, [announcementTeamSearch, event?.id, teams]);

  const selectedAnnouncementTeam = useMemo(
    () => teams.find((team) => team.id === announcementForm.teamId) ?? null,
    [announcementForm.teamId, teams],
  );
  const selectedDocumentEvent = useMemo(
    () => events.find((item) => item.id === documentEventId) ?? event,
    [documentEventId, event, events],
  );

  const statCards: Array<{ label: string; value: number; icon: LucideIcon }> = [
    { label: "Event", value: stats.events, icon: CalendarClock },
    { label: "Tim Terdaftar", value: stats.teams, icon: UsersRound },
    { label: "Menunggu Verifikasi", value: stats.pending, icon: ShieldCheck },
    { label: "Submission", value: stats.submissions, icon: FileSpreadsheet },
    { label: "Finalis", value: stats.finalists, icon: ClipboardList },
    { label: "Pemenang", value: stats.winners, icon: Megaphone },
  ];

  function showError(message: string) {
    setError(message);
    toastError(message);
  }

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);
    toastSuccess(nextMessage);
  }

  async function loadAdminData(nextToken = token, currentUser = user) {
    if (!nextToken) return;
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const juryMode = currentUser?.role === "juri";
      const canLoadRedeem =
        currentUser?.role === "admin" || currentUser?.role === "super_admin";
      const [
        nextStats,
        nextTeams,
        nextSubmissionTeams,
        nextUsers,
        active,
        nextEvents,
        nextRedeemCodes,
      ] = await Promise.all([
        api.adminStats(nextToken),
        api.adminTeams(nextToken),
        api.adminTeams(nextToken, "", "", true),
        juryMode ? Promise.resolve([]) : api.adminUsers(nextToken),
        api.activeEvent(),
        api.events(),
        canLoadRedeem
          ? api.adminRedeemCodes(nextToken).catch(() => [])
          : Promise.resolve([]),
      ]);
      const [
        nextCommittee,
        nextTimeline,
        nextRules,
        nextRegistrationSettings,
        nextPaymentSettings,
        nextSubmissionStages,
        nextFAQs,
        nextRubric,
      ] = await Promise.all([
        juryMode ? Promise.resolve([]) : api.committee(active.id),
        api.timeline(active.id),
        api.rules(active.id).catch((err) => {
          if (isNotFoundError(err))
            return { ...emptyRules, eventId: active.id };
          throw err;
        }),
        juryMode
          ? Promise.resolve({
              ...emptyRegistrationSettings,
              eventId: active.id,
            })
          : api.adminRegistrationSettings(nextToken, active.id).catch(() => ({
              ...emptyRegistrationSettings,
              eventId: active.id,
            })),
        juryMode
          ? Promise.resolve({ ...emptyPaymentSettings, eventId: active.id })
          : api
              .paymentSettings(nextToken, active.id)
              .catch(() => ({ ...emptyPaymentSettings, eventId: active.id })),
        api.submissionStages(nextToken, active.id).catch((err) => {
          if (isNotFoundError(err)) return [];
          throw err;
        }),
        juryMode
          ? Promise.resolve([])
          : api.adminFaqs(nextToken, active.id).catch((err) => {
              if (isNotFoundError(err)) return [];
              throw err;
            }),
        api.rubricQuestions(nextToken, active.id).catch((err) => {
          if (isNotFoundError(err)) return [];
          throw err;
        }),
      ]);
      setStats(nextStats);
      setTeams(nextTeams ?? []);
      setSubmissionTeams(nextSubmissionTeams ?? []);
      setAdminUsers(nextUsers ?? []);
      setRedeemCodes(nextRedeemCodes ?? []);
      setEvent(active);
      setEvents(nextEvents ?? []);
      setDocumentEventId((current) => current || active.id);
      setCommittee(nextCommittee ?? []);
      setTimeline(nextTimeline ?? []);
      setTimelineDraft((nextTimeline ?? []).map(timelineToInput));
      setRules(nextRules);
      setRulesDraft({
        minTeamMembers: nextRules.minTeamMembers,
        maxTeamMembers: nextRules.maxTeamMembers,
      });
      setRegistrationSettings(nextRegistrationSettings);
      setRegistrationDraft({
        currentBatch: String(nextRegistrationSettings.currentBatch || 1),
      });
      setPaymentSettings(nextPaymentSettings);
      setPaymentDraft({
        amount: String(nextPaymentSettings.amount ?? 0),
        isEnabled: nextPaymentSettings.isEnabled,
      });
      setSubmissionStageDraft(
        (nextSubmissionStages ?? []).map(submissionStageToInput),
      );
      setRubricDraft((nextRubric ?? []).map(rubricQuestionToInput));
      setFaqs(nextFAQs ?? []);
      setFaqForm((current) => ({
        ...current,
        eventId: active.id,
        sortOrder:
          current.eventId === active.id
            ? current.sortOrder
            : (nextFAQs ?? []).length + 1,
      }));
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Gagal memuat data admin.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function exportSpreadsheet() {
    if (!token) return;
    setExporting(true);
    setError("");
    try {
      const file = await api.exportAdminSpreadsheet(token);
      const url = URL.createObjectURL(file.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showMessage("Data admin berhasil diexport ke spreadsheet.");
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Gagal export spreadsheet.",
      );
    } finally {
      setExporting(false);
    }
  }

  async function loadEventDocuments(targetEventId = documentEventId) {
    if (!token || !targetEventId || !isSuperAdmin) return;
    setLoading(true);
    setError("");
    try {
      const documents = await api.eventDocuments(token, targetEventId);
      setEventDocuments(documents ?? []);
      setDocumentDraft(
        documents?.length
          ? documents.map(eventDocumentToInput)
          : requiredEventDocumentTemplates.map((item) => ({ ...item })),
      );
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Gagal memuat dokumen event.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveEventDocuments() {
    if (!token || !documentEventId) {
      showError("Pilih event terlebih dahulu.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const normalized = documentDraft
        .map((item, index) => ({
          ...item,
          label: item.label.trim(),
          url: item.url.trim(),
          sortOrder: index + 1,
        }))
        .filter((item) => item.label || item.url);
      const documents = await api.updateEventDocuments(
        token,
        documentEventId,
        normalized,
      );
      setEventDocuments(documents);
      setDocumentDraft(documents.map(eventDocumentToInput));
      showMessage("Dokumen event berhasil disimpan.");
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Gagal menyimpan dokumen event.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function uploadEventDocumentFile(index: number, file: File | null) {
    if (!file || !token || !documentEventId) return;
    setUploadingDocumentIndex(index);
    setError("");
    try {
      const uploaded = await api.uploadEventDocument(
        token,
        documentEventId,
        file,
      );
      setDocumentDraft((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index
            ? { ...item, url: uploaded.url, type: "file" }
            : item,
        ),
      );
      showMessage(
        "File dokumen berhasil diupload. Jangan lupa simpan daftar dokumen.",
      );
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Gagal upload dokumen event.",
      );
    } finally {
      setUploadingDocumentIndex(null);
    }
  }

  useEffect(() => {
    if (token) loadAdminData(token);
  }, []);

  useEffect(() => {
    if (token && isSuperAdmin && documentEventId) {
      void loadEventDocuments(documentEventId);
    }
  }, [token, isSuperAdmin, documentEventId]);

  useEffect(() => {
    if (isJury && tab !== "submission") {
      setTab("submission");
      return;
    }
    if (
      !isSuperAdmin &&
      (tab === "event" || tab === "event-switch" || tab === "payment")
    ) {
      setTab("overview");
    }
    if (!canManageRedeem && tab === "panitia") {
      setTab("overview");
    }
  }, [canManageRedeem, isJury, isSuperAdmin, tab]);

  useEffect(() => {
    if (tab === "nilai" && token && event && !isJury) {
      void loadScoreRanking();
    }
  }, [tab, token, event?.id, teams.length, isJury]);

  async function submitLogin(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await api.adminLogin(login.email, login.password);
      setToken(response.token);
      setUser(response.user);
      localStorage.setItem("pointproject.adminToken", response.token);
      localStorage.setItem(
        "pointproject.adminUser",
        JSON.stringify(response.user),
      );
      window.dispatchEvent(new CustomEvent("pointproject:admin-session"));
      setTab(response.user.role === "juri" ? "submission" : "overview");
      await loadAdminData(response.token, response.user);
      showMessage(`Berhasil masuk sebagai ${response.user.name}.`);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Login admin gagal.");
    } finally {
      setLoading(false);
    }
  }

  function scrollToTeamDetail() {
    window.setTimeout(() => {
      teamDetailRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }

  async function openTeamDetail(teamId: string, shouldScroll = false) {
    setLoading(true);
    setError("");
    try {
      const detail = await api.adminTeamDetail(token, teamId);
      setSelectedTeam(normalizeTeamDetail(detail));
      if (shouldScroll) {
        scrollToTeamDetail();
      }
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Gagal memuat detail tim.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadScoreRanking() {
    if (!token || !event) return;
    setRankingLoading(true);
    setError("");
    try {
      const eventTeams = teams.filter((team) => team.eventId === event.id);
      const details = await Promise.all(
        eventTeams.map((team) =>
          api.adminTeamDetail(token, team.id).catch(() => null),
        ),
      );
      const rows = details
        .filter((detail): detail is TeamDetail => Boolean(detail))
        .map((detail) => {
          const judgeCount = detail.assessments.length;
          const totalScore = detail.assessments.reduce(
            (total, assessment) => total + assessment.totalScore,
            0,
          );
          const averageScore = judgeCount ? totalScore / judgeCount : 0;
          const maxScore = detail.rubricQuestions.reduce(
            (total, question) => total + question.maxScore,
            0,
          );
          const updatedEntries = detail.assessments
            .map((assessment) => assessment.updatedAt)
            .filter(Boolean)
            .sort();
          const lastUpdated = updatedEntries[updatedEntries.length - 1] ?? "";
          return {
            team: detail.team,
            judgeCount,
            totalScore,
            averageScore,
            maxScore,
            lastUpdated,
          };
        })
        .sort((a, b) => {
          if (b.averageScore !== a.averageScore)
            return b.averageScore - a.averageScore;
          return b.judgeCount - a.judgeCount;
        });
      setScoreRanking(rows);
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Gagal memuat ranking nilai.",
      );
    } finally {
      setRankingLoading(false);
    }
  }

  async function verify(teamId: string, nextStatus: string) {
    setLoading(true);
    setError("");
    try {
      const nextTeam = await api.verifyTeam(token, teamId, nextStatus);
      setTeams((current) =>
        current.map((team) => (team.id === teamId ? nextTeam : team)),
      );
      setSubmissionTeams((current) =>
        current.map((team) => (team.id === teamId ? nextTeam : team)),
      );
      if (selectedTeam?.team.id === teamId) {
        setSelectedTeam({ ...selectedTeam, team: nextTeam });
      }
      showMessage(
        `Status ${nextTeam.name} diperbarui menjadi ${nextTeam.verificationStatus}.`,
      );
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Gagal memperbarui status tim.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function deleteTeam(teamId: string, teamName: string) {
    if (!isSuperAdmin) {
      showError("Hanya super admin yang dapat menghapus tim.");
      return;
    }
    const confirmed = window.confirm(
      `Hapus tim ${teamName}? Semua data pendaftaran, submission, dan akses tahap tim ini akan ikut terhapus dari database.`,
    );
    if (!confirmed) return;
    setLoading(true);
    setError("");
    try {
      await api.deleteTeam(token, teamId);
      setSelectedTeam(null);
      setTeams((current) => current.filter((team) => team.id !== teamId));
      setSubmissionTeams((current) =>
        current.filter((team) => team.id !== teamId),
      );
      await loadAdminData(token);
      showMessage(`Tim ${teamName} berhasil dihapus.`);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menghapus tim.");
    } finally {
      setLoading(false);
    }
  }

  async function createEvent(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    if (!eventForm.proposalUrl.trim()) {
      showError("Link Proposal Event wajib diisi sebelum membuat event.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const nextEvent = await api.createEvent(token, {
        name: eventForm.name,
        theme: eventForm.theme,
        year: eventForm.year,
        startDate: eventForm.startDate,
        endDate: eventForm.endDate,
        status: eventForm.status,
        documents: [
          {
            label: "Proposal",
            url: eventForm.proposalUrl,
            type: "link",
            requiredFor: "create",
            sortOrder: 1,
          },
        ],
      });
      await loadAdminData(token);
      setEventForm({
        name: "",
        theme: "",
        year: nextEvent.year + 1,
        startDate: "",
        endDate: "",
        status: "draft",
        proposalUrl: "",
      });
      showMessage(
        `${nextEvent.name} berhasil dibuat. Aktifkan dari tab Event Aktif saat siap dipakai.`,
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal membuat event.");
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
      showMessage(
        action.type === "lock"
          ? `${nextEvent.name} sudah dikunci permanen dari admin.`
          : `${nextEvent.name} sekarang menjadi event aktif.`,
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal memproses event.");
    } finally {
      setSwitchingEvent(false);
      setLoading(false);
    }
  }

  async function saveTimeline() {
    if (!event) {
      showError("Event aktif belum dimuat.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const normalized = timelineDraft.map((item, index) => ({
        ...item,
        sortOrder: index + 1,
      }));
      const nextTimeline = await api.updateTimeline(
        token,
        event.id,
        normalized,
      );
      setTimeline(nextTimeline);
      setTimelineDraft(nextTimeline.map(timelineToInput));
      showMessage("Jadwal berhasil diperbarui.");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menyimpan jadwal.");
    } finally {
      setLoading(false);
    }
  }

  async function saveRules() {
    if (!event) {
      showError("Event aktif belum dimuat.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const nextRules = await api.updateRules(token, event.id, rulesDraft);
      setRules(nextRules);
      setRulesDraft({
        minTeamMembers: nextRules.minTeamMembers,
        maxTeamMembers: nextRules.maxTeamMembers,
      });
      showMessage("Aturan jumlah anggota berhasil diperbarui.");
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Gagal menyimpan aturan anggota.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveRegistrationSettings() {
    if (!event) {
      showError("Event aktif belum dimuat.");
      return;
    }
    const currentBatch = Number(registrationDraft.currentBatch);
    if (currentBatch !== 1 && currentBatch !== 2) {
      showError("Batch aktif hanya boleh Batch 1 atau Batch 2.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const nextSettings = await api.updateRegistrationSettings(
        token,
        event.id,
        { currentBatch },
      );
      setRegistrationSettings(nextSettings);
      setRegistrationDraft({ currentBatch: String(nextSettings.currentBatch) });
      showMessage(
        `Pendaftaran sekarang dibuka untuk Batch ${nextSettings.currentBatch}.`,
      );
    } catch (err) {
      showError(
        err instanceof Error
          ? err.message
          : "Gagal menyimpan batch pendaftaran.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function savePaymentSettings() {
    if (!event) {
      showError("Event aktif belum dimuat.");
      return;
    }
    const amount = Number(paymentDraft.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      showError("Harga payment wajib berupa angka nol atau lebih.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const nextSettings = await api.updatePaymentSettings(token, event.id, {
        amount: Math.round(amount),
        isEnabled: paymentDraft.isEnabled,
      });
      setPaymentSettings(nextSettings);
      setPaymentDraft({
        amount: String(nextSettings.amount),
        isEnabled: nextSettings.isEnabled,
      });
      showMessage("Harga payment berhasil diperbarui.");
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Gagal menyimpan harga payment.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function createRedeemCode(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    setLoading(true);
    setError("");
    try {
      const code = await api.createAdminRedeemCode(token, redeemForm);
      setRedeemCodes((current) => [code, ...current]);
      setRedeemForm((current) => ({ ...current, maxClaims: 1, expiresAt: "" }));
      showMessage("Kode redeem panitia berhasil dibuat.");
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Gagal membuat kode redeem.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyRedeemLink(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      showMessage("Link redeem disalin.");
    } catch {
      showError("Gagal menyalin link redeem.");
    }
  }

  async function saveSubmissionStages() {
    if (!event) {
      showError("Event aktif belum dimuat.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const normalized = submissionStageDraft.map((item, index) => ({
        ...item,
        sortOrder: index + 1,
      }));
      const nextStages = await api.updateSubmissionStages(
        token,
        event.id,
        normalized,
      );
      setSubmissionStageDraft(nextStages.map(submissionStageToInput));
      showMessage("Tahap upload karya berhasil diperbarui.");
      if (selectedTeam) {
        const detail = await api.adminTeamDetail(token, selectedTeam.team.id);
        setSelectedTeam(normalizeTeamDetail(detail));
      }
    } catch (err) {
      showError(
        err instanceof Error
          ? err.message
          : "Gagal menyimpan tahap upload karya.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveRubricQuestions() {
    if (!event) {
      showError("Event aktif belum dimuat.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const normalized = rubricDraft
        .map((item, index) => ({
          ...item,
          question: item.question.trim(),
          description: item.description.trim(),
          maxScore: Math.min(100, Math.max(1, Number(item.maxScore) || 100)),
          sortOrder: index + 1,
          isActive: true,
        }))
        .filter((item) => item.question);
      const nextRubric = await api.updateRubricQuestions(
        token,
        event.id,
        normalized,
      );
      setRubricDraft(nextRubric.map(rubricQuestionToInput));
      if (selectedTeam) {
        const detail = await api.adminTeamDetail(token, selectedTeam.team.id);
        setSelectedTeam(normalizeTeamDetail(detail));
      }
      showMessage("Rubrik penilaian juri berhasil diperbarui.");
    } catch (err) {
      showError(
        err instanceof Error
          ? err.message
          : "Gagal menyimpan rubrik penilaian.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function setStageAccess(
    teamId: string,
    stageId: string,
    isAllowed: boolean,
  ) {
    setLoading(true);
    setError("");
    try {
      const detail = await api.updateTeamStageAccess(
        token,
        teamId,
        stageId,
        isAllowed,
      );
      setSelectedTeam(normalizeTeamDetail(detail));
      showMessage(
        isAllowed ? "Akses tahap tim dibuka." : "Akses tahap tim ditutup.",
      );
    } catch (err) {
      showError(
        err instanceof Error
          ? err.message
          : "Gagal memperbarui akses tahap tim.",
      );
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
      setAdminForm({
        name: "",
        nim: "",
        role: "admin",
        division: "",
        password: "",
      });
      showMessage(`Akun ${nextUser.email} berhasil dibuat.`);
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Gagal membuat akun panitia.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveFAQ(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    if (!event) {
      showError("Event aktif belum dimuat.");
      return;
    }
    setLoading(true);
    setError("");
    const payload: FAQPayload = {
      ...faqForm,
      eventId: event.id,
      question: faqForm.question.trim(),
      answer: faqForm.answer.trim(),
      sortOrder: Number(faqForm.sortOrder) || faqs.length + 1,
    };
    try {
      const nextFAQ = editingFaqId
        ? await api.updateFaq(token, editingFaqId, payload)
        : await api.createFaq(token, payload);
      setFaqs((current) =>
        sortFAQs(
          editingFaqId
            ? current.map((faq) => (faq.id === nextFAQ.id ? nextFAQ : faq))
            : [...current, nextFAQ],
        ),
      );
      setEditingFaqId("");
      setFaqForm(emptyFAQForm(event.id, faqs.length + (editingFaqId ? 1 : 2)));
      showMessage(
        editingFaqId
          ? "FAQ berhasil diperbarui."
          : "FAQ baru berhasil ditambahkan.",
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menyimpan FAQ.");
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
      isPublished: faq.isPublished,
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
      showMessage("FAQ berhasil dihapus.");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menghapus FAQ.");
    } finally {
      setLoading(false);
    }
  }

  async function createAnnouncement(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    if (!event) {
      showError("Event aktif belum dimuat.");
      return;
    }
    const isTeamAnnouncement = announcementForm.type !== "info";
    if (isTeamAnnouncement && !selectedAnnouncementTeam) {
      showError(
        "Pilih tim dari dropdown untuk pengumuman finalis atau pemenang.",
      );
      return;
    }
    if (announcementImage && !announcementImage.type.startsWith("image/")) {
      showError("File foto pengumuman harus berupa gambar.");
      return;
    }
    if (announcementImage && announcementImage.size > 6 * 1024 * 1024) {
      showError("Ukuran foto pengumuman maksimal 6MB.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      let imageUrl = "";
      if (announcementImage) {
        const uploaded = await api.uploadAnnouncementImage(
          token,
          announcementImage,
        );
        imageUrl = uploaded.url;
      }
      let result: AnnouncementResult | null = null;
      if (isTeamAnnouncement && selectedAnnouncementTeam) {
        const detail = await api.adminTeamDetail(
          token,
          selectedAnnouncementTeam.id,
        );
        const assets = latestSubmissionAssets(detail);
        result = {
          rank:
            announcementForm.type === "pemenang"
              ? Number(announcementForm.rank) || 1
              : 0,
          teamName: selectedAnnouncementTeam.name,
          categoryName: selectedAnnouncementTeam.categoryName,
          institution: selectedAnnouncementTeam.institution,
          workTitle: announcementForm.title.trim(),
          prototypeUrl: assets.prototypeUrl,
          previewUrl: assets.prototypeUrl,
          reason: announcementForm.reason,
          pptUrl: assets.pptUrl,
          posterUrl: assets.posterUrl,
          proposalUrl: assets.proposalUrl,
          reportUrl: assets.reportUrl,
        };
      }
      const announcement = await api.createAnnouncement(token, {
        eventId: event.id,
        type: announcementForm.type,
        title: announcementForm.title,
        body: announcementForm.body,
        imageUrl,
        results: result ? [result] : [],
      });
      showMessage(`${announcement.title} berhasil dipublish.`);
      setAnnouncementForm((current) => ({
        ...current,
        title: "",
        body: "",
        teamId: "",
        reason: "",
      }));
      setAnnouncementTeamSearch("");
      setAnnouncementImage(null);
      setAnnouncementImageInputKey((current) => current + 1);
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Gagal membuat pengumuman.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!token || !user) {
    return (
      <section className="experience-page py-14">
        <div className="mx-auto max-w-xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Admin Panel"
            title="Login Panitia"
            body="Panel ini digunakan untuk verifikasi peserta, jadwal, pembuatan akun, dan publikasi pengumuman."
          />
          <form
            onSubmit={submitLogin}
            className="mt-10 rounded-lg border border-dark/10 bg-white p-6 shadow-soft"
          >
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
                  onChange={(event) =>
                    setLogin((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
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
                  onChange={(event) =>
                    setLogin((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
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
    <section className="experience-page py-6 sm:py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold text-dark/55">Admin Panel</p>
            <h1 className="break-words text-2xl font-black sm:text-3xl">
              {event?.name ?? "Event belum dimuat"}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManageRedeem ? (
              <button
                className="btn-primary"
                onClick={exportSpreadsheet}
                disabled={exporting || loading}
              >
                <Download size={18} />
                {exporting ? "Mengekspor..." : "Export Spreadsheet"}
              </button>
            ) : null}
            <button
              className="btn-secondary"
              onClick={() => loadAdminData()}
              disabled={loading}
            >
              <RefreshCw size={18} />
              Refresh
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                localStorage.removeItem("pointproject.adminToken");
                localStorage.removeItem("pointproject.adminUser");
                window.dispatchEvent(
                  new CustomEvent("pointproject:admin-session"),
                );
                setToken("");
                setUser(null);
              }}
            >
              Keluar
            </button>
          </div>
        </div>

        {switchingEvent ? (
          <div className="mb-5 rounded-lg border border-primary/20 bg-primary/10 px-4 py-4 text-sm font-bold text-primary">
            Memuat event baru dan menyesuaikan tampilan website...
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-dark/10 bg-white p-2 shadow-soft sm:p-3">
            <nav className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
              {visibleTabs.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    className={clsx(
                      "flex min-w-0 items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-black transition",
                      tab === item.id
                        ? "bg-primary text-white"
                        : "text-dark/68 hover:bg-light hover:text-dark",
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
                    <Icon className="text-primary" size={24} />
                    <p className="mt-4 text-3xl font-black">{value}</p>
                    <p className="mt-1 text-sm font-bold text-dark/55">
                      {label}
                    </p>
                  </article>
                ))}
              </div>
            ) : null}

            {tab === "peserta" ? (
              <div className="rounded-lg border border-dark/10 bg-white p-4 shadow-soft sm:p-5">
                <div
                  className={clsx(
                    "grid gap-5",
                    selectedTeam && "xl:grid-cols-[minmax(0,1fr)_360px]",
                  )}
                >
                  <div className="min-w-0">
                    <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                      <div className="relative">
                        <Search
                          className="pointer-events-none absolute left-3 top-3 text-dark/35"
                          size={18}
                        />
                        <input
                          className="field !pl-10"
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Cari tim, ketua, instansi, email"
                        />
                      </div>
                      <CustomSelect
                        value={status}
                        onChange={setStatus}
                        options={[
                          { value: "", label: "Semua status" },
                          { value: "pending", label: "Pending" },
                          { value: "verified", label: "Verified" },
                          { value: "rejected", label: "Rejected" },
                        ]}
                      />
                    </div>
                    <TeamTable
                      teams={filteredTeams}
                      onVerify={verify}
                      onDetail={openTeamDetail}
                      loading={loading}
                      selectedTeamId={selectedTeam?.team.id}
                      canVerify={!isJury}
                    />
                  </div>
                  {selectedTeam ? (
                    <div ref={teamDetailRef} className="min-w-0 scroll-mt-24">
                      <TeamDetailPanel
                        detail={selectedTeam}
                        onClose={() => setSelectedTeam(null)}
                        onStageAccess={setStageAccess}
                        onAssessmentSaved={(detail) =>
                          setSelectedTeam(normalizeTeamDetail(detail))
                        }
                        onDeleteTeam={deleteTeam}
                        loading={loading}
                        canDelete={isSuperAdmin}
                        canManageStages={!isJury}
                        currentUser={user}
                        token={token}
                        embedded
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {tab === "nilai" ? (
              <div className="grid gap-5">
                <section className="rounded-lg border border-dark/10 bg-white p-5 shadow-soft">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
                        Ranking Nilai Juri
                      </p>
                      <h2 className="mt-2 text-2xl font-black">
                        Urutan skor tertinggi
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-dark/60">
                        Ranking dihitung dari rata-rata total skor semua juri
                        per tim. Tim yang belum dinilai tetap tampil di bawah.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={loadScoreRanking}
                      disabled={rankingLoading || loading}
                    >
                      <RefreshCw size={18} />
                      {rankingLoading ? "Memuat..." : "Refresh Ranking"}
                    </button>
                  </div>

                  <div className="mt-5 grid gap-3 md:hidden">
                    {scoreRanking.map((row, index) => (
                      <article
                        key={row.team.id}
                        className="rounded-lg border border-dark/10 bg-white p-4 shadow-soft"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-display text-2xl font-black text-primary">
                              #{index + 1}
                            </p>
                            <h3 className="mt-2 break-words text-lg font-black">
                              {row.team.name}
                            </h3>
                            <p className="mt-1 text-xs font-bold text-dark/45">
                              {row.team.categoryName} / Batch {row.team.batch}
                            </p>
                          </div>
                          <StatusPill tone={row.judgeCount ? "teal" : "amber"}>
                            {row.judgeCount ? "Sudah dinilai" : "Belum dinilai"}
                          </StatusPill>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <Info
                            label="Rata-rata"
                            value={
                              row.judgeCount
                                ? formatScore(row.averageScore)
                                : "-"
                            }
                          />
                          <Info label="Juri" value={`${row.judgeCount} juri`} />
                          <Info
                            label="Maks"
                            value={row.maxScore ? String(row.maxScore) : "-"}
                          />
                          <Info
                            label="Update"
                            value={formatDateTime(row.lastUpdated)}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn-secondary mt-4 w-full px-3 py-2"
                          onClick={() => openTeamDetail(row.team.id)}
                        >
                          Detail Tim
                        </button>
                      </article>
                    ))}
                  </div>

                  <div className="mt-5 hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="border-b border-dark/10 text-xs uppercase text-dark/45">
                        <tr>
                          <th className="py-3 pr-4">Rank</th>
                          <th className="py-3 pr-4">Tim</th>
                          <th className="py-3 pr-4">Rata-rata</th>
                          <th className="py-3 pr-4">Juri</th>
                          <th className="py-3 pr-4">Status</th>
                          <th className="py-3 pr-4">Update</th>
                          <th className="py-3 pr-4">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark/10">
                        {scoreRanking.map((row, index) => (
                          <tr
                            key={row.team.id}
                            className={
                              row.judgeCount ? "bg-white" : "bg-light/60"
                            }
                          >
                            <td className="py-4 pr-4 align-top">
                              <span className="font-display text-xl font-black text-primary">
                                #{index + 1}
                              </span>
                            </td>
                            <td className="py-4 pr-4 align-top">
                              <p className="font-black">{row.team.name}</p>
                              <p className="mt-1 text-xs text-dark/50">
                                {row.team.categoryName} / Batch {row.team.batch}
                              </p>
                            </td>
                            <td className="py-4 pr-4 align-top">
                              <p className="font-black">
                                {row.judgeCount
                                  ? formatScore(row.averageScore)
                                  : "-"}
                              </p>
                              <p className="mt-1 text-xs text-dark/45">
                                Maks {row.maxScore || "-"}
                              </p>
                            </td>
                            <td className="py-4 pr-4 align-top">
                              {row.judgeCount} juri
                            </td>
                            <td className="py-4 pr-4 align-top">
                              <StatusPill
                                tone={row.judgeCount ? "teal" : "amber"}
                              >
                                {row.judgeCount
                                  ? "Sudah dinilai"
                                  : "Belum dinilai"}
                              </StatusPill>
                            </td>
                            <td className="py-4 pr-4 align-top text-dark/60">
                              {formatDateTime(row.lastUpdated)}
                            </td>
                            <td className="py-4 pr-4 align-top">
                              <button
                                type="button"
                                className="btn-secondary px-3 py-2"
                                onClick={() => openTeamDetail(row.team.id)}
                              >
                                Detail
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {!scoreRanking.length ? (
                    <article className="mt-5 rounded-lg border border-dashed border-dark/20 p-8 text-center">
                      <p className="font-black">
                        Belum ada tim untuk diranking.
                      </p>
                      <p className="mt-2 text-sm text-dark/60">
                        Ranking muncul setelah peserta terdaftar di event aktif.
                      </p>
                    </article>
                  ) : null}
                </section>

                {selectedTeam ? (
                  <div ref={teamDetailRef} className="min-w-0 scroll-mt-24">
                    <TeamDetailPanel
                      detail={selectedTeam}
                      onClose={() => setSelectedTeam(null)}
                      onStageAccess={setStageAccess}
                      onAssessmentSaved={(detail) => {
                        setSelectedTeam(normalizeTeamDetail(detail));
                        void loadScoreRanking();
                      }}
                      onDeleteTeam={deleteTeam}
                      loading={loading}
                      canDelete={isSuperAdmin}
                      canManageStages={!isJury}
                      currentUser={user}
                      token={token}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {tab === "event-switch" ? (
              <div className="grid gap-5">
                <article className="rounded-lg border border-dark/10 bg-white p-5 shadow-soft">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
                        Event Aktif Saat Ini
                      </p>
                      <h2 className="mt-3 break-words text-2xl font-black">
                        {event?.name ?? "Belum ada event aktif"}
                      </h2>
                      {event ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <StatusPill
                            tone={event.status === "aktif" ? "teal" : "dark"}
                          >
                            {event.status}
                          </StatusPill>
                          <StatusPill
                            tone={event.lockedAt ? "orange" : "amber"}
                          >
                            {event.lockedAt ? "Locked" : "Belum locked"}
                          </StatusPill>
                          <span className="text-sm font-bold text-dark/55">
                            {formatEventDates(event)}
                          </span>
                        </div>
                      ) : null}
                      <p className="mt-4 max-w-3xl text-sm leading-6 text-dark/65">
                        Lock event bersifat permanen dari admin. Setelah
                        dikunci, super admin tidak dapat membuka lock lagi.
                        Untuk mengganti event aktif, lock event lama terlebih
                        dahulu, lalu pilih event baru.
                      </p>
                    </div>
                    {event ? (
                      <button
                        type="button"
                        className="btn-secondary shrink-0 border-orange/30 text-orange hover:bg-orange/10"
                        disabled={loading || Boolean(event.lockedAt)}
                        onClick={() =>
                          setConfirmAction({ type: "lock", event })
                        }
                      >
                        <Lock size={18} />
                        {event.lockedAt ? "Sudah Locked" : "Lock Event Ini"}
                      </button>
                    ) : null}
                  </div>
                </article>

                <div className="rounded-lg border border-dark/10 bg-white p-5 shadow-soft">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-xl font-black">
                        Pilih Event yang Dipakai Website
                      </h2>
                      <p className="mt-1 text-sm text-dark/60">
                        Landing page, pendaftaran, dashboard, FAQ, jadwal, dan
                        pengumuman mengikuti event aktif.
                      </p>
                    </div>
                    <StatusPill tone="dark">{events.length} event</StatusPill>
                  </div>
                  <div className="mt-5 grid gap-3">
                    {events.map((item) => {
                      const isCurrent = item.id === event?.id;
                      const activeEventMustBeLocked = Boolean(
                        event && !event.lockedAt && !isCurrent,
                      );
                      const disabledReason = item.lockedAt
                        ? "Event locked tidak bisa diaktifkan dari admin."
                        : activeEventMustBeLocked
                          ? "Lock event aktif saat ini terlebih dahulu."
                          : "";
                      return (
                        <article
                          key={item.id}
                          className={clsx(
                            "rounded-lg border p-4",
                            isCurrent
                              ? "border-primary/40 bg-primary/5"
                              : "border-dark/10",
                          )}
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusPill
                                  tone={
                                    item.status === "aktif"
                                      ? "teal"
                                      : item.status === "draft"
                                        ? "amber"
                                        : "dark"
                                  }
                                >
                                  {item.status}
                                </StatusPill>
                                {item.lockedAt ? (
                                  <StatusPill tone="orange">Locked</StatusPill>
                                ) : null}
                                <span className="text-xs font-bold text-dark/45">
                                  {formatEventDates(item)}
                                </span>
                              </div>
                              <h3 className="mt-3 break-words font-black">
                                {item.name}
                              </h3>
                              <p className="mt-1 break-words text-sm leading-6 text-dark/60">
                                {item.theme}
                              </p>
                              {disabledReason ? (
                                <p className="mt-2 text-xs font-bold text-orange">
                                  {disabledReason}
                                </p>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              className="btn-primary shrink-0"
                              disabled={
                                loading ||
                                isCurrent ||
                                Boolean(item.lockedAt) ||
                                activeEventMustBeLocked
                              }
                              onClick={() =>
                                setConfirmAction({
                                  type: "activate",
                                  event: item,
                                })
                              }
                            >
                              <Power size={18} />
                              {isCurrent ? "Sedang Aktif" : "Gunakan Event Ini"}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                    {!events.length ? (
                      <article className="rounded-lg border border-dashed border-dark/20 p-8 text-center">
                        <p className="font-black">Belum ada event.</p>
                        <p className="mt-2 text-sm text-dark/60">
                          Buat periode baru terlebih dahulu.
                        </p>
                      </article>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "event" ? (
              <form
                onSubmit={createEvent}
                className="rounded-lg border border-dark/10 bg-white p-5 shadow-soft"
              >
                <h2 className="text-xl font-black">Buat Periode Baru</h2>
                <p className="mt-2 text-sm leading-6 text-dark/60">
                  Event baru dibuat sebagai draft atau arsip. Untuk menampilkan
                  event baru ke website, gunakan tab Event Aktif.
                </p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <TextField
                    label="Nama Event"
                    value={eventForm.name}
                    onChange={(value) =>
                      setEventForm((current) => ({ ...current, name: value }))
                    }
                  />
                  <TextField
                    label="Tahun"
                    type="number"
                    value={String(eventForm.year)}
                    onChange={(value) =>
                      setEventForm((current) => ({
                        ...current,
                        year: Number(value),
                      }))
                    }
                  />
                  <div className="md:col-span-2">
                    <TextField
                      label="Tema"
                      value={eventForm.theme}
                      onChange={(value) =>
                        setEventForm((current) => ({
                          ...current,
                          theme: value,
                        }))
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <TextField
                      label="Link Proposal Event"
                      value={eventForm.proposalUrl}
                      onChange={(value) =>
                        setEventForm((current) => ({
                          ...current,
                          proposalUrl: value,
                        }))
                      }
                      placeholder="Google Docs, Drive, atau URL file proposal"
                    />
                    <p className="mt-2 text-xs font-bold text-dark/45">
                      Proposal wajib dilampirkan sebelum super admin bisa
                      membuat event baru.
                    </p>
                  </div>
                  <TextField
                    label="Tanggal Mulai"
                    type="date"
                    value={eventForm.startDate}
                    onChange={(value) =>
                      setEventForm((current) => ({
                        ...current,
                        startDate: value,
                      }))
                    }
                  />
                  <TextField
                    label="Tanggal Selesai"
                    type="date"
                    value={eventForm.endDate}
                    onChange={(value) =>
                      setEventForm((current) => ({
                        ...current,
                        endDate: value,
                      }))
                    }
                  />
                  <div>
                    <label className="label" htmlFor="status">
                      Status
                    </label>
                    <CustomSelect
                      id="status"
                      value={eventForm.status}
                      onChange={(value) =>
                        setEventForm((current) => ({
                          ...current,
                          status: value,
                        }))
                      }
                      options={[
                        { value: "draft", label: "Draft" },
                        { value: "arsip", label: "Arsip" },
                      ]}
                    />
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

            {tab === "documents" ? (
              <div className="grid gap-5">
                <section className="rounded-lg border border-dark/10 bg-white p-5 shadow-soft">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
                        Arsip Kebutuhan Event
                      </p>
                      <h2 className="mt-2 text-2xl font-black">
                        Dokumen tiap periode
                      </h2>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-dark/60">
                        Super admin bisa melihat dokumen tahun lalu, upload
                        file, atau menambahkan link baru. Proposal wajib ada
                        saat event dibuat, sementara dokumen lock wajib lengkap
                        sebelum event dikunci.
                      </p>
                    </div>
                    <div className="w-full max-w-md">
                      <label className="label" htmlFor="document-event">
                        Pilih Event
                      </label>
                      <CustomSelect
                        id="document-event"
                        value={documentEventId}
                        onChange={setDocumentEventId}
                        options={events.map((item) => ({
                          value: item.id,
                          label: `${item.year} - ${item.name}`,
                          description: item.status,
                        }))}
                      />
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border border-dark/10 bg-white p-5 shadow-soft">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-xl font-black">
                        {selectedDocumentEvent
                          ? `${selectedDocumentEvent.name} ${selectedDocumentEvent.year}`
                          : "Dokumen Event"}
                      </h3>
                      <p className="mt-1 text-sm text-dark/60">
                        {eventDocuments.length
                          ? `${eventDocuments.length} dokumen tersimpan.`
                          : "Belum ada dokumen tersimpan untuk event ini."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          setDocumentDraft((current) =>
                            mergeDocumentTemplates(current),
                          )
                        }
                      >
                        <Plus size={18} />
                        Isi Template Wajib
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          setDocumentDraft((current) => [
                            ...current,
                            emptyEventDocument(current.length + 1),
                          ])
                        }
                      >
                        <Plus size={18} />
                        Tambah Input
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={saveEventDocuments}
                        disabled={loading || !documentEventId}
                      >
                        <Save size={18} />
                        Simpan Dokumen
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4">
                    {documentDraft.map((item, index) => (
                      <article
                        key={`${item.id || "new"}-${index}`}
                        className="rounded-lg border border-dark/10 bg-light p-4"
                      >
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <p className="text-sm font-black">
                            Dokumen {index + 1}
                          </p>
                          <button
                            type="button"
                            className="btn-danger px-3 py-2"
                            onClick={() =>
                              setDocumentDraft((current) =>
                                current.filter(
                                  (_, itemIndex) => itemIndex !== index,
                                ),
                              )
                            }
                          >
                            <Trash2 size={16} />
                            Hapus
                          </button>
                        </div>
                        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr_170px_170px]">
                          <TextField
                            label="Nama Dokumen"
                            value={item.label}
                            onChange={(value) =>
                              updateEventDocumentDraft(
                                index,
                                "label",
                                value,
                                setDocumentDraft,
                              )
                            }
                            placeholder="Proposal, LPJ, TOR"
                          />
                          <TextField
                            label="Link / URL File"
                            value={item.url}
                            onChange={(value) =>
                              updateEventDocumentDraft(
                                index,
                                "url",
                                value,
                                setDocumentDraft,
                              )
                            }
                            placeholder="https://docs.google.com/..."
                          />
                          <div>
                            <label
                              className="label"
                              htmlFor={`document-type-${index}`}
                            >
                              Tipe
                            </label>
                            <CustomSelect
                              id={`document-type-${index}`}
                              value={item.type}
                              onChange={(value) =>
                                updateEventDocumentDraft(
                                  index,
                                  "type",
                                  value,
                                  setDocumentDraft,
                                )
                              }
                              options={[
                                { value: "link", label: "Link" },
                                { value: "file", label: "File" },
                              ]}
                            />
                          </div>
                          <div>
                            <label
                              className="label"
                              htmlFor={`document-required-${index}`}
                            >
                              Kebutuhan
                            </label>
                            <CustomSelect
                              id={`document-required-${index}`}
                              value={item.requiredFor}
                              onChange={(value) =>
                                updateEventDocumentDraft(
                                  index,
                                  "requiredFor",
                                  value,
                                  setDocumentDraft,
                                )
                              }
                              options={[
                                { value: "create", label: "Create Event" },
                                { value: "lock", label: "Lock Event" },
                                { value: "archive", label: "Arsip" },
                              ]}
                            />
                          </div>
                        </div>
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            {item.url ? (
                              <a
                                href={resolveFileURL(item.url)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex min-w-0 items-center gap-2 text-sm font-black text-primary"
                              >
                                <ExternalLink size={16} />
                                <span className="truncate">Buka dokumen</span>
                              </a>
                            ) : (
                              <p className="text-sm text-dark/55">
                                Isi link manual atau upload file dari komputer.
                              </p>
                            )}
                          </div>
                          <label className="btn-secondary cursor-pointer px-3 py-2">
                            <Upload size={18} />
                            {uploadingDocumentIndex === index
                              ? "Uploading..."
                              : "Upload File"}
                            <input
                              type="file"
                              className="hidden"
                              disabled={
                                uploadingDocumentIndex !== null ||
                                !documentEventId
                              }
                              onChange={(event) => {
                                void uploadEventDocumentFile(
                                  index,
                                  event.currentTarget.files?.[0] ?? null,
                                );
                                event.currentTarget.value = "";
                              }}
                            />
                          </label>
                        </div>
                      </article>
                    ))}
                    {!documentDraft.length ? (
                      <article className="rounded-lg border border-dashed border-dark/20 p-8 text-center">
                        <p className="font-black">Belum ada draft dokumen.</p>
                        <p className="mt-2 text-sm text-dark/60">
                          Gunakan template wajib atau tambah input baru.
                        </p>
                      </article>
                    ) : null}
                  </div>
                </section>
              </div>
            ) : null}

            {tab === "payment" ? (
              <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                <article className="card bg-white p-5">
                  <StatusPill
                    tone={paymentSettings.isEnabled ? "teal" : "orange"}
                  >
                    {paymentSettings.isEnabled ? "Aktif" : "Nonaktif"}
                  </StatusPill>
                  <h2 className="mt-4 text-2xl font-black">
                    Harga Pendaftaran
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-dark/65">
                    Nominal ini dipakai saat peserta membuat QRIS Pakasir untuk
                    event aktif. Ubah dari sini jika biaya pendaftaran berubah,
                    tanpa perlu edit `.env`.
                  </p>
                  <div className="mt-5 grid gap-4">
                    <TextField
                      label="Nominal QRIS"
                      type="number"
                      value={paymentDraft.amount}
                      onChange={(value) =>
                        setPaymentDraft((current) => ({
                          ...current,
                          amount: value,
                        }))
                      }
                      placeholder="Contoh: 50000"
                    />
                    <label className="flex items-center gap-3 rounded-md border border-dark/10 bg-light px-4 py-3 text-sm font-bold">
                      <input
                        type="checkbox"
                        checked={paymentDraft.isEnabled}
                        onChange={(event) =>
                          setPaymentDraft((current) => ({
                            ...current,
                            isEnabled: event.target.checked,
                          }))
                        }
                      />
                      Aktifkan pembayaran untuk event ini
                    </label>
                  </div>
                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={savePaymentSettings}
                      disabled={loading}
                    >
                      <Save size={18} />
                      Simpan Harga
                    </button>
                  </div>
                </article>
                <article className="card bg-white p-5">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
                    Ringkasan
                  </p>
                  <div className="mt-5 grid gap-3">
                    <Info label="Event" value={event?.name ?? "-"} />
                    <Info
                      label="Nominal saat ini"
                      value={formatCurrency(paymentSettings.amount)}
                    />
                    <Info
                      label="Status"
                      value={
                        paymentSettings.isEnabled
                          ? "Pembayaran aktif"
                          : "Pembayaran nonaktif"
                      }
                    />
                    <Info
                      label="Update terakhir"
                      value={formatDateTime(paymentSettings.updatedAt)}
                    />
                  </div>
                  {paymentSettings.amount <= 0 ? (
                    <p className="mt-5 rounded-md border border-orange/20 bg-orange/10 px-4 py-3 text-sm font-bold text-orange">
                      Nominal masih 0. Peserta belum bisa generate QRIS sampai
                      harga diatur.
                    </p>
                  ) : null}
                </article>
              </div>
            ) : null}

            {tab === "panitia" ? (
              <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                <form onSubmit={createRedeemCode} className="card bg-white p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 place-items-center bg-primary text-white">
                      <QrCode size={20} />
                    </span>
                    <div>
                      <h2 className="text-xl font-black">
                        Buat Kode Redeem Panitia
                      </h2>
                      <p className="mt-1 text-sm leading-6 text-dark/60">
                        Kadiv membuat link atau QR. Panitia claim sendiri dengan
                        nama dan email ITERA.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-4">
                    <div>
                      <label className="label" htmlFor="redeem-role">
                        Role hasil claim
                      </label>
                      <CustomSelect
                        id="redeem-role"
                        value={redeemForm.role}
                        onChange={(value) =>
                          setRedeemForm((current) => ({
                            ...current,
                            role: value,
                          }))
                        }
                        options={[
                          { value: "panitia", label: "Panitia" },
                          { value: "admin", label: "Admin / Kadiv" },
                          { value: "juri", label: "Juri" },
                        ]}
                      />
                    </div>
                    <TextField
                      label="Divisi"
                      value={redeemForm.division}
                      onChange={(value) =>
                        setRedeemForm((current) => ({
                          ...current,
                          division: value,
                        }))
                      }
                      placeholder="Acara, Pubdok, Website"
                    />
                    <TextField
                      label="Maksimal Claim"
                      type="number"
                      value={String(redeemForm.maxClaims)}
                      onChange={(value) =>
                        setRedeemForm((current) => ({
                          ...current,
                          maxClaims: Number(value),
                        }))
                      }
                    />
                    <TextField
                      label="Kedaluwarsa"
                      type="datetime-local"
                      value={redeemForm.expiresAt}
                      onChange={(value) =>
                        setRedeemForm((current) => ({
                          ...current,
                          expiresAt: value,
                        }))
                      }
                    />
                  </div>
                  <div className="mt-5 flex justify-end">
                    <button className="btn-primary" disabled={loading}>
                      <QrCode size={18} />
                      Generate Redeem
                    </button>
                  </div>
                </form>

                <div className="card bg-white p-5">
                  <h2 className="text-xl font-black">Link & QR Redeem</h2>
                  <div className="mt-5 grid gap-3">
                    {redeemCodes.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-lg border border-dark/10 bg-light p-4"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap gap-2">
                              <StatusPill
                                tone={
                                  item.status === "active"
                                    ? "teal"
                                    : item.status === "claimed"
                                      ? "dark"
                                      : "orange"
                                }
                              >
                                {item.status}
                              </StatusPill>
                              <StatusPill tone="amber">{item.role}</StatusPill>
                            </div>
                            <p className="mt-3 font-black">{item.code}</p>
                            <p className="mt-1 break-all text-xs leading-5 text-dark/55">
                              {item.claimUrl}
                            </p>
                            <p className="mt-2 text-xs font-bold text-dark/45">
                              {item.claimedCount}/{item.maxClaims} claim{" "}
                              {item.division ? `- ${item.division}` : ""}
                            </p>
                          </div>
                          <img
                            className="h-24 w-24 bg-white p-2"
                            alt={`QR redeem ${item.code}`}
                            src={qrImageUrl(item.claimUrl)}
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn-secondary px-3 py-2"
                            onClick={() => copyRedeemLink(item.claimUrl)}
                          >
                            <Copy size={16} />
                            Copy Link
                          </button>
                          <a
                            className="btn-secondary px-3 py-2"
                            href={item.claimUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <LinkIcon size={16} />
                            Buka
                          </a>
                        </div>
                      </article>
                    ))}
                    {!redeemCodes.length ? (
                      <p className="text-sm text-dark/60">
                        Belum ada kode redeem.
                      </p>
                    ) : null}
                  </div>
                </div>

                {isSuperAdmin ? (
                  <form
                    onSubmit={createAdmin}
                    className="rounded-lg border border-dark/10 bg-white p-5 shadow-soft"
                  >
                    <h2 className="text-xl font-black">Tambah Akun Manual</h2>
                    <p className="mt-1 text-sm leading-6 text-dark/60">
                      Khusus super admin untuk membuat Kadiv atau akun darurat.
                    </p>
                    <div className="mt-5 grid gap-4">
                      <TextField
                        label="Nama"
                        value={adminForm.name}
                        onChange={(value) =>
                          setAdminForm((current) => ({
                            ...current,
                            name: value,
                          }))
                        }
                      />
                      <TextField
                        label="NIM"
                        value={adminForm.nim}
                        onChange={(value) =>
                          setAdminForm((current) => ({
                            ...current,
                            nim: value,
                          }))
                        }
                      />
                      <div>
                        <label className="label" htmlFor="admin-role">
                          Role
                        </label>
                        <CustomSelect
                          id="admin-role"
                          value={adminForm.role}
                          onChange={(value) =>
                            setAdminForm((current) => ({
                              ...current,
                              role: value,
                            }))
                          }
                          options={[
                            { value: "admin", label: "Admin / Kadiv" },
                            { value: "super_admin", label: "Super Admin" },
                            { value: "panitia", label: "Panitia" },
                            { value: "juri", label: "Juri" },
                          ]}
                        />
                      </div>
                      <TextField
                        label="Divisi"
                        value={adminForm.division}
                        onChange={(value) =>
                          setAdminForm((current) => ({
                            ...current,
                            division: value,
                          }))
                        }
                      />
                      <TextField
                        label="Password Awal"
                        type="password"
                        value={adminForm.password}
                        onChange={(value) =>
                          setAdminForm((current) => ({
                            ...current,
                            password: value,
                          }))
                        }
                        placeholder="Kosongkan untuk memakai NIM"
                      />
                      <div className="rounded-md bg-light px-4 py-3 text-sm">
                        <span className="font-bold text-dark/55">Email:</span>{" "}
                        <span className="font-black">
                          {generatedEmail || "nama.nim@student.itera.ac.id"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-5 flex justify-end">
                      <button className="btn-primary" disabled={loading}>
                        <UserPlus size={18} />
                        Buat Akun
                      </button>
                    </div>
                  </form>
                ) : null}

                <div className="rounded-lg border border-dark/10 bg-white p-5 shadow-soft">
                  <h2 className="text-xl font-black">Akun Admin & Panitia</h2>
                  <div className="mt-5 grid gap-3 md:hidden">
                    {adminUsers.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-lg border border-dark/10 bg-light p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="break-words font-black">
                              {item.name}
                            </h3>
                            <p className="mt-1 text-xs text-dark/50">
                              {item.nim || "-"}
                            </p>
                          </div>
                          <p className="shrink-0 text-xs font-black uppercase tracking-wide text-primary">
                            {item.role}
                          </p>
                        </div>
                        <p className="mt-3 break-all text-sm text-dark/65">
                          {item.email}
                        </p>
                        <p className="mt-2 text-xs font-bold text-dark/45">
                          {item.division || "Tanpa divisi"}
                        </p>
                      </article>
                    ))}
                    {!adminUsers.length ? (
                      <p className="text-sm text-dark/60">
                        Belum ada akun panitia.
                      </p>
                    ) : null}
                  </div>
                  <div className="mt-5 hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[620px] text-left text-sm">
                      <thead className="border-b border-dark/10 text-xs uppercase text-dark/45">
                        <tr>
                          <th className="py-3 pr-4">Nama</th>
                          <th className="py-3 pr-4">Email</th>
                          <th className="py-3 pr-4">Role</th>
                          <th className="py-3 pr-4">Divisi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark/10">
                        {adminUsers.map((item) => (
                          <tr key={item.id}>
                            <td className="py-3 pr-4">
                              <p className="font-black">{item.name}</p>
                              <p className="text-xs text-dark/50">
                                {item.nim || "-"}
                              </p>
                            </td>
                            <td className="py-3 pr-4">{item.email}</td>
                            <td className="py-3 pr-4">{item.role}</td>
                            <td className="py-3 pr-4">
                              {item.division || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "jadwal" ? (
              <div className="grid gap-5">
                <section className="rounded-lg border border-dark/10 bg-white p-5 shadow-soft">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
                        Pendaftaran Peserta
                      </p>
                      <h2 className="mt-2 text-xl font-black">
                        Batch aktif saat ini
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-dark/60">
                        Form pendaftaran peserta akan otomatis memakai batch
                        ini. Backend juga mengunci batch agar tidak bisa diubah
                        manual dari request.
                      </p>
                    </div>
                    <div className="grid w-full max-w-md gap-3 sm:grid-cols-[1fr_auto]">
                      <CustomSelect
                        value={registrationDraft.currentBatch}
                        onChange={(value) =>
                          setRegistrationDraft({ currentBatch: value })
                        }
                        options={[
                          { value: "1", label: "Batch 1" },
                          { value: "2", label: "Batch 2" },
                        ]}
                      />
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={saveRegistrationSettings}
                        disabled={loading || !event}
                      >
                        <Save size={18} />
                        Simpan
                      </button>
                      <p className="text-xs font-bold text-dark/45 sm:col-span-2">
                        Saat ini: Batch {registrationSettings.currentBatch || 1}{" "}
                        {registrationSettings.updatedAt
                          ? `- update ${formatDateTime(registrationSettings.updatedAt)}`
                          : ""}
                      </p>
                    </div>
                  </div>
                </section>

                <div className="rounded-lg border border-dark/10 bg-white p-5 shadow-soft">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-xl font-black">Editor Jadwal</h2>
                      <p className="mt-1 text-sm text-dark/60">
                        Semua tahap disimpan ke tabel timeline event aktif.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          setTimelineDraft((current) => [
                            ...current,
                            emptyTimelineItem(current.length + 1),
                          ])
                        }
                      >
                        <Plus size={18} />
                        Tambah Tahap
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={saveTimeline}
                        disabled={loading}
                      >
                        <Save size={18} />
                        Simpan
                      </button>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-4">
                    {timelineDraft.map((item, index) => (
                      <div
                        key={index}
                        className="rounded-lg border border-dark/10 bg-light p-4"
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <p className="text-sm font-black">
                            Tahap {index + 1}
                          </p>
                          <button
                            type="button"
                            className="btn-danger px-3 py-2"
                            onClick={() =>
                              setTimelineDraft((current) =>
                                current.filter(
                                  (_, itemIndex) => itemIndex !== index,
                                ),
                              )
                            }
                          >
                            <Trash2 size={16} />
                            Hapus
                          </button>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <TextField
                            label="Nama Tahap"
                            value={item.label}
                            onChange={(value) =>
                              updateTimelineDraft(
                                index,
                                "label",
                                value,
                                setTimelineDraft,
                              )
                            }
                          />
                          <TextField
                            label="Urutan"
                            type="number"
                            value={String(index + 1)}
                            onChange={() => undefined}
                            disabled
                          />
                          <TextField
                            label="Tanggal Mulai"
                            type="date"
                            value={item.startDate}
                            onChange={(value) =>
                              updateTimelineDraft(
                                index,
                                "startDate",
                                value,
                                setTimelineDraft,
                              )
                            }
                          />
                          <TextField
                            label="Tanggal Selesai"
                            type="date"
                            value={item.endDate}
                            onChange={(value) =>
                              updateTimelineDraft(
                                index,
                                "endDate",
                                value,
                                setTimelineDraft,
                              )
                            }
                          />
                          <div className="md:col-span-2">
                            <TextField
                              label="Deskripsi"
                              value={item.description}
                              onChange={(value) =>
                                updateTimelineDraft(
                                  index,
                                  "description",
                                  value,
                                  setTimelineDraft,
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    {!timelineDraft.length ? (
                      <article className="rounded-lg border border-dashed border-dark/20 p-8 text-center">
                        <p className="font-black">Belum ada tahap jadwal.</p>
                        <p className="mt-2 text-sm text-dark/60">
                          Tambahkan tahap baru lalu simpan untuk mengisi
                          timeline event.
                        </p>
                      </article>
                    ) : null}
                  </div>

                  <div className="mt-8 border-t border-dark/10 pt-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-xl font-black">
                          Tahap Upload Karya
                        </h2>
                        <p className="mt-1 text-sm text-dark/60">
                          Tahap ini menentukan pilihan upload di dashboard
                          peserta.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() =>
                            setSubmissionStageDraft((current) => [
                              ...current,
                              emptySubmissionStage(current.length + 1),
                            ])
                          }
                        >
                          <Plus size={18} />
                          Tambah Tahap
                        </button>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={saveSubmissionStages}
                          disabled={loading}
                        >
                          <Save size={18} />
                          Simpan Tahap
                        </button>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-4">
                      {submissionStageDraft.map((item, index) => (
                        <div
                          key={index}
                          className="rounded-lg border border-dark/10 bg-light p-4"
                        >
                          <div className="mb-4 flex items-center justify-between">
                            <p className="text-sm font-black">
                              Tahap Upload {index + 1}
                            </p>
                            <button
                              type="button"
                              className="btn-danger px-3 py-2"
                              onClick={() =>
                                setSubmissionStageDraft((current) =>
                                  current.filter(
                                    (_, itemIndex) => itemIndex !== index,
                                  ),
                                )
                              }
                            >
                              <Trash2 size={16} />
                              Hapus
                            </button>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <TextField
                              label="Nama Tahap"
                              value={item.label}
                              onChange={(value) =>
                                updateSubmissionStageDraft(
                                  index,
                                  "label",
                                  value,
                                  setSubmissionStageDraft,
                                )
                              }
                            />
                            <TextField
                              label="Key Tahap"
                              value={item.key}
                              onChange={(value) =>
                                updateSubmissionStageDraft(
                                  index,
                                  "key",
                                  value,
                                  setSubmissionStageDraft,
                                )
                              }
                              placeholder="awal, final, semifinal"
                            />
                            <TextField
                              label="Urutan"
                              type="number"
                              value={String(index + 1)}
                              onChange={() => undefined}
                              disabled
                            />
                            <label className="flex items-center gap-3 rounded-md bg-white px-4 py-3 text-sm font-bold">
                              <input
                                type="checkbox"
                                checked={item.isOpen}
                                onChange={(event) =>
                                  updateSubmissionStageDraft(
                                    index,
                                    "isOpen",
                                    event.target.checked,
                                    setSubmissionStageDraft,
                                  )
                                }
                              />
                              Tahap dibuka
                            </label>
                            <label className="flex items-center gap-3 rounded-md bg-white px-4 py-3 text-sm font-bold md:col-span-2">
                              <input
                                type="checkbox"
                                checked={item.requiresApproval}
                                onChange={(event) =>
                                  updateSubmissionStageDraft(
                                    index,
                                    "requiresApproval",
                                    event.target.checked,
                                    setSubmissionStageDraft,
                                  )
                                }
                              />
                              Wajib lolos/diberi akses oleh admin sebelum
                              peserta bisa submit
                            </label>
                          </div>
                        </div>
                      ))}
                      {!submissionStageDraft.length ? (
                        <article className="rounded-lg border border-dashed border-dark/20 p-8 text-center">
                          <p className="font-black">Belum ada tahap upload.</p>
                          <p className="mt-2 text-sm text-dark/60">
                            Tambahkan minimal satu tahap agar peserta bisa
                            mengirim karya.
                          </p>
                        </article>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "rubrik" ? (
              <div className="rounded-lg border border-dark/10 bg-white p-5 shadow-soft">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-black">
                      Rubrik Penilaian Juri
                    </h2>
                    <p className="mt-1 text-sm text-dark/60">
                      Pertanyaan ini muncul di detail tim untuk juri. Buat
                      kalimat yang singkat dan mudah dinilai.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        setRubricDraft((current) => [
                          ...current,
                          emptyRubricQuestion(current.length + 1),
                        ])
                      }
                    >
                      <Plus size={18} />
                      Tambah Pertanyaan
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={saveRubricQuestions}
                      disabled={loading || !event}
                    >
                      <Save size={18} />
                      Simpan Rubrik
                    </button>
                  </div>
                </div>
                <div className="mt-5 grid gap-4">
                  {rubricDraft.map((item, index) => (
                    <article
                      key={index}
                      className="rounded-lg border border-dark/10 bg-light p-4"
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <p className="text-sm font-black">
                          Pertanyaan {index + 1}
                        </p>
                        <button
                          type="button"
                          className="btn-danger px-3 py-2"
                          onClick={() =>
                            setRubricDraft((current) =>
                              current.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            )
                          }
                        >
                          <Trash2 size={16} />
                          Hapus
                        </button>
                      </div>
                      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px]">
                        <TextField
                          label="Pertanyaan"
                          value={item.question}
                          onChange={(value) =>
                            updateRubricDraft(
                              index,
                              "question",
                              value,
                              setRubricDraft,
                            )
                          }
                          placeholder="Contoh: Apakah solusi menjawab masalah pengguna?"
                        />
                        <TextField
                          label="Skor Maksimal"
                          type="number"
                          value={String(item.maxScore)}
                          onChange={(value) =>
                            updateRubricDraft(
                              index,
                              "maxScore",
                              Number(value),
                              setRubricDraft,
                            )
                          }
                        />
                        <div className="md:col-span-2">
                          <TextField
                            label="Catatan untuk Juri"
                            value={item.description}
                            onChange={(value) =>
                              updateRubricDraft(
                                index,
                                "description",
                                value,
                                setRubricDraft,
                              )
                            }
                            placeholder="Beri arahan singkat agar juri tahu yang perlu dilihat."
                          />
                        </div>
                      </div>
                    </article>
                  ))}
                  {!rubricDraft.length ? (
                    <article className="rounded-lg border border-dashed border-dark/20 p-8 text-center">
                      <p className="font-black">Rubrik belum dibuat.</p>
                      <p className="mt-2 text-sm text-dark/60">
                        Tambahkan beberapa pertanyaan agar juri bisa mulai
                        menilai.
                      </p>
                    </article>
                  ) : null}
                </div>
              </div>
            ) : null}

            {tab === "faq" ? (
              <div className="grid gap-5">
                <div className="rounded-lg border border-dark/10 bg-white p-5 shadow-soft">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-xl font-black">
                        Aturan Jumlah Peserta
                      </h2>
                      <p className="mt-1 text-sm text-dark/60">
                        Batas ini dihitung termasuk ketua. Sistem akan menolak
                        pendaftaran di luar batas ini.
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
                      onChange={(value) =>
                        setRulesDraft((current) => ({
                          ...current,
                          minTeamMembers: Number(value),
                        }))
                      }
                    />
                    <TextField
                      label="Maksimal Peserta"
                      type="number"
                      value={String(rulesDraft.maxTeamMembers)}
                      onChange={(value) =>
                        setRulesDraft((current) => ({
                          ...current,
                          maxTeamMembers: Number(value),
                        }))
                      }
                    />
                    <div className="flex items-end">
                      <button
                        type="button"
                        className="btn-primary w-full"
                        onClick={saveRules}
                        disabled={loading || !event}
                      >
                        <Save size={18} />
                        Simpan
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
                  <form
                    onSubmit={saveFAQ}
                    className="rounded-lg border border-dark/10 bg-white p-5 shadow-soft"
                  >
                    <h2 className="text-xl font-black">
                      {editingFaqId ? "Edit FAQ" : "Tambah FAQ / Aturan"}
                    </h2>
                    <div className="mt-5 grid gap-4">
                      <TextField
                        label="Pertanyaan"
                        value={faqForm.question}
                        onChange={(value) =>
                          setFaqForm((current) => ({
                            ...current,
                            question: value,
                          }))
                        }
                        placeholder="Contoh: Berapa jumlah anggota dalam satu tim?"
                      />
                      <TextAreaField
                        label="Jawaban / Aturan"
                        value={faqForm.answer}
                        onChange={(value) =>
                          setFaqForm((current) => ({
                            ...current,
                            answer: value,
                          }))
                        }
                        placeholder="Tulis aturan atau jawaban yang akan tampil di landing page."
                      />
                      <TextField
                        label="Urutan"
                        type="number"
                        value={String(faqForm.sortOrder)}
                        onChange={(value) =>
                          setFaqForm((current) => ({
                            ...current,
                            sortOrder: Number(value),
                          }))
                        }
                      />
                      <label className="flex items-center gap-3 rounded-md bg-light px-4 py-3 text-sm font-bold">
                        <input
                          type="checkbox"
                          checked={faqForm.isPublished}
                          onChange={(event) =>
                            setFaqForm((current) => ({
                              ...current,
                              isPublished: event.target.checked,
                            }))
                          }
                        />
                        Tampilkan di halaman publik
                      </label>
                    </div>
                    <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                      {editingFaqId ? (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={cancelFAQEdit}
                          disabled={loading}
                        >
                          Batal
                        </button>
                      ) : null}
                      <button
                        className="btn-primary"
                        disabled={loading || !event}
                      >
                        <Save size={18} />
                        {editingFaqId ? "Simpan Perubahan" : "Tambah FAQ"}
                      </button>
                    </div>
                  </form>

                  <div className="rounded-lg border border-dark/10 bg-white p-5 shadow-soft">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-xl font-black">
                          FAQ & Aturan Publik
                        </h2>
                        <p className="mt-1 text-sm text-dark/60">
                          {event?.name ?? "Event aktif"} memakai daftar ini
                          secara dinamis.
                        </p>
                      </div>
                      <StatusPill tone="dark">{faqs.length} item</StatusPill>
                    </div>
                    <div className="mt-5 grid gap-3">
                      {faqs.map((faq) => (
                        <article
                          key={faq.id}
                          className="rounded-lg border border-dark/10 p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusPill
                                  tone={faq.isPublished ? "teal" : "dark"}
                                >
                                  {faq.isPublished ? "Published" : "Draft"}
                                </StatusPill>
                                <span className="text-xs font-bold text-dark/45">
                                  Urutan {faq.sortOrder}
                                </span>
                              </div>
                              <h3 className="mt-3 break-words font-black">
                                {faq.question}
                              </h3>
                              <p className="mt-2 break-words text-sm leading-6 text-dark/65">
                                {faq.answer || "-"}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-2">
                              <button
                                type="button"
                                className="btn-secondary px-3 py-2"
                                onClick={() => editFAQ(faq)}
                                disabled={loading}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn-danger px-3 py-2"
                                onClick={() => deleteFAQ(faq.id)}
                                disabled={loading}
                              >
                                Hapus
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                      {!faqs.length ? (
                        <article className="rounded-lg border border-dashed border-dark/20 p-8 text-center">
                          <p className="font-black">Belum ada FAQ.</p>
                          <p className="mt-2 text-sm text-dark/60">
                            Tambahkan aturan pertama untuk event aktif.
                          </p>
                        </article>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "submission" ? (
              <div className="rounded-lg border border-dark/10 bg-white p-4 shadow-soft sm:p-5">
                <div
                  className={clsx(
                    "grid gap-5",
                    selectedTeam && "xl:grid-cols-[minmax(0,1fr)_360px]",
                  )}
                >
                  <div className="min-w-0">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
                        Submission
                      </p>
                      <h2 className="mt-2 text-xl font-black">
                        Tim yang sudah mengirim karya
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-dark/60">
                        Tabel ini hanya menampilkan tim yang sudah mengirim
                        minimal satu file atau link submission.
                      </p>
                    </div>
                    <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px]">
                      <div className="relative">
                        <Search
                          className="pointer-events-none absolute left-3 top-3 text-dark/35"
                          size={18}
                        />
                        <input
                          className="field !pl-10"
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Cari tim yang sudah submit"
                        />
                      </div>
                      <CustomSelect
                        value={status}
                        onChange={setStatus}
                        options={[
                          { value: "", label: "Semua status" },
                          { value: "pending", label: "Pending" },
                          { value: "verified", label: "Verified" },
                          { value: "rejected", label: "Rejected" },
                        ]}
                      />
                    </div>
                    <TeamTable
                      teams={filteredSubmissionTeams}
                      onVerify={verify}
                      onDetail={openTeamDetail}
                      loading={loading}
                      selectedTeamId={selectedTeam?.team.id}
                      canVerify={false}
                      compact
                      emptyLabel="Belum ada tim yang sudah mengirim file atau link submission sesuai filter."
                    />
                  </div>
                  {selectedTeam ? (
                    <div ref={teamDetailRef} className="min-w-0 scroll-mt-24">
                      <TeamDetailPanel
                        detail={selectedTeam}
                        onClose={() => setSelectedTeam(null)}
                        onStageAccess={setStageAccess}
                        onAssessmentSaved={(detail) =>
                          setSelectedTeam(normalizeTeamDetail(detail))
                        }
                        onDeleteTeam={deleteTeam}
                        loading={loading}
                        canDelete={isSuperAdmin}
                        canManageStages={!isJury}
                        currentUser={user}
                        token={token}
                        embedded
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {tab === "pengumuman" ? (
              <form
                onSubmit={createAnnouncement}
                className="rounded-lg border border-dark/10 bg-white p-5 shadow-soft"
              >
                <h2 className="text-xl font-black">Publish Pengumuman</h2>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="announcement-type">
                      Jenis
                    </label>
                    <CustomSelect
                      id="announcement-type"
                      value={announcementForm.type}
                      onChange={(value) =>
                        setAnnouncementForm((current) => ({
                          ...current,
                          type: value,
                          teamId: value === "info" ? "" : current.teamId,
                        }))
                      }
                      options={[
                        { value: "finalis", label: "Finalis" },
                        { value: "pemenang", label: "Pemenang" },
                        { value: "info", label: "Info" },
                      ]}
                    />
                  </div>
                  {announcementForm.type === "pemenang" ? (
                    <TextField
                      label="Peringkat"
                      type="number"
                      value={announcementForm.rank}
                      onChange={(value) =>
                        setAnnouncementForm((current) => ({
                          ...current,
                          rank: value,
                        }))
                      }
                    />
                  ) : null}
                  <TextField
                    label="Judul"
                    value={announcementForm.title}
                    onChange={(value) =>
                      setAnnouncementForm((current) => ({
                        ...current,
                        title: value,
                      }))
                    }
                  />
                  <div className="md:col-span-2">
                    <label className="label" htmlFor="announcement-image">
                      Foto Berita
                    </label>
                    <label
                      htmlFor="announcement-image"
                      className="flex cursor-pointer flex-col gap-3 rounded-lg border border-dashed border-dark/20 bg-light p-4 transition hover:border-primary hover:bg-primary/5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white text-primary shadow-soft">
                          <ImagePlus size={20} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black">
                            {announcementImage
                              ? announcementImage.name
                              : "Upload foto untuk kartu berita"}
                          </span>
                          <span className="mt-1 block text-xs font-bold text-dark/45">
                            PNG, JPG, WEBP. Maksimal 6MB.
                          </span>
                        </span>
                      </span>
                      <span className="rounded-md border border-dark/10 bg-white px-3 py-2 text-xs font-black text-primary">
                        Pilih Foto
                      </span>
                    </label>
                    <input
                      key={announcementImageInputKey}
                      id="announcement-image"
                      className="sr-only"
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        setAnnouncementImage(event.target.files?.[0] ?? null)
                      }
                    />
                    {announcementImage ? (
                      <button
                        type="button"
                        className="btn-danger mt-2 px-3 py-2 text-xs"
                        onClick={() => {
                          setAnnouncementImage(null);
                          setAnnouncementImageInputKey(
                            (current) => current + 1,
                          );
                        }}
                      >
                        <X size={14} />
                        Hapus foto terpilih
                      </button>
                    ) : null}
                  </div>
                  {announcementForm.type !== "info" ? (
                    <div className="md:col-span-2">
                      <label
                        className="label"
                        htmlFor="announcement-team-search"
                      >
                        Cari Tim
                      </label>
                      <div className="grid gap-3 md:grid-cols-[1fr_1.1fr]">
                        <div className="relative">
                          <Search
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dark/35"
                            size={17}
                          />
                          <input
                            id="announcement-team-search"
                            className="field !pl-10"
                            value={announcementTeamSearch}
                            onChange={(event) => {
                              setAnnouncementTeamSearch(event.target.value);
                              setAnnouncementForm((current) => ({
                                ...current,
                                teamId: "",
                              }));
                            }}
                            placeholder="Cari nama tim, ketua, instansi"
                          />
                        </div>
                        <CustomSelect
                          value={announcementForm.teamId}
                          onChange={(value) =>
                            setAnnouncementForm((current) => ({
                              ...current,
                              teamId: value,
                            }))
                          }
                          placeholder={
                            announcementTeamSearch && !announcementTeams.length
                              ? "Tidak ada tim sesuai pencarian"
                              : "Pilih tim dari hasil pencarian"
                          }
                          disabled={!announcementTeams.length}
                          options={announcementTeams.map((team) => ({
                            value: team.id,
                            label: team.name,
                            description: `${team.categoryName} - ${team.institution}`,
                          }))}
                        />
                      </div>
                      {selectedAnnouncementTeam ? (
                        <div className="mt-3 grid gap-3 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm md:grid-cols-3">
                          <Info
                            label="Tim"
                            value={selectedAnnouncementTeam.name}
                          />
                          <Info
                            label="Kategori"
                            value={selectedAnnouncementTeam.categoryName}
                          />
                          <Info
                            label="Instansi"
                            value={selectedAnnouncementTeam.institution}
                          />
                        </div>
                      ) : (
                        <p className="mt-2 text-xs font-bold text-dark/45">
                          Data tim, kategori, instansi, dan link prototype akan
                          diambil otomatis dari database.
                        </p>
                      )}
                    </div>
                  ) : null}
                  <div className="md:col-span-2">
                    <TextAreaField
                      label="Isi"
                      value={announcementForm.body}
                      onChange={(value) =>
                        setAnnouncementForm((current) => ({
                          ...current,
                          body: value,
                        }))
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <TextAreaField
                      label="Alasan Menang / Catatan"
                      value={announcementForm.reason}
                      onChange={(value) =>
                        setAnnouncementForm((current) => ({
                          ...current,
                          reason: value,
                        }))
                      }
                    />
                  </div>
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
                <StatusPill
                  tone={user.role === "super_admin" ? "dark" : "teal"}
                >
                  {user.role}
                </StatusPill>
                <h2 className="mt-4 text-2xl font-black">{user.name}</h2>
                <p className="mt-2 text-sm text-dark/65">{user.email}</p>
                <p className="mt-1 text-sm text-dark/65">
                  Divisi {user.division || "-"}
                </p>
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
    sortOrder: item.sortOrder,
  };
}

function submissionStageToInput(
  item: SubmissionStageInput,
): SubmissionStageInput {
  return {
    id: item.id,
    key: item.key,
    label: item.label,
    sortOrder: item.sortOrder,
    isOpen: item.isOpen,
    requiresApproval: item.requiresApproval,
  };
}

function rubricQuestionToInput(item: RubricQuestion): RubricQuestionInput {
  return {
    id: item.id,
    question: item.question,
    description: item.description,
    maxScore: item.maxScore,
    sortOrder: item.sortOrder,
    isActive: item.isActive,
  };
}

function eventDocumentToInput(item: EventDocument): EventDocumentInput {
  return {
    id: item.id,
    label: item.label,
    url: item.url,
    type: item.type,
    requiredFor: item.requiredFor,
    sortOrder: item.sortOrder,
  };
}

function mergeDocumentTemplates(current: EventDocumentInput[]) {
  const existingLabels = new Set(
    current.map((item) => normalizeDocumentLabel(item.label)),
  );
  const additions = requiredEventDocumentTemplates
    .filter((item) => !existingLabels.has(normalizeDocumentLabel(item.label)))
    .map((item) => ({ ...item }));
  return [...current, ...additions].map((item, index) => ({
    ...item,
    sortOrder: index + 1,
  }));
}

function normalizeDocumentLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "dan")
    .replace(/-/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

function normalizeTeamDetail(detail: TeamDetail): TeamDetail {
  return {
    ...detail,
    team: {
      ...detail.team,
      members: detail.team.members ?? [],
    },
    submissions: detail.submissions ?? [],
    submissionStages: detail.submissionStages ?? [],
    rubricQuestions: detail.rubricQuestions ?? [],
    assessments: detail.assessments ?? [],
  };
}

function latestSubmissionAssets(detail: TeamDetail) {
  const submissions = [...(detail.submissions ?? [])].sort(
    (a, b) =>
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );
  const findURL = (
    key: "proposalUrl" | "prototypeUrl" | "pptUrl" | "reportUrl" | "posterUrl",
  ) => submissions.find((submission) => submission[key])?.[key] ?? "";

  return {
    proposalUrl: findURL("proposalUrl"),
    prototypeUrl: findURL("prototypeUrl"),
    pptUrl: findURL("pptUrl"),
    reportUrl: findURL("reportUrl"),
    posterUrl: findURL("posterUrl"),
  };
}

function sortFAQs(items: FAQ[]) {
  return [...items].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.question.localeCompare(b.question),
  );
}

function formatEventDates(event: Event) {
  return `${event.year} | ${event.startDate} - ${event.endDate}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatScore(value: number) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDateTime(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function qrImageUrl(value: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=2&data=${encodeURIComponent(value)}`;
}

function EventActionModal({
  action,
  loading,
  onCancel,
  onConfirm,
}: {
  action: Exclude<EventAction, null>;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isLock = action.type === "lock";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-dark/55 px-4 py-6">
      <article className="w-full max-w-lg rounded-lg border border-dark/10 bg-white p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <span
            className={clsx(
              "grid h-10 w-10 shrink-0 place-items-center rounded-md",
              isLock
                ? "bg-orange/10 text-orange"
                : "bg-primary/10 text-primary",
            )}
          >
            {isLock ? <Lock size={20} /> : <AlertTriangle size={20} />}
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-black">
              {isLock ? "Lock event ini?" : "Gunakan event ini?"}
            </h2>
            <p className="mt-2 break-words text-sm leading-6 text-dark/65">
              {isLock
                ? `${action.event.name} tahun ${action.event.year} akan dikunci permanen dari admin. Setelah dikunci, hanya developer yang bisa membuka lock lewat database.`
                : `${action.event.name} akan menjadi event aktif. Semua tampilan website akan memakai data event ini setelah proses selesai.`}
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Tidak
          </button>
          <button
            type="button"
            className={
              isLock
                ? "btn-secondary border-orange/30 text-orange hover:bg-orange/10"
                : "btn-primary"
            }
            onClick={onConfirm}
            disabled={loading}
          >
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
  setTimelineDraft: Dispatch<SetStateAction<TimelineItemInput[]>>,
) {
  setTimelineDraft((current) =>
    current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [key]: value } : item,
    ),
  );
}

function updateSubmissionStageDraft<
  K extends Exclude<keyof SubmissionStageInput, "id" | "sortOrder">,
>(
  index: number,
  key: K,
  value: SubmissionStageInput[K],
  setSubmissionStageDraft: Dispatch<SetStateAction<SubmissionStageInput[]>>,
) {
  setSubmissionStageDraft((current) =>
    current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [key]: value } : item,
    ),
  );
}

function updateRubricDraft<
  K extends Exclude<keyof RubricQuestionInput, "id" | "sortOrder" | "isActive">,
>(
  index: number,
  key: K,
  value: RubricQuestionInput[K],
  setRubricDraft: Dispatch<SetStateAction<RubricQuestionInput[]>>,
) {
  setRubricDraft((current) =>
    current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [key]: value } : item,
    ),
  );
}

function updateEventDocumentDraft<
  K extends Exclude<keyof EventDocumentInput, "id" | "sortOrder">,
>(
  index: number,
  key: K,
  value: EventDocumentInput[K],
  setDocumentDraft: Dispatch<SetStateAction<EventDocumentInput[]>>,
) {
  setDocumentDraft((current) =>
    current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [key]: value } : item,
    ),
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled = false,
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
        className="field disabled:bg-dark/5 disabled:text-dark/45"
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
  placeholder,
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
  onAssessmentSaved,
  onDeleteTeam,
  loading,
  canDelete,
  canManageStages,
  currentUser,
  token,
  embedded = false,
}: {
  detail: TeamDetail;
  onClose: () => void;
  onStageAccess: (teamId: string, stageId: string, isAllowed: boolean) => void;
  onAssessmentSaved: (detail: TeamDetail) => void;
  onDeleteTeam: (teamId: string, teamName: string) => void;
  loading: boolean;
  canDelete: boolean;
  canManageStages: boolean;
  currentUser: AdminUser | null;
  token: string;
  embedded?: boolean;
}) {
  const assets = latestSubmissionAssets(detail);
  const canJudge = Boolean(currentUser && token && currentUser.role === "juri");

  return (
    <article
      className={clsx(
        "min-w-0",
        embedded
          ? "border-t border-dark/10 pt-5 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0"
          : "rounded-lg border border-dark/10 bg-white p-4 shadow-soft sm:p-5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <StatusPill
            tone={
              detail.team.verificationStatus === "verified"
                ? "teal"
                : detail.team.verificationStatus === "rejected"
                  ? "orange"
                  : "amber"
            }
          >
            {detail.team.verificationStatus}
          </StatusPill>
          <h2 className="mt-4 break-words text-xl font-black">
            {detail.team.name}
          </h2>
          <p className="mt-1 break-words text-sm text-dark/60">
            {detail.category.name}
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary px-3 py-2"
          onClick={onClose}
          aria-label="Tutup detail tim"
        >
          <X size={16} />
        </button>
      </div>

      {canDelete ? (
        <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-black text-red-600">Zona Super Admin</p>
          <p className="mt-1 text-xs leading-5 text-dark/60">
            Menghapus tim akan menghapus data pendaftaran, submission, dan akses
            tahap dari database.
          </p>
          <button
            type="button"
            className="btn-danger mt-3 px-3 py-2"
            disabled={loading}
            onClick={() => onDeleteTeam(detail.team.id, detail.team.name)}
          >
            <Trash2 size={16} />
            Hapus Tim
          </button>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 border-t border-dark/10 pt-5 text-sm">
        <Info label="ID Tim" value={detail.team.id} />
        <Info label="Batch" value={`Batch ${detail.team.batch}`} />
        <Info label="Ketua" value={detail.team.leaderName} />
        <Info label="Email" value={detail.team.leaderEmail} />
        <Info label="WhatsApp" value={detail.team.leaderPhone || "-"} />
        <Info label="Instansi" value={detail.team.institution} />
      </div>

      <div className="mt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black">Karya Terbaru</p>
            <p className="mt-1 text-xs leading-5 text-dark/55">
              Semua file diambil dari submission terbaru yang punya file
              tersebut.
            </p>
          </div>
          <StatusPill tone={assets.prototypeUrl ? "teal" : "amber"}>
            {assets.prototypeUrl ? "Siap direview" : "Belum lengkap"}
          </StatusPill>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FileAssetCard
            title="Preview Web / Figma"
            value={assets.prototypeUrl}
            hint="Link prototype Figma tim"
          />
          <FileAssetCard
            title="Proposal"
            value={assets.proposalUrl}
            hint="Berkas proposal tim"
          />
          <FileAssetCard
            title="PPT"
            value={assets.pptUrl}
            hint="File presentasi untuk juri"
          />
          <FileAssetCard
            title="Poster"
            value={assets.posterUrl}
            hint="Poster karya final"
          />
        </div>
      </div>

      <div className="mt-6">
        <p className="text-sm font-black">Anggota</p>
        <div className="mt-3 grid gap-3">
          {detail.team.members.map((member, index) => (
            <div
              key={`${member.email || member.name}-${index}`}
              className={
                (member.role || "").toLowerCase() === "ketua"
                  ? "rounded-md border border-primary/20 bg-primary/5 p-3 text-sm"
                  : "rounded-md bg-light p-3 text-sm"
              }
            >
              <p className="font-black">
                {index + 1}. {member.name}
              </p>
              <p className="mt-1 text-dark/60">
                {member.email || "-"} - {member.role || "-"}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <p className="text-sm font-black">Riwayat Submission</p>
        <div className="mt-3 grid gap-3">
          {detail.submissions.map((submission) => (
            <div
              key={submission.id}
              className="rounded-md border border-dark/10 p-3 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-black capitalize">{submission.stage}</p>
                <StatusPill tone="teal">{submission.status}</StatusPill>
              </div>
              <p className="mt-2 text-xs font-bold text-dark/45">
                {formatDateTime(submission.submittedAt)}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <MiniFileLink
                  label="Prototype"
                  value={submission.prototypeUrl}
                />
                <MiniFileLink label="Proposal" value={submission.proposalUrl} />
                <MiniFileLink label="PPT" value={submission.pptUrl} />
                <MiniFileLink label="Poster" value={submission.posterUrl} />
                <MiniFileLink label="Laporan" value={submission.reportUrl} />
              </div>
            </div>
          ))}
          {!detail.submissions.length ? (
            <p className="text-sm text-dark/60">Belum ada submission.</p>
          ) : null}
        </div>
      </div>

      {canJudge ? (
        <JuryAssessmentForm
          detail={detail}
          currentUser={currentUser}
          token={token}
          onSaved={(nextDetail) =>
            onAssessmentSaved(normalizeTeamDetail(nextDetail))
          }
        />
      ) : null}

      <AssessmentSummary detail={detail} />

      {canManageStages ? (
        <div className="mt-6">
          <p className="text-sm font-black">Akses Tahap Upload</p>
          <div className="mt-3 grid gap-3">
            {detail.submissionStages.map((item) => (
              <div
                key={item.stage.id}
                className="rounded-md border border-dark/10 p-3 text-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <StatusPill tone={item.canSubmit ? "teal" : "amber"}>
                        {item.canSubmit ? "Bisa Submit" : "Tertutup"}
                      </StatusPill>
                      {item.stage.requiresApproval ? (
                        <StatusPill tone={item.isAllowed ? "teal" : "dark"}>
                          {item.isAllowed ? "Lolos" : "Belum Lolos"}
                        </StatusPill>
                      ) : null}
                    </div>
                    <p className="mt-3 font-black">{item.stage.label}</p>
                    <p className="mt-1 text-dark/60">
                      {item.reason || "Tahap terbuka untuk tim ini."}
                    </p>
                  </div>
                  {item.stage.requiresApproval ? (
                    <button
                      type="button"
                      className="btn-secondary px-3 py-2"
                      disabled={loading}
                      onClick={() =>
                        onStageAccess(
                          detail.team.id,
                          item.stage.id,
                          !item.isAllowed,
                        )
                      }
                    >
                      {item.isAllowed ? "Tutup Akses" : "Buka Akses"}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {!detail.submissionStages.length ? (
              <p className="text-sm text-dark/60">
                Belum ada tahap upload untuk event ini.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function FileAssetCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  const href = resolveFileURL(value);
  return (
    <a
      href={href || undefined}
      target="_blank"
      rel="noreferrer"
      className={clsx(
        "group rounded-lg border p-4 text-sm transition",
        href
          ? "border-primary/25 bg-primary/5 hover:-translate-y-0.5 hover:border-primary hover:bg-white hover:shadow-soft"
          : "border-dark/10 bg-light opacity-70",
      )}
      onClick={(event) => {
        if (!href) event.preventDefault();
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white text-primary shadow-sm">
          {title.toLowerCase().includes("poster") ? (
            <ImagePlus size={18} />
          ) : title.toLowerCase().includes("figma") ? (
            <LinkIcon size={18} />
          ) : (
            <FileText size={18} />
          )}
        </span>
        {href ? (
          <ExternalLink
            className="text-dark/35 transition group-hover:text-primary"
            size={16}
          />
        ) : null}
      </div>
      <p className="mt-4 font-black">{title}</p>
      <p className="mt-1 text-xs leading-5 text-dark/55">
        {href ? fileNameFromURL(href) : "Belum tersedia"}
      </p>
      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-primary">
        {hint}
      </p>
    </a>
  );
}

function MiniFileLink({ label, value }: { label: string; value: string }) {
  const href = resolveFileURL(value || "");
  if (!href) {
    return (
      <div className="rounded-md bg-light px-3 py-2 text-xs text-dark/45">
        <span className="font-black">{label}</span>: -
      </div>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-w-0 items-center justify-between gap-2 rounded-md border border-dark/10 bg-white px-3 py-2 text-xs font-black text-primary transition hover:border-primary hover:bg-primary/5"
    >
      <span className="truncate">{label}</span>
      <ExternalLink size={14} />
    </a>
  );
}

function JuryAssessmentForm({
  detail,
  currentUser,
  token,
  onSaved,
}: {
  detail: TeamDetail;
  currentUser: AdminUser | null;
  token: string;
  onSaved: (detail: TeamDetail) => void;
}) {
  const ownAssessment = useMemo(
    () =>
      detail.assessments.find(
        (assessment) => assessment.judgeId === currentUser?.id,
      ),
    [currentUser?.id, detail.assessments],
  );
  const [scores, setScores] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const nextScores: Record<string, string> = {};
    detail.rubricQuestions.forEach((question) => {
      const existingScore =
        ownAssessment?.scores.find((item) => item.question.id === question.id)
          ?.score ?? 0;
      nextScores[question.id] = String(existingScore);
    });
    setScores(nextScores);
    setNotes(ownAssessment?.notes ?? "");
  }, [detail.rubricQuestions, ownAssessment]);

  async function submitAssessment() {
    if (!currentUser) return;
    if (!detail.rubricQuestions.length) {
      toastError("Rubrik belum dibuat panitia.");
      return;
    }
    const payload: JudgeAssessmentPayload = {
      notes,
      scores: detail.rubricQuestions.map((question) => ({
        questionId: question.id,
        score: Math.min(
          question.maxScore,
          Math.max(0, Number(scores[question.id]) || 0),
        ),
      })),
    };
    setSaving(true);
    try {
      const nextDetail = await api.saveJudgeAssessment(
        token,
        detail.team.id,
        payload,
      );
      onSaved(nextDetail);
      toastSuccess("Nilai juri berhasil disimpan.");
    } catch (err) {
      toastError(
        err instanceof Error ? err.message : "Gagal menyimpan nilai juri.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-black">Panel Nilai Juri</p>
          <p className="mt-1 text-xs leading-5 text-dark/60">
            Isi angka sesuai rubrik. Nilai bisa disimpan ulang kalau ada
            koreksi.
          </p>
        </div>
        <StatusPill tone={ownAssessment ? "teal" : "amber"}>
          {ownAssessment ? "Sudah dinilai" : "Belum dinilai"}
        </StatusPill>
      </div>
      <div className="mt-4 grid gap-3">
        {detail.rubricQuestions.map((question, index) => (
          <label
            key={question.id}
            className="rounded-md border border-dark/10 bg-white p-3"
          >
            <span className="text-sm font-black">
              {index + 1}. {question.question}
            </span>
            {question.description ? (
              <span className="mt-1 block text-xs leading-5 text-dark/55">
                {question.description}
              </span>
            ) : null}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="number"
                min={0}
                max={question.maxScore}
                value={scores[question.id] ?? "0"}
                onChange={(event) =>
                  setScores((current) => ({
                    ...current,
                    [question.id]: event.target.value,
                  }))
                }
                className="field w-full px-3 py-2 text-center font-black sm:w-28"
              />
              <span className="text-xs font-bold text-dark/45">
                / {question.maxScore}
              </span>
            </div>
          </label>
        ))}
        {!detail.rubricQuestions.length ? (
          <article className="rounded-md border border-dashed border-dark/20 bg-white p-4 text-sm text-dark/60">
            Rubrik belum tersedia. Minta panitia membuat rubrik dulu dari tab
            Rubrik Juri.
          </article>
        ) : null}
      </div>
      <div className="mt-4">
        <TextAreaField
          label="Catatan untuk Tim"
          value={notes}
          onChange={setNotes}
          placeholder="Tulis catatan singkat jika ada."
        />
      </div>
      <button
        type="button"
        className="btn-primary mt-4 w-full"
        onClick={submitAssessment}
        disabled={saving || !detail.rubricQuestions.length}
      >
        <Save size={18} />
        {saving ? "Menyimpan..." : "Simpan Nilai"}
      </button>
    </section>
  );
}

function AssessmentSummary({ detail }: { detail: TeamDetail }) {
  const judgeCount = detail.assessments.length;
  const maxTotal = detail.rubricQuestions.reduce(
    (total, question) => total + question.maxScore,
    0,
  );
  const averageTotal = judgeCount
    ? detail.assessments.reduce(
        (total, assessment) => total + assessment.totalScore,
        0,
      ) / judgeCount
    : 0;
  const questionAverages = detail.rubricQuestions
    .map((question) => {
      const scores = detail.assessments
        .map(
          (assessment) =>
            assessment.scores.find((score) => score.question.id === question.id)
              ?.score,
        )
        .filter((score): score is number => typeof score === "number");
      const average = scores.length
        ? scores.reduce((total, score) => total + score, 0) / scores.length
        : 0;
      return { question, average, judgeCount: scores.length };
    })
    .filter((item) => item.judgeCount > 0);

  return (
    <section className="mt-6">
      <p className="text-sm font-black">Nilai Juri</p>
      <div className="mt-3 grid gap-3">
        {judgeCount ? (
          <article className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-black">Rata-rata akhir</p>
                <p className="mt-1 text-xs leading-5 text-dark/55">
                  Dihitung dari total nilai semua juri lalu dibagi jumlah juri
                  yang sudah menilai.
                </p>
              </div>
              <div className="text-left sm:text-right">
                <ScoreBadge value={averageTotal} maxScore={maxTotal} large />
                <p className="mt-1 text-xs font-bold text-dark/45">
                  {judgeCount} juri
                </p>
              </div>
            </div>
            {questionAverages.length ? (
              <div className="mt-3 grid gap-2">
                <p className="text-xs font-black uppercase tracking-wide text-dark/45">
                  Rata-rata per pertanyaan
                </p>
                {questionAverages.map((item) => (
                  <div
                    key={item.question.id}
                    className="flex items-start justify-between gap-3 rounded-md bg-white px-3 py-2"
                  >
                    <span className="min-w-0 break-words text-dark/70">
                      {item.question.question}
                    </span>
                    <ScoreBadge
                      value={item.average}
                      maxScore={item.question.maxScore}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        ) : null}
        {detail.assessments.map((assessment) => (
          <article
            key={assessment.id}
            className="rounded-md border border-dark/10 p-3 text-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black">{assessment.judgeName}</p>
                <p className="mt-1 text-xs text-dark/45">
                  {formatDateTime(assessment.updatedAt)}
                </p>
              </div>
              <ScoreBadge value={assessment.totalScore} maxScore={maxTotal} />
            </div>
            <div className="mt-3 grid gap-2">
              {assessment.scores.map((score) => (
                <div
                  key={score.question.id}
                  className="flex items-start justify-between gap-3 rounded-md bg-light px-3 py-2"
                >
                  <span className="min-w-0 break-words text-dark/70">
                    {score.question.question}
                  </span>
                  <ScoreBadge
                    value={score.score}
                    maxScore={score.question.maxScore}
                  />
                </div>
              ))}
            </div>
            {assessment.notes ? (
              <p className="mt-3 rounded-md bg-primary/5 p-3 leading-6 text-dark/65">
                {assessment.notes}
              </p>
            ) : null}
          </article>
        ))}
        {!detail.assessments.length ? (
          <p className="text-sm text-dark/60">
            Belum ada nilai juri untuk tim ini.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ScoreBadge({
  value,
  maxScore,
  large = false,
}: {
  value: number;
  maxScore: number;
  large?: boolean;
}) {
  const percent = maxScore > 0 ? (value / maxScore) * 100 : value;
  const tone =
    percent >= 75
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : percent >= 65
        ? "border-orange-200 bg-orange-50 text-orange-700"
        : percent >= 45
          ? "border-yellow-200 bg-yellow-50 text-yellow-800"
          : "border-red-200 bg-red-50 text-red-700";

  return (
    <span
      className={clsx(
        "shrink-0 rounded-md border text-center font-black",
        tone,
        large ? "min-w-24 px-4 py-2 text-2xl" : "min-w-16 px-3 py-1 text-sm",
      )}
      title={`${formatScore(percent)}% dari skor maksimal`}
    >
      {formatScore(value)}
    </span>
  );
}

function fileNameFromURL(value: string) {
  try {
    const url = new URL(value);
    const last = url.pathname.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : url.hostname;
  } catch {
    return value;
  }
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-bold text-dark/50">{label}:</span>{" "}
      <span className="break-words">{value}</span>
    </p>
  );
}

function TeamTable({
  teams,
  onVerify,
  onDetail,
  loading,
  selectedTeamId,
  canVerify = true,
  compact = false,
  emptyLabel = "Belum ada peserta sesuai filter.",
}: {
  teams: Team[];
  onVerify: (teamId: string, status: string) => void;
  onDetail: (teamId: string, shouldScroll?: boolean) => void;
  loading: boolean;
  selectedTeamId?: string;
  canVerify?: boolean;
  compact?: boolean;
  emptyLabel?: string;
}) {
  function openFromKeyboard(
    event: KeyboardEvent<HTMLElement>,
    teamId: string,
    shouldScroll = false,
  ) {
    const target = event.target as HTMLElement;
    if (target.closest("button")) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onDetail(teamId, shouldScroll);
  }

  function verifyFromButton(
    event: MouseEvent<HTMLButtonElement>,
    teamId: string,
    status: string,
  ) {
    event.stopPropagation();
    onVerify(teamId, status);
  }

  function detailFromButton(
    event: MouseEvent<HTMLButtonElement>,
    teamId: string,
  ) {
    event.stopPropagation();
    onDetail(teamId, true);
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
            onClick={() => onDetail(team.id, true)}
            onKeyDown={(event) => openFromKeyboard(event, team.id, true)}
            className={clsx(
              "cursor-pointer rounded-lg border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-primary/35",
              selectedTeamId === team.id
                ? "border-primary bg-primary/5"
                : "border-dark/10 bg-white hover:border-primary/45 hover:bg-light",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words font-black">{team.name}</p>
                <p className="mt-1 break-words text-xs text-dark/50">
                  {team.institution}
                </p>
              </div>
              <StatusPill
                tone={
                  team.verificationStatus === "verified"
                    ? "teal"
                    : team.verificationStatus === "rejected"
                      ? "orange"
                      : "amber"
                }
              >
                {team.verificationStatus}
              </StatusPill>
            </div>

            <div className="mt-4 grid gap-2 rounded-md bg-light px-3 py-3 text-sm text-dark/70">
              <Info label="Kategori" value={team.categoryName} />
              <Info label="Batch" value={`Batch ${team.batch}`} />
              <Info label="Ketua" value={team.leaderName} />
            </div>

            <button
              type="button"
              className="btn-primary mt-4 w-full px-3 py-2"
              disabled={loading}
              onClick={(event) => detailFromButton(event, team.id)}
            >
              Detail Tim
            </button>

            {!compact && canVerify ? (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  className="btn-primary w-full px-3 py-2 sm:w-auto"
                  disabled={loading}
                  onClick={(event) =>
                    verifyFromButton(event, team.id, "verified")
                  }
                >
                  <CheckCircle2 size={16} />
                  Verifikasi
                </button>
                <button
                  type="button"
                  className="btn-danger w-full px-3 py-2 sm:w-auto"
                  disabled={loading}
                  onClick={(event) =>
                    verifyFromButton(event, team.id, "rejected")
                  }
                >
                  Tolak
                </button>
              </div>
            ) : null}
          </article>
        ))}
        {!teams.length ? (
          <p className="p-6 text-center text-sm text-dark/60">
            {emptyLabel}
          </p>
        ) : null}
      </div>

      <div className="mt-5 hidden overflow-x-auto lg:block">
        <table
          className={clsx(
            "w-full text-left text-sm",
            compact ? "min-w-[680px]" : "min-w-[760px] lg:min-w-[900px]",
          )}
        >
          <thead className="border-b border-dark/10 text-xs uppercase text-dark/45">
            <tr>
              <th className="py-3 pr-4">Tim</th>
              <th className="py-3 pr-4">Kategori</th>
              <th className="py-3 pr-4">Batch</th>
              <th className="py-3 pr-4">Ketua</th>
              <th className="py-3 pr-4">Status</th>
              {!compact && canVerify ? (
                <th className="py-3 pr-4">Aksi</th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-dark/10">
            {teams.map((team) => (
              <tr
                key={team.id}
                role="button"
                tabIndex={0}
                aria-label={`Buka detail tim ${team.name}`}
                onClick={() => onDetail(team.id)}
                onKeyDown={(event) => openFromKeyboard(event, team.id)}
                className={clsx(
                  "cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/35",
                  selectedTeamId === team.id
                    ? "bg-primary/5"
                    : "hover:bg-light",
                )}
              >
                <td className="py-3 pr-4">
                  <p className="font-black">{team.name}</p>
                  <p className="text-xs text-dark/50">{team.institution}</p>
                </td>
                <td className="py-3 pr-4">{team.categoryName}</td>
                <td className="py-3 pr-4">Batch {team.batch}</td>
                <td className="py-3 pr-4">{team.leaderName}</td>
                <td className="py-3 pr-4">
                  <StatusPill
                    tone={
                      team.verificationStatus === "verified"
                        ? "teal"
                        : team.verificationStatus === "rejected"
                          ? "orange"
                          : "amber"
                    }
                  >
                    {team.verificationStatus}
                  </StatusPill>
                </td>
                {!compact && canVerify ? (
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-primary px-3 py-2"
                        disabled={loading}
                        onClick={(event) =>
                          verifyFromButton(event, team.id, "verified")
                        }
                      >
                        <CheckCircle2 size={16} />
                        Verifikasi
                      </button>
                      <button
                        type="button"
                        className="btn-danger px-3 py-2"
                        disabled={loading}
                        onClick={(event) =>
                          verifyFromButton(event, team.id, "rejected")
                        }
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
                <td
                  className="py-8 text-center text-dark/60"
                  colSpan={compact || !canVerify ? 5 : 6}
                >
                  {emptyLabel}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
