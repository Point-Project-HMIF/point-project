import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ExternalLink, Filter, Search, Trophy } from "lucide-react";
import { CustomSelect } from "../components/CustomSelect";
import { StatusPill } from "../components/Layout";
import { api } from "../lib/api";
import { toastError } from "../lib/toast";
import { winnerPath } from "../lib/winner";
import type { Announcement, AnnouncementResult, Event } from "../lib/types";

type WinnerEntry = AnnouncementResult & {
  announcement: Announcement;
};

export function AnnouncementsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState("");
  const [type, setType] = useState("");
  const [query, setQuery] = useState("");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    let alive = true;
    api
      .events()
      .then((nextEvents) => {
        if (!alive) return;
        const safeEvents = [...(nextEvents ?? [])].sort((a, b) => b.year - a.year);
        setEvents(safeEvents);
        setEventId(safeEvents[0]?.id ?? "");
      })
      .catch((err) => {
        if (!alive) return;
        toastError(err instanceof Error ? err.message : "Gagal memuat tahun pengumuman.");
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!eventId) return;
    api
      .announcements(eventId, type)
      .then((nextAnnouncements) => setAnnouncements(nextAnnouncements ?? []))
      .catch((err) => toastError(err instanceof Error ? err.message : "Gagal memuat pengumuman."));
  }, [eventId, type]);

  const selectedEvent = useMemo(() => events.find((item) => item.id === eventId), [events, eventId]);
  const winners = useMemo(
    () =>
      (announcements ?? [])
        .filter((announcement) => announcement.type === "pemenang")
        .flatMap((announcement) => announcement.results.map((result) => ({ ...result, announcement })))
        .filter((result) => result.teamName)
        .sort((a, b) => (a.rank || 99) - (b.rank || 99)),
    [announcements]
  );
  const podium = winners.length >= 3 ? [winners[1], winners[0], winners[2]] : winners.slice(0, 3);
  const visibleAnnouncements = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) return announcements;
    return announcements.filter((announcement) => {
      const resultText = announcement.results
        .map((result) => `${result.teamName} ${result.categoryName} ${result.institution} ${result.workTitle}`)
        .join(" ");
      return `${announcement.title} ${announcement.body} ${announcement.type} ${resultText}`.toLowerCase().includes(normalizedQuery);
    });
  }, [announcements, query]);

  return (
    <section className="bg-white">
      <div className="border-b border-ink/10 bg-cloud [background-image:linear-gradient(rgba(0,111,174,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(0,111,174,0.08)_1px,transparent_1px)] [background-size:24px_24px]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-lagoon">Point Project Arsip</p>
              <h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">
                Latest <span className="text-lagoon">Updates</span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/65">
                Informasi resmi seputar finalis, pemenang, dan kabar penting {selectedEvent?.name ?? "Point Project"}.
              </p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/35" size={18} />
              <input
                className="field h-12 rounded-full pl-11 pr-12"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari berita atau artikel..."
              />
              <span className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-lagoon text-white">
                <Search size={16} />
              </span>
            </div>
          </div>

          <div className="mt-8 grid gap-3 rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <label className="label" htmlFor="year-filter">
                Tahun
              </label>
              <CustomSelect
                id="year-filter"
                value={eventId}
                onChange={setEventId}
                placeholder="Pilih tahun"
                options={events.map((event) => ({
                  value: event.id,
                  label: `${event.year} - ${event.name}`,
                  description: event.status
                }))}
                disabled={!events.length}
              />
            </div>
            <div>
              <label className="label" htmlFor="type-filter">
                Jenis
              </label>
              <CustomSelect
                id="type-filter"
                value={type}
                onChange={setType}
                options={[
                  { value: "", label: "Semua" },
                  { value: "finalis", label: "Finalis" },
                  { value: "pemenang", label: "Pemenang" },
                  { value: "info", label: "Info" }
                ]}
              />
            </div>
            <span className="inline-flex items-center justify-center gap-2 rounded-md bg-cloud px-4 py-3 text-sm font-black text-ink/70 sm:self-end">
              <Filter size={17} />
              {visibleAnnouncements.length} berita
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {podium.length ? (
          <section>
            <div className="flex items-center gap-3">
              <Trophy className="text-sun" />
              <h2 className="text-2xl font-black">Podium Juara</h2>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-3 lg:items-end">
              {podium.map((winner) => (
                <PodiumCard key={`${winner.rank}-${winner.teamName}`} winner={winner} eventId={eventId} />
              ))}
            </div>
          </section>
        ) : null}

        <main className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visibleAnnouncements.map((announcement) => (
            <NewsCard key={announcement.id} announcement={announcement} />
          ))}
        </main>

        {!visibleAnnouncements.length ? (
          <article className="mt-10 rounded-lg border border-ink/10 bg-white p-8 text-center shadow-soft">
            <p className="font-black">Belum ada pengumuman untuk filter ini.</p>
            <p className="mt-2 text-sm text-ink/60">Coba ubah kata kunci, tahun, atau jenis pengumuman.</p>
          </article>
        ) : null}
      </div>
    </section>
  );
}

