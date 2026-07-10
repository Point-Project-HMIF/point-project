import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Award, ExternalLink, Filter, Medal, Newspaper, Trophy } from "lucide-react";
import { SectionHeading, StatusPill } from "../components/Layout";
import { api } from "../lib/api";
import { winnerPath } from "../lib/winner";
import type { Announcement, AnnouncementResult, Event } from "../lib/types";

type WinnerEntry = AnnouncementResult & {
  announcement: Announcement;
};

export function AnnouncementsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState("");
  const [type, setType] = useState("");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [error, setError] = useState("");

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
        setError(err instanceof Error ? err.message : "Gagal memuat tahun pengumuman.");
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
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat pengumuman."));
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
  const latestAnnouncement = announcements[0];

  return (
    <section className="py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Kanal Pengumuman"
          title="Berita resmi Point Project"
          body="Pengumuman finalis, pemenang, dan informasi event disusun seperti kanal berita agar mudah diikuti per tahun."
        />
        {error ? <p className="mt-8 rounded-md bg-coral/10 px-4 py-3 text-sm font-bold text-coral">{error}</p> : null}

        <div className="mt-10 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <article className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
            <div className="flex items-center gap-3">
              <Newspaper className="text-lagoon" />
              <div>
                <p className="text-xs font-black uppercase text-lagoon">Edisi {selectedEvent?.year ?? "-"}</p>
                <h2 className="mt-1 text-2xl font-black">{selectedEvent?.name ?? "Pengumuman"}</h2>
              </div>
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-ink/65">
              {latestAnnouncement
                ? latestAnnouncement.body
                : "Belum ada pengumuman yang dipublikasikan untuk tahun dan kategori ini."}
            </p>
          </article>

          <div className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div>
                <label className="label" htmlFor="year-filter">
                  Tahun
                </label>
                <select id="year-filter" className="field" value={eventId} onChange={(event) => setEventId(event.target.value)}>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.year} - {event.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="type-filter">
                  Jenis
                </label>
                <select id="type-filter" className="field" value={type} onChange={(event) => setType(event.target.value)}>
                  <option value="">Semua</option>
                  <option value="finalis">Finalis</option>
                  <option value="pemenang">Pemenang</option>
                  <option value="info">Info</option>
                </select>
              </div>
              <span className="inline-flex items-center justify-center gap-2 rounded-md bg-cloud px-4 py-3 text-sm font-black text-ink/70">
                <Filter size={17} />
                {announcements.length} berita
              </span>
            </div>
          </div>
        </div>

        {podium.length ? (
          <section className="mt-10">
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

        <div className="mt-10 grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
          <aside className="space-y-4">
            <h2 className="text-xl font-black">Headline</h2>
            {announcements.slice(0, 3).map((announcement) => (
              <article key={`headline-${announcement.id}`} className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
                <StatusPill tone={announcement.type === "pemenang" ? "amber" : "teal"}>{announcement.type}</StatusPill>
                <h3 className="mt-3 text-lg font-black leading-snug">{announcement.title}</h3>
                <p className="mt-2 text-xs text-ink/55">Dipublikasikan {formatDate(announcement.publishedAt)}</p>
              </article>
            ))}
          </aside>

          <main className="grid gap-5">
            {announcements.map((announcement) => (
              <article key={announcement.id} className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <StatusPill tone={announcement.type === "pemenang" ? "amber" : "teal"}>{announcement.type}</StatusPill>
                    <h2 className="mt-4 break-words text-2xl font-black">{announcement.title}</h2>
                    <p className="mt-2 text-sm text-ink/55">Dipublikasikan {formatDate(announcement.publishedAt)}</p>
                  </div>
                  {announcement.type === "pemenang" ? <Medal className="shrink-0 text-sun" size={34} /> : <Award className="shrink-0 text-lagoon" size={34} />}
                </div>
                <p className="mt-4 leading-7 text-ink/68">{announcement.body}</p>
                {announcement.results.length ? (
                  <div className="mt-6 overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="border-b border-ink/10 text-xs uppercase text-ink/45">
                        <tr>
                          <th className="py-3 pr-4">Peringkat</th>
                          <th className="py-3 pr-4">Tim</th>
                          <th className="py-3 pr-4">Kategori</th>
                          <th className="py-3 pr-4">Instansi</th>
                          <th className="py-3 pr-4">Karya</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink/10">
                        {announcement.results.map((result) => (
                          <tr key={`${announcement.id}-${result.teamName}`}>
                            <td className="py-3 pr-4 font-black">{result.rank ? `#${result.rank}` : "Finalis"}</td>
                            <td className="py-3 pr-4">
                              <Link className="font-black text-lagoon hover:underline" to={winnerPath(announcement.eventId, result.teamName)}>
                                {result.teamName}
                              </Link>
                            </td>
                            <td className="py-3 pr-4">{result.categoryName}</td>
                            <td className="py-3 pr-4">{result.institution}</td>
                            <td className="py-3 pr-4">{result.workTitle || announcement.title}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </article>
            ))}
            {!announcements.length ? (
              <article className="rounded-lg border border-ink/10 bg-white p-6 text-center shadow-soft">
                <p className="font-black">Belum ada pengumuman untuk filter ini.</p>
                <p className="mt-2 text-sm text-ink/60">Data akan tampil setelah admin mempublish pengumuman.</p>
              </article>
            ) : null}
          </main>
        </div>
      </div>
    </section>
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

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}
