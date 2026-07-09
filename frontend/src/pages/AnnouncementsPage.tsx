import { useEffect, useMemo, useState } from "react";
import { Award, ExternalLink, Filter, Medal, Trophy } from "lucide-react";
import { SectionHeading, StatusPill } from "../components/Layout";
import { api } from "../lib/api";
import type { Announcement, Event } from "../lib/types";

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
        setEvents(nextEvents);
        setEventId(nextEvents[0]?.id ?? "");
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Gagal memuat periode pengumuman.");
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!eventId) return;
    api
      .announcements(eventId, type)
      .then(setAnnouncements)
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat pengumuman."));
  }, [eventId, type]);

  const winners = useMemo(
    () => announcements.find((announcement) => announcement.type === "pemenang")?.results ?? [],
    [announcements]
  );

  return (
    <section className="py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Arsip Pengumuman"
          title="Finalis, pemenang, dan karya terbaik"
          body="Hasil lomba dapat difilter berdasarkan periode Point Project dan jenis pengumuman."
        />
        {error ? <p className="mt-8 rounded-md bg-coral/10 px-4 py-3 text-sm font-bold text-coral">{error}</p> : null}

        <div className="mt-10 rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <div>
              <label className="label" htmlFor="event-filter">
                Periode
              </label>
              <select id="event-filter" className="field" value={eventId} onChange={(event) => setEventId(event.target.value)}>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name} - {event.year}
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
            <div className="flex items-end">
              <span className="inline-flex items-center gap-2 rounded-md bg-cloud px-4 py-3 text-sm font-black text-ink/70">
                <Filter size={17} />
                {announcements.length} item
              </span>
            </div>
          </div>
        </div>

        {winners.length ? (
          <div className="mt-10">
            <div className="flex items-center gap-3">
              <Trophy className="text-sun" />
              <h2 className="text-2xl font-black">Highlight Juara</h2>
            </div>
            <div className="mt-5 grid gap-5 md:grid-cols-3">
              {winners.slice(0, 3).map((winner) => (
                <article key={`${winner.rank}-${winner.teamName}`} className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
                  <span className="grid h-12 w-12 place-items-center rounded-md bg-sun text-lg font-black">#{winner.rank}</span>
                  <h3 className="mt-5 text-xl font-black">{winner.teamName}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink/65">{winner.workTitle}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <StatusPill tone="teal">{winner.categoryName}</StatusPill>
                    <StatusPill tone="amber">{winner.institution}</StatusPill>
                  </div>
                  {winner.prototypeUrl ? (
                    <a href={winner.prototypeUrl} className="mt-5 inline-flex items-center gap-2 text-sm font-black text-lagoon">
                      Lihat Prototype
                      <ExternalLink size={16} />
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-10 grid gap-5">
          {announcements.map((announcement) => (
            <article key={announcement.id} className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <StatusPill tone={announcement.type === "pemenang" ? "amber" : "teal"}>{announcement.type}</StatusPill>
                  <h2 className="mt-4 text-2xl font-black">{announcement.title}</h2>
                  <p className="mt-2 text-sm text-ink/55">Dipublikasikan {announcement.publishedAt}</p>
                </div>
                {announcement.type === "pemenang" ? <Medal className="text-sun" size={34} /> : <Award className="text-lagoon" size={34} />}
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
                          <td className="py-3 pr-4">{result.teamName}</td>
                          <td className="py-3 pr-4">{result.categoryName}</td>
                          <td className="py-3 pr-4">{result.institution}</td>
                          <td className="py-3 pr-4">{result.workTitle}</td>
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
        </div>
      </div>
    </section>
  );
}
