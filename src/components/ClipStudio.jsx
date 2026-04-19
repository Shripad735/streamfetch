import { useMemo } from "react";
import { cn } from "../lib/cn";
import { formatSecondsToClock, parseTimeInputToSeconds } from "../lib/time";

const HANDLE_RANGE_CLASSES =
  "pointer-events-none absolute inset-x-0 top-0 h-16 appearance-none bg-transparent " +
  "[&::-webkit-slider-runnable-track]:h-16 [&::-webkit-slider-runnable-track]:bg-transparent " +
  "[&::-moz-range-track]:h-16 [&::-moz-range-track]:bg-transparent " +
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:mt-[17px] " +
  "[&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:w-8 [&::-webkit-slider-thumb]:appearance-none " +
  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[5px] [&::-webkit-slider-thumb]:border-app-card [&::-webkit-slider-thumb]:bg-current [&::-webkit-slider-thumb]:shadow-[0_8px_18px_rgba(15,23,42,0.18)] " +
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-8 [&::-moz-range-thumb]:w-8 " +
  "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[5px] [&::-moz-range-thumb]:border-app-card [&::-moz-range-thumb]:bg-current [&::-moz-range-thumb]:shadow-[0_8px_18px_rgba(15,23,42,0.18)]";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toPercent(value, durationSeconds) {
  if (!durationSeconds) return 0;
  return (value / durationSeconds) * 100;
}

