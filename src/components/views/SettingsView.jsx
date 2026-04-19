import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import Switch from "../ui/Switch";
import Badge from "../ui/Badge";
import Separator from "../ui/Separator";
import ScrollArea from "../ui/ScrollArea";
import { CONCURRENT_FRAGMENT_OPTIONS, QUALITY_OPTIONS } from "../../lib/app-constants";

function SettingsView({
  preferences,
  settingsDraft,
  setSettingsDraft,
  onSave,
  onChooseDefaultFolder,
  onToggleClipboard,
  ytDlpState,
  onCheckYtDlpUpdate,
  onRunYtDlpUpdate,
  appUpdateState,
  onOpenAppUpdate,
  onOpenRepo,
  hasElectron
}) {
  return (
    <ScrollArea className="h-full">
      <div className="grid min-h-full gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:p-6">
        <div className="grid content-start gap-4">
          <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-muted">Defaults</p>
          <h2 className="mt-2 font-display text-xl font-semibold text-app-text">Workspace preferences</h2>
          <p className="mt-2 max-w-3xl text-sm text-app-muted">
            These defaults hydrate the new download workspace every time the app opens.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Input
              as="select"
              label="Theme"
              value={settingsDraft.theme}
              onChange={(event) => setSettingsDraft((prev) => ({ ...prev, theme: event.target.value }))}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </Input>

            <Input
              as="select"
              label="Default mode"
              value={settingsDraft.defaultMode}
              onChange={(event) => setSettingsDraft((prev) => ({ ...prev, defaultMode: event.target.value }))}
            >
              <option value="video">Video MP4</option>
              <option value="audio">Audio MP3</option>
            </Input>

            <Input
              as="select"
              label="Default quality"
              value={settingsDraft.defaultQuality}
              onChange={(event) => setSettingsDraft((prev) => ({ ...prev, defaultQuality: event.target.value }))}
              disabled={settingsDraft.defaultMode === "audio"}
            >
              {QUALITY_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Input>

            <Input
              as="select"
              label="Default turbo fragments"
              value={String(settingsDraft.defaultConcurrentFragments)}
              onChange={(event) =>
                setSettingsDraft((prev) => ({ ...prev, defaultConcurrentFragments: Number(event.target.value) }))
              }
            >
              {CONCURRENT_FRAGMENT_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item === 1 ? "1 fragment (Standard)" : `${item} fragments`}
                </option>
              ))}
            </Input>

            <Input
              label="Global speed limit"
              value={settingsDraft.globalSpeedLimit}
              onChange={(event) => setSettingsDraft((prev) => ({ ...prev, globalSpeedLimit: event.target.value }))}
              placeholder="Optional: 500K, 2M, 1.5M"
            />
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-app-border bg-app-cardMuted p-4 md:flex-row md:items-end">
            <Input
              className="flex-1"
              label="Default download folder"
              value={settingsDraft.defaultOutputFolder}
              readOnly
              placeholder="Choose a default folder..."
            />
            <Button variant="secondary" onClick={onChooseDefaultFolder}>
              Choose folder
            </Button>
          </div>

          <div className="mt-5 flex justify-end">
            <Button onClick={onSave}>Save defaults</Button>
          </div>
        </Card>

          <Card className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-muted">Automation helpers</p>
                <h3 className="mt-2 font-display text-lg font-semibold text-app-text">Clipboard watcher</h3>
                <p className="mt-2 text-sm text-app-muted">
                  Suggest copied YouTube links when StreamFetch is visible on screen.
                </p>
                <div className="mt-3">
                  <Badge variant={preferences.clipboardWatcherEnabled ? "success" : "muted"}>
                    {preferences.clipboardWatcherEnabled ? "Watcher enabled" : "Watcher disabled"}
                  </Badge>
                </div>
              </div>
              <div className="shrink-0 self-start pt-1">
                <Switch checked={preferences.clipboardWatcherEnabled} onCheckedChange={onToggleClipboard} disabled={!hasElectron} />
              </div>
            </div>
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-muted">Maintenance</p>
          <h3 className="mt-2 font-display text-lg font-semibold text-app-text">yt-dlp updater</h3>
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

          <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-muted">Application</p>
          <h3 className="mt-2 font-display text-lg font-semibold text-app-text">Desktop status</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="muted">Installed {appUpdateState.currentVersion || "--"}</Badge>
            <Badge variant={appUpdateState.updateAvailable ? "info" : "success"}>
              {appUpdateState.updateAvailable
                ? `Update ${appUpdateState.latestVersion || appUpdateState.latestTag || "available"}`
                : "Up to date"}
            </Badge>
          </div>
          <Separator className="my-4" />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onOpenAppUpdate}>
              Open latest release
            </Button>
            <Button variant="ghost" onClick={onOpenRepo}>
              Project repository
            </Button>
          </div>
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}

export default SettingsView;
