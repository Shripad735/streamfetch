const { contextBridge, ipcRenderer } = require("electron");

function subscribe(channel, callback) {
  if (typeof callback !== "function") {
    return () => {};
  }

  const handler = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld("electronAPI", {
  fetchVideoInfo: (payload) => ipcRenderer.invoke("video:fetch-info", payload),
  getJobs: () => ipcRenderer.invoke("video:get-jobs"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  updateSettings: (payload) => ipcRenderer.invoke("settings:update", payload),
  chooseDownloadFolder: () => ipcRenderer.invoke("dialog:select-folder"),
  chooseCookiesFile: () => ipcRenderer.invoke("dialog:select-cookies-file"),
  downloadVideo: (payload) => ipcRenderer.invoke("video:start-download", payload),
  pauseDownload: (jobId) => ipcRenderer.invoke("video:pause-download", jobId),
  resumeDownload: (jobId) => ipcRenderer.invoke("video:resume-download", jobId),
  cancelDownload: (jobId) => ipcRenderer.invoke("video:cancel-download", jobId),
  clearFinished: () => ipcRenderer.invoke("video:clear-finished"),
  setGlobalSpeedLimit: (value) => ipcRenderer.invoke("settings:set-global-speed-limit", value),
  setClipboardWatcherEnabled: (enabled) => ipcRenderer.invoke("settings:set-clipboard-watcher-enabled", enabled),
  checkAppUpdate: () => ipcRenderer.invoke("app:check-update"),
  checkYtDlpUpdate: () => ipcRenderer.invoke("ytdlp:check-update"),
  updateYtDlp: () => ipcRenderer.invoke("ytdlp:update"),
  openExternal: (url) => ipcRenderer.invoke("app:open-external", url),
  windowMinimize: () => ipcRenderer.invoke("window:minimize"),
  windowToggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
  windowClose: () => ipcRenderer.invoke("window:close"),
  onJobsUpdated: (callback) => subscribe("video:jobs-updated", callback),
  onClipboardUrlDetected: (callback) => subscribe("clipboard:url-detected", callback),
  onToast: (callback) => subscribe("app:toast", callback),
  onDownloadProgress: (callback) => subscribe("video:download-progress", callback),
  onDownloadLog: (callback) => subscribe("video:download-log", callback),
  onDownloadStatus: (callback) => subscribe("video:download-status", callback),
  onDownloadComplete: (callback) => subscribe("video:download-complete", callback),
  onDownloadError: (callback) => subscribe("video:download-error", callback)
});
