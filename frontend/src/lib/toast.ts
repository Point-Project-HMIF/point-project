export type ToastType = "success" | "error" | "info";

export type ToastPayload = {
  type?: ToastType;
  title?: string;
  message: string;
  duration?: number;
};

export const toastEventName = "pointproject:toast";

export function notify(payload: ToastPayload) {
  if (typeof window === "undefined" || !payload.message.trim()) return;
  window.dispatchEvent(new CustomEvent<ToastPayload>(toastEventName, { detail: payload }));
}

export function toastSuccess(message: string, title = "Berhasil") {
  notify({ type: "success", title, message, duration: 4200 });
}

export function toastError(message: string, title = "Gagal") {
  notify({ type: "error", title, message, duration: 5600 });
}

export function toastInfo(message: string, title = "Info") {
  notify({ type: "info", title, message, duration: 4600 });
}
