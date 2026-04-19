import { cn } from "../../lib/cn";

function Input({ as = "input", label, className, inputClassName, children, ...props }) {
  const Comp = as;
  const isSelect = as === "select";
  const isTextarea = as === "textarea";

  return (
    <label className={cn("flex flex-col gap-2", className)}>
      {label && <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-muted">{label}</span>}
      <Comp
        className={cn(
          "w-full rounded-xl border border-app-border bg-app-card px-3.5 text-[14px] text-app-text outline-none transition-all duration-200 ease-out placeholder:text-app-muted focus:border-app-accent/45 focus:ring-2 focus:ring-app-accent/12",
          isTextarea ? "min-h-[104px] py-3" : "h-10",
          isSelect && "pr-8",
          props.readOnly && "bg-app-cardMuted",
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
