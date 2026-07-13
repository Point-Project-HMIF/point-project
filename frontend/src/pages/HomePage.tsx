import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
  CalendarCheck,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  Landmark,
  Mail,
  MapPin,
  Rocket,
  Trophy,
  UsersRound
} from "lucide-react";
import { CubeParticleCloud } from "../components/CubeParticleCloud";
import { api, isNotFoundError } from "../lib/api";
import { toastError } from "../lib/toast";
import type { Announcement, Category, Event, EventRules, FAQ, TimelineItem } from "../lib/types";

const systemCards = [
  { icon: UsersRound, label: "Peserta", text: "Registrasi tim, verifikasi OTP, dashboard, dan riwayat submission." },
  { icon: CalendarCheck, label: "Panitia", text: "Kontrol jadwal, tahap upload, FAQ, pengumuman, dan akses final." },
  { icon: Trophy, label: "Publik", text: "Finalis, pemenang, arsip event, dan rubrik karya tampil dalam satu kanal." },
  { icon: CheckCircle2, label: "Arsip", text: "Data tiap periode tetap tersimpan ketika event berikutnya aktif." }
];

export function HomePage() {
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<Event | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [rules, setRules] = useState<EventRules | null>(null);
  const [heroDarkProgress, setHeroDarkProgress] = useState(0);
  const [cubeLightProgress, setCubeLightProgress] = useState(0);
  const [heroExitProgress, setHeroExitProgress] = useState(0);

  useEffect(() => {
    let alive = true;
    let loadingTimer: number | undefined;
    const startedAt = Date.now();
    const finishLoading = () => {
      const remaining = Math.max(0, 850 - (Date.now() - startedAt));
      loadingTimer = window.setTimeout(() => {
        if (alive) setLoading(false);
      }, remaining);
    };

    setLoading(true);
    api
      .activeEvent()
      .then(async (active) => {
        const [nextCategories, nextTimeline, nextAnnouncements, nextRules, nextFAQs] = await Promise.all([
          api.categories(active.id),
          api.timeline(active.id),
          api.announcements(active.id),
          api.rules(active.id).catch((err) => {
            if (isNotFoundError(err)) return { eventId: active.id, minTeamMembers: 2, maxTeamMembers: 3 };
            throw err;
          }),
          api.faqs(active.id).catch((err) => {
            if (isNotFoundError(err)) return [];
            throw err;
          })
        ]);
        if (!alive) return;
        setEvent(active);
        setCategories(nextCategories ?? []);
        setTimeline(nextTimeline ?? []);
        setAnnouncements(nextAnnouncements ?? []);
        setRules(nextRules);
        setFaqs(nextFAQs ?? []);
        finishLoading();
      })
      .catch((err) => {
        if (!alive) return;
        toastError(err instanceof Error ? err.message : "Gagal memuat data dari server.");
        finishLoading();
      });
    return () => {
      alive = false;
      if (loadingTimer) window.clearTimeout(loadingTimer);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      const target = document.getElementById("rubik-scroll-area");
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const travel = Math.max(1, rect.height - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / travel));
      const nextDark = progress >= 0.25 && progress < 0.93 ? 1 : 0;
      const nextCubeLight = nextDark ? Math.min(1, Math.max(0, (progress - 0.23) / 0.12)) : 0;
      const nextExit = progress >= 0.93 ? 1 : 0;
      setHeroDarkProgress(nextDark);
      setCubeLightProgress(nextCubeLight);
      setHeroExitProgress(nextExit);
    };
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  const winnerAnnouncement = useMemo(
    () => (announcements ?? []).find((announcement) => announcement.type === "pemenang"),
    [announcements]
  );
  const eventName = event?.name ?? "Point Project";
  const [headlineTop, headlineBottom] = useMemo(() => splitHeroTitle(eventName), [eventName]);
  const publicFaqs = useMemo(() => faqs.filter((faq) => !isTeamRuleFAQ(faq)), [faqs]);
  const heroVisibleProgress = Math.max(0, heroDarkProgress * (1 - heroExitProgress));
  const heroInDarkMode = heroDarkProgress > 0.46 && heroExitProgress < 0.48;

  return (
    <div
      className="bg-white text-[#05070d]"
      style={
        {
          "--hero-dark-progress": heroDarkProgress,
          "--hero-exit-progress": heroExitProgress,
          "--hero-visible-progress": heroVisibleProgress,
          "--hero-soft-progress": cubeLightProgress * 0.92,
          "--hero-star-progress": heroVisibleProgress * 0.54
        } as CSSProperties
      }
    >
      <section id="rubik-scroll-area" className="relative isolate min-h-[430vh] overflow-clip border-b border-dark/10 bg-[#05070d]">
        <div className="sticky top-0 h-screen overflow-hidden bg-[#05070d]">
          <div className="absolute inset-0 z-0 bg-white" style={{ opacity: 1 - heroDarkProgress }} aria-hidden="true" />
          <div className="hero-dark-stage absolute inset-0 z-0" aria-hidden="true" />
          <div className="hero-starfield absolute inset-0 z-[1]" aria-hidden="true" />
          <CubeParticleCloud className="absolute inset-0 z-[3]" cubeCount={520} color="#4da6ff" scrollTarget="#rubik-scroll-area" />
          <div className="hero-diagonal-light absolute inset-0 z-[4]" aria-hidden="true" />
          <div className="hero-aurora-light absolute inset-0 z-[4]" aria-hidden="true" />
          <div className="hero-dark-vignette absolute inset-0 z-[2]" aria-hidden="true" />
          <div className="hero-dark-bottom absolute inset-x-0 bottom-0 z-[2] h-44" aria-hidden="true" />
          <div className="hero-exit-white absolute inset-0 z-[6]" aria-hidden="true" />
        </div>

        <div className="relative z-10 -mt-[100vh]">
          <div className="mx-auto grid min-h-screen max-w-7xl content-start px-4 pb-16 pt-20 sm:px-6 lg:px-8">
            <div className={`hero-landing-copy w-full reveal-up ${heroInDarkMode ? "is-dark" : ""}`}>
              <h1 className="synthetic-headline mt-5" aria-label={eventName}>
                <span className="glitch-text is-active" data-text={headlineTop}>
                  {headlineTop}
                </span>
                <span className="glitch-text is-active" data-text={headlineBottom}>
                  {headlineBottom}
                </span>
              </h1>
              {loading ? (
                <div className="mt-4 max-w-2xl">
                  <Skeleton className={`h-5 w-4/5 sm:w-2/3 ${heroInDarkMode ? "skeleton-dark" : ""}`} />
                </div>
              ) : (
                <p className="hero-theme-text mt-4 max-w-2xl text-base leading-8 sm:text-lg">
                  {event?.theme ?? "Kompetisi UI/UX nasional dengan alur pendaftaran, submission, seleksi, dan publikasi karya dalam satu sistem."}
                </p>
              )}
              <div className="mt-7 grid max-w-3xl gap-3 sm:grid-cols-3 reveal-up-delay">
                <Metric value={String(categories.length || 2).padStart(2, "0")} label="Kategori aktif" tone={heroInDarkMode ? "dark" : "light"} />
                <Metric value={String(timeline.length || 4).padStart(2, "0")} label="Tahap event" tone={heroInDarkMode ? "dark" : "light"} />
                <Metric value={String(announcements.length).padStart(2, "0")} label="Update publik" tone={heroInDarkMode ? "dark" : "light"} />
              </div>
              <p className={`hero-competition-marker mt-4 ${heroInDarkMode ? "is-dark" : ""}`}>
                HMIF ITERA / UI UX Competition
              </p>
              <div className="hero-os-overview mt-7">
                <div className="hero-os-copy">
                  <p className="hero-os-eyebrow">Apa itu Point Project?</p>
                  <h2 className="hero-os-title mt-3">
                    Sistem kompetisi UI/UX yang rapi dari pendaftaran sampai publikasi karya.
                  </h2>
                  <p className="hero-os-body mt-4 max-w-2xl">
                    Point Project menjadi ruang kerja bersama untuk peserta, panitia, dan publik. Tim mendaftar,
                    mengirim karya, mengikuti tahap seleksi, lalu hasil finalis dan pemenang tersimpan sebagai arsip event.
                  </p>
                </div>
                <div className="hero-os-list">
                  <div className="hero-os-list-head">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Operating System</p>
                    <span className="text-xs font-black text-dark/45">{event ? event.year : "ACTIVE"}</span>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {systemCards.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="hero-os-row">
                          <Icon className="text-primary" size={19} />
                          <div>
                            <p className="text-sm font-black uppercase tracking-wide">{item.label}</p>
                            <p className="mt-1 text-xs leading-5 text-dark/58">{item.text}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`hero-phase-boundary mx-auto grid min-h-[96vh] max-w-7xl content-end px-4 pb-24 pt-32 sm:px-6 lg:px-8 ${
              heroInDarkMode ? "is-dark" : ""
            }`}
          >
            <div className="max-w-5xl scroll-pop" data-scroll-pop>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-primary">Competition Runtime</p>
              <h2 className="mt-5 font-display text-5xl font-black uppercase leading-[0.88] tracking-[-0.055em] text-[#05070d] sm:text-7xl lg:text-8xl">
                Alur kompetisi bergerak dari ide, validasi, sampai publikasi.
              </h2>
            </div>
          </div>

          <div className="hero-cube-phase mx-auto grid min-h-screen max-w-7xl content-center justify-items-center gap-10 px-4 pb-[7vh] pt-28 text-center sm:px-6 lg:px-8">
            <div className="cube-opportunity-copy scroll-pop" data-scroll-pop>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/72">Scanning Opportunities</p>
              <h2 className="mt-4 text-4xl font-black uppercase leading-[0.9] text-white sm:text-6xl lg:text-7xl">
                We see outstanding opportunity
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-sm font-bold leading-7 text-white/72">
                The advent of synthetic reality aligns with our mission: membuka ruang kompetisi yang rapi,
                terukur, dan mudah diikuti peserta.
              </p>
            </div>
            <div className="hero-glass-card hero-scroll-card scroll-pop" data-scroll-pop>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-white/56">Point Project</p>
              <h2
                className="glitch-text is-active mx-auto mt-5 max-w-3xl text-3xl font-black uppercase leading-[0.95] sm:text-5xl"
                data-text="Jadi tim pertama yang mendaftar!"
              >
                Jadi tim pertama yang mendaftar!
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-white/70">
                Kami membuka pendaftaran untuk perlombaan UI/UX tingkat Nasional
              </p>
              <Link to="/daftar" className="cyber-cta-button mx-auto mt-8">
                <Rocket size={18} />
                Daftarkan Tim kamu Sekarang!
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="home-light-zone light-page">
      <section className="tech-grid bg-[#05070d] py-16 scroll-pop" data-scroll-pop>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <TechHeading
            eyebrow="Timeline"
            title={`Jadwal ${eventName}`}
            body="Tahapan dibuat seperti relay: setiap fase punya tanggal, konteks, dan status yang bisa diperbarui dari admin panel."
          />
          <div className="timeline-tree-panel mt-10">
            {loading ? (
              <TimelineSkeleton />
            ) : timeline.length ? (
              <ol className="timeline-tree">
                {timeline.map((item, index) => (
                  <li key={item.id} className="timeline-tree-item scroll-pop" data-scroll-pop>
                    <div className="timeline-tree-marker">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="timeline-tree-card">
                      <p className="timeline-tree-date">{formatRange(item.startDate, item.endDate)}</p>
                      <h3>{item.label}</h3>
                      <p>{item.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="Timeline belum tersedia." body="Jadwal akan tampil setelah admin mengatur tahapan event." />
            )}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#0b101b] py-16 scroll-pop" data-scroll-pop>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <TechHeading
            eyebrow="Kategori"
            title="Dua jalur kompetisi, satu arena nasional"
            body="Peserta memilih kategori sesuai jenjang pendidikan. Rules dan kebutuhan berkas tetap mengikuti event aktif."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {loading ? (
              <CategorySkeleton />
            ) : (
              categories.map((category) => (
                <article key={category.id} className="cyber-panel glitch-card bg-white/[0.04] p-6 scroll-pop" data-scroll-pop>
                  <div className="flex items-center gap-3">
                    {category.name.toLowerCase().includes("siswa") ? (
                      <GraduationCap className="text-orange" size={30} />
                    ) : (
                      <Landmark className="text-cyan-200" size={30} />
                    )}
                    <h3 className="text-2xl font-black uppercase">{category.name}</h3>
                  </div>
                  <p className="mt-5 text-sm leading-7 text-white/58">{category.description}</p>
                  <ul className="mt-6 grid gap-3">
                    {category.requirements.map((requirement) => (
                      <li key={requirement} className="flex gap-3 text-sm leading-6 text-white/70">
                        <CheckCircle2 className="mt-0.5 shrink-0 text-cyan-200" size={18} />
                        {requirement}
                      </li>
                    ))}
                  </ul>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="bg-[#05070d] py-16 scroll-pop" data-scroll-pop>
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow">Pengumuman</p>
            <h2 className="mt-4 text-3xl font-black uppercase leading-tight sm:text-5xl">
              Finalis dan pemenang tampil publik.
            </h2>
            <p className="mt-5 text-sm leading-7 text-white/58">
              Hasil kompetisi dapat difilter berdasarkan periode Point Project, lengkap dengan kategori,
              rubrik alasan menang, dan galeri karya.
            </p>
            <Link to="/pengumuman" className="mt-7 inline-flex items-center gap-2 border-b border-cyan-300 pb-1 text-sm font-black uppercase tracking-wide text-cyan-200">
              Buka Arsip Pengumuman
              <ExternalLink size={16} />
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {loading ? (
              <AnnouncementSkeleton />
            ) : (winnerAnnouncement?.results ?? []).slice(0, 3).length ? (
              (winnerAnnouncement?.results ?? []).slice(0, 3).map((result) => (
                <article key={`${result.rank}-${result.teamName}`} className="cyber-panel glitch-card bg-white/[0.045] p-5 transition hover:bg-white/[0.075] scroll-pop" data-scroll-pop>
                  <span className="grid h-12 w-12 place-items-center bg-yellow text-lg font-black text-[#05070d]">
                    #{result.rank}
                  </span>
                  <h3 className="mt-5 text-xl font-black">{result.teamName}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/56">{result.workTitle}</p>
                  <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">{result.categoryName}</p>
                </article>
              ))
            ) : (
              <EmptyState title="Pemenang belum dipublish." body="Podium akan muncul setelah panitia membuat pengumuman pemenang." />
            )}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#0b101b] py-14 scroll-pop" data-scroll-pop>
        <div className="mx-auto grid max-w-7xl items-start gap-8 px-4 sm:px-6 lg:grid-cols-[330px_minmax(0,1fr)] lg:px-8">
          <div className="grid auto-rows-max gap-3 self-start sm:grid-cols-2 lg:grid-cols-1">
            {[
              {
                icon: MapPin,
                title: "Penyelenggara",
                text: "Himpunan Mahasiswa Informatika Institut Teknologi Sumatera."
              },
              {
                icon: Mail,
                title: "Email",
                text: "pointproject@hmifitera.id"
              }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="border border-white/10 bg-white/[0.04] p-5 scroll-pop" data-scroll-pop>
                  <Icon className="text-cyan-200" size={22} />
                  <h3 className="mt-4 text-sm font-black uppercase tracking-wide">{item.title}</h3>
                  <p className={`mt-3 leading-6 text-white/58 ${item.title === "Email" ? "break-all text-xs sm:text-sm" : "text-sm"}`}>
                    {item.text}
                  </p>
                </article>
              );
            })}
          </div>
          <div>
            <TechHeading
              eyebrow="FAQ"
              title="Aturan dan pertanyaan umum"
              body="Daftar ini dikelola langsung oleh admin atau panitia untuk event aktif."
              align="left"
            />
            <div className="mt-6 grid gap-3">
              {loading ? (
                <FAQSkeleton />
              ) : rules ? (
                <article className="border border-cyan-300/20 bg-cyan-300/8 p-4 scroll-pop" data-scroll-pop>
                  <h3 className="font-black">Jumlah peserta per tim</h3>
                  <p className="mt-2 text-sm leading-6 text-white/58">
                    Minimal {rules.minTeamMembers} peserta dan maksimal {rules.maxTeamMembers} peserta, termasuk ketua.
                  </p>
                </article>
              ) : null}
              {!loading &&
                publicFaqs.map((faq) => (
                  <article key={faq.id} className="border border-white/10 bg-white/[0.04] p-4 scroll-pop" data-scroll-pop>
                    <h3 className="font-black">{faq.question}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/58">{faq.answer}</p>
                  </article>
                ))}
              {!loading && !rules && !publicFaqs.length ? (
                <EmptyState title="FAQ belum tersedia." body="Panitia akan memperbarui aturan melalui admin panel." />
              ) : null}
            </div>
          </div>
        </div>
      </section>
      </div>
    </div>
  );
}

function Metric({ value, label, tone = "dark" }: { value: string; label: string; tone?: "dark" | "light" }) {
  return (
    <div className={tone === "light" ? "metric-card-light px-4 py-3" : "cyber-panel glitch-card bg-white/[0.045] px-4 py-3"}>
      <p className={tone === "light" ? "text-3xl font-black text-[#05070d]" : "text-3xl font-black text-cyan-100"}>{value}</p>
      <p className={tone === "light" ? "mt-1 text-xs font-bold uppercase tracking-wide text-[#05070d]/50" : "mt-1 text-xs font-bold uppercase tracking-wide text-white/45"}>{label}</p>
    </div>
  );
}

function TechHeading({
  eyebrow,
  title,
  body,
  align = "center"
}: {
  eyebrow: string;
  title: string;
  body?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-black uppercase leading-tight sm:text-5xl">{title}</h2>
      {body ? <p className="mt-4 text-sm leading-7 text-white/58">{body}</p> : null}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <article className="border border-dashed border-white/18 bg-white/[0.025] p-8 text-center">
      <p className="font-black">{title}</p>
      <p className="mt-2 text-sm text-white/50">{body}</p>
    </article>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

function TimelineSkeleton() {
  return (
    <ol className="timeline-tree" aria-label="Memuat timeline">
      {Array.from({ length: 4 }).map((_, index) => (
        <li key={index} className="timeline-tree-item">
          <div className="timeline-tree-marker">{String(index + 1).padStart(2, "0")}</div>
          <div className="timeline-tree-card">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="mt-4 h-5 w-52" />
            <Skeleton className="mt-3 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-4/5" />
          </div>
        </li>
      ))}
    </ol>
  );
}

function CategorySkeleton() {
  return (
    <>
      {Array.from({ length: 2 }).map((_, index) => (
        <article key={index} className="border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-md skeleton-dark" />
            <Skeleton className="h-7 w-40 skeleton-dark" />
          </div>
          <Skeleton className="mt-5 h-3 w-full skeleton-dark" />
          <Skeleton className="mt-2 h-3 w-5/6 skeleton-dark" />
          <div className="mt-6 space-y-3">
            <Skeleton className="h-3 w-4/5 skeleton-dark" />
            <Skeleton className="h-3 w-3/4 skeleton-dark" />
            <Skeleton className="h-3 w-2/3 skeleton-dark" />
          </div>
        </article>
      ))}
    </>
  );
}

function AnnouncementSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, index) => (
        <article key={index} className="border border-white/10 bg-white/[0.045] p-5">
          <Skeleton className="h-12 w-12 skeleton-dark" />
          <Skeleton className="mt-5 h-5 w-28 skeleton-dark" />
          <Skeleton className="mt-3 h-3 w-full skeleton-dark" />
          <Skeleton className="mt-2 h-3 w-4/5 skeleton-dark" />
          <Skeleton className="mt-5 h-3 w-24 skeleton-dark" />
        </article>
      ))}
    </>
  );
}

function FAQSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, index) => (
        <article key={index} className="border border-white/10 bg-white/[0.04] p-4">
          <Skeleton className="h-4 w-1/2 skeleton-dark" />
          <Skeleton className="mt-3 h-3 w-full skeleton-dark" />
          <Skeleton className="mt-2 h-3 w-4/5 skeleton-dark" />
        </article>
      ))}
    </>
  );
}

function formatRange(startDate: string, endDate: string) {
  if (!startDate && !endDate) return "Tanggal menyusul";
  if (!startDate || !endDate) return formatReadableDate(startDate || endDate);
  if (startDate === endDate) return formatReadableDate(startDate);
  return `${formatReadableDate(startDate)} - ${formatReadableDate(endDate)}`;
}

function formatReadableDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function splitHeroTitle(title: string): [string, string] {
  const words = title.replace(/\s+/g, " ").trim().toUpperCase().split(" ");
  if (words.length <= 1) return [words[0] || "POINT", "PROJECT"];
  if (words[0] === "POINT" && words[1] === "PROJECT") return ["POINT", words.slice(1).join(" ")];
  const midpoint = Math.max(1, Math.ceil(words.length / 2));
  return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ") || "ARENA"];
}

function isTeamRuleFAQ(faq: FAQ) {
  const question = faq.question.toLowerCase();
  return (
    question.includes("jumlah peserta per tim") ||
    question.includes("jumlah minimal peserta") ||
    question.includes("jumlah maksimal peserta")
  );
}
