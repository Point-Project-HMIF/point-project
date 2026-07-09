import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  Landmark,
  Mail,
  MapPin,
  Trophy,
  UsersRound
} from "lucide-react";
import { SectionHeading, StatusPill } from "../components/Layout";
import { api, isNotFoundError } from "../lib/api";
import type { Announcement, Category, CommitteeMember, Event, FAQ, TimelineItem } from "../lib/types";

export function HomePage() {
  const [event, setEvent] = useState<Event | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [committee, setCommittee] = useState<CommitteeMember[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api
      .activeEvent()
      .then(async (active) => {
        const [nextCategories, nextTimeline, nextCommittee, nextAnnouncements, nextFAQs] = await Promise.all([
          api.categories(active.id),
          api.timeline(active.id),
          api.committee(active.id),
          api.announcements(active.id),
          api.faqs(active.id).catch((err) => {
            if (isNotFoundError(err)) return [];
            throw err;
          })
        ]);
        if (!alive) return;
        setEvent(active);
        setCategories(nextCategories ?? []);
        setTimeline(nextTimeline ?? []);
        setCommittee(nextCommittee ?? []);
        setAnnouncements(nextAnnouncements ?? []);
        setFaqs(nextFAQs ?? []);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Gagal memuat data dari server.");
      });
    return () => {
      alive = false;
    };
  }, []);

  const winnerAnnouncement = useMemo(
    () => (announcements ?? []).find((announcement) => announcement.type === "pemenang"),
    [announcements]
  );
  const eventName = event?.name ?? "Point Project";

  return (
    <>
      <section className="relative isolate overflow-hidden bg-ink text-white">
        <img
          src="/point-project-hero.png"
          alt={`Ilustrasi kompetisi UI/UX ${eventName}`}
          className="absolute inset-0 h-full w-full object-cover opacity-[0.58]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,24,39,0.96)_0%,rgba(16,24,39,0.78)_42%,rgba(16,24,39,0.18)_100%)]" />
        <div className="relative mx-auto grid min-h-[82vh] max-w-7xl content-center px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <StatusPill tone="amber">Kompetisi UI/UX Nasional</StatusPill>
            <h1 className="mt-6 text-5xl font-black leading-tight sm:text-6xl lg:text-7xl">
              {eventName}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/84">
              {event?.theme ?? "Data event sedang dimuat dari database."}
            </p>
            {error ? <p className="mt-4 rounded-md bg-coral/90 px-4 py-3 text-sm font-bold text-white">{error}</p> : null}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/daftar" className="btn-primary bg-mint text-ink hover:bg-emerald-300">
                Daftar Sekarang
                <ArrowRight size={18} />
              </Link>
              <Link to="/pengumuman" className="btn-secondary border-white/30 bg-white/10 text-white hover:bg-white hover:text-ink">
                Lihat Pengumuman
              </Link>
            </div>
            <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
              {[
                ["2 Kategori", "Siswa dan mahasiswa"],
                ["Multi-tahun", "Arsip per periode"],
                ["End-to-end", "Daftar sampai awarding"]
              ].map(([value, label]) => (
                <div key={value} className="border-l-2 border-mint pl-4">
                  <p className="text-2xl font-black">{value}</p>
                  <p className="text-sm text-white/72">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-lagoon">Tentang Kegiatan</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">Satu platform untuk seluruh siklus kompetisi.</h2>
            <p className="mt-4 text-base leading-7 text-ink/68">
              {eventName} menyatukan informasi, registrasi tim, submission karya, verifikasi panitia,
              pengumuman finalis, pemenang, dan arsip historis per tahun penyelenggaraan.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: UsersRound, label: "Peserta", text: "Dashboard tim, status verifikasi, dan upload karya." },
              { icon: CalendarCheck, label: "Panitia", text: "Kelola periode, jadwal, kategori, dan pengumuman." },
              { icon: Trophy, label: "Publik", text: "Akses pengumuman finalis, pemenang, dan galeri karya." },
              { icon: CheckCircle2, label: "Arsip", text: "Data tidak tertimpa saat Point Project berikutnya berjalan." }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="card">
                  <Icon className="text-lagoon" size={24} />
                  <h3 className="mt-4 font-black">{item.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink/65">{item.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Timeline"
            title={`Jadwal ${eventName}`}
            body="Tahapan disusun agar peserta dapat mengikuti proses pendaftaran, pengumpulan karya, seleksi, dan final dengan jelas."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-5">
            {timeline.map((item) => (
              <article key={item.id} className="relative rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
                <span className="grid h-9 w-9 place-items-center rounded-md bg-lagoon text-sm font-black text-white">
                  {item.sortOrder}
                </span>
                <h3 className="mt-4 text-base font-black">{item.label}</h3>
                <p className="mt-2 text-xs font-bold text-coral">
                  {item.startDate} - {item.endDate}
                </p>
                <p className="mt-3 text-sm leading-6 text-ink/65">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Kategori"
            title="Dua jalur kompetisi, satu panggung nasional"
            body="Peserta memilih kategori sesuai jenjang pendidikan. Setiap kategori terhubung ke periode event agar arsip tetap rapi."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {categories.map((category) => (
              <article key={category.id} className="rounded-lg border border-ink/10 bg-cloud p-6 shadow-soft">
                <div className="flex items-center gap-3">
                  {category.name.toLowerCase().includes("siswa") ? (
                    <GraduationCap className="text-coral" size={28} />
                  ) : (
                    <Landmark className="text-lagoon" size={28} />
                  )}
                  <h3 className="text-2xl font-black">{category.name}</h3>
                </div>
                <p className="mt-4 text-sm leading-6 text-ink/65">{category.description}</p>
                <ul className="mt-5 space-y-3">
                  {category.requirements.map((requirement) => (
                    <li key={requirement} className="flex gap-3 text-sm leading-6 text-ink/70">
                      <CheckCircle2 className="mt-0.5 shrink-0 text-lagoon" size={18} />
                      {requirement}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-lagoon">Kepanitiaan</p>
            <h2 className="mt-3 text-3xl font-black">Struktur operasional per periode</h2>
            <p className="mt-4 text-base leading-7 text-ink/65">
              Data kepanitiaan disimpan per event, sehingga struktur panitia periode berikutnya dapat
              ditambah tanpa menghapus rekam jejak sebelumnya.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {committee.map((member) => (
              <article key={member.id} className="card">
                <StatusPill tone="teal">{member.division}</StatusPill>
                <h3 className="mt-4 font-black">{member.name}</h3>
                <p className="mt-2 text-sm leading-6 text-ink/65">{member.position}</p>
                <p className="mt-4 text-xs font-bold text-ink/45">{member.identity}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink py-16 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <StatusPill tone="amber">Pengumuman</StatusPill>
            <h2 className="mt-4 text-3xl font-black sm:text-4xl">Finalis dan pemenang tampil publik.</h2>
            <p className="mt-4 text-base leading-7 text-white/70">
              Hasil kompetisi dapat difilter berdasarkan periode Point Project, lengkap dengan kategori dan galeri karya.
            </p>
            <Link to="/pengumuman" className="mt-6 inline-flex items-center gap-2 text-sm font-black text-mint">
              Buka Arsip Pengumuman
              <ExternalLink size={16} />
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {(winnerAnnouncement?.results ?? []).slice(0, 3).map((result) => (
              <article key={`${result.rank}-${result.teamName}`} className="rounded-lg bg-white p-5 text-ink">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-sun text-sm font-black">
                  #{result.rank}
                </span>
                <h3 className="mt-4 text-lg font-black">{result.teamName}</h3>
                <p className="mt-2 text-sm text-ink/65">{result.workTitle}</p>
                <p className="mt-4 text-xs font-bold uppercase tracking-wide text-lagoon">{result.categoryName}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.75fr_1.25fr] lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
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
                <article key={item.title} className="rounded-lg border border-ink/10 bg-cloud p-6">
                  <Icon className="text-lagoon" size={24} />
                  <h3 className="mt-4 font-black">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink/65">{item.text}</p>
                </article>
              );
            })}
          </div>
          <div>
            <SectionHeading
              eyebrow="FAQ"
              title="Aturan dan Pertanyaan Umum"
              body="Daftar ini dikelola langsung oleh admin atau panitia untuk event aktif."
            />
            <div className="mt-8 grid gap-4">
              {faqs.map((faq) => (
                <article key={faq.id} className="rounded-lg border border-ink/10 bg-cloud p-5">
                  <h3 className="font-black">{faq.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink/65">{faq.answer}</p>
                </article>
              ))}
              {!faqs.length ? (
                <article className="rounded-lg border border-dashed border-ink/20 p-6 text-center">
                  <h3 className="font-black">FAQ belum tersedia.</h3>
                  <p className="mt-2 text-sm text-ink/60">Panitia akan memperbarui aturan melalui admin panel.</p>
                </article>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
