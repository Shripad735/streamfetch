
const { randomUUID } = require("crypto");
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");
const electron = require("electron");

if (typeof electron === "string") {
  if (process.env.STREAMFETCH_RELAUNCHED === "1") {
    throw new Error("Electron runtime bootstrap failed. Remove ELECTRON_RUN_AS_NODE and retry.");
  }

  const env = { ...process.env, STREAMFETCH_RELAUNCHED: "1" };
  delete env.ELECTRON_RUN_AS_NODE;

  const result = spawnSync(electron, process.argv.slice(1), {
    stdio: "inherit",
    env,
    windowsHide: false
  });

  process.exit(result.status ?? 0);
}

const { app, BrowserWindow, clipboard, dialog, ipcMain, Notification, shell } = electron;

const QUALITY_OPTIONS = new Set(["best", "1080p", "720p", "480p", "240p", "144p"]);
const CONCURRENT_FRAGMENT_OPTIONS = new Set([1, 4, 8, 16]);
const COOKIE_BROWSERS = new Set(["chrome", "edge", "firefox", "brave"]);
const DEFAULT_COOKIE_BROWSERS = ["chrome", "edge", "firefox", "brave"];
const APP_RELEASES_API_URL = "https://api.github.com/repos/Shripad735/streamfetch/releases/latest";
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"]);
const YOUTUBE_WEB_SAFARI_CLIENT = "web_safari";
const YOUTUBE_IOS_CLIENT = "ios";
const YOUTUBE_ANDROID_CLIENT = "android";
const DEFAULT_BROWSER_USER_AGENT = "Mozilla/5.0";
const YTDLP_AUTO_UPDATE_TTL_MS = 6 * 60 * 60 * 1000;
const QUALITY_HEIGHT = {
  best: null,
  "1080p": 1080,
  "720p": 720,
  "480p": 480,
  "240p": 240,
  "144p": 144
};
const MAX_LOG_LINES = 320;
const MAX_HISTORY_JOBS = 220;
const JOB_STATUS = {
  QUEUED: "queued",
  DOWNLOADING: "downloading",
  PAUSED: "paused",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELED: "canceled",
  RETRYING: "retrying"
};

let mainWindow;
let globalSpeedLimit = "";
let clipboardWatcherEnabled = false;
let runningJobId = "";
const activeDownloads = new Map();
const queuedJobIds = [];
const jobsById = new Map();
let persistTimer = null;
let clipboardWatcherTimer = null;
let lastClipboardText = "";
let lastSuggestedClipboardUrl = "";
let ytDlpRefreshPromise = null;
let ytDlpRefreshState = {
  checkedAt: 0,
  currentVersion: "",
  latestVersion: "",
  lastError: "",
  updated: false
};

function getStateFilePath() {
  return path.join(app.getPath("userData"), "streamfetch-state.json");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1080,
    minHeight: 720,
    frame: false,
    backgroundColor: "#F7F3EA",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.webContents.on("did-finish-load", () => {
    resetClipboardWatcherState();
    sendJobsSnapshot();
  });
}

function getBundledBinaryPath(binaryName) {
  return app.isPackaged
    ? path.join(process.resourcesPath, "bin", binaryName)
    : path.join(__dirname, "..", "bin", binaryName);
}

function isUsableFfmpegBinary(candidatePath) {
  if (!candidatePath || !fs.existsSync(candidatePath)) {
    return false;
  }

  try {
    const probe = spawnSync(candidatePath, ["-version"], {
      windowsHide: true,
      timeout: 10000
    });
    return probe.status === 0;
  } catch {
    return false;
  }
}

function isUsableCommandBinary(candidatePath, versionArgs = ["--version"]) {
  if (!candidatePath || !fs.existsSync(candidatePath)) {
    return false;
  }

  try {
    const probe = spawnSync(candidatePath, versionArgs, {
      windowsHide: true,
      timeout: 10000
    });
    return probe.status === 0;
  } catch {
    return false;
  }
}

// Cross Platform ensureManagedYtDlpPath()

function unixManagedYtDlpPath() {
  const bundledPath = getBundledBinaryPath("yt-dlp");
  if (isUsableCommandBinary(bundledPath)) {
    return bundledPath;
  }

  const result = spawnSync("which", ["yt-dlp"]);

  if (result.status === 0 && result.stdout) {
    const ytDlpPath = result.stdout.toString().trim();

    if (isUsableCommandBinary(ytDlpPath)) {
      return ytDlpPath;
    }

    throw new Error(
      "yt-dlp was found at " + ytDlpPath + " but is not usable. Please reinstall yt-dlp or check its permissions."
    );
  }

  throw new Error(
    "yt-dlp not found in PATH. Please install yt-dlp using your package manager or download it from https://github.com/yt-dlp/yt-dlp/releases"
  );
}

function winManagedYtDlpPath() {
  const managedDir = path.join(app.getPath("userData"), "bin");
  const managedPath = path.join(managedDir, "yt-dlp.exe");

  if (isUsableCommandBinary(managedPath)) {
    return managedPath;
  }

  const bundledPath = getBundledBinaryPath("yt-dlp.exe");

  if (!isUsableCommandBinary(bundledPath)) {
    throw new Error("yt-dlp.exe was not found in the bin folder.");
  }

  fs.mkdirSync(managedDir, { recursive: true });
  fs.copyFileSync(bundledPath, managedPath);

  return managedPath;
}

function ensureManagedYtDlpPath() {
  if (process.platform === "win32") {
    return winManagedYtDlpPath();
  }

  if (process.platform === "linux" || process.platform === "darwin") {
    return unixManagedYtDlpPath();
  }

  throw new Error(`Unsupported platform: ${process.platform}`);
}

function getFfmpegPath() {
  if (process.platform === "win32") {
    const managed = path.join(app.getPath("userData"), "bin", "ffmpeg.exe");
    if (isUsableFfmpegBinary(managed)) {
      return managed;
    }

    const bundledPath = getBundledBinaryPath("ffmpeg.exe");
    return isUsableFfmpegBinary(bundledPath) ? bundledPath : "";
  }

  // macOS / Linux: check managed location, then bundled, then system PATH
  const managed = path.join(app.getPath("userData"), "bin", "ffmpeg");
  if (isUsableFfmpegBinary(managed)) {
    return managed;
  }

  const bundledPath = getBundledBinaryPath("ffmpeg");
  if (isUsableFfmpegBinary(bundledPath)) {
    return bundledPath;
  }

  try {
    const result = spawnSync("which", ["ffmpeg"], { timeout: 10000 });
    if (result.status === 0 && result.stdout) {
      const systemPath = result.stdout.toString().trim();
      if (isUsableFfmpegBinary(systemPath)) {
        return systemPath;
      }
    }
  } catch {
    // fall through
  }

  return "";
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isYoutubeUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    const host = parsed.hostname.toLowerCase();
    return host === "youtu.be" || YOUTUBE_HOSTS.has(host);
  } catch {
    return false;
  }
}

function normalizeClipboardWatcherEnabled(value) {
  return Boolean(value);
}

function normalizeYoutubeClipboardUrl(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue || !isValidHttpUrl(rawValue)) {
    return "";
  }

  let parsed;
  try {
    parsed = new URL(rawValue);
  } catch {
    return "";
  }

  const host = parsed.hostname.toLowerCase();
  const isYoutubeHost = YOUTUBE_HOSTS.has(host);
  const isShortHost = host === "youtu.be";
  const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  const trimmedPath = pathname.replace(/^\/+/, "");

  if (isShortHost) {
    if (!trimmedPath) return "";

    const normalized = new URL(`https://youtu.be/${trimmedPath}`);
    const playlistId = parsed.searchParams.get("list");
    if (playlistId) {
      normalized.searchParams.set("list", playlistId);
    }
    return normalized.toString();
  }

  if (!isYoutubeHost) {
    return "";
  }

  if (pathname === "/watch") {
    const videoId = parsed.searchParams.get("v");
    const playlistId = parsed.searchParams.get("list");
    if (!videoId && !playlistId) {
      return "";
    }

    const normalized = new URL(`https://${host}/watch`);
    if (videoId) {
      normalized.searchParams.set("v", videoId);
    }
    if (playlistId) {
      normalized.searchParams.set("list", playlistId);
    }
    return normalized.toString();
  }

  if (pathname === "/playlist") {
    const playlistId = parsed.searchParams.get("list");
    if (!playlistId) {
      return "";
    }

    const normalized = new URL(`https://${host}/playlist`);
    normalized.searchParams.set("list", playlistId);
    return normalized.toString();
  }

  const pathParts = trimmedPath.split("/").filter(Boolean);
  if (pathParts.length < 2) {
    return "";
  }

  const [kind, identifier] = pathParts;
  if (!identifier || !["shorts", "live", "embed"].includes(kind)) {
    return "";
  }

  return `https://${host}/${kind}/${identifier}`;
}

