import { Link } from "react-router-dom";
import type { CSSProperties } from "react";

export type ChampionPodiumWinner = {
  rank: number;
  teamName: string;
  href: string;
  workTitle?: string;
  categoryName?: string;
  institution?: string;
};

type ChampionPodiumProps = {
  winners: ChampionPodiumWinner[];
  variant: "official" | "arena";
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
};

const podiumOrder = [2, 1, 3];
const laurelLeaves = Array.from({ length: 8 }, (_, index) => index);

export function ChampionPodium({ winners, variant, eyebrow, title, description, className = "" }: ChampionPodiumProps) {
  const podium = podiumOrder
    .map((rank) => winners.find((winner) => winner.rank === rank))
    .filter((winner): winner is ChampionPodiumWinner => Boolean(winner));

  return (
    <section className={`champion-podium champion-podium--${variant} ${className}`} data-scroll-pop>
      <div className="champion-podium__header">
        <div>
          <p>{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        {description ? <span>{description}</span> : null}
      </div>

      <div className="champion-podium__stage" aria-label="Podium juara">
        <div className="champion-podium__light" />
        {podium.map((winner) => (
          <article key={`${winner.rank}-${winner.teamName}`} className={`champion-podium__slot rank-${winner.rank}`}>
            <div className="champion-podium__halo" />
            <Link to={winner.href} className="champion-podium__trophy" aria-label={`Lihat detail ${winner.teamName}`}>
              <span className="champion-podium__laurel champion-podium__laurel--left" aria-hidden="true">
                {laurelLeaves.map((leaf) => (
                  <i key={leaf} style={{ "--leaf-index": leaf } as CSSProperties} />
                ))}
              </span>
              <span className="champion-podium__laurel champion-podium__laurel--right" aria-hidden="true">
                {laurelLeaves.map((leaf) => (
                  <i key={leaf} style={{ "--leaf-index": leaf } as CSSProperties} />
                ))}
              </span>
              <span className="champion-podium__shield" aria-hidden="true">
                <span>{winner.rank}</span>
              </span>
              <span className="champion-podium__ribbon" aria-hidden="true">
                <b />
              </span>
              <span className="champion-podium__base" aria-hidden="true">
                <b />
                <i />
              </span>
              <em>{winner.rank}</em>
            </Link>
            <Link to={winner.href} className="champion-podium__name">
              {winner.teamName}
            </Link>
            <p className="champion-podium__caption">
              {winner.workTitle || (winner.rank === 1 ? "Juara utama" : `Juara ${winner.rank}`)}
            </p>
            {variant === "arena" ? (
              <div className="champion-podium__platform" aria-hidden="true">
                <span />
              </div>
            ) : null}
            {variant === "arena" ? (
              <Link to={winner.href} className="champion-podium__detail">
                Detail Tim
              </Link>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
