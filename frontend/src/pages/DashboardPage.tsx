import { FormEvent, useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, FileUp, Link as LinkIcon, RefreshCw, Send, ShieldAlert } from "lucide-react";
import { SectionHeading, StatusPill } from "../components/Layout";
import { api } from "../lib/api";
import type { ParticipantDashboard, SubmissionPayload } from "../lib/types";

export function DashboardPage() {
  const [teamId, setTeamId] = useState(localStorage.getItem("pointproject.teamId") ?? "");
  const [dashboard, setDashboard] = useState<ParticipantDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submission, setSubmission] = useState<SubmissionPayload>({
    stage: "final",
    proposalUrl: "",
    prototypeUrl: "",
    pptUrl: "",
    reportUrl: "",
    posterUrl: ""
  });

  const verified = dashboard?.team.verificationStatus === "verified";
  const statusTone = verified ? "teal" : dashboard?.team.verificationStatus === "rejected" ? "coral" : "amber";
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
        setDashboard(nextDashboard);
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
    setLoading(true);
    try {
      await api.submitWork(dashboard.team.id, submission);
      await api.participantDashboard(dashboard.team.id).then(setDashboard);
      setSubmission({ stage: "final", proposalUrl: "", prototypeUrl: "", pptUrl: "", reportUrl: "", posterUrl: "" });
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
                      <th className="py-3 pr-3">Proposal</th>
                      <th className="py-3 pr-3">Prototype</th>
                      <th className="py-3 pr-3">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/10">
                    {dashboard.submissions.map((item) => (
                      <tr key={item.id}>
                        <td className="py-3 pr-3 font-bold">{item.stage}</td>
                        <td className="py-3 pr-3">{item.status}</td>
                        <td className="py-3 pr-3">
                          {item.proposalUrl ? (
                            <a className="inline-flex items-center gap-1 font-bold text-lagoon" href={item.proposalUrl}>
                              <LinkIcon size={14} />
                              Link
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          {item.prototypeUrl ? (
                            <a className="inline-flex items-center gap-1 font-bold text-lagoon" href={item.prototypeUrl}>
                              <LinkIcon size={14} />
                              Link
                            </a>
                          ) : (
                            "-"
                          )}
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
                    <option value="awal">Awal</option>
                    <option value="final">Final</option>
                  </select>
                </div>
                {[
                  ["proposalUrl", "Link Proposal"],
                  ["prototypeUrl", "Link Prototype"],
                  ["pptUrl", "Link PPT"],
                  ["reportUrl", "Link Laporan"],
                  ["posterUrl", "Link Poster"]
                ].map(([key, label]) => (
                  <div key={key}>
                    <label className="label" htmlFor={key}>
                      {label}
                    </label>
                    <input
                      id={key}
                      className="field"
                      value={(submission as Record<string, string>)[key] ?? ""}
                      onChange={(event) => setSubmission((current) => ({ ...current, [key]: event.target.value }))}
                      placeholder="https://..."
                    />
                  </div>
                ))}
              </div>
              <div className="mt-5 flex justify-end">
                <button className="btn-primary" disabled={loading}>
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