function normalizeCookieBrowser(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  if (!COOKIE_BROWSERS.has(normalized)) {
    throw new Error("Unsupported browser for cookies. Choose Chrome, Edge, Firefox, or Brave.");
  }
  return normalized;
}

function normalizeCookiesFile(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (!fs.existsSync(normalized)) {
    throw new Error("Cookies file was not found.");
  }
  return normalized;
}

function needsBrowserCookies(stderrText) {
  const message = String(stderrText || "").toLowerCase();
  if (!message) return false;
  return (
    message.includes("sign in to confirm your age") ||
    message.includes("this video may be inappropriate for some users") ||
    message.includes("sign in to confirm you're not a bot") ||
    message.includes("use --cookies-from-browser or --cookies for the authentication")
  );
}

function isBrowserCookieAccessError(stderrText) {
  const message = String(stderrText || "").toLowerCase();
  if (!message) return false;
  return (
    message.includes("failed to decrypt with dpapi") ||
    message.includes("could not copy chrome cookie database") ||
    message.includes("database is locked") ||
    message.includes("failed to decrypt")
  );
}

function isNoFormatsAvailable(stderrText = "", stdoutText = "") {
  const message = `${stdoutText}\n${stderrText}`.toLowerCase();
  if (!message) return false;
  return (
    message.includes("requested format is not available") ||
    message.includes("no downloadable formats") ||
    message.includes("no formats found") ||
    message.includes("no video formats found") ||
    message.includes("no suitable formats")
  );
}

function buildYoutubeRequestDirectives(client = "") {
  const directives = {
    extractorArgs: [],
    headers: [`User-Agent: ${DEFAULT_BROWSER_USER_AGENT}`],
    jsRuntimes: ["node"]
  };

  if (client === YOUTUBE_ANDROID_CLIENT) {
    directives.extractorArgs.push(`youtube:player_client=${YOUTUBE_ANDROID_CLIENT}`);
  }

  return directives;
}

function buildYoutubeAttemptProfiles({ hasAccountCookies = false } = {}) {
  return [
    { client: "", label: "web" },
    { client: YOUTUBE_WEB_SAFARI_CLIENT, label: YOUTUBE_WEB_SAFARI_CLIENT },
    ...(!hasAccountCookies ? [{ client: YOUTUBE_IOS_CLIENT, label: YOUTUBE_IOS_CLIENT }] : []),
    { client: YOUTUBE_ANDROID_CLIENT, label: YOUTUBE_ANDROID_CLIENT }
  ];
}

function appendRequestDirectives(args, directives = {}) {
  const extractorArgs = Array.isArray(directives.extractorArgs) ? directives.extractorArgs : [];
  const headers = Array.isArray(directives.headers) ? directives.headers : [];
  const jsRuntimes = Array.isArray(directives.jsRuntimes) ? directives.jsRuntimes : [];

  extractorArgs
    .filter(Boolean)
    .forEach((value) => {
      args.push("--extractor-args", value);
    });

  headers
    .filter(Boolean)
    .forEach((value) => {
      args.push("--add-header", value);
    });

  if (jsRuntimes.length > 0) {
    args.push("--js-runtimes", jsRuntimes.join(","));
  }
}

function applySourceRequestDirectives(args, url, client = "") {
  if (!isYoutubeUrl(url)) return;
  appendRequestDirectives(args, buildYoutubeRequestDirectives(client));
}

function extractProbeFormatIds(stdout = "") {
  return String(stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("["))
    .filter((line) => !/^[-]+$/.test(line))
    .map((line) => line.match(/^(\S+)\s+\S+/))
    .filter(Boolean)
    .map((match) => match[1])
    .filter((id) => id && id.toLowerCase() !== "id");
}

function normalizeRateLimit(input) {
  const value = String(input || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!value) return "";
  const match = value.match(/^(\d+(?:\.\d+)?)([KMG]?)$/);
  if (!match) {
    throw new Error("Speed limit must look like 500K, 2M, or 1.5M.");
  }
  return `${match[1]}${match[2]}`;
}

function normalizeConcurrentFragments(input) {
  if (input === null || input === undefined || input === "") {
    return 1;
  }

  const value = Number(input);
  if (!Number.isInteger(value) || !CONCURRENT_FRAGMENT_OPTIONS.has(value)) {
    throw new Error("Turbo Mode fragment count must be 1, 4, 8, or 16.");
  }
  return value;
}

function parseRateToBytes(rate) {
  if (!rate) return null;
  const match = String(rate).match(/^(\d+(?:\.\d+)?)([KMG]?)$/i);
  if (!match) return null;

  const value = Number(match[1]);
  const unit = (match[2] || "").toUpperCase();
  const multiplier = unit === "G" ? 1024 ** 3 : unit === "M" ? 1024 ** 2 : unit === "K" ? 1024 : 1;
  return value * multiplier;
}

