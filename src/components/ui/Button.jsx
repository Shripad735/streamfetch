import { cn } from "../../lib/cn";

const VARIANT_CLASSES = {
  primary:
    "border-transparent bg-gradient-to-r from-app-accentSoft to-app-accent text-white shadow-button hover:-translate-y-0.5 hover:shadow-buttonHover",
  secondary: "border-app-border/60 bg-app-card/80 text-app-text hover:border-app-accent/22 hover:bg-app-panel",
  ghost: "border-transparent bg-transparent text-app-text hover:bg-app-border/35",
  danger: "border-app-dangerBorder bg-app-dangerBg text-app-dangerText hover:border-app-dangerBorder hover:bg-app-dangerBgHover"
};

const SIZE_CLASSES = {
  sm: "h-9 rounded-[14px] px-3.5 text-xs font-semibold",
  md: "h-11 rounded-2xl px-4 text-sm font-medium",
  lg: "h-12 rounded-full px-6 text-sm font-semibold"
};

function Button({ type = "button", variant = "secondary", size = "md", className, children, ...props }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 border transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/18",
        VARIANT_CLASSES[variant] || VARIANT_CLASSES.secondary,
        SIZE_CLASSES[size] || SIZE_CLASSES.md,
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
