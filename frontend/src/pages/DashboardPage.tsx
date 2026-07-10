import { FormEvent, useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, ExternalLink, FileUp, RefreshCw, Send, ShieldAlert } from "lucide-react";
import { SectionHeading, StatusPill } from "../components/Layout";
import { api } from "../lib/api";
import type { ParticipantDashboard, Submission, SubmissionPayload } from "../lib/types";

const submissionFileFields: Array<{
  key: Exclude<keyof SubmissionPayload, "stage" | "prototypeUrl">;
  label: string;
  accept?: string;
}> = [
  { key: "proposal", label: "File Proposal", accept: ".pdf,.doc,.docx" },
  { key: "ppt", label: "File PPT", accept: ".ppt,.pptx,.pdf" },
  { key: "report", label: "File Laporan", accept: ".pdf,.doc,.docx" },
  { key: "poster", label: "File Poster", accept: ".png,.jpg,.jpeg,.pdf" }
];

export function DashboardPage() {
  const [teamId, setTeamId] = useState(localStorage.getItem("pointproject.teamId") ?? "");
  const [dashboard, setDashboard] = useState<ParticipantDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploadResetKey, setUploadResetKey] = useState(0);
  const [submission, setSubmission] = useState<SubmissionPayload>({
    stage: "awal",
    proposal: null,
    prototypeUrl: "",
    ppt: null,
    report: null,
    poster: null
  });

  const verified = dashboard?.team.verificationStatus === "verified";
  const statusTone = verified ? "teal" : dashboard?.team.verificationStatus === "rejected" ? "coral" : "amber";
  const submissionStages = dashboard?.submissionStages ?? [];
  const selectedStage = submissionStages.find((item) => item.stage.key === submission.stage);
  const firstAllowedStage = submissionStages.find((item) => item.canSubmit);
  const finalist = useMemo(
    () =>
      dashboard?.announcements.some((announcement) =>
        announcement.results.some((result) => result.teamName.toLowerCase() === dashboard.team.name.toLowerCase())
      ),
    [dashboard]
  );

  function loadDashboard(nextTeamId = teamId) {
    if (!nextTeamId) {
      setError("Masukkan ID tim untuk membuka dashboard.");
      return;
    }
    setLoading(true);
    setError("");
    api
      .participantDashboard(nextTeamId)
      .then((nextDashboard) => {
        const normalized = normalizeDashboard(nextDashboard);
        setDashboard(normalized);
        const nextStage = normalized.submissionStages.find((item) => item.canSubmit)?.stage.key ?? normalized.submissionStages[0]?.stage.key ?? "awal";
        setSubmission({ stage: nextStage, proposal: null, prototypeUrl: "", ppt: null, report: null, poster: null });
        setUploadResetKey((current) => current + 1);
        localStorage.setItem("pointproject.teamId", nextTeamId);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Dashboard tidak ditemukan."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (teamId) loadDashboard(teamId);
  }, []);

  async function submitWork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!dashboard) {
      setError("Muat dashboard tim terlebih dahulu.");
      return;
    }
    const permission = dashboard.submissionStages.find((item) => item.stage.key === submission.stage);
    if (!permission?.canSubmit) {
      setError(permission?.reason || "Tahap upload ini belum tersedia untuk tim kamu.");
      return;
    }
    const prototypeUrl = submission.prototypeUrl?.trim() ?? "";
    if (prototypeUrl && !isFigmaURL(prototypeUrl)) {
      setError("Link prototype harus menggunakan URL Figma yang valid.");
      return;
    }
    if (!prototypeUrl && !submissionFileFields.some((field) => submission[field.key])) {
      setError("Isi link Figma prototype atau pilih minimal satu file karya sebelum mengirim submission.");
      return;
    }
    setLoading(true);
    try {
      await api.submitWork(dashboard.team.id, submission);
      await api.participantDashboard(dashboard.team.id).then((nextDashboard) => {
        const normalized = normalizeDashboard(nextDashboard);
        setDashboard(normalized);
        const nextStage = normalized.submissionStages.find((item) => item.canSubmit)?.stage.key ?? submission.stage;
        setSubmission({ stage: nextStage, proposal: null, prototypeUrl: "", ppt: null, report: null, poster: null });
        setUploadResetKey((current) => current + 1);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission gagal dikirim.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Dashboard Peserta"
          title="Pantau status dan kirim karya"
          body="Peserta dapat melihat status verifikasi, submission yang sudah masuk, dan pengumuman yang relevan untuk tim."
        />

        <div className="mt-10 rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              className="field"
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
              aria-label="ID Tim"
              placeholder="Masukkan ID tim"
            />
            <button type="button" className="btn-primary" onClick={() => loadDashboard(teamId)} disabled={loading}>
              <RefreshCw size={18} />
              Muat Dashboard
            </button>
          </div>
        </div>

        {error ? <p className="mt-5 rounded-md bg-coral/10 px-4 py-3 text-sm font-bold text-coral">{error}</p> : null}

        {!dashboard ? (
          <article className="mt-8 rounded-lg border border-ink/10 bg-white p-8 text-center shadow-soft">
            <p className="font-black">Dashboard belum dimuat.</p>
            <p className="mt-2 text-sm text-ink/60">Masukkan ID tim dari hasil pendaftaran untuk melihat data.</p>
          </article>
        ) : (

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-6">
            <article className="card">
              <StatusPill tone={statusTone}>{dashboard.team.verificationStatus}</StatusPill>
              <h2 className="mt-4 text-2xl font-black">{dashboard.team.name}</h2>
              <p className="mt-2 text-sm leading-6 text-ink/65">
                {dashboard.category.name} - Batch {dashboard.team.batch} - {dashboard.team.institution}
              </p>
              <div className="mt-5 grid gap-3 border-t border-ink/10 pt-5">
                <p className="text-sm">
                  <span className="font-bold text-ink/55">Ketua:</span> {dashboard.team.leaderName}
                </p>
                <p className="text-sm">
                  <span className="font-bold text-ink/55">Email:</span> {dashboard.team.leaderEmail}
                </p>
                <p className="text-sm">
                  <span className="font-bold text-ink/55">ID Tim:</span> {dashboard.team.id}
                </p>
                <p className="text-sm">
                  <span className="font-bold text-ink/55">Jumlah Peserta:</span> {dashboard.team.members.length} orang termasuk ketua
                </p>
              </div>
            </article>

            <article className="card">
              <div className="flex items-center gap-3">
                {finalist ? <CheckCircle2 className="text-lagoon" /> : <ShieldAlert className="text-sun" />}
                <h2 className="text-xl font-black">Status Finalis</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-ink/65">
                {finalist
                  ? "Tim kamu tercatat dalam daftar finalis/pemenang pada pengumuman publik."
                  : "Belum ada status finalis untuk tim ini. Pantau pengumuman setelah penilaian tahap awal."}
              </p>
            </article>

            <article className="card">
              <div className="flex items-center gap-3">
                <Bell className="text-coral" />
                <h2 className="text-xl font-black">Pengumuman</h2>
              </div>
              <div className="mt-4 space-y-4">
                {dashboard.announcements.map((announcement) => (
                  <div key={announcement.id} className="border-l-2 border-lagoon pl-4">
                    <p className="text-sm font-black">{announcement.title}</p>
                    <p className="mt-1 text-xs text-ink/55">{announcement.publishedAt}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="space-y-6">
            <article className="card">
              <div className="flex items-center gap-3">
                <FileUp className="text-lagoon" />
                <h2 className="text-xl font-black">Riwayat Submission</h2>
              </div>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-ink/10 text-xs uppercase text-ink/45">
                    <tr>
                      <th className="py-3 pr-3">Tahap</th>
                      <th className="py-3 pr-3">Status</th>
                      <th className="py-3 pr-3">Berkas</th>
                      <th className="py-3 pr-3">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/10">
                    {dashboard.submissions.map((item) => (
                      <tr key={item.id}>
                        <td className="py-3 pr-3 font-bold">{item.stage}</td>
                        <td className="py-3 pr-3">{item.status}</td>
                        <td className="py-3 pr-3">
                          <SubmissionLinks submission={item} />
                        </td>
                        <td className="py-3 pr-3">{new Date(item.submittedAt).toLocaleDateString("id-ID")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <form onSubmit={submitWork} className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
              <div className="flex items-center gap-3">
                <Send className="text-coral" />
                <h2 className="text-xl font-black">Upload Karya</h2>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label" htmlFor="stage">
                    Tahap
                  </label>
                  <select
                    id="stage"
                    className="field"
                    value={submission.stage}
                    onChange={(event) => setSubmission((current) => ({ ...current, stage: event.target.value }))}
                  >
                    {submissionStages.map((item) => (
                      <option key={item.stage.id} value={item.stage.key} disabled={!item.canSubmit}>
                        {item.stage.label}
                      </option>
                    ))}
                  </select>
                  {!submissionStages.length ? <p className="mt-2 text-xs font-bold text-coral">Belum ada tahap upload dari admin.</p> : null}
                </div>
                <div className="md:col-span-2">
                  <label className="label" htmlFor="prototype-url">
                    Link Figma Prototype
                  </label>
                  <input
                    id="prototype-url"
                    className="field"
                    type="url"
                    value={submission.prototypeUrl ?? ""}
                    onChange={(event) => setSubmission((current) => ({ ...current, prototypeUrl: event.target.value }))}
                    placeholder="https://www.figma.com/proto/..."
                  />
                  <p className="mt-2 text-xs font-bold text-ink/45">Prototype cukup berupa link Figma, bukan file upload.</p>
                </div>
                {submissionFileFields.map(({ key, label, accept }) => (
                  <div key={key}>
                    <label className="label" htmlFor={key}>
                      {label}
                    </label>
                    <input
                      key={`${uploadResetKey}-${key}`}
                      id={key}
                      className="field"
                      type="file"
                      accept={accept}
                      onChange={(event) => setSubmission((current) => ({ ...current, [key]: event.target.files?.[0] ?? null }))}
                    />
                  </div>
                ))}
              </div>
              {selectedStage && !selectedStage.canSubmit ? (
                <p className="mt-4 rounded-md bg-sun/20 px-4 py-3 text-sm font-bold text-amber-900">{selectedStage.reason}</p>
              ) : null}
              {!firstAllowedStage && submissionStages.length ? (
                <p className="mt-4 rounded-md bg-sun/20 px-4 py-3 text-sm font-bold text-amber-900">
                  Belum ada tahap upload yang terbuka untuk tim kamu.
                </p>
              ) : null}
              <div className="mt-5 flex justify-end">
                <button className="btn-primary" disabled={loading || !selectedStage?.canSubmit}>
                  <Send size={18} />
                  Kirim Submission
                </button>
              </div>
            </form>
          </div>
        </div>
        )}
      </div>
    </section>
  );
}

function normalizeDashboard(dashboard: ParticipantDashboard): ParticipantDashboard {
  return {
    ...dashboard,
    team: {
      ...dashboard.team,
      members: dashboard.team.members ?? []
    },
    submissions: dashboard.submissions ?? [],
    announcements: dashboard.announcements ?? [],
    rules: dashboard.rules ?? { eventId: dashboard.event.id, minTeamMembers: 2, maxTeamMembers: 3 },
    submissionStages: dashboard.submissionStages ?? []
  };
}

function isFigmaURL(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (url.protocol === "https:" || url.protocol === "http:") && (host === "figma.com" || host.endsWith(".figma.com"));
  } catch {
    return false;
  }
}

function SubmissionLinks({ submission }: { submission: Submission }) {
  const links = [
    ["Proposal", submission.proposalUrl],
    ["Prototype", submission.prototypeUrl],
    ["PPT", submission.pptUrl],
    ["Laporan", submission.reportUrl],
    ["Poster", submission.posterUrl]
  ].filter(([, url]) => Boolean(url));

  if (!links.length) return <span className="text-ink/45">-</span>;

  return (
    <div className="flex flex-wrap gap-2">
      {links.map(([label, url]) => (
        <a
          key={label}
          className="inline-flex items-center gap-1 rounded-md border border-ink/10 px-2 py-1 text-xs font-black text-lagoon hover:bg-lagoon hover:text-white"
          href={url}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={13} />
          {label}
        </a>
      ))}
    </div>
  );
}
