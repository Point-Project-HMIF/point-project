import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { CalendarDays, ChevronUp, Home, LayoutDashboard, Megaphone, ShieldCheck, UserPlus, X } from "lucide-react";
import clsx from "clsx";
import { useEffect, useLayoutEffect, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { ToastViewport } from "./ToastViewport";
import { api } from "../lib/api";
import type { Event } from "../lib/types";

// menu navigasi utama — pake lucide-react icon biar gak butuh gambar
const navItems = [
  { to: "/", label: "Beranda", icon: Home },
  { to: "/admin", label: "Admin", icon: ShieldCheck },
  { to: "/daftar", label: "Pendaftaran", icon: UserPlus },
  { to: "/pengumuman", label: "Pengumuman", icon: Megaphone },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }
];

const radialStartAngle = -90;
const radialItemStep = 360 / navItems.length;
const radialItemRadius = 34;

function getRadialItemAngle(index: number) {
  return radialStartAngle + index * radialItemStep;
}

function getRadialSectorAngle(index: number) {
  return getRadialItemAngle(index) + 90 - radialItemStep / 2;
}

function getNearestRadialIndex(angle: number) {
  return navItems.reduce(
    (nearest, _item, index) => {
      const diff = Math.abs(normalizeAngle(angle - getRadialItemAngle(index)));
      return diff < nearest.diff ? { index, diff } : nearest;
    },
    { index: 0, diff: Number.POSITIVE_INFINITY }
  ).index;
}

function normalizeAngle(angle: number) {
  return ((angle + 180) % 360 + 360) % 360 - 180;
}

export function Layout({ children }: { children: ReactNode }) {
  const [event, setEvent] = useState<Event | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [headerDark, setHeaderDark] = useState(false);
  const location = useLocation();

  usePageMotion(location.pathname);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = navOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  useEffect(() => {
    let frame = 0;
    const updateHeaderTheme = () => {
      if (location.pathname !== "/") {
        setHeaderDark(false);
        return;
      }

      const target = document.getElementById("rubik-scroll-area");
      if (!target) {
        setHeaderDark(false);
        return;
      }

      const rect = target.getBoundingClientRect();
      const travel = Math.max(1, rect.height - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / travel));
      setHeaderDark(progress >= 0.24 && progress < 0.985);
    };
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateHeaderTheme);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [location.pathname]);

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
    <div className="site-shell flex min-h-screen flex-col text-dark">
      <SiteOrnaments />
      <button
        type="button"
        className={clsx("nav-arc-trigger", !headerDark && "is-light")}
        onClick={() => setNavOpen(true)}
        aria-label="Buka menu navigasi"
        aria-expanded={navOpen}
      >
        <ChevronUp size={24} strokeWidth={2.4} />
      </button>
      <RadialNavOverlay open={navOpen} pathname={location.pathname} onClose={() => setNavOpen(false)} />
      <main key={location.pathname} className="relative z-10 flex-1 page-transition">
        {children}
      </main>
      <footer className="site-footer relative z-10 border-t border-dark/10 bg-white text-[#05070d]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
          <div>
            <p className="text-lg font-black">{event?.name ?? "Point Project"}</p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-dark/58">
              Kanal resmi informasi, pendaftaran, submission, pengumuman, dan arsip kompetisi UI/UX Design HMIF ITERA.
            </p>
          </div>
          <div>
            <p className="text-sm font-black">Kontak</p>
            <p className="mt-2 text-sm text-dark/58">pointproject@hmifitera.id</p>
            <p className="text-sm text-dark/58">@pointproject.hmif</p>
          </div>
          <div>
            <p className="text-sm font-black">Periode</p>
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-dark/58">
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

function RadialNavOverlay({ open, pathname, onClose }: { open: boolean; pathname: string; onClose: () => void }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const navigate = useNavigate();
  const activeIndex = Math.max(
    0,
    navItems.findIndex((item) => (item.to === "/" ? pathname === "/" : pathname.startsWith(item.to)))
  );
  const hoveredSectorAngle = hoveredIndex === null ? null : getRadialSectorAngle(hoveredIndex);
  const [sectorAngle, setSectorAngle] = useState(getRadialSectorAngle(0));

  useEffect(() => {
    if (hoveredSectorAngle === null) return;
    setSectorAngle((currentAngle) => currentAngle + normalizeAngle(hoveredSectorAngle - currentAngle));
  }, [hoveredSectorAngle]);

  const getPanelIndexFromPointer = (event: ReactMouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < rect.width * 0.14) return null;

    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    return getNearestRadialIndex(angle);
  };
  const handlePanelPointerMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    const nextIndex = getPanelIndexFromPointer(event);
    if (nextIndex === null) {
      setHoveredIndex(null);
      return;
    }
    setHoveredIndex((current) => (current === nextIndex ? current : nextIndex));
  };
  const handlePanelClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest("a.radial-menu-item")) return;
    const nextIndex = getPanelIndexFromPointer(event);
    if (nextIndex === null) return;
    navigate(navItems[nextIndex].to);
    onClose();
  };

  return (
    <div className={clsx("radial-nav-overlay", open && "is-open")} aria-hidden={!open}>
      <span className="radial-checker-bg" aria-hidden="true" />
      <span className="radial-radar-rings" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <button type="button" className="radial-close" onClick={onClose} aria-label="Tutup menu">
        <X size={34} strokeWidth={1.3} />
      </button>
      <div className="radial-social" aria-hidden="true">
        <span>in</span>
        <span>yt</span>
        <span>x</span>
      </div>
      <div
        className={clsx("radial-menu-panel", hoveredIndex !== null && "has-hover")}
        role="navigation"
        aria-label="Menu utama"
        onMouseMove={handlePanelPointerMove}
        onClick={handlePanelClick}
        onMouseLeave={() => setHoveredIndex(null)}
        style={{ "--sector-from": `${sectorAngle}deg` } as CSSProperties}
      >
        <span className="radial-sector-highlight" aria-hidden="true" />
        <span className="radial-sector-guides" aria-hidden="true" />
        <div className="radial-center">
          <span className="radial-center-mark">PP</span>
        </div>
        <nav className="radial-menu-items">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const angle = getRadialItemAngle(index);
            const radians = (angle * Math.PI) / 180;
            const itemX = 50 + Math.cos(radians) * radialItemRadius;
            const itemY = 50 + Math.sin(radians) * radialItemRadius;
            const itemStyle = {
              "--item-x": `${itemX}%`,
              "--item-y": `${itemY}%`,
              "--menu-delay": `${130 + index * 58}ms`
            } as CSSProperties;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                onMouseEnter={() => setHoveredIndex(index)}
                onFocus={() => setHoveredIndex(index)}
                onBlur={() => setHoveredIndex(null)}
                className={({ isActive }) =>
                  clsx("radial-menu-item", isActive && "is-active", hoveredIndex === index && "is-focus-sector")
                }
                style={itemStyle}
              >
                <Icon size={34} strokeWidth={2.6} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
      <p className="radial-copyright">POINT PROJECT / HMIF ITERA</p>
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
