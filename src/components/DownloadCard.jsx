import Badge from "./ui/Badge";
import Button from "./ui/Button";
import Card from "./ui/Card";
import ProgressBar from "./ProgressBar";
import { cn } from "../lib/cn";

function statusLabel(status) {
  switch (status) {
    case "downloading":
      return "Downloading";
    case "queued":
      return "Queued";
    case "paused":
      return "Paused";
    case "retrying":
      return "Retrying";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "canceled":
      return "Canceled";
    default:
      return "Idle";
  }
}

function DownloadCard({ job, selected, onSelect, onPause, onResume, onCancel }) {
  const progress = Math.max(0, Math.min(100, Number(job.progress || 0)));
  const status = job.status || "queued";
  const clipSummary =
    job.clipEnabled && job.clipStart && job.clipEnd ? ` | Clip ${job.clipStart} to ${job.clipEnd}` : "";
  const turboEnabled = Number(job.concurrentFragments || 1) > 1;
  const canPause = status === "downloading" || status === "queued";
  const canResume = status === "paused" || status === "failed" || status === "canceled";
  const canCancel = status === "downloading" || status === "queued" || status === "paused" || status === "retrying";
  const statusVariant =
    status === "completed"
      ? "success"
      : status === "downloading" || status === "retrying"
        ? "info"
        : status === "failed" || status === "canceled"
          ? "error"
          : "muted";

  return (
    <Card
      as="article"
      onClick={() => onSelect(job.id)}
      className={cn(
        "cursor-pointer p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-cardHover",
        selected && "border-app-accent/40 ring-2 ring-app-accent/20"
      )}
    >
      <header className="mb-2 flex items-start justify-between gap-3">
        <h4 className="line-clamp-2 font-display text-sm font-semibold text-app-text" title={job.title}>
          {job.title || "Untitled"}
        </h4>
        <Badge variant={statusVariant}>{statusLabel(status)}</Badge>
      </header>

      <p className="mb-3 text-xs text-app-muted">
        {job.mode === "audio" ? "Audio MP3" : `Video ${job.quality || "best"}`}
        {clipSummary}
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        <Badge variant="info">{progress.toFixed(1)}%</Badge>
        <Badge variant="muted">{job.speed || "--"}</Badge>
        <Badge variant="muted">ETA {job.eta || "--:--"}</Badge>
        {turboEnabled && <Badge variant="warning">Turbo x{job.concurrentFragments}</Badge>}
      </div>

      <ProgressBar value={progress} />

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={(event) => {
            event.stopPropagation();
            onPause(job.id);
          }}
          disabled={!canPause}
        >
          Pause
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={(event) => {
            event.stopPropagation();
            onResume(job.id);
          }}
          disabled={!canResume}
        >
          Resume
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={(event) => {
            event.stopPropagation();
            onCancel(job.id);
          }}
          disabled={!canCancel}
        >
          Cancel
        </Button>
      </div>
    </Card>
  );
}

export default DownloadCard;
