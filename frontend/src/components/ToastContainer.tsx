import { createPortal } from "react-dom";
import type { Toast } from "../hooks/useToast";

const toneClasses: Record<NonNullable<Toast["tone"]>, string> = {
  success: "border-zinc-800 bg-zinc-950 text-white dark:border-white/10 dark:bg-black dark:text-white",
  error: "border-zinc-800 bg-zinc-950 text-white dark:border-white/10 dark:bg-black dark:text-white",
  info: "border-zinc-800 bg-zinc-950 text-white dark:border-white/10 dark:bg-black dark:text-white",
};

export const ToastContainer = ({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) => {
  if (toasts.length === 0) {
    return null;
  }

  const content = (
    <div
      aria-atomic="true"
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-4 z-[80] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3"
    >
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => onDismiss(toast.id)}
          className={`pointer-events-auto rounded-2xl border px-4 py-3 text-left shadow-panel transition hover:-translate-y-0.5 ${toneClasses[toast.tone ?? "info"]}`}
        >
          <p className="text-sm font-semibold">{toast.title}</p>
          <p className="mt-1 text-xs text-zinc-200 dark:text-zinc-400">Tap to dismiss</p>
        </button>
      ))}
    </div>
  );

  if (typeof document === "undefined") {
    return content;
  }

  return createPortal(content, document.body);
};
