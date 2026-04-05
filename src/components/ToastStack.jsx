import { cn } from "../lib/cn";

function ToastStack({ toasts, onDismiss }) {
  return (
    <section className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <article
          key={toast.id}
          className={cn(
            "pointer-events-auto flex items-start justify-between gap-3 rounded-2xl border bg-app-card p-3 shadow-card",
            toast.type === "error" && "border-app-dangerBorder",
            toast.type === "success" && "border-app-successBorder",
            toast.type !== "error" && toast.type !== "success" && "border-app-border"
          )}
        >
          <div className="min-w-0 flex-1">
            <h4 className="font-display text-sm font-semibold text-app-text">{toast.title}</h4>
            <p className="mt-1 text-xs text-app-muted">{toast.message}</p>
            {toast.actionLabel && typeof toast.onAction === "function" && (
              <button
                className="mt-3 inline-flex h-8 items-center justify-center rounded-xl border border-app-accent/20 bg-app-panel px-3 text-xs font-semibold text-app-text transition-colors duration-200 hover:border-app-accent/40 hover:text-app-accent"
                onClick={() => toast.onAction()}
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
          <button
            className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-app-border bg-app-bg text-xs text-app-muted transition-colors duration-200 hover:border-app-accent/40 hover:text-app-accent"
            onClick={() => onDismiss(toast.id)}
          >
            X
          </button>
        </article>
      ))}
    </section>
  );
}

export default ToastStack;
