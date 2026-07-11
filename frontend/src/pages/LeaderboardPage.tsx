import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Medal, Search, Trophy, UsersRound } from "lucide-react";
import { CustomSelect } from "../components/CustomSelect";
import { api } from "../lib/api";
import { toastError } from "../lib/toast";
import type { Announcement, AnnouncementResult, Event, PublicTeam } from "../lib/types";
import { winnerPath } from "../lib/winner";

type WinnerEntry = AnnouncementResult & {
  announcement: Announcement;
};

export function LeaderboardPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState("");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [teams, setTeams] = useState<PublicTeam[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([api.events(), api.activeEvent().catch(() => null)])
      .then(([nextEvents, active]) => {
        if (!alive) return;
        const safeEvents = [...(nextEvents ?? [])]
          .filter((event) => event.status.toLowerCase() !== "draft" || event.id === active?.id)
          .sort((a, b) => {
            if (a.id === active?.id) return -1;
            if (b.id === active?.id) return 1;
            return b.year - a.year;
          });
        setEvents(safeEvents);
        setEventId(active?.id ?? safeEvents[0]?.id ?? "");
      })
      .catch((err) => toastError(err instanceof Error ? err.message : "Gagal memuat event leaderboard."));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    Promise.all([api.announcements(eventId, "pemenang"), api.eventTeams(eventId)])
      .then(([nextAnnouncements, nextTeams]) => {
        setAnnouncements(nextAnnouncements ?? []);
        setTeams(nextTeams ?? []);
      })
      .catch((err) => toastError(err instanceof Error ? err.message : "Gagal memuat leaderboard."))
      .finally(() => setLoading(false));
  }, [eventId]);

  const selectedEvent = useMemo(() => events.find((event) => event.id === eventId), [events, eventId]);
  const winners = useMemo(
    () =>
      announcements
        .filter((announcement) => announcement.type === "pemenang")
        .flatMap((announcement) => announcement.results.map((result) => ({ ...result, announcement })))
        .filter((result) => result.teamName)
        .sort((a, b) => (a.rank || 99) - (b.rank || 99)),
    [announcements]
  );
  const podium = [winners.find((winner) => winner.rank === 2), winners.find((winner) => winner.rank === 1), winners.find((winner) => winner.rank === 3)].filter(Boolean) as WinnerEntry[];
  const winnerNames = useMemo(() => new Set(winners.map((winner) => winner.teamName.toLowerCase())), [winners]);
  const otherTeams = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return teams
      .filter((team) => !winnerNames.has(team.name.toLowerCase()))
      .filter((team) => {
        if (!normalized) return true;
        return `${team.name} ${team.categoryName} ${team.institution} ${team.verificationStatus}`.toLowerCase().includes(normalized);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [query, teams, winnerNames]);

  return (
    <section className="leaderboard-page min-h-screen bg-[#05070d] text-white scroll-pop" data-scroll-pop>
      <div className="leaderboard-grid-bg">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
            <div>
              <p className="font-display text-xs font-black uppercase tracking-[0.28em] text-cyan-300">Top Leaderboard</p>
              <h1 className="mt-4 font-display text-5xl font-black uppercase leading-[0.88] tracking-[-0.055em] sm:text-7xl">
                Panggung tim terbaik dan seluruh partisipan.
              </h1>
              <p className="mt-5 max-w-2xl text-sm font-bold leading-7 text-white/62">
                Juara 1, 2, 3 ditarik dari pengumuman pemenang. Daftar tim lain mengikuti data peserta pada event yang dipilih.
              </p>
            </div>
            <div className="leaderboard-filter-panel">
              <label className="label text-white/70" htmlFor="leaderboard-year">
                Tahun Event
              </label>
              <CustomSelect
                id="leaderboard-year"
                value={eventId}
                onChange={setEventId}
                placeholder="Pilih event"
                options={events.map((event) => ({
                  value: event.id,
                  label: `${event.year} - ${event.name}`,
                  description: event.status
                }))}
                disabled={!events.length}
              />
              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cyan-200/55" size={17} />
                <input
                  className="field h-11 border-white/15 bg-white/8 !pl-10 text-white placeholder:text-white/35 focus:border-cyan-300"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari tim partisipan..."
                />
              </div>
            </div>
          </div>

          <div className="mt-14">
            {loading ? (
              <LeaderboardSkeleton />
            ) : podium.length ? (
              <div className="leaderboard-podium">
                {podium.map((winner) => (
                  <WinnerWireCard key={`${winner.rank}-${winner.teamName}`} winner={winner} eventId={eventId} />
                ))}
              </div>
            ) : (
              <article className="leaderboard-empty">
                <Trophy size={24} />
                <p className="font-black">Podium belum tersedia.</p>
                <p className="text-sm text-white/55">Admin perlu membuat pengumuman pemenang untuk menampilkan Juara 1, 2, dan 3.</p>
              </article>
            )}
          </div>

          <div className="leaderboard-divider">
            <span>{selectedEvent?.name ?? "Point Project"} / Tim Partisipan</span>
          </div>

          <div className="leaderboard-team-field">
            {otherTeams.map((team, index) => (
              <ParticipantNode key={team.id} team={team} index={index} />
            ))}
            {!loading && !otherTeams.length ? (
              <article className="leaderboard-empty">
                <UsersRound size={24} />
                <p className="font-black">Belum ada tim lain untuk ditampilkan.</p>
                <p className="text-sm text-white/55">Coba ubah pencarian atau pilih event lain.</p>
              </article>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function WinnerWireCard({ winner, eventId }: { winner: WinnerEntry; eventId: string }) {
  const rank = winner.rank || 0;
  return (
    <article className={`winner-wire-card rank-${rank}`} data-scroll-pop>
      <div className="winner-wire-actor" aria-hidden="true">
        <span className="actor-head" />
        <span className="actor-body" />
        <span className="actor-arm left" />
        <span className="actor-arm right" />
        <span className="actor-leg left" />
        <span className="actor-leg right" />
      </div>
      <div className="winner-wire-rank">
        <Medal size={22} />
        <span>Juara {rank}</span>
      </div>
      <Link to={winnerPath(eventId, winner.teamName)} className="winner-wire-name">
        {winner.teamName}
      </Link>
      <div className="winner-wire-info">
        <p>{winner.workTitle || winner.announcement.title || "Karya terbaik"}</p>
        <p>{winner.categoryName || "Kategori"} / {winner.institution || "Instansi"}</p>
      </div>
      <Link to={winnerPath(eventId, winner.teamName)} className="winner-wire-link">
        Lihat preview
        <ArrowRight size={14} />
      </Link>
    </article>
  );
}

function ParticipantNode({ team, index }: { team: PublicTeam; index: number }) {
  return (
    <article className="participant-node" style={{ "--node-step": index % 6 } as CSSProperties}>
      <p className="font-black uppercase">{team.name}</p>
      <span>{team.categoryName} / Batch {team.batch}</span>
    </article>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="leaderboard-podium">
      {Array.from({ length: 3 }).map((_, index) => (
        <article key={index} className="winner-wire-card is-loading">
          <div className="skeleton h-40 w-full bg-white/10" />
          <div className="mt-4 h-4 w-2/3 bg-white/10" />
          <div className="mt-3 h-3 w-full bg-white/10" />
        </article>
      ))}
    </div>
  );
}