function formatBytesToRate(bytes) {
  if (!bytes || Number.isNaN(bytes) || bytes <= 0) {
    return "";
  }
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)}G`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)}M`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)}K`;
  return `${Math.floor(bytes)}`;
}

function resolveEffectiveRate(globalRate, perDownloadRate) {
  const globalBytes = parseRateToBytes(globalRate);
  const perBytes = parseRateToBytes(perDownloadRate);
  if (!globalBytes && !perBytes) return "";
  if (globalBytes && perBytes) return formatBytesToRate(Math.min(globalBytes, perBytes));
  return formatBytesToRate(globalBytes || perBytes);
}

function parseProgressLine(line) {
  const percentMatch = line.match(/(\d+(?:\.\d+)?)%/);
  if (!percentMatch) return null;

  const speedMatch = line.match(/at\s+(.+?)\s+ETA/i);
  const etaMatch = line.match(/ETA\s+([0-9:]+)/i);

  return {
    percent: Number(percentMatch[1]),
    speed: speedMatch ? speedMatch[1].trim() : "",
    eta: etaMatch ? etaMatch[1].trim() : ""
  };
}

function parseFfmpegProgress(line) {
  const normalized = String(line || "");
  const timeMatch = normalized.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!timeMatch) return null;

  const hours = Number(timeMatch[1] || 0);
  const minutes = Number(timeMatch[2] || 0);
  const seconds = Number(timeMatch[3] || 0);
  if ([hours, minutes, seconds].some((value) => Number.isNaN(value))) {
    return null;
  }

  const speedMatch = normalized.match(/speed=\s*([0-9]+(?:\.[0-9]+)?)x/i);
  const speedX = speedMatch ? Number(speedMatch[1]) : null;

  return {
    processedSeconds: hours * 3600 + minutes * 60 + seconds,
    speedX: speedX && !Number.isNaN(speedX) && speedX > 0 ? speedX : null
  };
}

function formatEtaClock(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return "";
  }

  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function pushToast({ type, title, message, jobId }) {
  sendToRenderer("app:toast", { type, title, message, jobId, createdAt: Date.now() });
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: title || "StreamFetch",
      body: message || ""
    });
    notification.show();
  }
}

function schedulePersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
  }
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistState();
  }, 350);
}

function getSettingsPayload() {
  return {
    clipboardWatcherEnabled
  };
}

function resetClipboardWatcherState() {
  lastClipboardText = "";
  lastSuggestedClipboardUrl = "";
}

function shouldWatchClipboard() {
  return Boolean(
    clipboardWatcherEnabled &&
      mainWindow &&
      !mainWindow.isDestroyed() &&
      mainWindow.webContents &&
      !mainWindow.webContents.isLoadingMainFrame() &&
      mainWindow.isVisible() &&
      !mainWindow.isMinimized()
  );
}

function pollClipboardForYoutubeUrls() {
  if (!shouldWatchClipboard()) {
    return;
  }

  const nextClipboardText = String(clipboard.readText() || "").trim();
  if (!nextClipboardText) {
    if (lastClipboardText) {
      lastClipboardText = "";
      lastSuggestedClipboardUrl = "";
    }
    return;
  }

  if (nextClipboardText === lastClipboardText) {
    return;
  }

  lastClipboardText = nextClipboardText;
  const normalizedUrl = normalizeYoutubeClipboardUrl(nextClipboardText);

  if (!normalizedUrl) {
    lastSuggestedClipboardUrl = "";
    return;
  }

  if (normalizedUrl === lastSuggestedClipboardUrl) {
    return;
  }

  lastSuggestedClipboardUrl = normalizedUrl;
  sendToRenderer("clipboard:url-detected", {
    url: normalizedUrl,
    detectedAt: Date.now()
  });
}

function startClipboardWatcher() {
  if (clipboardWatcherTimer) {
    return;
  }

  clipboardWatcherTimer = setInterval(pollClipboardForYoutubeUrls, 800);
}

function persistState() {
  try {
    const payload = {
      globalSpeedLimit,
      clipboardWatcherEnabled,
      queue: [...queuedJobIds],
      jobs: getSortedJobs().slice(0, MAX_HISTORY_JOBS).map((job) => ({
        ...job,
        logs: Array.isArray(job.logs) ? job.logs.slice(-MAX_LOG_LINES) : []
      })),
      savedAt: new Date().toISOString()
    };
    fs.mkdirSync(path.dirname(getStateFilePath()), { recursive: true });
    fs.writeFileSync(getStateFilePath(), JSON.stringify(payload, null, 2), "utf8");
  } catch {
    // Intentionally ignore persistence failures.
  }
}

function loadState() {
  try {
    const statePath = getStateFilePath();
    if (!fs.existsSync(statePath)) return;

    const parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
    globalSpeedLimit = normalizeRateLimit(parsed.globalSpeedLimit || "");
    clipboardWatcherEnabled = normalizeClipboardWatcherEnabled(parsed.clipboardWatcherEnabled);

    if (Array.isArray(parsed.jobs)) {
      parsed.jobs.slice(0, MAX_HISTORY_JOBS).forEach((rawJob) => {
        const job = {
          ...rawJob,
          logs: Array.isArray(rawJob.logs) ? rawJob.logs.slice(-MAX_LOG_LINES) : [],
          progress: Number(rawJob.progress || 0),
          speed: String(rawJob.speed || ""),
          eta: String(rawJob.eta || ""),
          updatedAt: new Date().toISOString(),
          attempts: Number(rawJob.attempts || 0),
          strategyIndex: Number(rawJob.strategyIndex || 0),
          concurrentFragments: normalizeConcurrentFragments(rawJob.concurrentFragments)
        };

        if ([JOB_STATUS.DOWNLOADING, JOB_STATUS.QUEUED, JOB_STATUS.RETRYING].includes(job.status)) {
          job.status = JOB_STATUS.PAUSED;
          appendJobLog(job, "Recovered after app restart. Resume to continue.", "warn");
        }

        jobsById.set(job.id, job);
      });
    }
  } catch {
    globalSpeedLimit = "";
    clipboardWatcherEnabled = false;
    jobsById.clear();
    queuedJobIds.length = 0;
  }
}

function getSortedJobs() {
  return [...jobsById.values()].sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

function sendJobsSnapshot() {
  sendToRenderer("video:jobs-updated", {
    jobs: getSortedJobs(),
    runningJobId,
    globalSpeedLimit
  });
}

function appendJobLog(job, message, level = "info") {
  if (!job || !message) return;
  const logLine = {
    id: randomUUID(),
    at: new Date().toISOString(),
    message: String(message),
    level
  };
  job.logs = [...(job.logs || []), logLine].slice(-MAX_LOG_LINES);
  job.updatedAt = new Date().toISOString();

  sendToRenderer("video:download-log", {
    jobId: job.id,
    ...logLine
  });
}

function terminateProcess(child) {
  if (!child || child.killed) return;

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/f", "/t"], { windowsHide: true });
  } else {
    child.kill("SIGTERM");
  }
}

function normalizePositiveInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error("Playlist range values must be positive integers.");
  }
  return num;
}

function parseTimestampToSeconds(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;

  if (!/^\d+(?::\d{1,2}){0,2}$/.test(normalized)) {
    throw new Error("Time must use ss, mm:ss, or hh:mm:ss.");
  }

  const parts = normalized.split(":").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) {
    throw new Error("Time contains an invalid number.");
  }

  if (parts.length === 1) {
    return parts[0];
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    if (seconds >= 60) {
      throw new Error("Seconds must be below 60 in mm:ss.");
    }
    return minutes * 60 + seconds;
  }

  const [hours, minutes, seconds] = parts;
  if (minutes >= 60 || seconds >= 60) {
    throw new Error("Minutes and seconds must be below 60 in hh:mm:ss.");
  }
  return hours * 3600 + minutes * 60 + seconds;
}

function formatSecondsAsClock(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function normalizeClipRange({ enabled, start, end, maxDurationSeconds }) {
  if (!enabled) {
    return {
      clipEnabled: false,
      clipStart: "",
      clipEnd: "",
      clipStartSeconds: null,
      clipEndSeconds: null
    };
  }

  const startSeconds = parseTimestampToSeconds(start);
  const endSeconds = parseTimestampToSeconds(end);

  if (startSeconds === null || endSeconds === null) {
    throw new Error("Provide both clip start and clip end.");
  }

  if (startSeconds < 0 || endSeconds < 0) {
    throw new Error("Clip times must be zero or greater.");
  }

  if (endSeconds <= startSeconds) {
    throw new Error("Clip end must be greater than clip start.");
  }

  const maxDuration = Number(maxDurationSeconds || 0) || null;
  if (maxDuration) {
    if (startSeconds >= maxDuration) {
      throw new Error("Clip start must be inside the video duration.");
    }
    if (endSeconds > maxDuration) {
      throw new Error("Clip end cannot exceed the video duration.");
    }
  }

  return {
    clipEnabled: true,
    clipStart: formatSecondsAsClock(startSeconds),
    clipEnd: formatSecondsAsClock(endSeconds),
    clipStartSeconds: startSeconds,
    clipEndSeconds: endSeconds
  };
}

function normalizeIndex(rawValue, totalCount) {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value === 0) {
    throw new Error("Playlist range contains an invalid index.");
  }

  if (value < 0) {
    if (!totalCount) {
      throw new Error("Negative playlist indices require known playlist count.");
    }
    const translated = totalCount + value + 1;
    if (translated < 1) {
      throw new Error("Playlist range index exceeds playlist bounds.");
    }
    return translated;
  }

  return value;
}

function parsePlaylistSpec(spec, totalCount) {
  const result = new Set();
  const cleaned = String(spec || "").replace(/\s+/g, "");
  if (!cleaned) return result;

  const tokens = cleaned.split(",").filter(Boolean);
  if (tokens.length === 0) return result;

  tokens.forEach((token) => {
    if (token.includes(":")) {
      const parts = token.split(":");
      if (parts.length < 2 || parts.length > 3) {
        throw new Error("Invalid playlist range token.");
      }

      const rawStart = parts[0];
      const rawStop = parts[1];
      const rawStep = parts[2] || "1";
      if (!rawStart || !rawStop) {
        throw new Error("Playlist colon ranges must include both start and stop.");
      }

      const start = normalizeIndex(rawStart, totalCount);
      const stop = normalizeIndex(rawStop, totalCount);
      const step = Math.abs(Number(rawStep));
      if (!Number.isInteger(step) || step <= 0) {
        throw new Error("Playlist range step must be a positive integer.");
      }

      const dir = start <= stop ? 1 : -1;
      for (let idx = start; dir === 1 ? idx <= stop : idx >= stop; idx += dir * step) {
        result.add(idx);
      }
      return;
    }

    if (token.includes("-")) {
      const [startRaw, stopRaw] = token.split("-");
      const start = normalizeIndex(startRaw, totalCount);
      const stop = normalizeIndex(stopRaw, totalCount);
      const [min, max] = start <= stop ? [start, stop] : [stop, start];
      for (let idx = min; idx <= max; idx += 1) {
        result.add(idx);
      }
      return;
    }

    result.add(normalizeIndex(token, totalCount));
  });

  return result;
}

function compressPlaylistItems(indexSet) {
  const sorted = [...indexSet].filter((x) => x > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return "";

  const chunks = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i += 1) {
    const value = sorted[i];
    if (value === prev + 1) {
      prev = value;
      continue;
    }
    chunks.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = value;
    prev = value;
  }
  chunks.push(start === prev ? `${start}` : `${start}-${prev}`);
  return chunks.join(",");
}

function buildPlaylistItemsSpec(job) {
  const includeSpec = String(job.playlistInclude || "").trim();
  const excludeSpec = String(job.playlistExclude || "").trim();
  const totalCount = Number(job.playlistCount || 0) || null;

  if (!includeSpec && !excludeSpec) return "";

  let includeSet;
  if (includeSpec) {
    includeSet = parsePlaylistSpec(includeSpec, totalCount);
  } else {
    if (!totalCount) {
      throw new Error("Playlist count is required for exclude-only ranges. Fetch metadata first.");
    }
    includeSet = new Set(Array.from({ length: totalCount }, (_unused, idx) => idx + 1));
  }

  if (excludeSpec) {
    const excludeSet = parsePlaylistSpec(excludeSpec, totalCount);
    excludeSet.forEach((index) => includeSet.delete(index));
  }

  if (includeSet.size === 0) {
    throw new Error("Playlist filters excluded all items.");
  }

  return compressPlaylistItems(includeSet);
}

function expandStrategiesForSource(job, strategies) {
  if (!isYoutubeUrl(job.url)) {
    return strategies.map((strategy) => ({
      ...strategy,
      client: "",
      clientLabel: "web",
      extractorArgs: [],
      headers: []
    }));
  }

  const requestProfiles = buildYoutubeAttemptProfiles({
    hasAccountCookies: Boolean(job.cookiesFile || job.cookieBrowser)
  }).map((profile) => ({
    client: profile.client,
    clientLabel: profile.label
  }));

  return strategies.flatMap((strategy) =>
    requestProfiles.map((profile) => ({
      ...strategy,
      client: profile.client,
      clientLabel: profile.clientLabel,
      ...buildYoutubeRequestDirectives(profile.client)
    }))
  );
}

function buildVideoStrategies(job, ffmpegPath) {
  const cap = QUALITY_HEIGHT[job.quality] || null;
  const capFilter = cap ? `[height<=${cap}]` : "";
  const hasFfmpeg = Boolean(ffmpegPath);
  const isYoutubeSource = isYoutubeUrl(job.url);
  const strategies = [];

  if (job.selectedFormatId && job.selectedFormatId !== "auto") {
    strategies.push({
      name: `Selected format ${job.selectedFormatId}`,
      format: job.selectedFormatId,
      useFfmpeg: hasFfmpeg,
      mergeMp4: hasFfmpeg
    });
  }

  if (hasFfmpeg) {
    strategies.push(
      {
        name: isYoutubeSource ? "Best combined or merged stream" : "Best merged stream",
        format: isYoutubeSource ? `b${capFilter}/bv*${capFilter}+ba/b${capFilter}` : `bv*${capFilter}+ba/b${capFilter}`,
        useFfmpeg: true,
        mergeMp4: true
      },
      {
        name: "Fallback muxed mp4 stream",
        format: `best[ext=mp4][vcodec!=none][acodec!=none]${capFilter}/best[vcodec!=none][acodec!=none]${capFilter}`,
        useFfmpeg: false,
        mergeMp4: false
      },
      {
        name: "Fallback universal best stream",
        format: "best[vcodec!=none][acodec!=none]/best",
        useFfmpeg: false,
        mergeMp4: false
      }
    );
  } else {
    strategies.push(
      {
        name: "Single-file mp4 stream",
        format: `best[ext=mp4][vcodec!=none][acodec!=none]${capFilter}/best[vcodec!=none][acodec!=none]${capFilter}`,
        useFfmpeg: false,
        mergeMp4: false
      },
      {
        name: "Fallback universal best stream",
        format: "best[vcodec!=none][acodec!=none]/best",
        useFfmpeg: false,
        mergeMp4: false
      }
    );
  }

  const seen = new Set();
  return expandStrategiesForSource(job, strategies).filter((strategy) => {
    const key = `${strategy.format}|${strategy.useFfmpeg}|${strategy.mergeMp4}|${strategy.client}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildAudioStrategies(job) {
  return expandStrategiesForSource(job, [
    {
      name: "Best audio as MP3",
      format: "bestaudio/best",
      extractMp3: true
    },
    {
      name: "Fallback best available audio",
      format: "bestaudio/best",
      extractMp3: false
    }
  ]);
}

