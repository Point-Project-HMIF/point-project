import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Filter, Search, Trophy } from "lucide-react";
import { CustomSelect } from "../components/CustomSelect";
import { StatusPill } from "../components/Layout";
import { api } from "../lib/api";
import { toastError } from "../lib/toast";
import { announcementPath, winnerPath } from "../lib/winner";
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
  const [winnerAnnouncements, setWinnerAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.all([api.events(), api.activeEvent().catch(() => null)])
      .then(([nextEvents, activeEvent]) => {
        if (!alive) return;
        const safeEvents = [...(nextEvents ?? [])]
          .filter((event) => event.status.toLowerCase() !== "draft" || event.id === activeEvent?.id)
          .sort((a, b) => {
            if (a.id === activeEvent?.id) return -1;
            if (b.id === activeEvent?.id) return 1;
            return b.year - a.year;
          });
        setEvents(safeEvents);
        setEventId(activeEvent?.id ?? safeEvents[0]?.id ?? "");
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
    const visibleRequest = api.announcements(eventId, type);
    const winnersRequest = type === "" || type === "pemenang" ? visibleRequest : api.announcements(eventId, "pemenang");
    Promise.all([visibleRequest, winnersRequest])
      .then(([nextAnnouncements, nextWinnerAnnouncements]) => {
        setAnnouncements(nextAnnouncements ?? []);
        setWinnerAnnouncements(nextWinnerAnnouncements ?? []);
      })
      .catch((err) => toastError(err instanceof Error ? err.message : "Gagal memuat pengumuman."));
  }, [eventId, type]);

  const selectedEvent = useMemo(() => events.find((item) => item.id === eventId), [events, eventId]);
  const winners = useMemo(
    () =>
      (winnerAnnouncements ?? [])
        .filter((announcement) => announcement.type === "pemenang")
        .flatMap((announcement) => announcement.results.map((result) => ({ ...result, announcement })))
        .filter((result) => result.teamName)
        .sort((a, b) => (a.rank || 99) - (b.rank || 99)),
    [winnerAnnouncements]
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
    <section className="light-page announcements-light-page scroll-pop" data-scroll-pop>
      <div className="tech-grid tech-noise relative border-b border-white/10 bg-[#080d16]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">Point Project Arsip</p>
              <h1 className="mt-4 text-4xl font-black uppercase leading-tight sm:text-6xl">
                Latest <span className="text-cyan-200">Updates</span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/58">
                Informasi resmi seputar finalis, pemenang, dan kabar penting {selectedEvent?.name ?? "Point Project"}.
              </p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cyan-200/60" size={18} />
              <input
                className="field h-12 rounded-sm border-white/12 bg-white/8 !pl-12 !pr-4 text-white placeholder:text-white/35 focus:border-cyan-300"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari berita atau artikel..."
              />
            </div>
          </div>

          <div className="relative z-40 mt-8 grid gap-3 overflow-visible border border-white/10 bg-[#05070d]/78 p-4 shadow-soft backdrop-blur sm:grid-cols-[1fr_1fr_auto] scroll-pop" data-scroll-pop>
            <div>
              <label className="label text-white/72" htmlFor="year-filter">
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
              <label className="label text-white/72" htmlFor="type-filter">
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
            <span className="inline-flex items-center justify-center gap-2 rounded-sm border border-cyan-300/20 bg-cyan-300/8 px-4 py-3 text-sm font-black text-cyan-100 sm:self-end">
              <Filter size={17} />
              {visibleAnnouncements.length} berita
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {podium.length ? (
          <PodiumShowcase podium={podium} eventId={eventId} />
        ) : null}

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visibleAnnouncements.map((announcement) => (
            <NewsCard key={announcement.id} announcement={announcement} />
          ))}
        </div>

        {!visibleAnnouncements.length ? (
          <article className="mt-10 border border-white/10 bg-white/[0.045] p-8 text-center shadow-soft">
            <p className="font-black">Belum ada pengumuman untuk filter ini.</p>
            <p className="mt-2 text-sm text-white/55">Coba ubah kata kunci, tahun, atau jenis pengumuman.</p>
          </article>
        ) : null}
      </div>
    </section>
  );
}

