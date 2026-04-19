import Card from "./ui/Card";
import ScrollArea from "./ui/ScrollArea";
import { cn } from "../lib/cn";

function LogPanel({ title, lines }) {
  return (
    <Card as="section" className="flex min-h-0 min-w-0 flex-col p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-semibold text-app-text">{title || "Status Logs"}</h3>
      </div>

      <ScrollArea className="min-h-[220px] min-w-0 rounded-2xl border border-app-border bg-app-bg p-3 font-mono text-xs leading-5 text-app-text">
        {lines.length === 0 ? (
          <p className="text-sm font-body text-app-muted">No logs yet.</p>
        ) : (
          lines.map((line, idx) => {
            const item = typeof line === "string" ? { id: `${idx}`, message: line, level: "info" } : line;
            return (
              <p
                key={item.id || `${idx}-${item.message}`}
                className={cn(
                  "mb-1 break-all text-app-text",
                  item.level === "error" && "text-app-dangerText",
                  item.level === "warn" && "text-app-warningText",
                  item.level === "info" && "text-app-text"
                )}
              >
                <span className="mr-2 text-app-muted">{item.at ? new Date(item.at).toLocaleTimeString() : "--:--:--"}</span>
                {item.message}
              </p>
            );
          })
        )}
      </ScrollArea>
    </Card>
  );
}

export default LogPanel;