function buildDownloadArgs({ job, strategy, ffmpegPath, effectiveRateLimit }) {
  const outputTemplate = path.join(job.outputFolder, "%(title)s.%(ext)s");
  const args = ["--newline", "--no-warnings", "--ignore-config", "--continue", "-o", outputTemplate];
  let ffmpegLocationAdded = false;
  const addFfmpegLocation = () => {
    if (!ffmpegPath || ffmpegLocationAdded) return;
    args.push("--ffmpeg-location", ffmpegPath);
    ffmpegLocationAdded = true;
  };

  if (job.cookiesFile) {
    args.push("--cookies", job.cookiesFile);
  } else if (job.cookieBrowser) {
    args.push("--cookies-from-browser", job.cookieBrowser);
  }

  appendRequestDirectives(args, strategy);

  if (effectiveRateLimit) {
    args.push("--limit-rate", effectiveRateLimit);
  }

  if (Number(job.concurrentFragments || 1) > 1) {
    args.push("--concurrent-fragments", String(job.concurrentFragments));
  }

  if (job.allowPlaylist) {
    args.push("--yes-playlist");
    const itemSpec = buildPlaylistItemsSpec(job);
    if (itemSpec) {
      args.push("--playlist-items", itemSpec);
    } else {
      if (job.playlistStart) args.push("--playlist-start", String(job.playlistStart));
      if (job.playlistEnd) args.push("--playlist-end", String(job.playlistEnd));
    }
  } else {
    args.push("--no-playlist");
  }

  if (job.clipEnabled) {
    if (!ffmpegPath) {
      throw new Error("Clip range download requires ffmpeg.");
    }
    addFfmpegLocation();
    args.push("--download-sections", `*${job.clipStart}-${job.clipEnd}`);
  }

  if (job.mode === "audio") {
    if (strategy.extractMp3) {
      addFfmpegLocation();
      args.push("-f", strategy.format, "-x", "--audio-format", "mp3", "--audio-quality", "0");
    } else {
      args.push("-f", strategy.format);
    }
  } else {
    if (strategy.useFfmpeg) {
      addFfmpegLocation();
    }
    args.push("-f", strategy.format);
    if (strategy.mergeMp4 && ffmpegPath) {
      args.push("--merge-output-format", "mp4");
    }
  }

  args.push(job.url);
  return args;
}

function setJobStatus(job, status, message) {
  job.status = status;
  if (message) {
    appendJobLog(job, message, status === JOB_STATUS.FAILED ? "error" : "info");
  }

  sendToRenderer("video:download-status", {
    jobId: job.id,
    status,
    message: message || status
  });
}

function startNextQueuedJob() {
  if (runningJobId) return;

  while (queuedJobIds.length > 0) {
    const nextId = queuedJobIds.shift();
    const nextJob = jobsById.get(nextId);
    if (!nextJob) continue;
    if (nextJob.status !== JOB_STATUS.QUEUED && nextJob.status !== JOB_STATUS.RETRYING) continue;
    startJob(nextJob);
    return;
  }

  sendJobsSnapshot();
}

