import { useCallback, useEffect, useMemo, useState } from "react";
import ClipStudio from "./components/ClipStudio";
import DownloadCard from "./components/DownloadCard";
import HistoryList from "./components/HistoryList";
import LogPanel from "./components/LogPanel";
import ToastStack from "./components/ToastStack";
import VideoInfoCard from "./components/VideoInfoCard";
import VideoInfoSkeleton from "./components/VideoInfoSkeleton";
import Button from "./components/ui/Button";
import Card from "./components/ui/Card";
import Input from "./components/ui/Input";
import { formatSecondsToClock, parseTimeInputToSeconds } from "./lib/time";

const QUALITY_OPTIONS = ["best", "1080p", "720p", "480p", "240p", "144p"];
const CONCURRENT_FRAGMENT_OPTIONS = [1, 4, 8, 16];
const PROJECT_REPO_URL = "https://github.com/Shripad735/streamfetch";
const YTDLP_COOKIE_EXPORT_GUIDE_URL = "https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies";
const RECOMMENDED_COOKIE_EXTENSION_URL =
  "https://chromewebstore.google.com/detail/cclelndahbckbenkjhflpdbgdldlbecc?utm_source=item-share-cb";
const THEME_STORAGE_KEY = "streamfetch-theme";
const COOKIE_BROWSER_OPTIONS = [
  { value: "chrome", label: "Chrome" },
  { value: "edge", label: "Edge" },
  { value: "firefox", label: "Firefox" },
  { value: "brave", label: "Brave" }
];

