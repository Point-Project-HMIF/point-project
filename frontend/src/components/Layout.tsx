import { Link, NavLink } from "react-router-dom";
import { CalendarDays, LayoutDashboard, Megaphone, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import clsx from "clsx";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import type { Event } from "../lib/types";

const navItems = [
  { to: "/", label: "Beranda", icon: Sparkles },
  { to: "/daftar", label: "Pendaftaran", icon: UserPlus },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pengumuman", label: "Pengumuman", icon: Megaphone },
  { to: "/admin", label: "Admin", icon: ShieldCheck }
];

export function Layout({ children }: { children: ReactNode }) {
  const [event, setEvent] = useState<Event | null>(null);

  useEffect(() => {
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
    <div className="min-h-screen bg-cloud text-ink">
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-white/92 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-ink text-sm font-black text-white">PP</span>
            <span>
              <span className="block text-sm font-black uppercase tracking-wide">Point Project</span>
              <span className="block text-xs text-ink/60">HMIF ITERA</span>
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
                      isActive ? "bg-ink text-white" : "text-ink/72 hover:bg-ink/5 hover:text-ink"
                    )
                  }
                >
                  <Icon size={16} />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
        <nav className="grid grid-cols-5 border-t border-ink/10 bg-white md:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx("grid place-items-center gap-1 px-1 py-2 text-[11px]", isActive ? "text-lagoon" : "text-ink/60")
                }
              >
                <Icon size={17} />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </header>
      <main>{children}</main>
      <footer className="border-t border-ink/10 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
          <div>
            <p className="text-lg font-black">{event?.name ?? "Point Project"}</p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-ink/65">
              Kanal resmi informasi, pendaftaran, submission, pengumuman, dan arsip kompetisi UI/UX Design HMIF ITERA.
            </p>
          </div>
          <div>
            <p className="text-sm font-black">Kontak</p>
            <p className="mt-2 text-sm text-ink/65">pointproject@hmifitera.id</p>
            <p className="text-sm text-ink/65">@pointproject.hmif</p>
          </div>
          <div>
            <p className="text-sm font-black">Periode</p>
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-ink/65">
              <CalendarDays size={16} />
              {event ? formatEventPeriod(event) : "Periode event aktif"}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
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
      <p className="text-xs font-black uppercase tracking-[0.18em] text-lagoon">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-black sm:text-4xl">{title}</h2>
      {body ? <p className="mt-4 text-base leading-7 text-ink/65">{body}</p> : null}
    </div>
  );
}

export function StatusPill({ children, tone = "teal" }: { children: ReactNode; tone?: "teal" | "amber" | "coral" | "ink" }) {
  return (
    <span
      className={clsx(
        "inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide",
        tone === "teal" && "bg-lagoon/10 text-lagoon",
        tone === "amber" && "bg-sun/20 text-amber-800",
        tone === "coral" && "bg-coral/10 text-coral",
        tone === "ink" && "bg-ink text-white"
      )}
    >
      {children}
    </span>
  );
}
