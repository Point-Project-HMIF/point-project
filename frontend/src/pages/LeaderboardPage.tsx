import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Trophy, UsersRound } from "lucide-react";
import { ChampionPodium } from "../components/ChampionPodium";
import { api } from "../lib/api";
import { toastError } from "../lib/toast";
import type { Announcement, AnnouncementResult, Event, PublicTeam } from "../lib/types";
import { winnerPath } from "../lib/winner";

type WinnerEntry = AnnouncementResult & {
  announcement: Announcement;
};

const podiumOrder = [2, 1, 3] as const;

export function LeaderboardPage() {
  const [event, setEvent] = useState<Event | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [teams, setTeams] = useState<PublicTeam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    api
      .activeEvent()
      .then(async (active) => {
        const [nextAnnouncements, nextTeams] = await Promise.all([
          api.announcements(active.id, "pemenang"),
          api.eventTeams(active.id)
        ]);
        if (!alive) return;
        setEvent(active);
        setAnnouncements(nextAnnouncements ?? []);
        setTeams(nextTeams ?? []);
      })
      .catch((err) => {
        if (!alive) return;
        toastError(err instanceof Error ? err.message : "Gagal memuat leaderboard.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const winners = useMemo(
    () =>
      announcements
        .filter((announcement) => announcement.type === "pemenang")
        .flatMap((announcement) => announcement.results.map((result) => ({ ...result, announcement })))
        .filter((result) => result.teamName)
        .sort((a, b) => (a.rank || 99) - (b.rank || 99)),
    [announcements]
  );

  const podium = useMemo(
    () => podiumOrder.map((rank) => winners.find((winner) => winner.rank === rank)).filter(Boolean) as WinnerEntry[],
    [winners]
  );

  const winnerNames = useMemo(() => new Set(winners.map((winner) => winner.teamName.toLowerCase())), [winners]);
  const participantTeams = useMemo(
    () =>
      teams
        .filter((team) => !winnerNames.has(team.name.toLowerCase()))
        .sort((a, b) => {
          if (a.verificationStatus === "verified" && b.verificationStatus !== "verified") return -1;
          if (b.verificationStatus === "verified" && a.verificationStatus !== "verified") return 1;
          return a.name.localeCompare(b.name);
        }),
    [teams, winnerNames]
  );

  return (
    <section className="leaderboard-season-page min-h-screen text-white scroll-pop" data-scroll-pop>
      <div className="leaderboard-season-bg">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-20 lg:px-8">
          {podium.length ? (
            <ChampionPodium
              variant="arena"
              eyebrow={`${event?.name ?? "Point Project"} / UI UX Arena`}
              title="Season Champions"
              description="Tim terbaik yang berhasil naik ke puncak kompetisi dan meninggalkan jejak karya di arsip publik."
              winners={podium.map((winner) => ({
                rank: winner.rank,
                teamName: winner.teamName,
                href: event?.id ? winnerPath(event.id, winner.teamName) : "#",
                workTitle: winner.workTitle || winner.announcement.title,
                categoryName: winner.categoryName,
                institution: winner.institution
              }))}
            />
          ) : (
            <article className="leaderboard-season-empty">
              <Trophy size={24} />
              <p>Podium belum tersedia.</p>
            </article>
          )}

          <section className="leaderboard-season-tree-section">
            <div className="leaderboard-season-tree-title">
              <h2>Top Leaderboard</h2>
              <span />
            </div>
            <div className="leaderboard-season-tree" aria-label="Tim partisipan Point Project">
              {participantTeams.map((team, index) => (
                <ParticipantTreeNode key={team.id} index={index} team={team} />
              ))}
              {!loading && !participantTeams.length ? (
                <article className="leaderboard-season-empty compact">
                  <UsersRound size={22} />
                  <p>Belum ada tim non-juara untuk ditampilkan.</p>
                </article>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

function ParticipantTreeNode({ team, index }: { team: PublicTeam; index: number }) {
  const side = index % 2 === 0 ? "left" : "right";

  return (
    <article
      className={`leaderboard-season-node ${side}`}
      style={{ "--node-delay": `${Math.min(index, 8) * 70}ms` } as CSSProperties}
    >
      <div className="leaderboard-season-node-card">
        <span className="leaderboard-season-node-rank">{String(index + 4).padStart(2, "0")}</span>
        <div>
          <strong>{team.name}</strong>
          <p>{team.categoryName || "-"} / {team.institution || "Instansi belum diisi"}</p>
        </div>
      </div>
    </article>
  );
}