function NewsCard({ announcement }: { announcement: Announcement }) {
  const hasWinnerDetail = announcement.type === "pemenang";
  const target = announcementPath(announcement.eventId, announcement.id);
  const shownResults = announcement.results.filter((result) => result.teamName).slice(0, 3);
  const sourceLabel = announcement.source === "instagram" ? "Instagram" : announcement.type;
  const fallbackLabel = announcement.source === "instagram" ? "IG" : "PP";

  return (
    <article
      id={`announcement-${announcement.id}`}
      className="overflow-hidden border border-white/10 bg-white/[0.045] shadow-soft transition hover:border-cyan-300/35 hover:bg-white/[0.065] scroll-pop"
      data-scroll-pop
    >
      <div className="relative h-44 overflow-hidden bg-dark">
        {announcement.imageUrl ? (
          <img src={announcement.imageUrl} alt="" className="h-full w-full object-cover opacity-80 transition duration-300 hover:scale-[1.03]" />
        ) : (
          <div className="grid h-full place-items-center bg-[linear-gradient(135deg,#07111f_0%,#0f766e_55%,#f59e0b_100%)]">
            <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:16px_16px]" />
            <span className="relative rounded-md border border-white/20 bg-white/10 px-4 py-2 text-sm font-black uppercase tracking-[0.2em] text-white/85">
              {fallbackLabel}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-dark/25" />
        <div className="absolute right-4 top-4 bg-white px-3 py-2 text-center shadow-soft">
          <p className="text-sm font-black text-dark">{formatDay(announcement.publishedAt)}</p>
          <p className="text-[10px] font-black uppercase text-primary">{formatMonthYear(announcement.publishedAt)}</p>
        </div>
        <div className="absolute bottom-4 left-4">
          <StatusPill tone={announcement.type === "pemenang" ? "amber" : "teal"}>{sourceLabel}</StatusPill>
        </div>
      </div>
      <div className="p-5">
        <h2 className="line-clamp-2 text-lg font-black leading-snug">{announcement.title}</h2>
        <p className="mt-4 line-clamp-3 text-sm leading-6 text-white/58">{announcement.body}</p>

        {shownResults.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {shownResults.map((result) =>
              hasWinnerDetail ? (
                <Link
                  key={`${announcement.id}-${result.teamName}`}
                  to={winnerPath(announcement.eventId, result.teamName)}
                  className="bg-cyan-300/10 px-2.5 py-1 text-xs font-black text-cyan-100 hover:bg-cyan-300 hover:text-[#05070d]"
                >
                  {result.rank ? `#${result.rank} ` : ""}
                  {result.teamName}
                </Link>
              ) : (
                <span key={`${announcement.id}-${result.teamName}`} className="bg-cyan-300/10 px-2.5 py-1 text-xs font-black text-cyan-100">
                  {result.teamName}
                </span>
              )
            )}
          </div>
        ) : null}

        <Link to={target} className="mt-5 inline-flex items-center gap-2 text-xs font-black uppercase text-cyan-200 hover:text-white">
          Baca Selengkapnya
          <ArrowRight size={14} />
        </Link>
        {announcement.sourceUrl ? (
          <a href={announcement.sourceUrl} target="_blank" rel="noreferrer" className="ml-4 mt-5 inline-flex items-center gap-2 text-xs font-black uppercase text-white/35 hover:text-cyan-200">
            Buka Instagram
          </a>
        ) : null}
      </div>
    </article>
  );
}

function PodiumShowcase({ podium, eventId }: { podium: WinnerEntry[]; eventId: string }) {
  return (
    <section className="overflow-hidden rounded-lg bg-dark text-white shadow-soft scroll-pop" data-scroll-pop>
      <div className="relative px-5 py-7 sm:px-7 lg:px-8">
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,214,102,0.35)_1px,transparent_1px)] [background-size:18px_18px]" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-orange/20 to-transparent" />
        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-yellow">
              <Trophy size={16} />
              Podium Juara
            </div>
            <h2 className="mt-3 text-2xl font-black sm:text-3xl">Tim terbaik periode ini</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-white/68">
            Klik nama tim untuk melihat alasan kemenangan, rubrik penilaian, preview karya, PPT, dan poster.
          </p>
        </div>
        <div className="relative mt-7 grid gap-4 lg:grid-cols-[1fr_1.15fr_1fr] lg:items-end">
          {podium.map((winner) => (
            <PodiumCard key={`${winner.rank}-${winner.teamName}`} winner={winner} eventId={eventId} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PodiumCard({ winner, eventId }: { winner: WinnerEntry; eventId: string }) {
  const isFirst = winner.rank === 1;
  const isSecond = winner.rank === 2;
  const rankLabel = winner.rank || "-";
  const metalClass = isFirst
    ? "from-yellow via-[#f6d461] to-[#946d13] text-dark"
    : isSecond
      ? "from-white via-slate-200 to-slate-500 text-dark"
      : "from-[#f5c0ad] via-[#c7836c] to-[#7f4a3b] text-white";
  const ribbonClass = isFirst ? "bg-red-600" : isSecond ? "bg-red-500" : "bg-red-700";
  return (
    <article
      className={`group rounded-lg border border-white/12 bg-white/[0.07] p-4 shadow-soft backdrop-blur surface-hover scroll-pop ${
        isFirst ? "lg:-mt-4 lg:pb-8" : "lg:mt-10"
      }`}
      data-scroll-pop
    >
      <div className="grid place-items-center">
        <div className={`relative grid h-28 w-28 place-items-center bg-gradient-to-br ${metalClass} shadow-[0_18px_40px_rgba(0,0,0,0.28)] sm:h-32 sm:w-32`} style={{ clipPath: "polygon(50% 0%, 86% 13%, 91% 53%, 50% 100%, 9% 53%, 14% 13%)" }}>
          <span className="text-5xl font-black leading-none drop-shadow-sm">{rankLabel}</span>
        </div>
        <span className={`relative -mt-5 inline-flex min-w-28 justify-center rounded-sm ${ribbonClass} px-4 py-1 text-xs font-black uppercase tracking-wide text-white shadow-md`}>
          Juara {rankLabel}
        </span>
      </div>
      <div className="mt-5 text-center">
        <Link to={winnerPath(eventId, winner.teamName)} className="block text-2xl font-black text-white transition group-hover:text-yellow">
          {winner.teamName}
        </Link>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/68">{winner.workTitle || winner.announcement.title}</p>
        <p className="mt-4 text-xs font-bold uppercase tracking-wide text-white/45">{winner.categoryName || "Kategori"}</p>
        <p className="mt-1 text-xs font-bold text-white/55">{winner.institution}</p>
      </div>
      <Link
        to={winnerPath(eventId, winner.teamName)}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/18 bg-white/10 px-3 py-2 text-sm font-black text-white transition hover:bg-white hover:text-dark"
      >
        Lihat Detail Tim
        <ArrowRight size={15} />
      </Link>
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
