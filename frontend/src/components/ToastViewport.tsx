import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import clsx from "clsx";
import { toastEventName, type ToastPayload, type ToastType } from "../lib/toast";

type ToastItem = {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration: number;
};

const iconMap = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info
};

export function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    function handleToast(event: Event) {
      const payload = (event as CustomEvent<ToastPayload>).detail;
      if (!payload?.message?.trim()) return;

      const type = payload.type ?? "info";
      const item: ToastItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type,
        title: payload.title ?? defaultTitle(type),
        message: payload.message,
        duration: payload.duration ?? 4600
      };

      setItems((current) => [...current.slice(-3), item]);
      const timer = window.setTimeout(() => {
        setItems((current) => current.filter((toast) => toast.id !== item.id));
      }, item.duration);
      timers.current.push(timer);
    }

    window.addEventListener(toastEventName, handleToast);
    return () => {
      window.removeEventListener(toastEventName, handleToast);
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current = [];
    };
  }, []);

  if (!items.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-[70] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 sm:bottom-5 sm:left-5">
      {items.map((item) => {
        const Icon = iconMap[item.type];
        return (
          <article
            key={item.id}
            role="status"
            aria-live="polite"
            className={clsx(
              "pointer-events-auto flex gap-3 border bg-[#080d16]/95 p-4 text-white shadow-[0_22px_80px_rgba(0,0,0,0.38)] backdrop-blur",
              item.type === "success" && "border-cyan-300/25",
              item.type === "error" && "border-orange/35",
              item.type === "info" && "border-white/12"
            )}
          >
            <span
              className={clsx(
                "mt-0.5 grid h-8 w-8 shrink-0 place-items-center border",
                item.type === "success" && "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
                item.type === "error" && "border-orange/30 bg-orange/10 text-orange",
                item.type === "info" && "border-white/12 bg-white/8 text-white"
              )}
            >
              <Icon size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black">{item.title}</p>
              <p className="mt-1 break-words text-sm leading-5 text-white/62">{item.message}</p>
            </div>
            <button
              type="button"
              className="grid h-7 w-7 shrink-0 place-items-center text-white/45 transition hover:bg-white hover:text-[#05070d]"
              onClick={() => setItems((current) => current.filter((toast) => toast.id !== item.id))}
              aria-label="Tutup notifikasi"
            >
              <X size={16} />
            </button>
          </article>
        );
      })}
    </div>
  );
}

function defaultTitle(type: ToastType) {
  if (type === "success") return "Berhasil";
  if (type === "error") return "Gagal";
  return "Info";
}