async function startJob(job) {
  if (!job) return;
  if (runningJobId) return;

  try {
    runningJobId = job.id;
    setJobStatus(job, JOB_STATUS.DOWNLOADING, "Download started.");
    sendJobsSnapshot();
    schedulePersist();

    const ytDlpPath = ensureManagedYtDlpPath();
    const ffmpegPath = getFfmpegPath();
    const strategies = job.mode === "audio" ? buildAudioStrategies(job) : buildVideoStrategies(job, ffmpegPath);

    if (job.strategyIndex >= strategies.length) {
      job.strategyIndex = 0;
    }

    const strategy = strategies[job.strategyIndex];
    const effectiveRateLimit = resolveEffectiveRate(globalSpeedLimit, job.perDownloadSpeedLimit);
    let effectiveStrategy = strategy;
    let args;

    activeDownloads.set(job.id, {
      process: null,
      canceled: false,
      paused: false,
      stderrBuffer: "",
      preflight: true
    });

    // `yt-dlp -F` can return storyboard-only YouTube results even when a direct download still succeeds.
    const shouldProbeFormats = false;
    if (shouldProbeFormats && job.mode === "video" && !job.allowPlaylist && isYoutubeUrl(job.url)) {
      try {
        appendJobLog(job, "Probing available formats before download.");
        const probeResult = await probeVideoFormatsWithFallback({
          url: job.url,
          cookiesFile: job.cookiesFile,
          cookieBrowser: job.cookieBrowser,
          client: strategy.client
        });
        const preflightEntry = activeDownloads.get(job.id);
        if (preflightEntry?.paused) {
          activeDownloads.delete(job.id);
          runningJobId = "";
          setJobStatus(job, JOB_STATUS.PAUSED, "Paused.");
          sendJobsSnapshot();
          schedulePersist();
          startNextQueuedJob();
          return;
        }
        if (preflightEntry?.canceled) {
          activeDownloads.delete(job.id);
          runningJobId = "";
          setJobStatus(job, JOB_STATUS.CANCELED, "Canceled.");
          sendJobsSnapshot();
          schedulePersist();
          startNextQueuedJob();
          return;
        }

        if (probeResult.ok && probeResult.client !== strategy.client) {
          effectiveStrategy = {
            ...strategy,
            client: probeResult.client,
            clientLabel: probeResult.clientLabel,
            ...buildYoutubeRequestDirectives(probeResult.client)
          };
          appendJobLog(job, `Format probe recovered with ${probeResult.clientLabel} client.`, "warn");
        } else if (probeResult.noFormats) {
          activeDownloads.delete(job.id);
          runningJobId = "";

          const hasFallback = job.strategyIndex < strategies.length - 1;
          if (hasFallback) {
            job.strategyIndex += 1;
            job.attempts = Number(job.attempts || 0) + 1;
            setJobStatus(job, JOB_STATUS.RETRYING, `Retrying with fallback #${job.strategyIndex + 1}.`);
            queuedJobIds.unshift(job.id);
            sendJobsSnapshot();
            schedulePersist();
            startNextQueuedJob();
            return;
          }

          const detail = (probeResult.stderr || probeResult.stdout || "").trim();
          const finalMessage = detail
            ? `Unable to extract video formats. This may be due to YouTube restrictions or a client mismatch. Try enabling authentication or retrying.\n\n${detail}`
            : "Unable to extract video formats. This may be due to YouTube restrictions or a client mismatch. Try enabling authentication or retrying.";
          setJobStatus(job, JOB_STATUS.FAILED, finalMessage);
          sendToRenderer("video:download-error", {
            jobId: job.id,
            url: job.url,
            message: finalMessage,
            reason: "no_formats_available",
            detail
          });
          pushToast({
            type: "error",
            title: "Format Extraction Failed",
            message: `${job.title || "Item"} could not expose downloadable formats.`,
            jobId: job.id
          });
          sendJobsSnapshot();
          schedulePersist();
          startNextQueuedJob();
          return;
        }
      } catch (error) {
        appendJobLog(job, `Format probe skipped: ${error.message}`, "warn");
      }
    }

    try {
      args = buildDownloadArgs({
        job,
        strategy: effectiveStrategy,
        ffmpegPath,
        effectiveRateLimit
      });
    } catch (error) {
      activeDownloads.delete(job.id);
      runningJobId = "";
      setJobStatus(job, JOB_STATUS.FAILED, error.message || "Invalid playlist/filter configuration.");
      pushToast({
        type: "error",
        title: "Job Failed",
        message: error.message || "Invalid playlist/filter configuration.",
        jobId: job.id
      });
      sendJobsSnapshot();
      schedulePersist();
      startNextQueuedJob();
      return;
    }

    appendJobLog(job, `Strategy: ${effectiveStrategy.name}`);
    appendJobLog(job, `Using format: ${effectiveStrategy.format}`);
    if (effectiveStrategy.clientLabel) {
      appendJobLog(job, `Using client: ${effectiveStrategy.clientLabel}`);
    }
    if (effectiveRateLimit) {
      appendJobLog(job, `Speed limit: ${effectiveRateLimit}/s`);
    }
    if (Number(job.concurrentFragments || 1) > 1) {
      appendJobLog(job, `Turbo mode: ${job.concurrentFragments} fragments.`);
    }
    if (job.mode === "video" && !ffmpegPath) {
      appendJobLog(job, "FFmpeg not found. Smart fallback will use single-file formats.", "warn");
    }

    const child = spawn(ytDlpPath, args, { windowsHide: true });
    activeDownloads.set(job.id, {
      process: child,
      canceled: false,
      paused: false,
      stderrBuffer: "",
      preflight: false
    });

    const onData = (buffer) => {
    const text = buffer.toString();
    const lines = text.split(/\r?\n/).filter(Boolean);
    lines.forEach((line) => {
      const level = line.startsWith("ERROR") ? "error" : line.includes("WARNING") ? "warn" : "info";
      appendJobLog(job, line, level);

      if (job.clipEnabled && job.clipStartSeconds !== null && job.clipEndSeconds !== null) {
        const clipDuration = Math.max(1, Number(job.clipEndSeconds) - Number(job.clipStartSeconds));
        const ffmpegProgress = parseFfmpegProgress(line);
        if (ffmpegProgress) {
          const ffmpegPercent = Math.min(99, Math.max(0, (ffmpegProgress.processedSeconds / clipDuration) * 100));
          if (ffmpegPercent > Number(job.progress || 0)) {
            const remainingSeconds = Math.max(0, clipDuration - ffmpegProgress.processedSeconds);
            const derivedEta =
              ffmpegProgress.speedX && ffmpegProgress.speedX > 0
                ? formatEtaClock(remainingSeconds / ffmpegProgress.speedX)
                : "Processing";
            job.progress = ffmpegPercent;
            job.speed = ffmpegProgress.speedX ? `${ffmpegProgress.speedX.toFixed(2)}x` : "";
            job.eta = derivedEta || "Processing";
            sendToRenderer("video:download-progress", {
              jobId: job.id,
              percent: job.progress,
              speed: job.speed,
              eta: job.eta
            });
          }
        }
      }

      const progress = parseProgressLine(line);
      if (!progress) return;

      let percent = Number(progress.percent || 0);
      if (job.clipEnabled && percent >= 100) {
        // For clipped downloads, keep <100 until yt-dlp process actually exits successfully.
        percent = 99;
      }

      job.progress = percent;
      job.speed = progress.speed || "";
      job.eta = progress.eta || (job.clipEnabled && percent >= 99 ? "Processing" : "");
      sendToRenderer("video:download-progress", {
        jobId: job.id,
        percent: job.progress,
        speed: job.speed,
        eta: job.eta
      });
    });
    };

    child.stdout.on("data", onData);

    child.stderr.on("data", (buffer) => {
      const entry = activeDownloads.get(job.id);
      if (entry) {
        entry.stderrBuffer += buffer.toString();
        activeDownloads.set(job.id, entry);
      }
      onData(buffer);
    });
    child.on("error", (error) => {
      activeDownloads.delete(job.id);
      runningJobId = "";
      setJobStatus(job, JOB_STATUS.FAILED, `Failed to spawn yt-dlp: ${error.message}`);
      sendToRenderer("video:download-error", { jobId: job.id, message: error.message });
      pushToast({
        type: "error",
        title: "Download Failed",
        message: `${job.title || "Item"} failed to start.`,
        jobId: job.id
      });
      sendJobsSnapshot();
      schedulePersist();
      startNextQueuedJob();
    });

    child.on("close", (code) => {
      const entry = activeDownloads.get(job.id);
      activeDownloads.delete(job.id);
      runningJobId = "";

      if (entry?.paused) {
        setJobStatus(job, JOB_STATUS.PAUSED, "Paused.");
        sendJobsSnapshot();
        schedulePersist();
        startNextQueuedJob();
        return;
      }

      if (entry?.canceled) {
        setJobStatus(job, JOB_STATUS.CANCELED, "Canceled.");
        sendJobsSnapshot();
        schedulePersist();
        startNextQueuedJob();
        return;
      }

      if (code === 0) {
        job.progress = 100;
        job.speed = "";
        job.eta = "00:00";
        setJobStatus(job, JOB_STATUS.COMPLETED, "Download completed.");
        sendToRenderer("video:download-progress", { jobId: job.id, percent: 100, speed: "", eta: "00:00" });
        sendToRenderer("video:download-complete", {
          jobId: job.id,
          outputFolder: job.outputFolder,
          mode: job.mode
        });
        pushToast({
          type: "success",
          title: "Download Complete",
          message: `${job.title || "Item"} finished successfully.`,
          jobId: job.id
        });
        sendJobsSnapshot();
        schedulePersist();
        startNextQueuedJob();
        return;
      }

      const stderr = (entry?.stderrBuffer || "").trim();
      const authError = needsBrowserCookies(stderr);
      const browserAccessError = Boolean(job.cookieBrowser) && isBrowserCookieAccessError(stderr);

      if (authError || browserAccessError) {
        let reason = "cookies_required";
        let promptMessage =
          "This video needs authentication. Choose a browser or cookies.txt file, then retry.";
        let canUseCookiesFile = true;

        if (!job.cookieBrowser && !job.cookiesFile) {
          reason = "cookies_required";
          promptMessage =
            "This video needs authentication for age/bot checks. Choose a browser or cookies.txt file, then retry.";
        } else if (browserAccessError) {
          reason = "browser_cookies_failed";
          const browserName = job.cookieBrowser.charAt(0).toUpperCase() + job.cookieBrowser.slice(1);
          promptMessage = `Could not read ${browserName} cookies on this system. Use cookies.txt and retry.`;
        } else if (job.cookiesFile || job.cookieBrowser) {
          reason = "cookies_auth_failed";
          promptMessage =
            "The selected cookies did not grant access to this video. Export fresh YouTube cookies and retry.";
        }

        const finalMessage = stderr || "Download failed due to authentication.";
        setJobStatus(job, JOB_STATUS.FAILED, finalMessage);
        sendToRenderer("video:download-error", {
          jobId: job.id,
          url: job.url,
          message: finalMessage,
          reason,
          promptMessage,
          detail: stderr || "",
          supportedBrowsers: DEFAULT_COOKIE_BROWSERS,
          canUseCookiesFile
        });
        pushToast({
          type: "error",
          title: "Authentication Needed",
          message: `${job.title || "Item"} requires cookies to continue.`,
          jobId: job.id
        });
        sendJobsSnapshot();
        schedulePersist();
        startNextQueuedJob();
        return;
      }

      if (isNoFormatsAvailable(stderr)) {
        const friendly =
          "Unable to extract video formats. This may be due to YouTube restrictions or a client mismatch. Try enabling authentication or retrying.";
        const finalMessage = stderr
          ? `${friendly}\n\n${stderr}`
          : friendly;
        setJobStatus(job, JOB_STATUS.FAILED, finalMessage);
        sendToRenderer("video:download-error", {
          jobId: job.id,
          url: job.url,
          message: finalMessage,
          reason: "no_formats_available",
          detail: stderr || ""
        });
        pushToast({
          type: "error",
          title: "Format Extraction Failed",
          message: `${job.title || "Item"} could not expose downloadable formats.`,
          jobId: job.id
        });
        sendJobsSnapshot();
        schedulePersist();
        startNextQueuedJob();
        return;
      }

      const hasFallback = job.strategyIndex < strategies.length - 1;
      if (hasFallback) {
        job.strategyIndex += 1;
        job.attempts = Number(job.attempts || 0) + 1;
        setJobStatus(job, JOB_STATUS.RETRYING, `Retrying with fallback #${job.strategyIndex + 1}.`);
        queuedJobIds.unshift(job.id);
        sendJobsSnapshot();
        schedulePersist();
        startNextQueuedJob();
        return;
      }

      const finalMessage = stderr || "Download failed after all fallback strategies.";
      setJobStatus(job, JOB_STATUS.FAILED, finalMessage);
      sendToRenderer("video:download-error", {
        jobId: job.id,
        message: finalMessage
      });
      pushToast({
        type: "error",
        title: "Download Failed",
        message: `${job.title || "Item"} failed. See logs for details.`,
        jobId: job.id
      });
      sendJobsSnapshot();
      schedulePersist();
      startNextQueuedJob();
    });
  } catch (error) {
    activeDownloads.delete(job.id);
    runningJobId = "";
    const message = error.message || "Download failed before yt-dlp could start.";
    setJobStatus(job, JOB_STATUS.FAILED, message);
    sendToRenderer("video:download-error", { jobId: job.id, message });
    pushToast({
      type: "error",
      title: "Download Failed",
      message,
      jobId: job.id
    });
    sendJobsSnapshot();
    schedulePersist();
    startNextQueuedJob();
  }
}

