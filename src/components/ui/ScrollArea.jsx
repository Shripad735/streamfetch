import { cn } from "../../lib/cn";

function ScrollArea({ className, children }) {
  return (
    <div
      className={cn(
        "overflow-auto [scrollbar-color:rgba(148,163,184,0.7)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400/60",
        className
      )}
    >
      {children}
    </div>
  );
}

export default ScrollArea;
