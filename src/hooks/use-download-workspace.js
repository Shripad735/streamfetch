import { useCallback, useEffect, useMemo, useState } from "react";
import { COOKIE_BROWSER_OPTIONS, NO_FORMATS_ERROR_MESSAGE } from "../lib/app-constants";
import { formatSecondsToClock, parseTimeInputToSeconds } from "../lib/time";
import { getBrowserLabel, getFileName } from "../lib/app-formatters";

export function useDownloadWorkspace({
  hasElectron,
  preferences,
  preferencesLoaded,
  pushToast,
  setSelectedJobId,
  selectQueueView,
  showFormatExtractionError,
  closeNoFormatsPrompt
}) {
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
  const [mode, setMode] = useState("video");
  const [quality, setQuality] = useState("best");
  const [selectedFormatId, setSelectedFormatId] = useState("auto");
  const [clipEnabled, setClipEnabled] = useState(false);
  const [clipStart, setClipStart] = useState("");
  const [clipEnd, setClipEnd] = useState("");
  const [concurrentFragments, setConcurrentFragments] = useState(1);
  const [downloadFolder, setDownloadFolder] = useState("");
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false);

  useEffect(() => {
    if (!preferencesLoaded || workspaceHydrated) return;
    setMode(preferences.defaultMode || "video");
    setQuality(preferences.defaultQuality || "best");
    setConcurrentFragments(Number(preferences.defaultConcurrentFragments || 1) || 1);
    setDownloadFolder(preferences.defaultOutputFolder || "");
    setWorkspaceHydrated(true);
  }, [preferences, preferencesLoaded, workspaceHydrated]);

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
  }, [mode, videoInfo]);

  const clipRangeState = useMemo(() => {
    if (!clipEnabled) {
      return { valid: true, error: "", normalizedStart: "", normalizedEnd: "", durationSeconds: null };
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
      return { valid: false, error: "Enter both clip start and end.", normalizedStart: "", normalizedEnd: "", durationSeconds: null };
    }
    if (endParsed.seconds <= startParsed.seconds) {
      return { valid: false, error: "End time must be greater than start time.", normalizedStart: "", normalizedEnd: "", durationSeconds: null };
    }

    const sourceDuration = Number(videoInfo?.duration || 0) || null;
    if (sourceDuration) {
      if (startParsed.seconds >= sourceDuration) {
        return { valid: false, error: "Start time must be inside the video duration.", normalizedStart: "", normalizedEnd: "", durationSeconds: null };
      }
      if (endParsed.seconds > sourceDuration) {
        return { valid: false, error: "End time cannot exceed the video duration.", normalizedStart: "", normalizedEnd: "", durationSeconds: null };
      }
    }

    return {
      valid: true,
      error: "",
      normalizedStart: formatSecondsToClock(startParsed.seconds),
      normalizedEnd: formatSecondsToClock(endParsed.seconds),
      durationSeconds: endParsed.seconds - startParsed.seconds
    };
  }, [clipEnabled, clipEnd, clipStart, videoInfo]);

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

  const openCookiePromptForDownload = useCallback((payload) => {
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
  }, []);

  const handleNoFormats = useCallback(
    (detail = "") => {
      setErrorMessage(NO_FORMATS_ERROR_MESSAGE);
      showFormatExtractionError(detail);
    },
    [showFormatExtractionError]
  );

  const fetchInfoForUrl = useCallback(
    async (targetUrl) => {
      if (!hasElectron) return;
      const normalizedUrl = String(targetUrl || "").trim();
      if (!normalizedUrl) return;

      setUrl(normalizedUrl);
      setErrorMessage("");
      setFetchingInfo(true);
      setVideoInfo(null);
      closeNoFormatsPrompt();
      setActiveCookieBrowser("");
      setActiveCookiesFile("");
      setCookiesFilePath("");
      setCookiePrompt((prev) => ({ ...prev, open: false }));

      try {
        const response = await window.electronAPI.fetchVideoInfo({ url: normalizedUrl });
        if (!response?.ok && response?.reason === "cookies_required") {
          const supportedBrowsers =
            Array.isArray(response.supportedBrowsers) && response.supportedBrowsers.length > 0
              ? response.supportedBrowsers
              : COOKIE_BROWSER_OPTIONS.map((item) => item.value);
          setCookieBrowser(supportedBrowsers[0]);
          setCookiePrompt({
            open: true,
            message: response.message || "This video requires browser cookies.",
            url: normalizedUrl,
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

        if (!response?.ok && response?.reason === "no_formats_available") {
          handleNoFormats(response?.detail || response?.message || "");
          return;
        }

        if (!response?.ok || !response?.data) {
          throw new Error(response?.message || "Unable to fetch metadata.");
        }

        const info = response.data;
        setVideoInfo(info);
        setSelectedFormatId("auto");
        if (!Array.isArray(info.formats) || info.formats.length === 0) {
          handleNoFormats();
        }
        pushToast({ type: "info", title: "Metadata Loaded", message: `Fetched ${info.title}` });
      } catch (error) {
        setErrorMessage(error.message || "Unable to fetch metadata.");
        pushToast({ type: "error", title: "Fetch Failed", message: error.message || "Unable to fetch metadata." });
      } finally {
        setFetchingInfo(false);
      }
    },
    [closeNoFormatsPrompt, handleNoFormats, hasElectron, pushToast]
  );

  const chooseCookiesFile = useCallback(async () => {
    if (!hasElectron || !window.electronAPI?.chooseCookiesFile) return;
    const selected = await window.electronAPI.chooseCookiesFile();
    if (selected) {
      setCookiesFilePath(selected);
    }
  }, [hasElectron]);

  const retryWithCookies = useCallback(async () => {
    if (!hasElectron || !cookiePrompt.open) return;
    const isDownloadRetry = cookiePrompt.source === "download" && cookiePrompt.jobId;

    if (isDownloadRetry) {
      setCookieRetrying(true);
      setErrorMessage("");
      try {
        const response = await window.electronAPI.resumeDownload({ jobId: cookiePrompt.jobId, cookieBrowser });
        if (!response?.success) {
          throw new Error(response?.message || "Unable to retry download with browser cookies.");
        }
        setActiveCookieBrowser(cookieBrowser);
        setActiveCookiesFile("");
        setCookiesFilePath("");
        setCookiePrompt((prev) => ({ ...prev, open: false, jobId: "", source: "fetch" }));
        setSelectedJobId(cookiePrompt.jobId);
        selectQueueView();
        pushToast({
          type: "success",
          title: "Retry Queued",
          message: `Retrying download with ${getBrowserLabel(COOKIE_BROWSER_OPTIONS, cookieBrowser)} cookies.`
        });
      } catch (error) {
        setErrorMessage(error.message || "Unable to retry download with browser cookies.");
        pushToast({ type: "error", title: "Cookie Retry Failed", message: error.message || "Unable to retry download with browser cookies." });
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
      const response = await window.electronAPI.fetchVideoInfo({ url: cookiePrompt.url, cookieBrowser });
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
        if (response?.reason === "no_formats_available") {
          handleNoFormats(response?.detail || response?.message || "");
          return;
        }
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
        handleNoFormats();
      }
      pushToast({
        type: "success",
        title: "Metadata Loaded",
        message: `Using ${getBrowserLabel(COOKIE_BROWSER_OPTIONS, cookieBrowser)} cookies.`
      });
    } catch (error) {
      setErrorMessage(error.message || "Unable to fetch metadata with cookies.");
      pushToast({ type: "error", title: "Cookie Retry Failed", message: error.message || "Unable to fetch metadata with cookies." });
    } finally {
      setCookieRetrying(false);
      setFetchingInfo(false);
    }
  }, [cookieBrowser, cookiePrompt, handleNoFormats, hasElectron, pushToast, selectQueueView, setSelectedJobId]);

  const retryWithCookiesFile = useCallback(async () => {
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
        const response = await window.electronAPI.resumeDownload({ jobId: cookiePrompt.jobId, cookiesFile: cookiesFilePath });
        if (!response?.success) {
          throw new Error(response?.message || "Unable to retry download with cookies file.");
        }
        setActiveCookiesFile(cookiesFilePath);
        setActiveCookieBrowser("");
        setCookiePrompt((prev) => ({ ...prev, open: false, jobId: "", source: "fetch" }));
        setSelectedJobId(cookiePrompt.jobId);
        selectQueueView();
        pushToast({ type: "success", title: "Retry Queued", message: `Retrying download with ${getFileName(cookiesFilePath)}.` });
      } catch (error) {
        setErrorMessage(error.message || "Unable to retry download with cookies file.");
        pushToast({ type: "error", title: "Cookies File Retry Failed", message: error.message || "Unable to retry download with cookies file." });
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
      const response = await window.electronAPI.fetchVideoInfo({ url: cookiePrompt.url, cookiesFile: cookiesFilePath });
      if (!response?.ok || !response?.data) {
        if (response?.reason === "no_formats_available") {
          handleNoFormats(response?.detail || response?.message || "");
          return;
        }
        throw new Error(response?.message || "Unable to fetch metadata with cookies file.");
      }
      const info = response.data;
      setVideoInfo(info);
      setSelectedFormatId("auto");
      setActiveCookiesFile(cookiesFilePath);
      setActiveCookieBrowser("");
      setCookiePrompt((prev) => ({ ...prev, open: false, source: "fetch", jobId: "" }));
      if (!Array.isArray(info.formats) || info.formats.length === 0) {
        handleNoFormats();
      }
      pushToast({ type: "success", title: "Metadata Loaded", message: `Using ${getFileName(cookiesFilePath)}.` });
    } catch (error) {
      setErrorMessage(error.message || "Unable to fetch metadata with cookies file.");
      pushToast({ type: "error", title: "Cookies File Retry Failed", message: error.message || "Unable to fetch metadata with cookies file." });
    } finally {
      setCookieFileRetrying(false);
      setFetchingInfo(false);
    }
  }, [cookiePrompt, cookiesFilePath, handleNoFormats, hasElectron, pushToast, selectQueueView, setSelectedJobId]);

  const chooseDownloadFolder = useCallback(async () => {
    if (!hasElectron) return;
    const folder = await window.electronAPI.chooseDownloadFolder();
    if (folder) setDownloadFolder(folder);
  }, [hasElectron]);

  const queueDownload = useCallback(async () => {
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
      selectQueueView();
      pushToast({ type: "success", title: "Queued", message: "Download added to queue." });
    } catch (error) {
      setErrorMessage(error.message || "Unable to queue download.");
      pushToast({ type: "error", title: "Queue Failed", message: error.message || "Unable to queue download." });
    }
  }, [activeCookieBrowser, activeCookiesFile, clipEnabled, clipRangeState, concurrentFragments, downloadFolder, hasElectron, mode, pushToast, quality, selectQueueView, selectedFormatId, setSelectedJobId, url, videoInfo]);

  return {
    url,
    setUrl,
    videoInfo,
    setVideoInfo,
    fetchingInfo,
    setFetchingInfo,
    errorMessage,
    setErrorMessage,
    cookieBrowser,
    setCookieBrowser,
    activeCookieBrowser,
    activeCookiesFile,
    cookiesFilePath,
    cookiePrompt,
    cookieRetrying,
    cookieFileRetrying,
    mode,
    setMode,
    quality,
    setQuality,
    selectedFormatId,
    setSelectedFormatId,
    clipEnabled,
    setClipEnabled,
    clipStart,
    setClipStart,
    clipEnd,
    setClipEnd,
    concurrentFragments,
    setConcurrentFragments,
    downloadFolder,
    setDownloadFolder,
    muxedFormats,
    clipRangeState,
    openCookiePromptForDownload,
    fetchInfoForUrl,
    chooseCookiesFile,
    retryWithCookies,
    retryWithCookiesFile,
    chooseDownloadFolder,
    queueDownload,
    closeCookiePrompt: () => {
      setCookiePrompt((prev) => ({ ...prev, open: false, source: "fetch", jobId: "" }));
      setActiveCookieBrowser("");
      setActiveCookiesFile("");
      setCookiesFilePath("");
    }
  };
}
