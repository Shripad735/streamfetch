export function parseTimeInputToSeconds(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return { seconds: null, error: "" };
  }

  if (!/^\d+(?::\d{1,2}){0,2}$/.test(normalized)) {
    return { seconds: null, error: "Use ss, mm:ss, or hh:mm:ss." };
  }

  const parts = normalized.split(":").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) {
    return { seconds: null, error: "Time contains invalid numbers." };
  }

  if (parts.length === 1) {
    return { seconds: parts[0], error: "" };
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    if (seconds >= 60) {
      return { seconds: null, error: "Seconds must be below 60 for mm:ss." };
    }
    return { seconds: minutes * 60 + seconds, error: "" };
  }

  const [hours, minutes, seconds] = parts;
  if (minutes >= 60 || seconds >= 60) {
    return { seconds: null, error: "Minutes and seconds must be below 60 for hh:mm:ss." };
  }
  return { seconds: hours * 3600 + minutes * 60 + seconds, error: "" };
}

export function formatSecondsToClock(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
