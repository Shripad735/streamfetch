import { cn } from "../../lib/cn";

function Input({ as = "input", label, className, inputClassName, children, ...props }) {
  const Comp = as;
  const isSelect = as === "select";

  return (
    <label className={cn("flex flex-col gap-2", className)}>
      {label && <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-muted">{label}</span>}
      <Comp
        className={cn(
          "h-12 w-full rounded-[22px] border border-app-border/60 bg-app-card/72 px-4 text-[15px] text-app-text outline-none transition-all duration-200 ease-out placeholder:text-app-muted focus:border-app-accent/45 focus:ring-2 focus:ring-app-accent/12",
          isSelect && "pr-8",
          inputClassName
        )}
        {...props}
      >
        {children}
      </Comp>
    </label>
  );
}

export default Input;
