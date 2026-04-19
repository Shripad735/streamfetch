import Card from "../ui/Card";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import ScrollArea from "../ui/ScrollArea";
import DownloadCard from "../DownloadCard";
import LogPanel from "../LogPanel";

function QueueView({
  jobs,
  activeJobs,
  selectedJob,
  selectedJobId,
  setSelectedJobId,
  onPause,
  onResume,
  onCancel,
  onClearFinished
}) {
  const queuedJobs = activeJobs.filter((job) => job.status === "queued");
  const inProgressJobs = activeJobs.filter((job) => ["downloading", "retrying", "paused"].includes(job.status));
  const finishedJobs = jobs.filter((job) => ["completed", "failed", "canceled"].includes(job.status)).slice(0, 12);

  return (
    <div className="grid h-full min-h-0 gap-4 p-4 md:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.35fr)] md:p-6">
      <Card className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-app-border px-4 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-app-text">Queue overview</h2>
            <p className="mt-1 text-sm text-app-muted">Watch active jobs, intervene quickly, and keep logs close.</p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClearFinished}>
            Clear finished
          </Button>
        </div>

        <ScrollArea className="min-h-0 flex-1 px-4 py-4">
          <div className="space-y-6">
            <section>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-semibold text-app-text">In progress</h3>
                <Badge variant="info">{inProgressJobs.length}</Badge>
              </div>
              <div className="space-y-3">
                {inProgressJobs.length === 0 && <p className="text-sm text-app-muted">No active downloads right now.</p>}
                {inProgressJobs.map((job) => (
                  <DownloadCard
                    key={job.id}
                    job={job}
                    selected={selectedJobId === job.id}
                    onSelect={setSelectedJobId}
                    onPause={onPause}
                    onResume={onResume}
                    onCancel={onCancel}
                  />
                ))}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-semibold text-app-text">Queued next</h3>
                <Badge variant="muted">{queuedJobs.length}</Badge>
              </div>
              <div className="space-y-3">
                {queuedJobs.length === 0 && <p className="text-sm text-app-muted">No queued items waiting behind the current run.</p>}
                {queuedJobs.map((job) => (
                  <DownloadCard
                    key={job.id}
                    job={job}
                    selected={selectedJobId === job.id}
                    onSelect={setSelectedJobId}
                    onPause={onPause}
                    onResume={onResume}
                    onCancel={onCancel}
                  />
                ))}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-semibold text-app-text">Recently finished</h3>
                <Badge variant="muted">{finishedJobs.length}</Badge>
              </div>
              <div className="space-y-2">
                {finishedJobs.length === 0 && <p className="text-sm text-app-muted">Nothing has finished in this session yet.</p>}
                {finishedJobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => setSelectedJobId(job.id)}
                    className="flex w-full items-center justify-between rounded-2xl border border-app-border bg-app-bg px-3 py-3 text-left transition-colors duration-200 hover:bg-app-cardMuted"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-app-text">{job.title || "Untitled"}</p>
                      <p className="mt-1 text-xs text-app-muted">{job.outputFolder}</p>
                    </div>
                    <Badge variant={job.status === "completed" ? "success" : job.status === "failed" ? "error" : "muted"}>
                      {job.status}
                    </Badge>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </ScrollArea>
      </Card>

      <div className="grid min-h-0 gap-4">
        <Card className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-muted">Selected job</p>
              <h2 className="mt-2 line-clamp-2 font-display text-xl font-semibold text-app-text">
                {selectedJob?.title || "Pick a job to inspect"}
              </h2>
              <p className="mt-2 text-sm text-app-muted">
                {selectedJob
                  ? `Output folder: ${selectedJob.outputFolder}`
                  : "Logs, speed, and recovery controls appear here once you select a queue item."}
              </p>
            </div>
            {selectedJob && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="info">{selectedJob.progress ? `${Number(selectedJob.progress).toFixed(1)}%` : "0.0%"}</Badge>
                <Badge variant="muted">{selectedJob.speed || "--"}</Badge>
                <Badge variant="muted">ETA {selectedJob.eta || "--:--"}</Badge>
              </div>
            )}
          </div>
        </Card>

        <LogPanel title={selectedJob ? `Logs | ${selectedJob.title}` : "Logs"} lines={selectedJob?.logs || []} />
      </div>
    </div>
  );
}

export default QueueView;
