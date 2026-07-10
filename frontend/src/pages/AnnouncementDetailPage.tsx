import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CalendarDays, ExternalLink, Trophy } from "lucide-react";
import { StatusPill } from "../components/Layout";
import { api, resolveFileURL } from "../lib/api";
import { toastError } from "../lib/toast";
import { winnerPath } from "../lib/winner";
import type { Announcement, Event } from "../lib/types";

export function AnnouncementDetailPage() {
  const { eventId = "", announcementId = "" } = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    setError("");
    Promise.all([api.events(), api.announcements(eventId)])
      .then(([events, nextAnnouncements]) => {
        setEvent((events ?? []).find((item) => item.id === eventId) ?? null);
        setAnnouncements(nextAnnouncements ?? []);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Gagal memuat detail pengumuman.";
        setError(message);
        toastError(message);
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  const announcement = useMemo(
    () => announcements.find((item) => item.id === announcementId),
    [announcements, announcementId]
  );

  return (
    <section className="py-14 scroll-pop" data-scroll-pop>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Link to="/pengumuman" className="inline-flex items-center gap-2 text-sm font-black text-primary">
          <ArrowLeft size={17} />
          Kembali ke Pengumuman
        </Link>

        {loading ? (
          <article className="mt-8 rounded-lg border border-dark/10 bg-white p-8 text-center shadow-soft">
            <p className="font-black">Memuat detail pengumuman...</p>
          </article>
        ) : error ? (
          <article className="mt-8 rounded-lg border border-dark/10 bg-white p-8 text-center shadow-soft">
            <p className="font-black">Detail belum bisa dimuat.</p>
            <p className="mt-2 text-sm text-dark/60">Silakan coba buka kembali halaman pengumuman.</p>
          </article>
        ) : !announcement ? (
          <article className="mt-8 rounded-lg border border-dark/10 bg-white p-8 text-center shadow-soft">
            <p className="font-black">Pengumuman tidak ditemukan.</p>
            <p className="mt-2 text-sm text-dark/60">Periksa kembali link atau pilih pengumuman dari daftar.</p>
          </article>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <article className="overflow-hidden rounded-lg border border-dark/10 bg-white shadow-soft scroll-pop" data-scroll-pop>
              <div className="relative min-h-72 bg-dark px-5 py-10 text-white sm:px-8">
                {announcement.imageUrl ? (
                  <img src={announcement.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
                ) : (
                  <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(135deg,#07111f_0%,#0f766e_55%,#f59e0b_100%)]">
                    <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:18px_18px]" />
                    <span className="relative rounded-md border border-white/20 bg-white/10 px-5 py-3 text-sm font-black uppercase tracking-[0.24em] text-white/75">
                      {announcement.source === "instagram" ? "IG" : "PP"}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-dark/70" />
                <div className="relative max-w-3xl">
                  <StatusPill tone={announcement.type === "pemenang" ? "amber" : "teal"}>{announcement.type}</StatusPill>
                  <h1 className="mt-5 text-3xl font-black leading-tight sm:text-5xl">{announcement.title}</h1>
                  <p className="mt-5 flex items-center gap-2 text-sm font-bold text-white/70">
                    <CalendarDays size={17} />
                    {formatLongDate(announcement.publishedAt)}
                    {event ? ` - ${event.name}` : ""}
                  </p>
                </div>
              </div>
              <div className="p-5 sm:p-8">
                <div className="max-w-3xl whitespace-pre-line text-base leading-8 text-dark/72">
                  {announcement.body || "Belum ada isi pengumuman."}
                </div>
                {announcement.sourceUrl ? (
                  <a
                    href={announcement.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-6 inline-flex items-center gap-2 rounded-md border border-dark/10 bg-white px-4 py-2.5 text-sm font-black text-primary hover:bg-primary hover:text-white"
                  >
                    <ExternalLink size={16} />
                    Buka Post Instagram
                  </a>
                ) : null}

                {announcement.results.length ? (
                  <div className="mt-8 border-t border-dark/10 pt-7">
                    <h2 className="text-2xl font-black">
                      {announcement.type === "pemenang" ? "Tim Terkait" : "Daftar Tim"}
                    </h2>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      {announcement.results.map((result) => (
                        <AnnouncementTeamCard
                          key={`${result.rank}-${result.teamName}`}
                          announcement={announcement}
                          result={result}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </article>

            <aside className="grid auto-rows-max gap-4">
              <article className="rounded-lg border border-dark/10 bg-white p-5 shadow-soft">
                <p className="text-sm font-black">Ringkasan</p>
                <div className="mt-4 grid gap-3 text-sm">
                  <Info label="Event" value={event?.name ?? "Point Project"} />
                  <Info label="Tipe" value={announcement.type} />
                  {announcement.source ? <Info label="Sumber" value={announcement.source} /> : null}
                  <Info label="Tanggal" value={formatLongDate(announcement.publishedAt)} />
                  <Info label="Jumlah Tim" value={`${announcement.results.length} tim`} />
                </div>
              </article>
              {announcement.results.some((result) => hasResultAsset(result)) ? (
                <article className="rounded-lg border border-dark/10 bg-white p-5 shadow-soft">
                  <p className="text-sm font-black">Akses Karya</p>
                  <div className="mt-4 grid gap-2">
                    {announcement.results.map((result) => (
                      <div key={`${result.teamName}-assets`} className="rounded-md bg-light p-3">
                        <p className="text-sm font-black">{result.teamName}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <AssetLink label="Preview" url={result.previewUrl || result.prototypeUrl} />
                          <AssetLink label="PPT" url={result.pptUrl} />
                          <AssetLink label="Poster" url={result.posterUrl} />
                          <AssetLink label="Proposal" url={result.proposalUrl} />
                          <AssetLink label="Laporan" url={result.reportUrl} />
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ) : null}
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}

function hasResultAsset(result: Announcement["results"][number]) {
  return Boolean(
    result.previewUrl ||
      result.prototypeUrl ||
      result.pptUrl ||
      result.posterUrl ||
      result.proposalUrl ||
      result.reportUrl
  );
}

function AnnouncementTeamCard({
  announcement,
  result
}: {
  announcement: Announcement;
  result: Announcement["results"][number];
}) {
  const canOpenWinnerDetail = announcement.type === "pemenang" && result.teamName;
  const teamTitle = canOpenWinnerDetail ? (
    <Link to={winnerPath(announcement.eventId, result.teamName)} className="mt-2 block text-xl font-black hover:text-primary">
      {result.teamName}
    </Link>
  ) : (
    <p className="mt-2 text-xl font-black">{result.teamName}</p>
  );

  return (
    <article className="rounded-lg border border-dark/10 bg-light p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-primary">
            {result.rank ? `Juara ${result.rank}` : "Finalis"}
          </p>
          {teamTitle}
        </div>
        {result.rank ? <Trophy className="shrink-0 text-yellow" size={24} /> : null}
      </div>
      <p className="mt-3 text-sm leading-6 text-dark/65">{result.workTitle || announcement.title}</p>
      <p className="mt-3 text-xs font-bold uppercase text-dark/45">{result.categoryName || "Kategori"} - {result.institution}</p>
      {canOpenWinnerDetail ? (
        <Link to={winnerPath(announcement.eventId, result.teamName)} className="mt-4 inline-flex items-center gap-2 text-sm font-black text-primary">
          Lihat detail tim
          <ArrowRight size={15} />
        </Link>
      ) : null}
    </article>
  );
}

function AssetLink({ label, url }: { label: string; url?: string }) {
  if (!url) return null;
  return (
    <a
      className="inline-flex items-center gap-1 rounded-md border border-dark/10 bg-white px-2 py-1 text-xs font-black text-primary hover:bg-primary hover:text-white"
      href={resolveFileURL(url)}
      target="_blank"
      rel="noreferrer"
    >
      <ExternalLink size={13} />
      {label}
    </a>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-bold text-dark/50">{label}:</span> <span className="break-words">{value}</span>
    </p>
  );
}

function formatLongDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "-";
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}
