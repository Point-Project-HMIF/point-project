import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  ImageIcon,
  Medal,
  Presentation,
  Trophy,
} from "lucide-react";
import { StatusPill } from "../components/Layout";
import { api, resolveFileURL } from "../lib/api";
import { toastError } from "../lib/toast";
import { teamSlug } from "../lib/winner";
import type {
  Announcement,
  AnnouncementResult,
  Event,
  RubricQuestion,
} from "../lib/types";

type WinnerEntry = AnnouncementResult & {
  announcement: Announcement;
};

export function WinnerDetailPage() {
  const { eventId = "", teamSlug: slug = "" } = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [rubricQuestions, setRubricQuestions] = useState<RubricQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    Promise.all([
      api.events(),
      api.announcements(eventId, "pemenang"),
      api.publicRubricQuestions(eventId),
    ])
      .then(([events, nextAnnouncements, nextRubricQuestions]) => {
        setEvent((events ?? []).find((item) => item.id === eventId) ?? null);
        setAnnouncements(nextAnnouncements ?? []);
        setRubricQuestions(
          (nextRubricQuestions ?? [])
            .filter((question) => question.isActive)
            .sort((a, b) => a.sortOrder - b.sortOrder),
        );
      })
      .catch((err) => {
        const message =
          err instanceof Error ? err.message : "Gagal memuat detail pemenang.";
        setError(message);
        toastError(message);
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  const winner = useMemo<WinnerEntry | undefined>(
    () =>
      announcements
        .flatMap((announcement) =>
          announcement.results.map((result) => ({ ...result, announcement })),
        )
        .find((result) => teamSlug(result.teamName) === slug),
    [announcements, slug],
  );
  const previewUrl = winner?.previewUrl || winner?.prototypeUrl;
  const embeddedPreviewUrl = previewUrl
    ? toEmbeddablePreviewURL(previewUrl)
    : "";

  return (
    <section className="experience-page py-14 scroll-pop" data-scroll-pop>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Link
          to="/pengumuman"
          className="inline-flex items-center gap-2 text-sm font-black text-primary"
        >
          <ArrowLeft size={17} />
          Kembali ke Pengumuman
        </Link>

        {loading ? (
          <article
            className="mt-8 rounded-lg border border-dark/10 bg-white p-8 text-center shadow-soft scroll-pop"
            data-scroll-pop
          >
            <p className="font-black">Memuat detail pemenang...</p>
          </article>
        ) : error ? (
          <article
            className="mt-8 rounded-lg border border-dark/10 bg-white p-8 text-center shadow-soft scroll-pop"
            data-scroll-pop
          >
            <p className="font-black">Detail belum bisa dimuat.</p>
            <p className="mt-2 text-sm text-dark/60">
              Silakan coba buka kembali halaman pengumuman.
            </p>
          </article>
        ) : !winner ? (
          <article
            className="mt-8 rounded-lg border border-dark/10 bg-white p-8 text-center shadow-soft scroll-pop"
            data-scroll-pop
          >
            <p className="font-black">Tim pemenang tidak ditemukan.</p>
            <p className="mt-2 text-sm text-dark/60">
              Periksa kembali link atau filter tahun pengumuman.
            </p>
          </article>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <article
              className="rounded-lg border border-dark/10 bg-white p-6 shadow-soft scroll-pop"
              data-scroll-pop
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <StatusPill tone={winner.rank === 1 ? "amber" : "teal"}>
                    Juara {winner.rank || "-"}
                  </StatusPill>
                  <h1 className="mt-4 text-4xl font-black leading-tight">
                    {winner.teamName}
                  </h1>
                  <p className="mt-3 text-sm font-bold uppercase text-dark/45">
                    {event?.name ?? "Point Project"} {event?.year ?? ""}
                  </p>
                </div>
                {winner.rank === 1 ? (
                  <Trophy className="shrink-0 text-yellow" size={42} />
                ) : (
                  <Medal className="shrink-0 text-primary" size={42} />
                )}
              </div>

              <div className="mt-7 grid gap-3 border-t border-dark/10 pt-5 text-sm">
                <Info label="Kategori" value={winner.categoryName || "-"} />
                <Info label="Instansi" value={winner.institution || "-"} />
                <Info
                  label="Judul Karya"
                  value={winner.workTitle || winner.announcement.title || "-"}
                />
              </div>

              <div className="mt-7">
                <h2 className="text-xl font-black">Kenapa Mereka Menang</h2>
                <p className="mt-3 leading-7 text-dark/68">
                  {winner.reason ||
                    winner.announcement.body ||
                    "Catatan penilaian belum ditambahkan oleh admin."}
                </p>
              </div>

              <div className="mt-7">
                <h2 className="text-xl font-black">Rubrik Penilaian</h2>
                <div className="mt-4 grid gap-3">
                  {rubricQuestions.map((question) => (
                    <div
                      key={question.id}
                      className="rounded-md border border-dark/10 bg-light p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-black">
                          {question.question}
                        </p>
                        <span className="shrink-0 text-xs font-black text-primary">
                          /{question.maxScore}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-dark/62">
                        {question.description ||
                          "Kriteria ini diatur oleh panitia untuk periode event ini."}
                      </p>
                    </div>
                  ))}
                  {!rubricQuestions.length ? (
                    <div className="rounded-md border border-dashed border-dark/15 bg-light p-3">
                      <p className="text-sm font-bold text-dark/60">
                        Rubrik belum dipublikasikan panitia untuk event ini.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>

            <article
              className="rounded-lg border border-dark/10 bg-white p-4 shadow-soft scroll-pop"
              data-scroll-pop
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-black">Preview Web</h2>
                {previewUrl ? (
                  <StatusPill tone="teal">Live</StatusPill>
                ) : (
                  <StatusPill tone="amber">Belum Ada</StatusPill>
                )}
              </div>
              {previewUrl ? (
                <div className="overflow-hidden rounded-md border border-dark/10 bg-light">
                  <iframe
                    title={`Preview ${winner.teamName}`}
                    src={embeddedPreviewUrl}
                    className="h-[520px] w-full bg-white"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="grid h-[360px] place-items-center rounded-md bg-light px-6 text-center">
                  <p className="text-sm font-bold text-dark/60">
                    Tim belum mengirim link prototype atau preview karya.
                  </p>
                </div>
              )}

              <div className="mt-5">
                <h3 className="text-sm font-black uppercase tracking-[0.16em] text-dark/45">
                  Data File Tim
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <AssetCard
                    label="Prototype / Preview"
                    url={previewUrl}
                    icon={ExternalLink}
                  />
                  <AssetCard
                    label="File PPT"
                    url={winner.pptUrl}
                    icon={Presentation}
                  />
                  <AssetCard
                    label="Poster"
                    url={winner.posterUrl}
                    icon={ImageIcon}
                  />
                  <AssetCard
                    label="Proposal"
                    url={winner.proposalUrl}
                    icon={FileText}
                  />
                  <AssetCard
                    label="Laporan"
                    url={winner.reportUrl}
                    icon={FileText}
                  />
                </div>
              </div>
            </article>
          </div>
        )}
      </div>
    </section>
  );
}

function toEmbeddablePreviewURL(url: string) {
  const resolved = resolveFileURL(url);
  if (/figma\.com/i.test(resolved) && !/figma\.com\/embed/i.test(resolved)) {
    return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(resolved)}`;
  }
  return resolved;
}

function AssetCard({
  label,
  url,
  icon: Icon,
}: {
  label: string;
  url?: string;
  icon: typeof ExternalLink;
}) {
  const resolved = url ? resolveFileURL(url) : "";
  return (
    <a
      href={resolved || undefined}
      target="_blank"
      rel="noreferrer"
      aria-disabled={!resolved}
      className={
        resolved
          ? "group rounded-md border border-dark/10 bg-light p-4 transition hover:border-primary/40 hover:bg-primary/5"
          : "pointer-events-none rounded-md border border-dashed border-dark/15 bg-light/60 p-4 opacity-70"
      }
    >
      <div className="flex items-start gap-3">
        <span className={resolved ? "text-primary" : "text-dark/30"}>
          <Icon size={19} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black">{label}</p>
          <p className="mt-1 break-all text-xs leading-5 text-dark/52">
            {resolved ? "Klik untuk membuka file" : "Belum tersedia"}
          </p>
        </div>
      </div>
    </a>
  );
}

function AssetButton({
  label,
  url,
  icon: Icon,
  primary = false,
}: {
  label: string;
  url?: string;
  icon: typeof ExternalLink;
  primary?: boolean;
}) {
  if (!url) return null;
  return (
    <a
      href={resolveFileURL(url)}
      target="_blank"
      rel="noreferrer"
      className={
        primary
          ? "inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-black text-white hover:bg-[#055c8f]"
          : "inline-flex items-center gap-2 rounded-md border border-dark/10 bg-white px-4 py-2.5 text-sm font-black text-primary hover:bg-primary hover:text-white"
      }
    >
      <Icon size={16} />
      {label}
    </a>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-bold text-dark/50">{label}:</span>{" "}
      <span className="break-words">{value}</span>
    </p>
  );
}
