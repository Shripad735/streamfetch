import { useMemo } from "react";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import ScrollArea from "../ui/ScrollArea";
import HistoryList from "../HistoryList";

function HistoryView({ historyJobs, historyQuery, setHistoryQuery, onClear, onSelect, selectedJobId }) {
  const filteredHistory = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    if (!query) return historyJobs;
    return historyJobs.filter((job) => {
      const haystack = [job.title, job.outputFolder, job.mode, job.status].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [historyJobs, historyQuery]);

  return (
    <div className="grid h-full min-h-0 gap-4 p-4 md:grid-cols-[360px_minmax(0,1fr)] md:p-6">
      <Card className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-muted">Archive</p>
        <h2 className="mt-2 font-display text-xl font-semibold text-app-text">Past downloads</h2>
        <p className="mt-2 text-sm text-app-muted">
          Search finished jobs, failed attempts, and canceled work without leaving the app.
        </p>

        <div className="mt-5">
          <Input
            label="Search history"
            value={historyQuery}
            onChange={(event) => setHistoryQuery(event.target.value)}
            placeholder="Search title, folder, mode, or status..."
          />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Badge variant="muted">{filteredHistory.length} visible</Badge>
          <Badge variant="success">{historyJobs.filter((job) => job.status === "completed").length} completed</Badge>
          <Badge variant="error">{historyJobs.filter((job) => job.status === "failed").length} failed</Badge>
        </div>

        <Button className="mt-5 w-full" variant="ghost" onClick={onClear}>
          Clear finished items
        </Button>
      </Card>

      <Card className="flex min-h-0 flex-col p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-app-text">History browser</h3>
            <p className="text-sm text-app-muted">Click an item to focus it in the queue and inspect its logs.</p>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <HistoryList entries={filteredHistory} onClear={onClear} onSelect={onSelect} selectedJobId={selectedJobId} />
        </ScrollArea>
      </Card>
    </div>
  );
}

export default HistoryView;
