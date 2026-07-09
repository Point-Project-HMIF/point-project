import { FormEvent, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileSpreadsheet,
  LayoutGrid,
  LogIn,
  Megaphone,
  Plus,
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
import { api } from "../lib/api";
import type {
  AdminStats,
  AdminUser,
  AnnouncementResult,
  CommitteeMember,
  CreateAdminUserPayload,
  Event,
  Team,
  TeamDetail,
  TimelineItem,
  TimelineItemInput
} from "../lib/types";

type Tab = "overview" | "event" | "peserta" | "panitia" | "jadwal" | "submission" | "pengumuman" | "akun";

const emptyStats: AdminStats = {
  events: 0,
  teams: 0,
  pending: 0,
  submissions: 0,
  finalists: 0,
  winners: 0
};

const tabs: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "event", label: "Event", icon: CalendarClock },
  { id: "peserta", label: "Peserta", icon: UsersRound },
  { id: "panitia", label: "Panitia", icon: UserCog },
  { id: "jadwal", label: "Jadwal", icon: ClipboardList },
  { id: "submission", label: "Submission", icon: FileSpreadsheet },
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
  const [committee, setCommittee] = useState<CommitteeMember[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [timelineDraft, setTimelineDraft] = useState<TimelineItemInput[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamDetail | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
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

  function loadAdminData(nextToken = token) {
    if (!nextToken) return;
    setLoading(true);
    setError("");
    setMessage("");

    Promise.all([api.adminStats(nextToken), api.adminTeams(nextToken), api.adminUsers(nextToken), api.activeEvent()])
      .then(async ([nextStats, nextTeams, nextUsers, active]) => {
        const [nextCommittee, nextTimeline] = await Promise.all([api.committee(active.id), api.timeline(active.id)]);
        setStats(nextStats);
        setTeams(nextTeams);
        setAdminUsers(nextUsers);
        setEvent(active);
        setCommittee(nextCommittee);
        setTimeline(nextTimeline);
        setTimelineDraft(nextTimeline.map(timelineToInput));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Gagal memuat data admin.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (token) loadAdminData(token);
  }, []);

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
      loadAdminData(response.token);
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
      setSelectedTeam(detail);
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
      setEvent(nextEvent);
      setTimeline([]);
      setTimelineDraft([]);
      setMessage(`${nextEvent.name} berhasil dibuat.`);
      await loadAdminData(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat event.");
    } finally {
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
    <section className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-ink/55">Admin Panel</p>
            <h1 className="text-3xl font-black">{event?.name ?? "Event belum dimuat"}</h1>
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

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="rounded-lg border border-ink/10 bg-white p-3 shadow-soft">
            <nav className="grid gap-1">
              {tabs.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    className={clsx(
                      "flex items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-black transition",
                      tab === item.id ? "bg-ink text-white" : "text-ink/68 hover:bg-cloud hover:text-ink"
                    )}
                  >
                    <Icon size={18} />
                    {item.label}
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
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
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
                  />
                </div>
                <TeamDetailPanel detail={selectedTeam} onClose={() => setSelectedTeam(null)} />
              </div>
            ) : null}

            {tab === "event" ? (
              <form onSubmit={createEvent} className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
                <h2 className="text-xl font-black">Buat Periode Baru</h2>
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
                      <option value="aktif">Aktif</option>
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
              </div>
            ) : null}

            {tab === "submission" ? (
              <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
                <h2 className="text-xl font-black">Rekap Submission</h2>
                <TeamTable teams={teams} onVerify={verify} onDetail={openTeamDetail} loading={loading} compact />
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

function TeamDetailPanel({ detail, onClose }: { detail: TeamDetail | null; onClose: () => void }) {
  if (!detail) {
    return (
      <article className="rounded-lg border border-dashed border-ink/20 bg-white p-6 text-center shadow-soft">
        <Eye className="mx-auto text-ink/35" size={28} />
        <p className="mt-3 font-black">Pilih tim untuk melihat detail.</p>
        <p className="mt-2 text-sm text-ink/60">Detail memuat data anggota, kontak, status, dan submission.</p>
      </article>
    );
  }

  return (
    <article className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <StatusPill tone={detail.team.verificationStatus === "verified" ? "teal" : detail.team.verificationStatus === "rejected" ? "coral" : "amber"}>
            {detail.team.verificationStatus}
          </StatusPill>
          <h2 className="mt-4 text-xl font-black">{detail.team.name}</h2>
          <p className="mt-1 text-sm text-ink/60">{detail.category.name}</p>
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
  compact = false
}: {
  teams: Team[];
  onVerify: (teamId: string, status: string) => void;
  onDetail: (teamId: string) => void;
  loading: boolean;
  compact?: boolean;
}) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b border-ink/10 text-xs uppercase text-ink/45">
          <tr>
            <th className="py-3 pr-4">Tim</th>
            <th className="py-3 pr-4">Kategori</th>
            <th className="py-3 pr-4">Batch</th>
            <th className="py-3 pr-4">Ketua</th>
            <th className="py-3 pr-4">Status</th>
            <th className="py-3 pr-4">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/10">
          {teams.map((team) => (
            <tr key={team.id}>
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
              <td className="py-3 pr-4">
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary px-3 py-2" disabled={loading} onClick={() => onDetail(team.id)}>
                    <Eye size={16} />
                    Detail
                  </button>
                  {!compact ? (
                    <>
                      <button className="btn-secondary px-3 py-2" disabled={loading} onClick={() => onVerify(team.id, "verified")}>
                        <CheckCircle2 size={16} />
                        Verifikasi
                      </button>
                      <button className="btn-secondary px-3 py-2" disabled={loading} onClick={() => onVerify(team.id, "rejected")}>
                        Tolak
                      </button>
                    </>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
          {!teams.length ? (
            <tr>
              <td className="py-8 text-center text-ink/60" colSpan={6}>
                Belum ada peserta sesuai filter.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
