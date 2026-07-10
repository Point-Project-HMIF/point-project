import { Link, NavLink, useLocation } from "react-router-dom";
import { CalendarDays, Home, LayoutDashboard, Megaphone, Menu, ShieldCheck, UserPlus, X } from "lucide-react";
import clsx from "clsx";
import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { ToastViewport } from "./ToastViewport";
import { api } from "../lib/api";
import type { Event } from "../lib/types";

// menu navigasi utama — pake lucide-react icon biar gak butuh gambar
const navItems = [
  { to: "/", label: "Beranda", icon: Home },
  { to: "/daftar", label: "Pendaftaran", icon: UserPlus },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pengumuman", label: "Pengumuman", icon: Megaphone },
  { to: "/admin", label: "Admin", icon: ShieldCheck }
];

export function Layout({ children }: { children: ReactNode }) {
  const [event, setEvent] = useState<Event | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  usePageMotion(location.pathname);

  useEffect(() => {
    // fetch event aktif pas mount, biar footer & header bisa nampilin info event
    let alive = true;
    const loadActiveEvent = () => {
      api
        .activeEvent()
        .then((active) => {
          if (alive) setEvent(active);
        })
        .catch(() => undefined);
    };
    loadActiveEvent();
    window.addEventListener("pointproject:event-changed", loadActiveEvent);
    return () => {
      alive = false;
      window.removeEventListener("pointproject:event-changed", loadActiveEvent);
    };
  }, []);

  return (
    <div className="site-shell flex min-h-screen flex-col bg-light text-dark">
      <SiteOrnaments />
      <header className="site-header sticky top-0 z-40 border-b border-dark/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-sm font-black text-white">PP</span>
            <span>
              <span className="block text-sm font-black uppercase tracking-wide text-dark">Point Project</span>
              <span className="block text-xs font-bold text-primary">HMIF ITERA</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    clsx(
                      "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition",
                      isActive ? "bg-primary text-white" : "text-dark/72 hover:bg-primary/10 hover:text-primary"
                    )
                  }
                >
                  <Icon size={16} />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-md border border-dark/10 text-dark transition hover:bg-light md:hidden"
            onClick={() => setMobileOpen((current) => !current)}
            aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {mobileOpen ? (
          <div className="border-t border-dark/10 bg-white md:hidden">
            <nav className="mx-auto grid max-w-7xl gap-1 px-4 py-3 sm:px-6">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      clsx(
                        "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-black transition",
                        isActive ? "bg-primary text-white" : "text-dark/70 hover:bg-light hover:text-primary"
                      )
                    }
                  >
                    <Icon className="shrink-0" size={18} />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        ) : null}
      </header>
      <main key={location.pathname} className="relative z-10 flex-1 page-transition">
        {children}
      </main>
      <footer className="site-footer relative z-10 border-t border-dark/10 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
          <div>
            <p className="text-lg font-black">{event?.name ?? "Point Project"}</p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-dark/65">
              Kanal resmi informasi, pendaftaran, submission, pengumuman, dan arsip kompetisi UI/UX Design HMIF ITERA.
            </p>
          </div>
          <div>
            <p className="text-sm font-black">Kontak</p>
            <p className="mt-2 text-sm text-dark/65">pointproject@hmifitera.id</p>
            <p className="text-sm text-dark/65">@pointproject.hmif</p>
          </div>
          <div>
            <p className="text-sm font-black">Periode</p>
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-dark/65">
              <CalendarDays size={16} />
              {event ? formatEventPeriod(event) : "Periode event aktif"}
            </p>
          </div>
        </div>
      </footer>
      <ToastViewport />
    </div>
  );
}

function SiteOrnaments() {
  return (
    <div className="site-ornaments" aria-hidden="true">
      <span className="site-ornament site-ornament-grid" />
      <span className="site-ornament site-ornament-square" />
      <span className="site-ornament site-ornament-triangle" />
      <span className="site-ornament site-ornament-corner" />
      <span className="site-ornament site-ornament-steps" />
    </div>
  );
}

function usePageMotion(pathname: string) {
  useLayoutEffect(() => {
    document.documentElement.classList.add("motion-ready");
    return () => {
      document.documentElement.classList.remove("motion-ready");
    };
  }, []);

  useEffect(() => {
    const selector = "[data-scroll-pop]";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let observer: IntersectionObserver | null = null;
    let mutationObserver: MutationObserver | null = null;

    const revealAll = () => {
      document.querySelectorAll<HTMLElement>(selector).forEach((node) => {
        node.classList.add("is-visible");
      });
    };

    const prepareNodes = () => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(
        (node) => !node.classList.contains("is-visible")
      );

      nodes.forEach((node, index) => {
        node.style.setProperty("--pop-delay", `${Math.min(index * 42, 180)}ms`);
        if (observer) {
          observer.observe(node);
        } else {
          node.classList.add("is-visible");
        }
      });
    };

    const schedulePrepare = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(prepareNodes);
    };

    if (reduceMotion || !("IntersectionObserver" in window)) {
      frame = window.requestAnimationFrame(revealAll);
      return () => window.cancelAnimationFrame(frame);
    }

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer?.unobserve(entry.target);
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -4% 0px" }
    );

    schedulePrepare();
    mutationObserver = new MutationObserver(schedulePrepare);
    mutationObserver.observe(document.querySelector("main") ?? document.body, {
      childList: true,
      subtree: true
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [pathname]);
}

function formatEventPeriod(event: Event) {
  if (!event.startDate || !event.endDate) return String(event.year);
  return `${formatShortDate(event.startDate)} - ${formatShortDate(event.endDate)} ${event.year}`;
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function SectionHeading({
  eyebrow,
  title,
  body
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-black sm:text-4xl">{title}</h2>
      {body ? <p className="mt-4 text-base leading-7 text-dark/65">{body}</p> : null}
    </div>
  );
}

// badge status kecil — dipake di banyak tempat
export function StatusPill({ children, tone = "teal" }: { children: ReactNode; tone?: "teal" | "amber" | "orange" | "dark" }) {
  return (
    <span
      className={clsx(
        "inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide",
        tone === "teal" && "bg-primary/10 text-primary",
        tone === "amber" && "bg-yellow/20 text-amber-800",
        tone === "orange" && "bg-orange/10 text-orange",
        tone === "dark" && "bg-dark text-white"
      )}
    >
      {children}
    </span>
  );
}
