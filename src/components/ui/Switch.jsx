import { cn } from "../../lib/cn";

function Switch({ checked, onCheckedChange, className, disabled = false, ...props }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-8 w-[68px] items-center rounded-full border p-1 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-app-accent/40 bg-app-accent shadow-button" : "border-app-borderStrong bg-app-cardMuted",
        className
      )}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      <span
        className={cn(
          "pointer-events-none absolute text-[10px] font-semibold uppercase tracking-[0.16em]",
          checked ? "left-3 text-white/85" : "right-3 text-app-muted"
        )}
      >
        {checked ? "On" : "Off"}
      </span>
      <span
        className={cn(
          "relative z-[1] block h-6 w-6 rounded-full shadow-sm transition-transform duration-200",
          checked ? "translate-x-9 bg-white" : "translate-x-0 bg-app-text"
        )}
      />
    </button>
  );
}

export default Switch;
