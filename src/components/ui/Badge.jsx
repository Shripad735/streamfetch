import { cn } from "../../lib/cn";

const VARIANT_CLASSES = {
  info: "border-app-infoBorder bg-app-infoBg text-app-infoText",
  success: "border-app-successBorder bg-app-successBg text-app-successText",
  warning: "border-app-warningBorder bg-app-warningBg text-app-warningText",
  error: "border-app-dangerBorder bg-app-dangerBg text-app-dangerText",
  muted: "border-app-subtleBorder bg-app-subtleBg text-app-muted"
};

function Badge({ variant = "muted", className, children }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium leading-none",
        VARIANT_CLASSES[variant] || VARIANT_CLASSES.muted,
        className
      )}
    >
      {children}
    </span>
  );
}

export default Badge;