function NewsCard({ announcement }: { announcement: Announcement }) {
  const hasWinnerDetail = announcement.type === "pemenang";
  const firstResult = announcement.results.find((result) => result.teamName);
  const target = hasWinnerDetail && firstResult ? winnerPath(announcement.eventId, firstResult.teamName) : `#announcement-${announcement.id}`;
  const shownResults = announcement.results.filter((result) => result.teamName).slice(0, 3);

  return (
    <article id={`announcement-${announcement.id}`} className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft">
      <div className="relative h-44 overflow-hidden bg-ink">
        <img src="/point-project-hero.png" alt="" className="h-full w-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-ink/20" />
        <div className="absolute right-4 top-4 rounded-md bg-white px-3 py-2 text-center shadow-soft">
          <p className="text-sm font-black text-ink">{formatDay(announcement.publishedAt)}</p>
          <p className="text-[10px] font-black uppercase text-lagoon">{formatMonthYear(announcement.publishedAt)}</p>
        </div>
        <div className="absolute bottom-4 left-4">
          <StatusPill tone={announcement.type === "pemenang" ? "amber" : "teal"}>{announcement.type}</StatusPill>
        </div>
      </div>
      <div className="p-5">
        <h2 className="line-clamp-2 text-lg font-black leading-snug">{announcement.title}</h2>
        <p className="mt-4 line-clamp-3 text-sm leading-6 text-ink/62">{announcement.body}</p>

        {shownResults.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {shownResults.map((result) =>
              hasWinnerDetail ? (
                <Link
                  key={`${announcement.id}-${result.teamName}`}
                  to={winnerPath(announcement.eventId, result.teamName)}
                  className="rounded-md bg-cloud px-2.5 py-1 text-xs font-black text-lagoon hover:bg-lagoon hover:text-white"
                >
                  {result.rank ? `#${result.rank} ` : ""}
                  {result.teamName}
                </Link>
              ) : (
                <span key={`${announcement.id}-${result.teamName}`} className="rounded-md bg-cloud px-2.5 py-1 text-xs font-black text-lagoon">
                  {result.teamName}
                </span>
              )
            )}
          </div>
        ) : null}

        <Link to={target} className="mt-5 inline-flex items-center gap-2 text-xs font-black uppercase text-lagoon hover:text-ink">
          Baca Selengkapnya
          <ArrowRight size={14} />
        </Link>
      </div>
    </article>
  );
}

function PodiumCard({ winner, eventId }: { winner: WinnerEntry; eventId: string }) {
  const isFirst = winner.rank === 1;
  return (
    <article className={`rounded-lg border bg-white p-5 shadow-soft ${isFirst ? "border-sun lg:pb-9" : "border-ink/10"}`}>
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-12 w-12 place-items-center rounded-md text-lg font-black ${isFirst ? "bg-sun text-ink" : "bg-cloud text-lagoon"}`}>
          {winner.rank || "-"}
        </span>
        <StatusPill tone={isFirst ? "amber" : "teal"}>{winner.categoryName || "Kategori"}</StatusPill>
      </div>
      <Link to={winnerPath(eventId, winner.teamName)} className="mt-5 block text-2xl font-black hover:text-lagoon">
        {winner.teamName}
      </Link>
      <p className="mt-2 text-sm leading-6 text-ink/65">{winner.workTitle || winner.announcement.title}</p>
      <p className="mt-4 text-xs font-bold uppercase text-ink/45">{winner.institution}</p>
      {winner.prototypeUrl ? (
        <a href={winner.prototypeUrl} className="mt-5 inline-flex items-center gap-2 text-sm font-black text-lagoon" target="_blank" rel="noreferrer">
          Prototype
          <ExternalLink size={16} />
        </a>
      ) : null}
    </article>
  );
}

function formatDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", { day: "2-digit" });
}

function formatMonthYear(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("id-ID", { month: "short", year: "numeric" });
}