function formatTick(value) {
  const safe = Math.max(0, Math.floor(Number(value) || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function MetricPill({ tone = "muted", label, value }) {
  const toneClasses =
    tone === "start"
      ? "bg-app-successBg text-app-successText ring-app-successBorder/60"
      : tone === "end"
        ? "bg-app-infoBg text-app-infoText ring-app-infoBorder/60"
        : "bg-app-card/85 text-app-text ring-app-border/55";

  return (
    // <div className={cn("inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs ring-1", toneClasses)}>
    //   <span className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70">{label}</span>
    //   <span className="font-semibold tabular-nums">{value}</span>
    // </div>
    <div className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ring-1", toneClasses)}>
      <span className="text-[9px] font-semibold uppercase tracking-[0.12em] opacity-70">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function ClipStudio({
  durationSeconds,
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  disabled
}) {
  const safeDuration = Math.max(0, Math.floor(Number(durationSeconds) || 0));
  const startParsed = parseTimeInputToSeconds(startValue);
  const endParsed = parseTimeInputToSeconds(endValue);

  const timelineState = useMemo(() => {
    if (!safeDuration) {
      return {
        start: 0,
        end: 0
      };
    }

    const fallbackStart = startParsed.seconds ?? 0;
    const fallbackEnd = endParsed.seconds ?? safeDuration;
    const clampedStart = clamp(fallbackStart, 0, Math.max(0, safeDuration - 1));
    const clampedEnd = clamp(fallbackEnd, clampedStart + 1, safeDuration);

    return {
      start: clampedStart,
      end: clampedEnd
    };
  }, [endParsed.seconds, safeDuration, startParsed.seconds]);

  const applyStartChange = (rawValue) => {
    if (!safeDuration || disabled) return;
    const nextEnd = clamp(timelineState.end, 1, safeDuration);
    const nextStart = clamp(Math.round(rawValue), 0, Math.max(0, nextEnd - 1));
    onStartChange(formatSecondsToClock(nextStart));
  };

  const applyEndChange = (rawValue) => {
    if (!safeDuration || disabled) return;
    const nextStart = clamp(timelineState.start, 0, Math.max(0, safeDuration - 1));
    const nextEnd = clamp(Math.round(rawValue), Math.min(safeDuration, nextStart + 1), safeDuration);
    onEndChange(formatSecondsToClock(nextEnd));
  };

  const startPercent = toPercent(timelineState.start, safeDuration);
  const endPercent = toPercent(timelineState.end, safeDuration);
  const selectionWidth = Math.max(0, endPercent - startPercent);
  const selectedDuration = Math.max(0, timelineState.end - timelineState.start);
  const midpointSeconds = safeDuration > 1 ? Math.floor(safeDuration / 2) : 0;

  return (
    <div className="mt-4 rounded-[32px] bg-app-panel/72 p-6 shadow-card ring-1 ring-app-border/35">
      <div className="max-w-xl">
        <h4 className="font-display text-xl font-semibold tracking-[0.01em] text-app-text">Clip Studio</h4>
        <p className="mt-2 text-sm leading-6 text-app-muted">
          Drag the round green handle to where the clip starts and the blue handle to where it ends. Use the time fields below only for fine adjustments. The highlighted section is what will be downloaded. Drag the colored handles until the clip length looks right.
        </p>
      </div>

      <div className="mt-6 rounded-[28px] bg-app-card/76 p-5 shadow-card">
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(290px,0.78fr)_minmax(0,1.22fr)]">
          {safeDuration > 0 ? (
            <>
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                  <MetricPill tone="start" label="Start" value={formatSecondsToClock(timelineState.start)} />
                  <MetricPill tone="end" label="End" value={formatSecondsToClock(timelineState.end)} />
                  <MetricPill label="Len" value={formatSecondsToClock(selectedDuration)} />
                </div>

                <div className="rounded-[22px] border border-app-border/60 bg-app-bg/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-app-muted">Selection summary</p>
                  <div className="mt-3 space-y-2.5 text-sm text-app-muted">
                    <div className="flex items-center justify-between gap-4">
                      <span>Clip starts at</span>
                      <span className="font-semibold tabular-nums text-app-text">{formatSecondsToClock(timelineState.start)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Clip ends at</span>
                      <span className="font-semibold tabular-nums text-app-text">{formatSecondsToClock(timelineState.end)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Total selected</span>
                      <span className="font-semibold tabular-nums text-app-text">{formatSecondsToClock(selectedDuration)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] bg-app-panel/78 px-5 py-5 ring-1 ring-app-border/28">
                <div className="mb-4 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.22em]">
                  <span className="text-app-successText">Start Handle</span>
                  <span className="text-app-infoText">End Handle</span>
                </div>

                <div className="relative h-16">
                  <div className="absolute inset-x-0 top-[30px] h-2.5 rounded-full bg-app-border/65" />
                  <div
                    className="absolute top-[30px] h-2.5 rounded-full bg-app-accent/90"
                    style={{ left: `${startPercent}%`, width: `${selectionWidth}%` }}
                  />

                  <input
                    type="range"
                    min="0"
                    max={safeDuration}
                    step="1"
                    value={timelineState.start}
                    onChange={(event) => applyStartChange(Number(event.target.value))}
                    className={`${HANDLE_RANGE_CLASSES} text-app-successText [&::-webkit-slider-thumb]:bg-app-successText [&::-moz-range-thumb]:bg-app-successText`}
                    disabled={disabled}
                    aria-label="Clip start handle"
                  />
                  <input
                    type="range"
                    min="0"
                    max={safeDuration}
                    step="1"
                    value={timelineState.end}
                    onChange={(event) => applyEndChange(Number(event.target.value))}
                    className={`${HANDLE_RANGE_CLASSES} text-app-accent [&::-webkit-slider-thumb]:bg-app-accent [&::-moz-range-thumb]:bg-app-accent`}
                    disabled={disabled}
                    aria-label="Clip end handle"
                  />
                </div>

                <div className="mt-4 flex items-center justify-between text-[12px] font-medium tracking-[0.12em] text-app-muted">
                  <span className="tabular-nums">{formatTick(0)}</span>
                  <span className="tabular-nums">{formatTick(midpointSeconds)}</span>
                  <span className="tabular-nums">{formatTick(safeDuration)}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-[24px] bg-app-panel/78 px-4 py-5 text-sm text-app-muted ring-1 ring-app-border/28 xl:col-span-2">
              Duration is unavailable for this item, so Clip Studio falls back to manual time entry below.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ClipStudio;
