import ClipStudio from "../ClipStudio";
import VideoInfoCard from "../VideoInfoCard";
import VideoInfoSkeleton from "../VideoInfoSkeleton";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Input from "../ui/Input";
import ScrollArea from "../ui/ScrollArea";
import { formatFormatOption } from "../../lib/app-formatters";
import { CONCURRENT_FRAGMENT_OPTIONS, QUALITY_OPTIONS } from "../../lib/app-constants";
import { formatSecondsToClock } from "../../lib/time";

function NewDownloadView({
  hasElectron,
  appUpdateState,
  onOpenAppUpdate,
  url,
  setUrl,
  fetchingInfo,
  onFetchInfo,
  clipboardWatcherEnabled,
  onToggleClipboardWatcher,
  videoInfo,
  mode,
  setMode,
  quality,
  setQuality,
  selectedFormatId,
  setSelectedFormatId,
  muxedFormats,
  clipEnabled,
  setClipEnabled,
  clipStart,
  setClipStart,
  clipEnd,
  setClipEnd,
  clipRangeState,
  concurrentFragments,
  setConcurrentFragments,
  downloadFolder,
  onChooseFolder,
  onQueueDownload,
  errorMessage,
  ytDlpState,
  onCheckYtDlpUpdate,
  onRunYtDlpUpdate,
  activeCookieBrowser,
  activeCookiesFile
}) {
  const turboEnabled = concurrentFragments > 1;
  const accelerationStatusText = turboEnabled
    ? "Turbo mode is active. StreamFetch will request more fragments for compatible streams."
    : "Turbo mode is off. StreamFetch will download with the standard single-fragment strategy.";

  return (
    <div className="grid h-full min-h-0 gap-4 p-4 xl:grid-cols-[minmax(0,1.2fr)_380px] xl:p-6">
      <ScrollArea className="min-h-0 pr-1">
        <div className="space-y-4 pb-2">
          {!hasElectron && (
            <div className="rounded-2xl border border-app-dangerBorder bg-app-dangerBg px-4 py-3 text-sm text-app-dangerText">
              Electron bridge unavailable. Run inside the desktop app.
            </div>
          )}

          {hasElectron && appUpdateState.updateAvailable && !appUpdateState.dismissed && (
            <Card className="border-app-infoBorder bg-app-infoBg p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-infoText">Update available</p>
                  <h3 className="mt-2 font-display text-lg font-semibold text-app-text">
                    StreamFetch {appUpdateState.latestTag || appUpdateState.latestVersion || "latest"} is ready
                  </h3>
                  <p className="mt-1 text-sm text-app-muted">
                    Installed {appUpdateState.currentVersion || "--"} | Latest {appUpdateState.latestVersion || "--"}
                  </p>
                </div>
                <Button size="sm" onClick={onOpenAppUpdate}>
                  Download update
                </Button>
              </div>
            </Card>
          )}

          <Card className="p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <Input
                className="flex-1"
                label="Video URL"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="Paste a video or playlist URL here..."
              />
              <Button size="lg" onClick={onFetchInfo} disabled={!url.trim() || fetchingInfo}>
                {fetchingInfo ? "Fetching..." : "Inspect"}
              </Button>
            </div>
            {(activeCookieBrowser || activeCookiesFile) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {activeCookieBrowser && <Badge variant="info">Auth via {activeCookieBrowser}</Badge>}
                {activeCookiesFile && <Badge variant="warning">Cookies file attached</Badge>}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-muted">Clipboard assistant</p>
                <h3 className="mt-2 font-display text-lg font-semibold text-app-text">Fetch copied YouTube links faster</h3>
                <p className="mt-1 text-sm text-app-muted">
                  StreamFetch can detect copied links and offer a one-click metadata fetch while the window stays visible.
                </p>
                <div className="mt-3">
                  <Badge variant={clipboardWatcherEnabled ? "success" : "muted"}>
                    {clipboardWatcherEnabled ? "Watcher enabled" : "Watcher disabled"}
                  </Badge>
                </div>
              </div>
              <Button variant={clipboardWatcherEnabled ? "primary" : "secondary"} onClick={onToggleClipboardWatcher}>
                {clipboardWatcherEnabled ? "Disable watcher" : "Enable watcher"}
              </Button>
            </div>
          </Card>

          {fetchingInfo && <VideoInfoSkeleton />}
          {!fetchingInfo && videoInfo && (
            <VideoInfoCard
              title={videoInfo.title}
              thumbnail={videoInfo.thumbnail}
              extractor={videoInfo.extractor}
              duration={videoInfo.duration}
              isPlaylist={videoInfo.isPlaylist}
              playlistCount={videoInfo.playlistCount}
            />
          )}

          <Card className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-muted">Download setup</p>
                <h3 className="mt-2 font-display text-lg font-semibold text-app-text">Structured options</h3>
              </div>
              <Badge variant="muted">{videoInfo?.isPlaylist ? "Playlist" : "Single item"}</Badge>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <Input as="select" value={mode} onChange={(event) => setMode(event.target.value)} label="Format type">
                <option value="video">Video MP4</option>
                <option value="audio">Audio MP3</option>
              </Input>

              <Input
                as="select"
                value={quality}
                onChange={(event) => setQuality(event.target.value)}
                disabled={mode === "audio"}
                label="Quality"
              >
                {QUALITY_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Input>

              <Input
                as="select"
                value={selectedFormatId}
                onChange={(event) => setSelectedFormatId(event.target.value)}
                disabled={mode === "audio"}
                label="Advanced format"
              >
                <option value="auto">Auto (Smart)</option>
                {muxedFormats.map((item) => (
                  <option key={item.formatId} value={item.formatId}>
                    {formatFormatOption(item)}
                  </option>
                ))}
              </Input>
            </div>

            <div className="mt-5 rounded-[24px] border border-app-border bg-app-cardMuted p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display text-base font-semibold text-app-text">Clip range</p>
                  <p className="mt-1 text-sm text-app-muted">Download only the exact section you need.</p>
                </div>
                <Button
                  size="sm"
                  variant={clipEnabled ? "primary" : "secondary"}
                  disabled={Boolean(videoInfo?.isPlaylist)}
                  onClick={() => {
                    setClipEnabled((prev) => {
                      const next = !prev;
                      if (!next) {
                        setClipStart("");
                        setClipEnd("");
                      } else {
                        const duration = Number(videoInfo?.duration || 0) || 0;
                        setClipStart("00:00:00");
                        setClipEnd(duration ? formatSecondsToClock(duration) : "");
                      }
                      return next;
                    });
                  }}
                >
                  {clipEnabled ? "Range on" : "Range off"}
                </Button>
              </div>

              {videoInfo?.isPlaylist && <p className="mt-3 text-xs text-app-muted">Clip range is available only for single videos.</p>}

              {clipEnabled && !videoInfo?.isPlaylist && (
                <div className="mt-4">
                  <ClipStudio
                    durationSeconds={videoInfo?.duration || 0}
                    startValue={clipStart}
                    endValue={clipEnd}
                    onStartChange={setClipStart}
                    onEndChange={setClipEnd}
                    disabled={!videoInfo?.duration}
                  />
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Input
                      label="Start time"
                      value={clipStart}
                      onChange={(event) => setClipStart(event.target.value)}
                      placeholder="00:00:00"
                    />
                    <Input
                      label="End time"
                      value={clipEnd}
                      onChange={(event) => setClipEnd(event.target.value)}
                      placeholder={videoInfo?.duration ? formatSecondsToClock(videoInfo.duration) : "00:30"}
                    />
                  </div>
                  {clipRangeState.valid ? (
                    clipRangeState.normalizedStart && clipRangeState.normalizedEnd ? (
                      <p className="mt-3 text-sm font-medium text-app-accent">
                        Clip: {clipRangeState.normalizedStart} to {clipRangeState.normalizedEnd}
                      </p>
                    ) : null
                  ) : (
                    <p className="mt-3 text-sm text-app-dangerText">{clipRangeState.error}</p>
                  )}
                </div>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-muted">Acceleration</p>
                <h3 className="mt-2 font-display text-lg font-semibold text-app-text">Turbo fragments</h3>
                <p className="mt-1 text-sm text-app-muted">
                  Turbo mode uses yt-dlp concurrent fragments on compatible streams.
                </p>
              </div>
              <div className="inline-flex rounded-xl border border-app-border bg-app-cardMuted p-1">
                <button
                  type="button"
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${!turboEnabled ? "bg-app-card text-app-text shadow-sm" : "text-app-muted"}`}
                  onClick={() => setConcurrentFragments(1)}
                >
                  Off
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${turboEnabled ? "bg-app-accent text-white shadow-sm" : "text-app-muted"}`}
                  onClick={() => setConcurrentFragments((prev) => (prev > 1 ? prev : 8))}
                >
                  On
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-end">
              <Input
                as="select"
                label="Fragment count"
                value={String(concurrentFragments)}
                onChange={(event) => setConcurrentFragments(Number(event.target.value))}
              >
                {CONCURRENT_FRAGMENT_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item === 1 ? "1 fragment (Standard)" : `${item} fragments`}
                  </option>
                ))}
              </Input>
              <p className="text-sm text-app-muted">{accelerationStatusText}</p>
            </div>
          </Card>
        </div>
      </ScrollArea>

      <div className="grid min-h-0 gap-4">
        <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-muted">Destination</p>
          <h3 className="mt-2 font-display text-lg font-semibold text-app-text">Output folder</h3>
          <div className="mt-4 flex flex-col gap-3">
            <Input value={downloadFolder} readOnly placeholder="Choose a download folder..." />
            <Button variant="secondary" onClick={onChooseFolder}>
              Choose folder
            </Button>
          </div>
          <Button
            className="mt-5 w-full"
            size="lg"
            onClick={onQueueDownload}
            disabled={!url.trim() || !downloadFolder || (clipEnabled && !clipRangeState.valid)}
          >
            Add to queue
          </Button>
        </Card>

        <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-muted">Maintenance</p>
          <h3 className="mt-2 font-display text-lg font-semibold text-app-text">yt-dlp</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="muted">Current {ytDlpState.currentVersion || "--"}</Badge>
            <Badge variant={ytDlpState.updateAvailable ? "warning" : "success"}>
              Latest {ytDlpState.latestVersion || "--"}
            </Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onCheckYtDlpUpdate} disabled={ytDlpState.checking}>
              {ytDlpState.checking ? "Checking..." : "Check updates"}
            </Button>
            <Button variant="secondary" onClick={onRunYtDlpUpdate} disabled={ytDlpState.updating}>
              {ytDlpState.updating ? "Updating..." : "One-click update"}
            </Button>
          </div>
          {ytDlpState.output && (
            <pre className="mt-4 max-h-40 overflow-auto rounded-2xl border border-app-border bg-app-bg p-3 text-xs text-app-muted">
              {ytDlpState.output}
            </pre>
          )}
        </Card>

        {errorMessage && (
          <div className="rounded-2xl border border-app-dangerBorder bg-app-dangerBg px-4 py-3 text-sm text-app-dangerText">
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}

export default NewDownloadView;
