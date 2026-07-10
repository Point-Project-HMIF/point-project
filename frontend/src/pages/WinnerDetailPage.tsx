import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Medal, Trophy } from "lucide-react";
import { StatusPill } from "../components/Layout";
import { api } from "../lib/api";
import { toastError } from "../lib/toast";
import { teamSlug } from "../lib/winner";
import type { Announcement, AnnouncementResult, Event } from "../lib/types";

type WinnerEntry = AnnouncementResult & {
  announcement: Announcement;
};

export function WinnerDetailPage() {
  const { eventId = "", teamSlug: slug = "" } = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    Promise.all([api.events(), api.announcements(eventId, "pemenang")])
      .then(([events, nextAnnouncements]) => {
        setEvent((events ?? []).find((item) => item.id === eventId) ?? null);
        setAnnouncements(nextAnnouncements ?? []);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Gagal memuat detail pemenang.";
        setError(message);
        toastError(message);
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  const winner = useMemo<WinnerEntry | undefined>(
    () =>
      announcements
        .flatMap((announcement) => announcement.results.map((result) => ({ ...result, announcement })))
        .find((result) => teamSlug(result.teamName) === slug),
    [announcements, slug]
  );
  const previewUrl = winner?.previewUrl || winner?.prototypeUrl;

  return (
    <section className="py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Link to="/pengumuman" className="inline-flex items-center gap-2 text-sm font-black text-lagoon">
          <ArrowLeft size={17} />
          Kembali ke Pengumuman
        </Link>

        {loading ? (
          <article className="mt-8 rounded-lg border border-ink/10 bg-white p-8 text-center shadow-soft">
            <p className="font-black">Memuat detail pemenang...</p>
          </article>
        ) : error ? (
          <article className="mt-8 rounded-lg border border-ink/10 bg-white p-8 text-center shadow-soft">
            <p className="font-black">Detail belum bisa dimuat.</p>
            <p className="mt-2 text-sm text-ink/60">Silakan coba buka kembali halaman pengumuman.</p>
          </article>
        ) : !winner ? (
          <article className="mt-8 rounded-lg border border-ink/10 bg-white p-8 text-center shadow-soft">
            <p className="font-black">Tim pemenang tidak ditemukan.</p>
            <p className="mt-2 text-sm text-ink/60">Periksa kembali link atau filter tahun pengumuman.</p>
          </article>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <StatusPill tone={winner.rank === 1 ? "amber" : "teal"}>Juara {winner.rank || "-"}</StatusPill>
                  <h1 className="mt-4 text-4xl font-black leading-tight">{winner.teamName}</h1>
                  <p className="mt-3 text-sm font-bold uppercase text-ink/45">{event?.name ?? "Point Project"} {event?.year ?? ""}</p>
                </div>
                {winner.rank === 1 ? <Trophy className="shrink-0 text-sun" size={42} /> : <Medal className="shrink-0 text-lagoon" size={42} />}
              </div>

              <div className="mt-7 grid gap-3 border-t border-ink/10 pt-5 text-sm">
                <Info label="Kategori" value={winner.categoryName || "-"} />
                <Info label="Instansi" value={winner.institution || "-"} />
                <Info label="Judul Karya" value={winner.workTitle || winner.announcement.title || "-"} />
              </div>

              <div className="mt-7">
                <h2 className="text-xl font-black">Kenapa Mereka Menang</h2>
                <p className="mt-3 leading-7 text-ink/68">
                  {winner.reason || winner.announcement.body || "Catatan penilaian belum ditambahkan oleh admin."}
                </p>
              </div>

              {previewUrl ? (
                <a href={previewUrl} target="_blank" rel="noreferrer" className="mt-7 inline-flex items-center gap-2 rounded-md bg-lagoon px-4 py-2.5 text-sm font-black text-white">
                  Buka Preview
                  <ExternalLink size={16} />
                </a>
              ) : null}
            </article>

            <article className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-black">Preview Web</h2>
                {previewUrl ? <StatusPill tone="teal">Live</StatusPill> : <StatusPill tone="amber">Belum Ada</StatusPill>}
              </div>
              {previewUrl ? (
                <div className="overflow-hidden rounded-md border border-ink/10 bg-cloud">
                  <iframe title={`Preview ${winner.teamName}`} src={previewUrl} className="h-[520px] w-full bg-white" />
                </div>
              ) : (
                <div className="grid h-[360px] place-items-center rounded-md bg-cloud px-6 text-center">
                  <p className="text-sm font-bold text-ink/60">Admin belum menambahkan URL preview untuk tim ini.</p>
                </div>
              )}
            </article>
          </div>
        )}
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-bold text-ink/50">{label}:</span> <span className="break-words">{value}</span>
    </p>
  );
}
