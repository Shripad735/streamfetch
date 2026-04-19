import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "./components/shell/AppShell";
import CookiePromptDialog from "./components/dialogs/CookiePromptDialog";
import NoFormatsDialog from "./components/dialogs/NoFormatsDialog";
import HistoryView from "./components/views/HistoryView";
import NewDownloadView from "./components/views/NewDownloadView";
import QueueView from "./components/views/QueueView";
import SettingsView from "./components/views/SettingsView";
import ToastStack from "./components/ToastStack";
import { useDownloadJobs } from "./hooks/use-download-jobs";
import { useDownloadWorkspace } from "./hooks/use-download-workspace";
import { usePreferences } from "./hooks/use-preferences";
import { useToastCenter } from "./hooks/use-toast-center";
import {
  COOKIE_BROWSER_OPTIONS,
  NO_FORMATS_PROMPT_MESSAGE,
  NO_FORMATS_TITLE,
  PROJECT_REPO_URL,
  RECOMMENDED_COOKIE_EXTENSION_URL,
  VIEW_ITEMS,
  YTDLP_COOKIE_EXPORT_GUIDE_URL
} from "./lib/app-constants";

function App() {
  const hasElectron = Boolean(window?.electronAPI);
  const [currentView, setCurrentView] = useState("new-download");
  const [historyQuery, setHistoryQuery] = useState("");
  const [maximized, setMaximized] = useState(false);
  const [noFormatsPrompt, setNoFormatsPrompt] = useState({
    open: false,
    title: NO_FORMATS_TITLE,
    message: "",
    detail: ""
  });
  const [ytDlpState, setYtDlpState] = useState({
    checking: false,
    updating: false,
    currentVersion: "",
    latestVersion: "",
    updateAvailable: false,
    output: ""
  });
  const [appUpdateState, setAppUpdateState] = useState({
    checking: false,
    checked: false,
    currentVersion: "",
    latestVersion: "",
    latestTag: "",
    releaseUrl: "",
    updateAvailable: false,
    dismissed: false,
    error: ""
  });

  const { toasts, pushToast, dismissToast } = useToastCenter();
  const { preferences, preferencesLoaded, updatePreferences } = usePreferences(hasElectron, pushToast);
  const [settingsDraft, setSettingsDraft] = useState({
    clipboardWatcherEnabled: false,
    theme: "light",
    defaultMode: "video",
    defaultQuality: "best",
    defaultConcurrentFragments: 1,
    defaultOutputFolder: "",
    globalSpeedLimit: ""
  });

  useEffect(() => {
    setSettingsDraft(preferences);
  }, [preferences]);

  const showNoFormatsPrompt = useCallback((message, detail = "") => {
    setNoFormatsPrompt({
      open: true,
      title: NO_FORMATS_TITLE,
      message: String(message || NO_FORMATS_PROMPT_MESSAGE),
      detail: String(detail || "").trim()
    });
  }, []);

  const closeNoFormatsPrompt = useCallback(() => {
    setNoFormatsPrompt((prev) => ({ ...prev, open: false }));
  }, []);

  const showFormatExtractionError = useCallback(
    (detail = "") => {
      showNoFormatsPrompt(NO_FORMATS_PROMPT_MESSAGE, detail);
    },
    [showNoFormatsPrompt]
  );

  const jobsApi = useDownloadJobs({
    hasElectron,
    pushToast,
    onAuthRequired: (payload) => {
      workspace.openCookiePromptForDownload(payload);
      setCurrentView("new-download");
    },
    onClipboardDetected: (detectedUrl) => {
      const toastId = `clipboard-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      pushToast({
        id: toastId,
        type: "info",
        title: "Clipboard Link Detected",
        message: "Copied YouTube link ready to inspect.",
        actionLabel: "Fetch this",
        durationMs: 10000,
        onAction: () => {
          dismissToast(toastId);
          setCurrentView("new-download");
          void workspace.fetchInfoForUrl(detectedUrl);
        }
      });
    },
    onNoFormats: showFormatExtractionError
  });

  const workspace = useDownloadWorkspace({
    hasElectron,
    preferences,
    preferencesLoaded,
    pushToast,
    setSelectedJobId: jobsApi.setSelectedJobId,
    selectQueueView: () => setCurrentView("active-queue"),
    showFormatExtractionError,
    closeNoFormatsPrompt
  });

  useEffect(() => {
    let disposed = false;
    if (!hasElectron || !window.electronAPI?.checkAppUpdate) return () => {};

    window.electronAPI
      .checkAppUpdate()
      .then((response) => {
        if (disposed) return;
        setAppUpdateState((prev) => ({
          ...prev,
          checked: true,
          currentVersion: String(response.currentVersion || ""),
          latestVersion: String(response.latestVersion || ""),
          latestTag: String(response.latestTag || ""),
          releaseUrl: String(response.releaseUrl || ""),
          updateAvailable: Boolean(response.updateAvailable),
          dismissed: Boolean(response.updateAvailable) ? prev.dismissed : false,
          error: ""
        }));
      })
      .catch((error) => {
        if (disposed) return;
        setAppUpdateState((prev) => ({ ...prev, checked: true, error: error.message || "App update check failed." }));
      });

    return () => {
      disposed = true;
    };
  }, [hasElectron]);

  const openExternal = useCallback(
    async (target) => {
      if (hasElectron && window.electronAPI?.openExternal) {
        await window.electronAPI.openExternal(target);
        return;
      }
      window.open(target, "_blank", "noopener,noreferrer");
    },
    [hasElectron]
  );

  const checkYtDlpUpdate = useCallback(async () => {
    if (!hasElectron) return;
    setYtDlpState((prev) => ({ ...prev, checking: true, output: "" }));
    try {
      const response = await window.electronAPI.checkYtDlpUpdate();
      setYtDlpState((prev) => ({
        ...prev,
        checking: false,
        currentVersion: response.currentVersion || "",
        latestVersion: response.latestVersion || "",
        updateAvailable: Boolean(response.updateAvailable)
      }));
    } catch (error) {
      setYtDlpState((prev) => ({ ...prev, checking: false, output: error.message || "Update check failed." }));
    }
  }, [hasElectron]);

  const runYtDlpUpdate = useCallback(async () => {
    if (!hasElectron) return;
    setYtDlpState((prev) => ({ ...prev, updating: true }));
    try {
      const response = await window.electronAPI.updateYtDlp();
      setYtDlpState((prev) => ({
        ...prev,
        updating: false,
        output: response.output || "",
        currentVersion: response.currentVersion || prev.currentVersion,
        updateAvailable: false
      }));
      pushToast({
        type: response.success ? "success" : "error",
        title: response.success ? "yt-dlp Updated" : "yt-dlp Update Failed",
        message: response.success ? `Current version: ${response.currentVersion}` : "Could not update yt-dlp."
      });
    } catch (error) {
      setYtDlpState((prev) => ({ ...prev, updating: false, output: error.message || "Update failed." }));
    }
  }, [hasElectron, pushToast]);

  const viewMeta = useMemo(() => {
    if (currentView === "active-queue") return `${jobsApi.activeJobs.length} active · ${jobsApi.runningJobId ? "engine live" : "idle"}`;
    if (currentView === "history") return `${jobsApi.historyJobs.length} archived jobs`;
    if (currentView === "settings") return "Persistent defaults and maintenance";
    return workspace.videoInfo ? "Metadata ready to queue" : "Paste a link to begin";
  }, [currentView, jobsApi.activeJobs.length, jobsApi.historyJobs.length, jobsApi.runningJobId, workspace.videoInfo]);

  const handleSaveSettings = useCallback(async () => {
    const previous = preferences;
    const response = await updatePreferences(settingsDraft, { optimistic: false });
    if (!response.success) return;

    const nextSettings = response.settings || settingsDraft;
    setSettingsDraft(nextSettings);

    if (!workspace.downloadFolder || workspace.downloadFolder === previous.defaultOutputFolder) {
      workspace.setDownloadFolder(nextSettings.defaultOutputFolder || "");
    }
    if (workspace.mode === previous.defaultMode) {
      workspace.setMode(nextSettings.defaultMode || "video");
    }
    if (workspace.quality === previous.defaultQuality) {
      workspace.setQuality(nextSettings.defaultQuality || "best");
    }
    if (Number(workspace.concurrentFragments) === Number(previous.defaultConcurrentFragments || 1)) {
      workspace.setConcurrentFragments(Number(nextSettings.defaultConcurrentFragments || 1));
    }

    pushToast({
      type: "success",
      title: "Preferences Saved",
      message: "Workspace defaults have been updated."
    });
  }, [preferences, pushToast, settingsDraft, updatePreferences, workspace]);

  return (
    <>
      <AppShell
        currentView={currentView}
        setCurrentView={setCurrentView}
        viewItems={VIEW_ITEMS}
        viewMeta={viewMeta}
        runningJobId={jobsApi.runningJobId}
        counts={{ active: jobsApi.activeJobs.length, history: jobsApi.historyJobs.length }}
        hasElectron={hasElectron}
        theme={preferences.theme}
        onThemeToggle={() => updatePreferences({ theme: preferences.theme === "dark" ? "light" : "dark" })}
        onOpenRepo={() => openExternal(PROJECT_REPO_URL)}
        onMinimize={() => hasElectron && window.electronAPI.windowMinimize()}
        onToggleMaximize={async () => {
          if (!hasElectron) return;
          const state = await window.electronAPI.windowToggleMaximize();
          setMaximized(Boolean(state));
        }}
        onClose={() => hasElectron && window.electronAPI.windowClose()}
        maximized={maximized}
      >
        {currentView === "new-download" && (
          <NewDownloadView
            hasElectron={hasElectron}
            appUpdateState={appUpdateState}
            onOpenAppUpdate={() => openExternal(appUpdateState.releaseUrl || "https://github.com/Shripad735/streamfetch/releases/latest")}
            url={workspace.url}
            setUrl={workspace.setUrl}
            fetchingInfo={workspace.fetchingInfo}
            onFetchInfo={() => workspace.fetchInfoForUrl(workspace.url)}
            clipboardWatcherEnabled={preferences.clipboardWatcherEnabled}
            onToggleClipboardWatcher={() => updatePreferences({ clipboardWatcherEnabled: !preferences.clipboardWatcherEnabled })}
            videoInfo={workspace.videoInfo}
            mode={workspace.mode}
            setMode={workspace.setMode}
            quality={workspace.quality}
            setQuality={workspace.setQuality}
            selectedFormatId={workspace.selectedFormatId}
            setSelectedFormatId={workspace.setSelectedFormatId}
            muxedFormats={workspace.muxedFormats}
            clipEnabled={workspace.clipEnabled}
            setClipEnabled={workspace.setClipEnabled}
            clipStart={workspace.clipStart}
            setClipStart={workspace.setClipStart}
            clipEnd={workspace.clipEnd}
            setClipEnd={workspace.setClipEnd}
            clipRangeState={workspace.clipRangeState}
            concurrentFragments={workspace.concurrentFragments}
            setConcurrentFragments={workspace.setConcurrentFragments}
            downloadFolder={workspace.downloadFolder}
            onChooseFolder={workspace.chooseDownloadFolder}
            onQueueDownload={workspace.queueDownload}
            errorMessage={workspace.errorMessage}
            ytDlpState={ytDlpState}
            onCheckYtDlpUpdate={checkYtDlpUpdate}
            onRunYtDlpUpdate={runYtDlpUpdate}
            activeCookieBrowser={workspace.activeCookieBrowser}
            activeCookiesFile={workspace.activeCookiesFile}
          />
        )}
        {currentView === "active-queue" && (
          <QueueView
            jobs={jobsApi.jobs}
            activeJobs={jobsApi.activeJobs}
            selectedJob={jobsApi.selectedJob}
            selectedJobId={jobsApi.selectedJobId}
            setSelectedJobId={jobsApi.setSelectedJobId}
            onPause={jobsApi.pauseJob}
            onResume={jobsApi.resumeJob}
            onCancel={jobsApi.cancelJob}
            onClearFinished={jobsApi.clearFinished}
          />
        )}
        {currentView === "history" && (
          <HistoryView
            historyJobs={jobsApi.historyJobs}
            historyQuery={historyQuery}
            setHistoryQuery={setHistoryQuery}
            onClear={jobsApi.clearFinished}
            onSelect={(jobId) => {
              jobsApi.setSelectedJobId(jobId);
              setCurrentView("active-queue");
            }}
            selectedJobId={jobsApi.selectedJobId}
          />
        )}
        {currentView === "settings" && (
          <SettingsView
            preferences={preferences}
            settingsDraft={settingsDraft}
            setSettingsDraft={setSettingsDraft}
            onSave={handleSaveSettings}
            onChooseDefaultFolder={async () => {
              if (!hasElectron) return;
              const folder = await window.electronAPI.chooseDownloadFolder();
              if (folder) setSettingsDraft((prev) => ({ ...prev, defaultOutputFolder: folder }));
            }}
            onToggleClipboard={() => updatePreferences({ clipboardWatcherEnabled: !preferences.clipboardWatcherEnabled })}
            ytDlpState={ytDlpState}
            onCheckYtDlpUpdate={checkYtDlpUpdate}
            onRunYtDlpUpdate={runYtDlpUpdate}
            appUpdateState={appUpdateState}
            onOpenAppUpdate={() => openExternal(appUpdateState.releaseUrl || "https://github.com/Shripad735/streamfetch/releases/latest")}
            onOpenRepo={() => openExternal(PROJECT_REPO_URL)}
            hasElectron={hasElectron}
          />
        )}
      </AppShell>

      <NoFormatsDialog state={noFormatsPrompt} onClose={closeNoFormatsPrompt} />
      <CookiePromptDialog
        open={workspace.cookiePrompt.open}
        cookiePrompt={workspace.cookiePrompt}
        cookieBrowser={workspace.cookieBrowser}
        setCookieBrowser={workspace.setCookieBrowser}
        cookieBrowserOptions={COOKIE_BROWSER_OPTIONS}
        cookiesFilePath={workspace.cookiesFilePath}
        onChooseCookiesFile={workspace.chooseCookiesFile}
        onRetryWithCookies={workspace.retryWithCookies}
        onRetryWithCookiesFile={workspace.retryWithCookiesFile}
        onOpenCookieExtension={() => openExternal(RECOMMENDED_COOKIE_EXTENSION_URL)}
        onOpenCookieGuide={() => openExternal(YTDLP_COOKIE_EXPORT_GUIDE_URL)}
        onClose={workspace.closeCookiePrompt}
        cookieRetrying={workspace.cookieRetrying}
        cookieFileRetrying={workspace.cookieFileRetrying}
      />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

export default App;
