import { cn } from "../../lib/cn";

const VARIANT_CLASSES = {
  primary: "border-app-accent bg-app-accent text-white shadow-button hover:bg-app-accentStrong",
  secondary: "border-app-border bg-app-card text-app-text shadow-sm hover:border-app-borderStrong hover:bg-app-cardMuted",
  ghost: "border-transparent bg-transparent text-app-text hover:bg-app-cardMuted",
  danger: "border-app-dangerBorder bg-app-dangerBg text-app-dangerText hover:border-app-dangerBorder hover:bg-app-dangerBgHover"
};

const SIZE_CLASSES = {
  sm: "h-9 rounded-xl px-3.5 text-xs font-medium",
  md: "h-10 rounded-xl px-4 text-sm font-medium",
  lg: "h-11 rounded-xl px-5 text-sm font-semibold"
};

function Button({ type = "button", variant = "secondary", size = "md", className, children, ...props }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 border transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/20 focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg",
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
