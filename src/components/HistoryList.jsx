import Badge from "./ui/Badge";
import Button from "./ui/Button";
import Card from "./ui/Card";

function HistoryList({ entries, onClear, onSelect }) {
  return (
    <Card as="section" className="flex min-h-0 min-w-0 flex-col p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-semibold text-app-text">History</h3>
        <Button size="sm" variant="ghost" onClick={onClear} disabled={entries.length === 0}>
          Clear
        </Button>
      </div>

      <div className="min-h-0 space-y-2 overflow-auto pr-1 [scrollbar-color:#CBD5E1_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/70">
        {entries.length === 0 && <p className="text-sm text-app-muted">No completed downloads yet.</p>}
        {entries.map((item) => (
          <article
            key={item.id}
            className="cursor-pointer rounded-2xl border border-app-border bg-app-bg p-3 transition-all duration-200 ease-out hover:border-app-accent/35 hover:bg-app-card"
            onClick={() => onSelect(item.id)}
          >
            <div className="mb-1 flex items-start justify-between gap-2">
              <h4 className="line-clamp-1 font-display text-sm font-semibold text-app-text">{item.title}</h4>
              {Number(item.concurrentFragments || 1) > 1 && <Badge variant="warning">Turbo x{item.concurrentFragments}</Badge>}
            </div>
            <p className="text-xs text-app-muted">
              {(item.mode || "").toUpperCase()} | {new Date(item.updatedAt || item.createdAt || Date.now()).toLocaleString()}
            </p>
            <p className="mt-1 line-clamp-1 text-xs text-app-muted">{item.outputFolder}</p>
          </article>
        ))}
      </div>
    </Card>
  );
}

export default HistoryList;