function runYtDlpCommand(args, { timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const ytDlpPath = ensureManagedYtDlpPath();
    const child = spawn(ytDlpPath, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
      terminateProcess(child);
      reject(new Error("yt-dlp command timed out."));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(new Error(`Unable to run yt-dlp: ${error.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ code, stdout, stderr });
    });
  });
}

function normalizeVersionTag(value) {
  return String(value || "").trim().replace(/^v/i, "");
}

function parseVersionParts(value) {
  const normalized = normalizeVersionTag(value);
  if (!normalized) return [];
  const core = normalized.split("-")[0];
  if (!core) return [];
  return core.split(".").map((part) => {
    const match = String(part).match(/^(\d+)/);
    return match ? Number(match[1]) : 0;
  });
}

function compareSemverLike(left, right) {
  const a = parseVersionParts(left);
  const b = parseVersionParts(right);
  const max = Math.max(a.length, b.length);
  for (let idx = 0; idx < max; idx += 1) {
    const aPart = Number(a[idx] || 0);
    const bPart = Number(b[idx] || 0);
    if (aPart > bPart) return 1;
    if (aPart < bPart) return -1;
  }
  return 0;
}

function fetchLatestAppRelease() {
  return new Promise((resolve, reject) => {
    const request = https.request(
      APP_RELEASES_API_URL,
      {
        method: "GET",
        headers: {
          "User-Agent": "StreamFetch",
          Accept: "application/vnd.github+json"
        },
        timeout: 15000
      },
      (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk.toString();
        });
        response.on("end", () => {
          if (response.statusCode !== 200) {
            reject(new Error(`GitHub API returned ${response.statusCode}.`));
            return;
          }

          try {
            const parsed = JSON.parse(body);
            resolve({
              tagName: String(parsed.tag_name || "").trim(),
              url: String(parsed.html_url || "").trim(),
              name: String(parsed.name || "").trim(),
              publishedAt: String(parsed.published_at || "").trim()
            });
          } catch {
            reject(new Error("Failed to parse latest app release response."));
          }
        });
      }
    );

    request.on("error", (error) => reject(error));
    request.on("timeout", () => {
      request.destroy(new Error("App update check timed out."));
    });
    request.end();
  });
}

function fetchLatestYtDlpVersion() {
  return new Promise((resolve, reject) => {
    const request = https.request(
      "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest",
      {
        method: "GET",
        headers: {
          "User-Agent": "StreamFetch",
          Accept: "application/vnd.github+json"
        },
        timeout: 15000
      },
      (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk.toString();
        });
        response.on("end", () => {
          if (response.statusCode !== 200) {
            reject(new Error(`GitHub API returned ${response.statusCode}.`));
            return;
          }

          try {
            const parsed = JSON.parse(body);
            resolve(String(parsed.tag_name || "").trim());
          } catch {
            reject(new Error("Failed to parse latest yt-dlp version response."));
          }
        });
      }
    );

    request.on("error", (error) => reject(error));
    request.on("timeout", () => {
      request.destroy(new Error("yt-dlp update check timed out."));
    });
    request.end();
  });
}

async function ensureYtDlpFresh() {
  const now = Date.now();
  if (ytDlpRefreshState.checkedAt && now - ytDlpRefreshState.checkedAt < YTDLP_AUTO_UPDATE_TTL_MS) {
    return ytDlpRefreshState;
  }

  if (ytDlpRefreshPromise) {
    return ytDlpRefreshPromise;
  }

  ytDlpRefreshPromise = (async () => {
    const current = await runYtDlpCommand(["--version"], { timeoutMs: 30000 });
    if (current.code !== 0) {
      throw new Error(current.stderr.trim() || "Failed to get current yt-dlp version.");
    }

    const currentVersion = current.stdout.trim();

    try {
      const latestVersion = await fetchLatestYtDlpVersion();
      if (latestVersion && latestVersion !== currentVersion) {
        await runYtDlpCommand(["-U"], { timeoutMs: 240000 });
        const updated = await runYtDlpCommand(["--version"], { timeoutMs: 30000 });
        const resolvedVersion = updated.code === 0 ? updated.stdout.trim() : currentVersion;
        ytDlpRefreshState = {
          checkedAt: Date.now(),
          currentVersion: resolvedVersion,
          latestVersion,
          lastError: "",
          updated: resolvedVersion !== currentVersion
        };
        return ytDlpRefreshState;
      }

      ytDlpRefreshState = {
        checkedAt: Date.now(),
        currentVersion,
        latestVersion,
        lastError: "",
        updated: false
      };
      return ytDlpRefreshState;
    } catch (error) {
      ytDlpRefreshState = {
        checkedAt: Date.now(),
        currentVersion,
        latestVersion: "",
        lastError: error.message || "Unable to refresh yt-dlp automatically.",
        updated: false
      };
      return ytDlpRefreshState;
    }
  })().finally(() => {
    ytDlpRefreshPromise = null;
  });

  return ytDlpRefreshPromise;
}

function buildMetadataArgs({ url, cookiesFile, cookieBrowser, client = "" }) {
  const args = ["-J", "--no-warnings", "--skip-download", "--ignore-no-formats-error"];
  if (cookiesFile) {
    args.push("--cookies", cookiesFile);
  } else if (cookieBrowser) {
    args.push("--cookies-from-browser", cookieBrowser);
  }
  applySourceRequestDirectives(args, url, client);
  args.push(url);
  return args;
}

function buildFormatProbeArgs({ url, cookiesFile, cookieBrowser, client = "" }) {
  const args = ["-F", "--no-warnings", "--ignore-config", "--no-playlist"];
  if (cookiesFile) {
    args.push("--cookies", cookiesFile);
  } else if (cookieBrowser) {
    args.push("--cookies-from-browser", cookieBrowser);
  }
  applySourceRequestDirectives(args, url, client);
  args.push(url);
  return args;
}

function buildMetadataFormats(entry) {
  return (entry?.formats || []).map((item) => ({
    formatId: item.format_id || "",
    ext: item.ext || "",
    resolution: item.resolution || (item.height ? `${item.height}p` : "Unknown"),
    height: item.height || null,
    fps: item.fps || null,
    vcodec: item.vcodec || "",
    acodec: item.acodec || "",
    hasVideo: item.vcodec && item.vcodec !== "none",
    hasAudio: item.acodec && item.acodec !== "none",
    tbr: item.tbr || null,
    formatNote: item.format_note || ""
  }));
}

function parseMetadataPayload(stdout) {
  let metadata;
  try {
    metadata = JSON.parse(stdout);
  } catch {
    throw new Error("yt-dlp returned invalid metadata JSON.");
  }

  const primaryEntry =
    Array.isArray(metadata.entries) && metadata.entries.length > 0 ? metadata.entries[0] : metadata;
  const formats = buildMetadataFormats(primaryEntry);

  return {
    metadata,
    primaryEntry,
    formats
  };
}

async function fetchVideoMetadataWithFallback({ url, cookiesFile, cookieBrowser }) {
  const attempts = isYoutubeUrl(url)
    ? buildYoutubeAttemptProfiles({
        hasAccountCookies: Boolean(cookiesFile || cookieBrowser)
      })
    : [{ client: "", label: "default" }];
  let pendingAuthResult = null;
  let lastError = "";

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    const args = buildMetadataArgs({
      url,
      cookiesFile,
      cookieBrowser,
      client: attempt.client
    });
    const { code, stdout, stderr } = await runYtDlpCommand(args, {
      timeoutMs: 180000
    });
    const message = stderr.trim() || "Failed to fetch video metadata.";

    if (code !== 0) {
      lastError = message;
      if (cookieBrowser && isBrowserCookieAccessError(message)) {
        const browserName = cookieBrowser.charAt(0).toUpperCase() + cookieBrowser.slice(1);
        return {
          ok: false,
          reason: "browser_cookies_failed",
          message: `Could not read ${browserName} cookies on this system. Close the browser and retry, or use a cookies.txt file.`,
          detail: message,
          supportedBrowsers: DEFAULT_COOKIE_BROWSERS
        };
      }
      if (!cookieBrowser && !cookiesFile && needsBrowserCookies(message)) {
        pendingAuthResult = {
          ok: false,
          reason: "cookies_required",
          message:
            "This video needs authentication from your signed-in browser session. Choose a browser and retry.",
          supportedBrowsers: DEFAULT_COOKIE_BROWSERS
        };
      }
      if (index < attempts.length - 1 && (isNoFormatsAvailable(stderr, stdout) || isYoutubeUrl(url))) {
        continue;
      }
      break;
    }

    const { metadata, primaryEntry, formats } = parseMetadataPayload(stdout);
    if (formats.length === 0 && index < attempts.length - 1) {
      lastError = stderr.trim();
      continue;
    }

    if (formats.length === 0) {
      return {
        ok: false,
        reason: "no_formats_available",
        message:
          "Unable to extract video formats. This may be due to YouTube restrictions or a client mismatch. Try enabling authentication or retrying.",
        detail: stderr.trim()
      };
    }

    return {
      ok: true,
      data: {
        title: primaryEntry.title || metadata.title || "Untitled",
        thumbnail: primaryEntry.thumbnail || metadata.thumbnail || "",
        duration: primaryEntry.duration || metadata.duration || null,
        extractor: metadata.extractor_key || metadata.extractor || "Unknown",
        isPlaylist: Boolean(Array.isArray(metadata.entries)),
        playlistCount: Array.isArray(metadata.entries) ? metadata.entries.length : 0,
        formats,
        extractionClient: attempt.label
      }
    };
  }

  if (pendingAuthResult) {
    return pendingAuthResult;
  }

  if (isNoFormatsAvailable(lastError)) {
    return {
      ok: false,
      reason: "no_formats_available",
      message:
        "Unable to extract video formats. This may be due to YouTube restrictions or a client mismatch. Try enabling authentication or retrying.",
      detail: lastError
    };
  }

  throw new Error(lastError || "Failed to fetch video metadata.");
}

async function probeVideoFormatsWithFallback({ url, cookiesFile, cookieBrowser, client = "" }) {
  const youtubeProfiles = buildYoutubeAttemptProfiles({
    hasAccountCookies: Boolean(cookiesFile || cookieBrowser)
  });
  const attempts = isYoutubeUrl(url)
    ? [
        { client, label: client || "web" },
        ...youtubeProfiles.filter((profile) => profile.client !== client)
      ]
    : [{ client, label: client || "web" }];
  let lastResult = {
    ok: false,
    clientLabel: attempts[0]?.label || "web",
    stdout: "",
    stderr: ""
  };

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    const { code, stdout, stderr } = await runYtDlpCommand(
      buildFormatProbeArgs({
        url,
        cookiesFile,
        cookieBrowser,
        client: attempt.client
      }),
      { timeoutMs: 180000 }
    );
    const formatIds = extractProbeFormatIds(stdout);
    const hasPlayableFormats = isYoutubeUrl(url)
      ? formatIds.some((id) => !/^sb\d+$/i.test(id))
      : formatIds.length > 0;
    const noFormats = isNoFormatsAvailable(stderr, stdout) || (code === 0 && !hasPlayableFormats);
    lastResult = {
      ok: code === 0 && hasPlayableFormats,
      client: attempt.client,
      clientLabel: attempt.label,
      stdout,
      stderr,
      noFormats
    };
    if (lastResult.ok || !noFormats || index === attempts.length - 1) {
      return lastResult;
    }
  }

  return lastResult;
}

ipcMain.handle("window:minimize", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
});

ipcMain.handle("window:toggle-maximize", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return false;
  }
  mainWindow.maximize();
  return true;
});

ipcMain.handle("window:close", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
});
ipcMain.handle("app:open-external", async (_event, url) => {
  const normalizedUrl = String(url || "").trim();
  if (!isValidHttpUrl(normalizedUrl)) {
    return { success: false, message: "Invalid URL." };
  }

  await shell.openExternal(normalizedUrl);
  return { success: true };
});
ipcMain.handle("app:check-update", async () => {
  const currentVersion = String(app.getVersion() || "").trim();
  const latest = await fetchLatestAppRelease();
  const latestTag = String(latest.tagName || "").trim();
  const latestVersion = normalizeVersionTag(latestTag);
  const normalizedCurrent = normalizeVersionTag(currentVersion);

  let updateAvailable = false;
  if (latestVersion && normalizedCurrent) {
    updateAvailable = compareSemverLike(latestVersion, normalizedCurrent) > 0;
  } else if (latestVersion) {
    updateAvailable = latestVersion !== normalizedCurrent;
  }

  return {
    currentVersion: normalizedCurrent || currentVersion,
    latestVersion,
    latestTag,
    releaseUrl: latest.url || "https://github.com/Shripad735/streamfetch/releases/latest",
    releaseName: latest.name || latestTag || "",
    publishedAt: latest.publishedAt || "",
    updateAvailable
  };
});

ipcMain.handle("dialog:select-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle("dialog:select-cookies-file", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      { name: "Cookie Files", extensions: ["txt", "cookies"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle("video:get-jobs", async () => ({
  jobs: getSortedJobs(),
  runningJobId,
  globalSpeedLimit
}));

ipcMain.handle("settings:get", async () => getSettingsPayload());

ipcMain.handle("settings:set-global-speed-limit", async (_event, value) => {
  globalSpeedLimit = normalizeRateLimit(value);
  sendJobsSnapshot();
  schedulePersist();
  return { success: true, globalSpeedLimit };
});

ipcMain.handle("settings:set-clipboard-watcher-enabled", async (_event, value) => {
  clipboardWatcherEnabled = normalizeClipboardWatcherEnabled(value);
  resetClipboardWatcherState();
  schedulePersist();
  return {
    success: true,
    clipboardWatcherEnabled
  };
});

ipcMain.handle("video:fetch-info", async (_event, url) => {
  const request = typeof url === "string" ? { url } : url || {};
  const normalizedUrl = String(request.url || "").trim();
  if (!isValidHttpUrl(normalizedUrl)) {
    throw new Error("Enter a valid video URL.");
  }

  const cookiesFile = normalizeCookiesFile(request.cookiesFile);
  const cookieBrowser = cookiesFile ? "" : normalizeCookieBrowser(request.cookieBrowser);

  if (isYoutubeUrl(normalizedUrl)) {
    await ensureYtDlpFresh();
  }

  return fetchVideoMetadataWithFallback({
    url: normalizedUrl,
    cookiesFile,
    cookieBrowser
  });
});

ipcMain.handle("video:start-download", async (_event, payload) => {
  const url = String(payload?.url || "").trim();
  if (!isValidHttpUrl(url)) {
    throw new Error("Enter a valid video URL before downloading.");
  }

  if (isYoutubeUrl(url)) {
    await ensureYtDlpFresh();
  }

  const outputFolder = String(payload?.outputFolder || "").trim();
  if (!outputFolder) {
    throw new Error("Select a download folder.");
  }
  if (!fs.existsSync(outputFolder)) {
    throw new Error("Selected download folder does not exist.");
  }

  const mode = payload?.mode === "audio" ? "audio" : "video";
  const quality = QUALITY_OPTIONS.has(payload?.quality) ? payload.quality : "best";
  const allowPlaylist = Boolean(payload?.allowPlaylist);
  const perDownloadSpeedLimit = normalizeRateLimit(payload?.perDownloadSpeedLimit || "");
  const concurrentFragments = normalizeConcurrentFragments(payload?.concurrentFragments);
  const selectedFormatId = String(payload?.selectedFormatId || "auto").trim() || "auto";
  const clipEnabled = Boolean(payload?.clipEnabled);
  const sourceDurationSeconds = Number(payload?.sourceDurationSeconds || 0) || null;
  const cookiesFile = normalizeCookiesFile(payload?.cookiesFile);
  const cookieBrowser = cookiesFile ? "" : normalizeCookieBrowser(payload?.cookieBrowser);

  if (clipEnabled && allowPlaylist) {
    throw new Error("Clip range is available only for single videos.");
  }

  const playlistStart = allowPlaylist ? normalizePositiveInt(payload?.playlistStart) : null;
  const playlistEnd = allowPlaylist ? normalizePositiveInt(payload?.playlistEnd) : null;
  if (playlistStart && playlistEnd && playlistEnd < playlistStart) {
    throw new Error("Playlist end must be greater than or equal to playlist start.");
  }

  const clipRange = normalizeClipRange({
    enabled: clipEnabled,
    start: payload?.clipStart,
    end: payload?.clipEnd,
    maxDurationSeconds: sourceDurationSeconds
  });
  if (clipRange.clipEnabled && !getFfmpegPath()) {
    throw new Error("Clip range download requires ffmpeg. Use a full download or make ffmpeg available.");
  }

  const job = {
    id: randomUUID(),
    url,
    title: String(payload?.title || "Untitled"),
    thumbnail: String(payload?.thumbnail || ""),
    outputFolder,
    mode,
    quality,
    selectedFormatId,
    cookieBrowser,
    cookiesFile,
    allowPlaylist,
    playlistStart,
    playlistEnd,
    playlistInclude: String(payload?.playlistInclude || "").trim(),
    playlistExclude: String(payload?.playlistExclude || "").trim(),
    playlistCount: Number(payload?.playlistCount || 0) || null,
    clipEnabled: clipRange.clipEnabled,
    clipStart: clipRange.clipStart,
    clipEnd: clipRange.clipEnd,
    clipStartSeconds: clipRange.clipStartSeconds,
    clipEndSeconds: clipRange.clipEndSeconds,
    perDownloadSpeedLimit,
    concurrentFragments,
    status: JOB_STATUS.QUEUED,
    progress: 0,
    speed: "",
    eta: "",
    logs: [],
    attempts: 0,
    strategyIndex: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  appendJobLog(job, "Added to queue.");
  if (clipRange.clipEnabled) {
    appendJobLog(job, `Clip range: ${clipRange.clipStart} to ${clipRange.clipEnd}.`);
  }
  jobsById.set(job.id, job);
  queuedJobIds.push(job.id);

  setJobStatus(job, JOB_STATUS.QUEUED, "Queued.");
  sendJobsSnapshot();
  schedulePersist();
  startNextQueuedJob();

  return { jobId: job.id };
});

ipcMain.handle("video:pause-download", async (_event, jobId) => {
  const id = String(jobId || "");
  const job = jobsById.get(id);
  if (!job) return { success: false, message: "Download job not found." };

  if (runningJobId === id) {
    const entry = activeDownloads.get(id);
    if (!entry) return { success: false, message: "Active process not found." };
    entry.paused = true;
    activeDownloads.set(id, entry);
    appendJobLog(job, "Pause requested.");
    if (entry.process) {
      terminateProcess(entry.process);
    }
    sendJobsSnapshot();
    schedulePersist();
    return { success: true };
  }

  const queueIndex = queuedJobIds.indexOf(id);
  if (queueIndex >= 0) {
    queuedJobIds.splice(queueIndex, 1);
    setJobStatus(job, JOB_STATUS.PAUSED, "Paused while queued.");
    sendJobsSnapshot();
    schedulePersist();
    return { success: true };
  }

  return { success: false, message: "Only queued or active downloads can be paused." };
});

ipcMain.handle("video:resume-download", async (_event, payload) => {
  const request = typeof payload === "string" ? { jobId: payload } : payload || {};
  const id = String(request.jobId || "");
  const job = jobsById.get(id);
  if (!job) return { success: false, message: "Download job not found." };

  if (![JOB_STATUS.PAUSED, JOB_STATUS.FAILED, JOB_STATUS.CANCELED].includes(job.status)) {
    return { success: false, message: "Only paused/failed/canceled items can be resumed." };
  }

  const cookiesFile = normalizeCookiesFile(request.cookiesFile);
  const cookieBrowser = cookiesFile ? "" : normalizeCookieBrowser(request.cookieBrowser);
  if (cookiesFile || cookieBrowser) {
    job.cookiesFile = cookiesFile;
    job.cookieBrowser = cookieBrowser;
    if (cookiesFile) {
      appendJobLog(job, "Authentication: using selected cookies file.");
    } else {
      appendJobLog(job, `Authentication: using ${cookieBrowser} browser cookies.`);
    }
  }

  job.status = JOB_STATUS.QUEUED;
  job.speed = "";
  job.eta = "";
  appendJobLog(job, "Queued for resume.");
  queuedJobIds.push(id);
  sendJobsSnapshot();
  schedulePersist();
  startNextQueuedJob();
  return { success: true };
});
ipcMain.handle("video:cancel-download", async (_event, jobId) => {
  const id = String(jobId || "");
  const job = jobsById.get(id);
  if (!job) return { success: false, message: "Download job not found." };

  if (runningJobId === id) {
    const entry = activeDownloads.get(id);
    if (!entry) return { success: false, message: "Active process not found." };
    entry.canceled = true;
    activeDownloads.set(id, entry);
    appendJobLog(job, "Cancel requested.");
    if (entry.process) {
      terminateProcess(entry.process);
    }
    sendJobsSnapshot();
    schedulePersist();
    return { success: true };
  }

  const queueIndex = queuedJobIds.indexOf(id);
  if (queueIndex >= 0) {
    queuedJobIds.splice(queueIndex, 1);
  }

  setJobStatus(job, JOB_STATUS.CANCELED, "Canceled.");
  sendJobsSnapshot();
  schedulePersist();
  return { success: true };
});

ipcMain.handle("video:clear-finished", async () => {
  const removeStatuses = new Set([JOB_STATUS.COMPLETED, JOB_STATUS.CANCELED, JOB_STATUS.FAILED]);
  [...jobsById.keys()].forEach((jobId) => {
    const job = jobsById.get(jobId);
    if (job && removeStatuses.has(job.status)) {
      jobsById.delete(jobId);
    }
  });
  sendJobsSnapshot();
  schedulePersist();
  return { success: true };
});

ipcMain.handle("ytdlp:check-update", async () => {
  const current = await runYtDlpCommand(["--version"], { timeoutMs: 30000 });
  if (current.code !== 0) {
    throw new Error(current.stderr.trim() || "Failed to get current yt-dlp version.");
  }

  const currentVersion = current.stdout.trim();
  const latestVersion = await fetchLatestYtDlpVersion();
  return {
    currentVersion,
    latestVersion,
    updateAvailable: Boolean(latestVersion) && latestVersion !== currentVersion
  };
});

ipcMain.handle("ytdlp:update", async () => {
  const updateResult = await runYtDlpCommand(["-U"], { timeoutMs: 240000 });
  const versionResult = await runYtDlpCommand(["--version"], { timeoutMs: 30000 });

  const message = `${updateResult.stdout}${updateResult.stderr}`.trim();
  const currentVersion = versionResult.code === 0 ? versionResult.stdout.trim() : "";

  return {
    success: updateResult.code === 0,
    output: message,
    currentVersion
  };
});

app.whenReady().then(() => {
  ensureManagedYtDlpPath();
  loadState();
  createWindow();
  startClipboardWatcher();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  activeDownloads.forEach((entry) => terminateProcess(entry.process));
  activeDownloads.clear();
  if (clipboardWatcherTimer) {
    clearInterval(clipboardWatcherTimer);
    clipboardWatcherTimer = null;
  }
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  persistState();
});
