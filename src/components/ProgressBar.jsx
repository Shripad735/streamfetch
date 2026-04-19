import { cn } from "../lib/cn";

function ProgressBar({ value, label }) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <section className="flex w-full flex-col gap-2">
      {label && <div className="text-xs font-medium text-app-muted">{label}</div>}
      <div className="h-2 w-full overflow-hidden rounded-full bg-app-subtleBg">
        <div
          className={cn("h-full rounded-full bg-app-accent transition-[width] duration-300 ease-out")}
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </section>
  );
}

export default ProgressBar;