function formatDuration(totalSeconds) {
  if (!totalSeconds || Number.isNaN(totalSeconds)) return "Unknown";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function formatFormatOption(format) {
  const res = format.resolution || (format.height ? `${format.height}p` : "Unknown");
  const fps = format.fps ? ` ${format.fps}fps` : "";
  const bitrate = format.tbr ? ` ${Math.round(format.tbr)}kbps` : "";
  const ext = format.ext ? ` ${format.ext.toUpperCase()}` : "";
  return `${format.formatId} | ${res}${fps}${bitrate}${ext}`;
}

function App() {
  const hasElectron = Boolean(window?.electronAPI);
  const [url, setUrl] = useState("");
  const [videoInfo, setVideoInfo] = useState(null);
  const [fetchingInfo, setFetchingInfo] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [cookieBrowser, setCookieBrowser] = useState("chrome");
  const [activeCookieBrowser, setActiveCookieBrowser] = useState("");
  const [activeCookiesFile, setActiveCookiesFile] = useState("");
  const [cookiesFilePath, setCookiesFilePath] = useState("");
  const [cookiePrompt, setCookiePrompt] = useState({
    open: false,
    message: "",
    url: "",
    supportedBrowsers: COOKIE_BROWSER_OPTIONS.map((item) => item.value),
    detail: "",
    canUseCookiesFile: false,
    source: "fetch",
    jobId: ""
  });
  const [cookieRetrying, setCookieRetrying] = useState(false);
  const [cookieFileRetrying, setCookieFileRetrying] = useState(false);
  const [noFormatsPrompt, setNoFormatsPrompt] = useState({
    open: false,
    title: "No Downloadable Formats",
    message: "",
    detail: ""
  });

  const [mode, setMode] = useState("video");
  const [quality, setQuality] = useState("best");
  const [selectedFormatId, setSelectedFormatId] = useState("auto");
  const [clipEnabled, setClipEnabled] = useState(false);
  const [clipStart, setClipStart] = useState("");
  const [clipEnd, setClipEnd] = useState("");
  const [concurrentFragments, setConcurrentFragments] = useState(1);
  const [downloadFolder, setDownloadFolder] = useState("");

  const [jobs, setJobs] = useState([]);
  const [runningJobId, setRunningJobId] = useState("");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [toasts, setToasts] = useState([]);
  const [maximized, setMaximized] = useState(false);
  const [theme, setTheme] = useState("light");

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

  const pushToast = useCallback((input) => {
    const toast = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: input.type || "info",
      title: input.title || "StreamFetch",
      message: input.message || "",
      expiresAt: Date.now() + 5500
    };
    setToasts((prev) => [toast, ...prev].slice(0, 8));
  }, []);

  const patchJob = useCallback((jobId, updater) => {
    setJobs((prev) =>
      prev.map((job) => {
        if (job.id !== jobId) return job;
        return updater({ ...job });
      })
    );
  }, []);

  const showNoFormatsPrompt = useCallback((message, detail = "") => {
    setNoFormatsPrompt({
      open: true,
      title: "No Downloadable Formats",
      message: String(message || "This video currently has no downloadable stream formats."),
      detail: String(detail || "").trim()
    });
  }, []);
  const closeNoFormatsPrompt = useCallback(() => {
    setNoFormatsPrompt((prev) => ({ ...prev, open: false }));
  }, []);

  const checkAppUpdate = useCallback(
    async ({ silent = false } = {}) => {
      if (!hasElectron || !window.electronAPI?.checkAppUpdate) return;
      setAppUpdateState((prev) => ({
        ...prev,
        checking: true,
        error: silent ? prev.error : ""
      }));
      try {
        const response = await window.electronAPI.checkAppUpdate();
        setAppUpdateState((prev) => ({
          ...prev,
          checking: false,
          checked: true,
          currentVersion: String(response.currentVersion || ""),
          latestVersion: String(response.latestVersion || ""),
          latestTag: String(response.latestTag || ""),
          releaseUrl: String(response.releaseUrl || ""),
          updateAvailable: Boolean(response.updateAvailable),
          dismissed: Boolean(response.updateAvailable) ? prev.dismissed : false,
          error: ""
        }));
      } catch (error) {
        setAppUpdateState((prev) => ({
          ...prev,
          checking: false,
          checked: true,
          error: error.message || "App update check failed."
        }));
      }
    },
    [hasElectron]
  );

  const handleOpenAppUpdate = useCallback(async () => {
    const target = appUpdateState.releaseUrl || "https://github.com/Shripad735/streamfetch/releases/latest";
    if (hasElectron && window.electronAPI?.openExternal) {
      await window.electronAPI.openExternal(target);
      return;
    }
    window.open(target, "_blank", "noopener,noreferrer");
  }, [appUpdateState.releaseUrl, hasElectron]);

  useEffect(() => {
    const timer = setInterval(() => {
      setToasts((prev) => prev.filter((toast) => toast.expiresAt > Date.now()));
    }, 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    let disposed = false;
    if (!hasElectron || !window.electronAPI?.checkAppUpdate) return () => {};

    const run = async () => {
      await checkAppUpdate({ silent: true });
      if (disposed) return;
    };
    run();

    return () => {
      disposed = true;
    };
  }, [checkAppUpdate, hasElectron]);

  useEffect(() => {
    if (!hasElectron) return undefined;

    window.electronAPI.getJobs().then((payload) => {
      setJobs(payload.jobs || []);
      setRunningJobId(payload.runningJobId || "");
    });

    const unsubs = [
      window.electronAPI.onJobsUpdated((payload) => {
        setJobs(payload.jobs || []);
        setRunningJobId(payload.runningJobId || "");
      }),
      window.electronAPI.onDownloadProgress((payload) => {
        patchJob(payload.jobId, (job) => ({
          ...job,
          progress: Number(payload.percent || 0),
          speed: payload.speed || "",
          eta: payload.eta || ""
        }));
      }),
      window.electronAPI.onDownloadStatus((payload) => {
        patchJob(payload.jobId, (job) => ({
          ...job,
          status: payload.status || job.status
        }));
      }),
      window.electronAPI.onDownloadLog((payload) => {
        patchJob(payload.jobId, (job) => ({
          ...job,
          logs: [...(job.logs || []), payload].slice(-320)
        }));
      }),
      window.electronAPI.onDownloadComplete((payload) => {
        patchJob(payload.jobId, (job) => ({ ...job, status: "completed", progress: 100 }));
      }),
      window.electronAPI.onDownloadError((payload) => {
        patchJob(payload.jobId, (job) => ({ ...job, status: "failed", lastError: payload.message || "" }));
        const isAuthIssue = ["cookies_required", "browser_cookies_failed", "cookies_auth_failed"].includes(
          String(payload?.reason || "")
        );
        if (isAuthIssue) {
          const supportedBrowsers =
            Array.isArray(payload.supportedBrowsers) && payload.supportedBrowsers.length > 0
              ? payload.supportedBrowsers
              : COOKIE_BROWSER_OPTIONS.map((item) => item.value);
          setCookieBrowser((prev) => (supportedBrowsers.includes(prev) ? prev : supportedBrowsers[0]));
          setCookiePrompt({
            open: true,
            message:
              payload.promptMessage ||
              "This download needs authentication. Choose a browser or cookies.txt file, then retry.",
            url: String(payload.url || "").trim(),
            supportedBrowsers,
            detail: payload.detail || payload.message || "",
            canUseCookiesFile: Boolean(payload.canUseCookiesFile),
            source: "download",
            jobId: String(payload.jobId || "")
          });
          setSelectedJobId(String(payload.jobId || ""));
          pushToast({
            type: "warn",
            title: "Authentication Needed",
            message: "Apply cookies and retry this failed download."
          });
          return;
        }

        if (String(payload?.reason || "") === "no_formats_available") {
          setErrorMessage(
            "No downloadable formats are available for this video with current access. It may be DRM-protected or unavailable."
          );
          showNoFormatsPrompt(
            "This video currently has no downloadable stream formats.\nIt may be DRM-protected or temporarily unavailable.",
            payload?.detail || payload?.message || ""
          );
        }
      }),
      window.electronAPI.onToast((payload) => {
        pushToast({
          type: payload.type,
          title: payload.title,
          message: payload.message
        });
      })
    ];

    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [hasElectron, patchJob, pushToast, showNoFormatsPrompt]);

  useEffect(() => {
    const currentExists = jobs.some((item) => item.id === selectedJobId);
    if (currentExists) return;

    const active = jobs.find((item) => item.id === runningJobId) || jobs[0];
    setSelectedJobId(active?.id || "");
  }, [jobs, selectedJobId, runningJobId]);

  const activeJobs = useMemo(
    () => jobs.filter((job) => !["completed", "failed", "canceled"].includes(job.status)),
    [jobs]
  );
  const historyJobs = useMemo(
    () => jobs.filter((job) => ["completed", "failed", "canceled"].includes(job.status)),
    [jobs]
  );
  const selectedJob = useMemo(
    () => jobs.find((item) => item.id === selectedJobId) || null,
    [jobs, selectedJobId]
  );

  const muxedFormats = useMemo(() => {
    if (!videoInfo?.formats || mode !== "video") return [];
    const seen = new Set();
    return videoInfo.formats
      .filter((item) => item.hasVideo && item.hasAudio)
      .sort((a, b) => {
        const aHeight = Number(a.height || 0);
        const bHeight = Number(b.height || 0);
        if (aHeight !== bHeight) return bHeight - aHeight;
        return Number(b.tbr || 0) - Number(a.tbr || 0);
      })
      .filter((item) => {
        if (!item.formatId || seen.has(item.formatId)) return false;
        seen.add(item.formatId);
        return true;
      })
      .slice(0, 40);
  }, [videoInfo, mode]);

  const clipRangeState = useMemo(() => {
    if (!clipEnabled) {
      return {
        valid: true,
        error: "",
        normalizedStart: "",
        normalizedEnd: "",
        durationSeconds: null
      };
    }

    if (videoInfo?.isPlaylist) {
      return {
        valid: false,
        error: "Clip range works only for single videos, not playlists.",
        normalizedStart: "",
        normalizedEnd: "",
        durationSeconds: null
      };
    }

    const startParsed = parseTimeInputToSeconds(clipStart);
    const endParsed = parseTimeInputToSeconds(clipEnd);
    if (startParsed.error) {
      return { valid: false, error: `Start time: ${startParsed.error}`, normalizedStart: "", normalizedEnd: "", durationSeconds: null };
    }
    if (endParsed.error) {
      return { valid: false, error: `End time: ${endParsed.error}`, normalizedStart: "", normalizedEnd: "", durationSeconds: null };
    }
    if (startParsed.seconds === null || endParsed.seconds === null) {
      return {
        valid: false,
        error: "Enter both clip start and end.",
        normalizedStart: "",
        normalizedEnd: "",
        durationSeconds: null
      };
    }
    if (endParsed.seconds <= startParsed.seconds) {
      return {
        valid: false,
        error: "End time must be greater than start time.",
        normalizedStart: "",
        normalizedEnd: "",
        durationSeconds: null
      };
    }

    const sourceDuration = Number(videoInfo?.duration || 0) || null;
    if (sourceDuration) {
      if (startParsed.seconds >= sourceDuration) {
        return {
          valid: false,
          error: "Start time must be inside the video duration.",
          normalizedStart: "",
          normalizedEnd: "",
          durationSeconds: null
        };
      }
      if (endParsed.seconds > sourceDuration) {
        return {
          valid: false,
          error: "End time cannot exceed the video duration.",
          normalizedStart: "",
          normalizedEnd: "",
          durationSeconds: null
        };
      }
    }

    return {
      valid: true,
      error: "",
      normalizedStart: formatSecondsToClock(startParsed.seconds),
      normalizedEnd: formatSecondsToClock(endParsed.seconds),
      durationSeconds: endParsed.seconds - startParsed.seconds
    };
  }, [clipEnabled, clipStart, clipEnd, videoInfo]);

  useEffect(() => {
    if (videoInfo?.isPlaylist && clipEnabled) {
      setClipEnabled(false);
    }
  }, [videoInfo, clipEnabled]);

  useEffect(() => {
    if (!clipEnabled || videoInfo?.isPlaylist) return;

    const duration = Number(videoInfo?.duration || 0) || 0;
    if (!duration) return;

    const startParsed = parseTimeInputToSeconds(clipStart);
    const endParsed = parseTimeInputToSeconds(clipEnd);
    const fullDuration = formatSecondsToClock(duration);

    if (startParsed.seconds === null || startParsed.error || startParsed.seconds >= duration) {
      setClipStart("00:00:00");
    }

    if (
      endParsed.seconds === null ||
      endParsed.error ||
      endParsed.seconds > duration ||
      (startParsed.seconds !== null && !startParsed.error && endParsed.seconds !== null && endParsed.seconds <= startParsed.seconds)
    ) {
      setClipEnd(fullDuration);
    }
  }, [clipEnabled, clipEnd, clipStart, videoInfo]);

  const getBrowserLabel = useCallback((value) => {
    const found = COOKIE_BROWSER_OPTIONS.find((item) => item.value === value);
    return found ? found.label : value;
  }, []);
  const getFileName = useCallback((filePath) => {
    const value = String(filePath || "");
    if (!value) return "";
    const parts = value.split(/[\\/]/);
    return parts[parts.length - 1] || value;
  }, []);

  const handleFetchInfo = async () => {
    if (!hasElectron) return;
    setErrorMessage("");
    setFetchingInfo(true);
    setVideoInfo(null);
    closeNoFormatsPrompt();
    setActiveCookieBrowser("");
    setActiveCookiesFile("");
    setCookiesFilePath("");
    setCookiePrompt((prev) => ({ ...prev, open: false }));

    try {
      const response = await window.electronAPI.fetchVideoInfo({ url: url.trim() });
      if (!response?.ok && response?.reason === "cookies_required") {
        const supportedBrowsers =
          Array.isArray(response.supportedBrowsers) && response.supportedBrowsers.length > 0
            ? response.supportedBrowsers
            : COOKIE_BROWSER_OPTIONS.map((item) => item.value);
        setCookieBrowser(supportedBrowsers[0]);
        setCookiePrompt({
          open: true,
          message: response.message || "This video requires browser cookies.",
          url: url.trim(),
          supportedBrowsers,
          detail: "",
          canUseCookiesFile: false,
          source: "fetch",
          jobId: ""
        });
        pushToast({
          type: "warn",
          title: "Authentication Needed",
          message: "Pick a browser to retry with your logged-in cookies."
        });
        return;
      }

      if (!response?.ok || !response?.data) {
        throw new Error(response?.message || "Unable to fetch metadata.");
      }

      const info = response.data;
      setVideoInfo(info);
      setSelectedFormatId("auto");
      setActiveCookieBrowser("");
      setActiveCookiesFile("");
      if (!Array.isArray(info.formats) || info.formats.length === 0) {
        setErrorMessage("No downloadable formats were returned for this video. It may be DRM-protected or unavailable.");
        showNoFormatsPrompt(
          "No downloadable formats were returned for this video.\nIt may be DRM-protected or currently unavailable for direct download."
        );
      }
      pushToast({ type: "info", title: "Metadata Loaded", message: `Fetched ${info.title}` });
    } catch (error) {
      setErrorMessage(error.message || "Unable to fetch metadata.");
      pushToast({ type: "error", title: "Fetch Failed", message: error.message || "Unable to fetch metadata." });
    } finally {
      setFetchingInfo(false);
    }
  };

  const handleRetryFetchWithCookies = async () => {
    if (!hasElectron || !cookiePrompt.open) return;
    const isDownloadRetry = cookiePrompt.source === "download" && cookiePrompt.jobId;

    if (isDownloadRetry) {
      setCookieRetrying(true);
      setErrorMessage("");
      try {
        const response = await window.electronAPI.resumeDownload({
          jobId: cookiePrompt.jobId,
          cookieBrowser
        });
        if (!response?.success) {
          throw new Error(response?.message || "Unable to retry download with browser cookies.");
        }
        setActiveCookieBrowser(cookieBrowser);
        setActiveCookiesFile("");
        setCookiesFilePath("");
        setCookiePrompt((prev) => ({ ...prev, open: false, jobId: "", source: "fetch" }));
        setSelectedJobId(cookiePrompt.jobId);
        pushToast({
          type: "success",
          title: "Retry Queued",
          message: `Retrying download with ${getBrowserLabel(cookieBrowser)} cookies.`
        });
      } catch (error) {
        setErrorMessage(error.message || "Unable to retry download with browser cookies.");
        pushToast({
          type: "error",
          title: "Cookie Retry Failed",
          message: error.message || "Unable to retry download with browser cookies."
        });
      } finally {
        setCookieRetrying(false);
      }
      return;
    }

    if (!cookiePrompt.url) return;
    setCookieRetrying(true);
    setFetchingInfo(true);
    setErrorMessage("");
    setVideoInfo(null);

    try {
      const response = await window.electronAPI.fetchVideoInfo({
        url: cookiePrompt.url,
        cookieBrowser
      });
      if (!response?.ok && response?.reason === "browser_cookies_failed") {
        setCookiePrompt((prev) => ({
          ...prev,
          message: response.message || "Could not read browser cookies.",
          detail: response.detail || "",
          canUseCookiesFile: true
        }));
        pushToast({
          type: "warn",
          title: "Browser Cookie Access Failed",
          message: "Close the browser fully and retry, or pick an exported cookies.txt file."
        });
        return;
      }
      if (!response?.ok || !response?.data) {
        throw new Error(response?.message || "Unable to fetch metadata.");
      }
      const info = response.data;
      setVideoInfo(info);
      setSelectedFormatId("auto");
      setActiveCookieBrowser(cookieBrowser);
      setActiveCookiesFile("");
      setCookiesFilePath("");
      setCookiePrompt((prev) => ({ ...prev, open: false, source: "fetch", jobId: "" }));
      if (!Array.isArray(info.formats) || info.formats.length === 0) {
        setErrorMessage("No downloadable formats were returned for this video. It may be DRM-protected or unavailable.");
        showNoFormatsPrompt(
          "No downloadable formats were returned for this video.\nIt may be DRM-protected or currently unavailable for direct download."
        );
      }
      pushToast({
        type: "success",
        title: "Metadata Loaded",
        message: `Using ${getBrowserLabel(cookieBrowser)} cookies.`
      });
    } catch (error) {
      setErrorMessage(error.message || "Unable to fetch metadata with cookies.");
      pushToast({
        type: "error",
        title: "Cookie Retry Failed",
        message: error.message || "Unable to fetch metadata with cookies."
      });
    } finally {
      setCookieRetrying(false);
      setFetchingInfo(false);
    }
  };

  const handleChooseCookiesFile = async () => {
    if (!hasElectron || !window.electronAPI?.chooseCookiesFile) return;
    const selected = await window.electronAPI.chooseCookiesFile();
    if (selected) {
      setCookiesFilePath(selected);
    }
  };

  const handleRetryFetchWithCookiesFile = async () => {
    if (!hasElectron || !cookiePrompt.open) return;
    if (!cookiesFilePath) {
      setErrorMessage("Select a cookies.txt file first.");
      return;
    }

    const isDownloadRetry = cookiePrompt.source === "download" && cookiePrompt.jobId;
    if (isDownloadRetry) {
      setCookieFileRetrying(true);
      setErrorMessage("");
      try {
        const response = await window.electronAPI.resumeDownload({
          jobId: cookiePrompt.jobId,
          cookiesFile: cookiesFilePath
        });
        if (!response?.success) {
          throw new Error(response?.message || "Unable to retry download with cookies file.");
        }
        setActiveCookiesFile(cookiesFilePath);
        setActiveCookieBrowser("");
        setCookiePrompt((prev) => ({ ...prev, open: false, jobId: "", source: "fetch" }));
        setSelectedJobId(cookiePrompt.jobId);
        pushToast({
          type: "success",
          title: "Retry Queued",
          message: `Retrying download with ${getFileName(cookiesFilePath)}.`
        });
      } catch (error) {
        setErrorMessage(error.message || "Unable to retry download with cookies file.");
        pushToast({
          type: "error",
          title: "Cookies File Retry Failed",
          message: error.message || "Unable to retry download with cookies file."
        });
      } finally {
        setCookieFileRetrying(false);
      }
      return;
    }

    if (!cookiePrompt.url) return;
    setCookieFileRetrying(true);
    setFetchingInfo(true);
    setErrorMessage("");
    setVideoInfo(null);

    try {
      const response = await window.electronAPI.fetchVideoInfo({
        url: cookiePrompt.url,
        cookiesFile: cookiesFilePath
      });
      if (!response?.ok || !response?.data) {
        throw new Error(response?.message || "Unable to fetch metadata with cookies file.");
      }
      const info = response.data;
      setVideoInfo(info);
      setSelectedFormatId("auto");
      setActiveCookiesFile(cookiesFilePath);
      setActiveCookieBrowser("");
      setCookiePrompt((prev) => ({ ...prev, open: false, source: "fetch", jobId: "" }));
      if (!Array.isArray(info.formats) || info.formats.length === 0) {
        setErrorMessage("No downloadable formats were returned for this video. It may be DRM-protected or unavailable.");
        showNoFormatsPrompt(
          "No downloadable formats were returned for this video.\nIt may be DRM-protected or currently unavailable for direct download."
        );
      }
      pushToast({
        type: "success",
        title: "Metadata Loaded",
        message: `Using ${getFileName(cookiesFilePath)}.`
      });
    } catch (error) {
      setErrorMessage(error.message || "Unable to fetch metadata with cookies file.");
      pushToast({
        type: "error",
        title: "Cookies File Retry Failed",
        message: error.message || "Unable to fetch metadata with cookies file."
      });
    } finally {
      setCookieFileRetrying(false);
      setFetchingInfo(false);
    }
  };

  const handleChooseFolder = async () => {
    if (!hasElectron) return;
    const folder = await window.electronAPI.chooseDownloadFolder();
    if (folder) setDownloadFolder(folder);
  };

  const handleQueueDownload = async () => {
    if (!hasElectron) return;
    setErrorMessage("");

    try {
      if (clipEnabled && !clipRangeState.valid) {
        throw new Error(clipRangeState.error || "Clip range is invalid.");
      }

      const result = await window.electronAPI.downloadVideo({
        url: url.trim(),
        title: videoInfo?.title || url.trim(),
        thumbnail: videoInfo?.thumbnail || "",
        outputFolder: downloadFolder,
        mode,
        quality,
        selectedFormatId,
        cookieBrowser: activeCookieBrowser,
        cookiesFile: activeCookiesFile,
        allowPlaylist: Boolean(videoInfo?.isPlaylist),
        playlistCount: videoInfo?.playlistCount || 0,
        clipEnabled: Boolean(clipEnabled),
        clipStart: clipRangeState.normalizedStart,
        clipEnd: clipRangeState.normalizedEnd,
        sourceDurationSeconds: Number(videoInfo?.duration || 0) || null,
        concurrentFragments
      });
      setSelectedJobId(result.jobId);
      pushToast({ type: "success", title: "Queued", message: "Download added to queue." });
    } catch (error) {
      setErrorMessage(error.message || "Unable to queue download.");
      pushToast({ type: "error", title: "Queue Failed", message: error.message || "Unable to queue download." });
    }
  };

  const handlePause = async (jobId) => {
    if (!hasElectron) return;
    const response = await window.electronAPI.pauseDownload(jobId);
    if (!response.success) {
      pushToast({ type: "error", title: "Pause Failed", message: response.message || "Unable to pause." });
    }
  };

  const handleResume = async (jobId) => {
    if (!hasElectron) return;
    const response = await window.electronAPI.resumeDownload(jobId);
    if (!response.success) {
      pushToast({ type: "error", title: "Resume Failed", message: response.message || "Unable to resume." });
    }
  };

  const handleCancel = async (jobId) => {
    if (!hasElectron) return;
    const response = await window.electronAPI.cancelDownload(jobId);
    if (!response.success) {
      pushToast({ type: "error", title: "Cancel Failed", message: response.message || "Unable to cancel." });
    }
  };

  const checkYtDlpUpdate = async () => {
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
  };

  const runYtDlpUpdate = async () => {
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
  };

  const clearFinished = async () => {
    if (!hasElectron) return;
    await window.electronAPI.clearFinished();
  };

  const handleOpenRepo = async () => {
    if (hasElectron && window.electronAPI?.openExternal) {
      await window.electronAPI.openExternal(PROJECT_REPO_URL);
      return;
    }
    window.open(PROJECT_REPO_URL, "_blank", "noopener,noreferrer");
  };

  const handleOpenCookieGuide = async () => {
    if (hasElectron && window.electronAPI?.openExternal) {
      await window.electronAPI.openExternal(YTDLP_COOKIE_EXPORT_GUIDE_URL);
      return;
    }
    window.open(YTDLP_COOKIE_EXPORT_GUIDE_URL, "_blank", "noopener,noreferrer");
  };

  const handleOpenCookieExtension = async () => {
    if (hasElectron && window.electronAPI?.openExternal) {
      await window.electronAPI.openExternal(RECOMMENDED_COOKIE_EXTENSION_URL);
      return;
    }
    window.open(RECOMMENDED_COOKIE_EXTENSION_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="h-screen bg-app-bg p-3 md:p-4">
      <div className="mx-auto flex h-full max-w-[1600px] flex-col overflow-hidden rounded-3xl border border-app-border bg-app-bg">
        <header
          className="flex h-16 items-center justify-between border-b border-app-border bg-app-bg px-4 md:px-6"
          style={{ WebkitAppRegion: "drag" }}
        >
          <div>
            <h1 className="font-display text-xl font-bold text-app-text">StreamFetch</h1>
            <p className="mt-0.5 text-xs text-app-muted">{runningJobId ? "Running" : "Idle"} | {activeJobs.length} active</p>
          </div>

          <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" }}>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-app-border bg-app-card text-app-muted transition-colors duration-200 hover:border-app-accent/40 hover:text-app-accent"
              onClick={handleOpenRepo}
              title="Open source on GitHub"
              aria-label="Open StreamFetch GitHub repository"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.82a7.5 7.5 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-app-border bg-app-card text-app-muted transition-colors duration-200 hover:border-app-accent/40 hover:text-app-accent"
              onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <circle cx="12" cy="12" r="4.2" />
                  <path d="M12 2.5v2.1M12 19.4v2.1M4.6 4.6l1.5 1.5M17.9 17.9l1.5 1.5M2.5 12h2.1M19.4 12h2.1M4.6 19.4l1.5-1.5M17.9 6.1l1.5-1.5" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M21 12.7A9 9 0 1 1 11.3 3a7.3 7.3 0 0 0 9.7 9.7z" />
                </svg>
              )}
            </button>
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-app-border bg-app-card text-xs text-app-muted transition-colors duration-200 hover:border-app-accent/40 hover:text-app-accent"
              onClick={() => hasElectron && window.electronAPI.windowMinimize()}
            >
              -
            </button>
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-app-border bg-app-card text-xs text-app-muted transition-colors duration-200 hover:border-app-accent/40 hover:text-app-accent"
              onClick={async () => {
                if (!hasElectron) return;
                const state = await window.electronAPI.windowToggleMaximize();
                setMaximized(Boolean(state));
              }}
            >
              {maximized ? "o" : "+"}
            </button>
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-app-border bg-app-card text-xs text-app-muted transition-colors duration-200 hover:border-app-dangerBorder hover:bg-app-dangerBg hover:text-app-dangerText"
              onClick={() => hasElectron && window.electronAPI.windowClose()}
            >
              x
            </button>
          </div>
        </header>

        <main className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-4 p-4 xl:grid-cols-[1.28fr_1fr]">
          <Card className="min-h-0 min-w-0 overflow-hidden p-4 md:p-5">
            <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1 [scrollbar-color:#CBD5E1_transparent] [scrollbar-width:thin] [&>*]:shrink-0 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/70">
              {!hasElectron && (
                <div className="rounded-2xl border border-app-dangerBorder bg-app-dangerBg px-4 py-3 text-sm text-app-dangerText">
                  Electron bridge unavailable. Run inside desktop app.
                </div>
              )}

              {hasElectron && appUpdateState.updateAvailable && !appUpdateState.dismissed && (
                <Card className="border-app-accent/25 bg-app-panel p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-display text-sm font-semibold text-app-text">
                        App Update Available ({appUpdateState.latestTag || appUpdateState.latestVersion || "latest"})
                      </h3>
                      <p className="mt-1 text-xs text-app-muted">
                        Installed: {appUpdateState.currentVersion || "--"} | Latest:{" "}
                        {appUpdateState.latestVersion || appUpdateState.latestTag || "--"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={handleOpenAppUpdate}>
                        Download Update
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setAppUpdateState((prev) => ({ ...prev, dismissed: true }))}
                      >
                        Later
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              <Card className="p-4 md:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <Input
                    className="flex-1"
                    label="Video URL"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="Paste video URL here..."
                  />
                  <Button variant="primary" size="lg" onClick={handleFetchInfo} disabled={!url.trim() || fetchingInfo}>
                    {fetchingInfo ? "Fetching..." : "Fetch"}
                  </Button>
                </div>
              </Card>

              {fetchingInfo && <VideoInfoSkeleton />}
              {!fetchingInfo && videoInfo && (
                <VideoInfoCard
                  title={videoInfo.title}
                  thumbnail={videoInfo.thumbnail}
                  extractor={videoInfo.extractor}
                  duration={formatDuration(videoInfo.duration)}
                  isPlaylist={videoInfo.isPlaylist}
                  playlistCount={videoInfo.playlistCount}
                />
              )}

              <Card className="p-4 md:p-5">
                <h3 className="mb-3 font-display text-sm font-semibold text-app-text">Download Options</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <Input as="select" value={mode} onChange={(event) => setMode(event.target.value)} label="Format Type">
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
                    label="Advanced Format Picker"
                  >
                    <option value="auto">Auto (Smart)</option>
                    {muxedFormats.map((item) => (
                      <option key={item.formatId} value={item.formatId}>
                        {formatFormatOption(item)}
                      </option>
                    ))}
                  </Input>
                </div>

                <div className="mt-4 rounded-[30px] bg-app-panel/72 p-5 shadow-card ring-1 ring-app-border/35">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-display text-base font-semibold tracking-[0.01em] text-app-text">Clip Range (Optional)</p>
                      <p className="mt-1 text-sm leading-6 text-app-muted">
                        Download only a part of the video using start and end times.
                      </p>
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
                      {clipEnabled ? "Range On" : "Range Off"}
                    </Button>
                  </div>

                  {videoInfo?.isPlaylist && (
                    <p className="mt-2 text-xs text-app-muted">Clip range is available only for single videos.</p>
                  )}

                  {clipEnabled && !videoInfo?.isPlaylist && (
                    <div className="mt-4">
                      <ClipStudio
                        durationSeconds={videoInfo?.duration || 0}
                        thumbnail={videoInfo?.thumbnail || ""}
                        startValue={clipStart}
                        endValue={clipEnd}
                        onStartChange={setClipStart}
                        onEndChange={setClipEnd}
                        disabled={!videoInfo?.duration}
                      />
                      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                        <Input
                          className="min-w-0"
                          label="Start Time"
                          value={clipStart}
                          onChange={(event) => setClipStart(event.target.value)}
                          placeholder="00:00:00"
                          inputClassName="bg-app-card/70"
                        />
                        <Input
                          className="min-w-0"
                          label="End Time"
                          value={clipEnd}
                          onChange={(event) => setClipEnd(event.target.value)}
                          placeholder={videoInfo?.duration ? formatSecondsToClock(videoInfo.duration) : "00:30"}
                          inputClassName="bg-app-card/70"
                        />
                      </div>
                      <p className="mt-3 text-sm leading-6 text-app-muted">
                        Drag the Clip Studio handles first, then fine-tune here if needed. You can use `ss`, `mm:ss`, or `hh:mm:ss`.
                      </p>
                      {clipRangeState.valid ? (
                        clipRangeState.normalizedStart && clipRangeState.normalizedEnd ? (
                          <p className="mt-2 text-sm font-medium text-app-accent">
                            Clip: {clipRangeState.normalizedStart} to {clipRangeState.normalizedEnd}
                            {clipRangeState.durationSeconds !== null
                              ? ` (${formatDuration(clipRangeState.durationSeconds)})`
                              : ""}
                          </p>
                        ) : null
                      ) : (
                        <p className="mt-2 text-xs text-app-dangerText">{clipRangeState.error}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 rounded-[30px] bg-app-panel/72 p-5 shadow-card ring-1 ring-app-border/35">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                      <p className="font-display text-base font-semibold tracking-[0.01em] text-app-text">Download Acceleration</p>
                      <p className="mt-1 text-sm leading-6 text-app-muted">
                        Turbo Mode uses yt-dlp concurrent fragments on compatible streams. 
                        Some sources may show little or no speed change.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        size="sm"
                        variant={concurrentFragments > 1 ? "primary" : "secondary"}
                        onClick={() => setConcurrentFragments((prev) => (prev > 1 ? 1 : 8))}
                      >
                        {concurrentFragments > 1 ? "Turbo On" : "Turbo Off"}
                      </Button>
                      <div className="flex items-center gap-2 text-sm text-app-muted">
                        {concurrentFragments > 1 ? (
                          <>
                            <span className="rounded-full bg-app-infoBg px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-app-infoText">
                              Turbo x{concurrentFragments}
                            </span>
                            <span>More fragments for compatible streams.</span>
                          </>
                        ) : (
                          <span>Standard single-fragment mode.</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-end">
                    <p className="text-sm leading-6 text-app-muted">
                      Fragment count matters only when Turbo is enabled, so this stays available as a lightweight advanced control.
                    </p>
                    <Input
                      as="select"
                      label="Fragment Count"
                      value={String(concurrentFragments)}
                      onChange={(event) => setConcurrentFragments(Number(event.target.value))}
                      inputClassName="border-app-border/40 bg-app-bg/42 shadow-none focus:border-app-accent/35"
                    >
                      {CONCURRENT_FRAGMENT_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                          {item === 1 ? "1 fragment (Standard)" : `${item} fragments`}
                        </option>
                      ))}
                    </Input>
                  </div>
                </div>
              </Card>

              <Card className="p-4 md:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <Input className="flex-1" label="Download Folder" value={downloadFolder} readOnly placeholder="Choose a folder..." />
                  <Button
                    variant="secondary"
                    className="h-12 w-12 rounded-2xl p-0"
                    onClick={handleChooseFolder}
                    aria-label="Select folder"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
                      <path d="M3.75 6.75h5l2 2h9.5v8.5a2 2 0 0 1-2 2h-12.5a2 2 0 0 1-2-2v-10.5z" />
                    </svg>
                  </Button>
                </div>
              </Card>

              <Button
                variant="primary"
                size="lg"
                className="h-14 w-full text-base"
                onClick={handleQueueDownload}
                disabled={!url.trim() || !downloadFolder || (clipEnabled && !clipRangeState.valid)}
              >
                Add To Queue
              </Button>

              <Card className="p-4 md:p-5">
                <h3 className="font-display text-sm font-semibold text-app-text">yt-dlp Updater</h3>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-app-muted">
                  <span>Current: {ytDlpState.currentVersion || "--"}</span>
                  <span>Latest: {ytDlpState.latestVersion || "--"}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={checkYtDlpUpdate} disabled={ytDlpState.checking}>
                    {ytDlpState.checking ? "Checking..." : "Check Updates"}
                  </Button>
                  <Button variant="secondary" onClick={runYtDlpUpdate} disabled={ytDlpState.updating}>
                    {ytDlpState.updating ? "Updating..." : "One-Click Update"}
                  </Button>
                </div>
                {ytDlpState.output && (
                  <pre className="mt-3 max-h-28 overflow-auto rounded-2xl border border-app-border bg-app-panel p-3 text-xs text-app-text [scrollbar-color:#CBD5E1_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/70">
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
          </Card>

          <section className="grid min-h-0 min-w-0 grid-rows-[1fr_auto] gap-4 xl:grid-rows-[1fr_0.95fr]">
            <Card className="flex min-h-0 min-w-0 flex-col p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-display text-sm font-semibold text-app-text">Per-Item Progress</h3>
                <Button size="sm" variant="ghost" onClick={clearFinished}>
                  Clear Finished
                </Button>
              </div>

              <div className="min-h-0 space-y-3 overflow-auto pr-1 [scrollbar-color:#CBD5E1_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/70">
                {jobs.length === 0 && <p className="text-sm text-app-muted">Queue is empty.</p>}
                {jobs.slice(0, 30).map((job) => (
                  <DownloadCard
                    key={job.id}
                    job={job}
                    selected={selectedJobId === job.id}
                    onSelect={setSelectedJobId}
                    onPause={handlePause}
                    onResume={handleResume}
                    onCancel={handleCancel}
                  />
                ))}
              </div>
            </Card>

            <div className="grid min-h-0 min-w-0 gap-4 lg:grid-cols-[1.35fr_1fr]">
              <LogPanel title={selectedJob ? `Logs | ${selectedJob.title}` : "Logs"} lines={selectedJob?.logs || []} />
              <HistoryList entries={historyJobs} onClear={clearFinished} onSelect={setSelectedJobId} />
            </div>
          </section>
        </main>
      </div>

      {noFormatsPrompt.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
          <Card className="w-full max-w-lg p-5">
            <h3 className="font-display text-base font-semibold text-app-text">{noFormatsPrompt.title}</h3>
            <p className="mt-2 whitespace-pre-line text-sm text-app-muted">{noFormatsPrompt.message}</p>
            <p className="mt-2 text-xs text-app-muted">
              This is usually caused by restricted/DRM streams and not by a normal app error.
            </p>
            {noFormatsPrompt.detail && (
              <pre className="mt-3 max-h-32 overflow-auto rounded-2xl border border-app-border bg-app-panel p-3 text-xs text-app-muted [scrollbar-color:#CBD5E1_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/70">
                {noFormatsPrompt.detail}
              </pre>
            )}
            <div className="mt-4 flex justify-end">
              <Button variant="primary" onClick={closeNoFormatsPrompt}>
                OK
              </Button>
            </div>
          </Card>
        </div>
      )}

      {cookiePrompt.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <Card className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden p-5">
            <h3 className="font-display text-base font-semibold text-app-text">Authentication Required</h3>
            <div className="mt-2 overflow-y-auto pr-1 [scrollbar-color:#CBD5E1_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/70">
              <p className="text-sm text-app-muted">
                {cookiePrompt.message ||
                  "This video needs a signed-in browser session. Choose a browser and retry metadata fetch."}
              </p>
              {cookiePrompt.detail && (
                <pre className="mt-3 max-h-24 overflow-auto rounded-2xl border border-app-border bg-app-panel p-3 text-xs text-app-muted [scrollbar-color:#CBD5E1_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/70">
                  {cookiePrompt.detail}
                </pre>
              )}
              <div className="mt-4">
                <Input
                  as="select"
                  label="Browser Cookies"
                  value={cookieBrowser}
                  onChange={(event) => setCookieBrowser(event.target.value)}
                >
                  {COOKIE_BROWSER_OPTIONS.filter((item) => cookiePrompt.supportedBrowsers.includes(item.value)).map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Input>
              </div>
              {cookiePrompt.canUseCookiesFile && (
                <div className="mt-4 rounded-2xl border border-app-border bg-app-panel p-3">
                  <p className="text-xs text-app-muted">
                    Browser cookie access failed. Export `cookies.txt` and retry with file import.
                  </p>
                  <details className="mt-3 rounded-2xl border border-app-border bg-app-card p-3">
                    <summary className="cursor-pointer text-sm font-medium text-app-text">
                      How to export `cookies.txt` (step by step)
                    </summary>
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs text-app-muted">
                      <li>Open your browser and log in to YouTube.</li>
                      <li>Install this extension (recommended): `Get cookies.txt LOCALLY`.</li>
                      <li>Click `Open Recommended Extension`, then click `Add to Chrome`/`Add to Brave`.</li>
                      <li>Open `youtube.com`, click the extension icon, then export cookies for YouTube.</li>
                      <li>Save as `cookies.txt` (Netscape format).</li>
                      <li>The file is usually in `Downloads` (example: `C:\\Users\\YourName\\Downloads`).</li>
                      <li>In this popup, click the folder icon, select the file, then click `Retry With Cookies File`.</li>
                    </ol>
                    <div className="mt-3 flex flex-col gap-2">
                      <Button className="w-full" variant="ghost" onClick={handleOpenCookieExtension}>
                        Open Recommended Extension
                      </Button>
                      <Button className="w-full" variant="ghost" onClick={handleOpenCookieGuide}>
                        Open Official Cookie Guide
                      </Button>
                    </div>
                  </details>
                  <div className="mt-3 flex items-end gap-2">
                    <Input
                      className="flex-1"
                      label="Cookies File"
                      value={cookiesFilePath}
                      readOnly
                      placeholder="Select cookies.txt..."
                    />
                    <Button
                      variant="secondary"
                      className="h-12 w-12 rounded-2xl p-0"
                      onClick={handleChooseCookiesFile}
                      aria-label="Select cookies file"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
                        <path d="M3.75 6.75h5l2 2h9.5v8.5a2 2 0 0 1-2 2h-12.5a2 2 0 0 1-2-2v-10.5z" />
                      </svg>
                    </Button>
                  </div>
                  <Button
                    className="mt-3 w-full"
                    variant="secondary"
                    onClick={handleRetryFetchWithCookiesFile}
                    disabled={!cookiesFilePath || cookieFileRetrying || cookieRetrying}
                  >
                    {cookieFileRetrying ? "Retrying With File..." : "Retry With Cookies File"}
                  </Button>
                </div>
              )}
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setCookiePrompt((prev) => ({ ...prev, open: false, source: "fetch", jobId: "" }));
                  setActiveCookieBrowser("");
                  setActiveCookiesFile("");
                  setCookiesFilePath("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleRetryFetchWithCookies}
                disabled={cookieRetrying || cookieFileRetrying}
              >
                {cookieRetrying ? "Retrying..." : "Retry With Cookies"}
              </Button>
            </div>
            </div>
          </Card>
        </div>
      )}

      <ToastStack
        toasts={toasts}
        onDismiss={(id) => {
          setToasts((prev) => prev.filter((item) => item.id !== id));
        }}
      />
    </div>
  );
}

export default App;
