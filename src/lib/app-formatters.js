export function formatDuration(totalSeconds) {
  if (!totalSeconds || Number.isNaN(totalSeconds)) return "Unknown";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function formatFormatOption(format) {
  const res = format.resolution || (format.height ? `${format.height}p` : "Unknown");
  const fps = format.fps ? ` ${format.fps}fps` : "";
  const bitrate = format.tbr ? ` ${Math.round(format.tbr)}kbps` : "";
  const ext = format.ext ? ` ${format.ext.toUpperCase()}` : "";
  return `${format.formatId} | ${res}${fps}${bitrate}${ext}`;
}

export function statusLabel(status) {
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

export function statusTone(status) {
  switch (status) {
    case "completed":
      return "success";
    case "downloading":
    case "retrying":
      return "info";
    case "failed":
    case "canceled":
      return "error";
    case "paused":
      return "warning";
    default:
      return "muted";
  }
}

export function getBrowserLabel(options, value) {
  const found = options.find((item) => item.value === value);
  return found ? found.label : value;
}

export function getFileName(filePath) {
  const value = String(filePath || "");
  if (!value) return "";
  const parts = value.split(/[\\/]/);
  return parts[parts.length - 1] || value;
}
