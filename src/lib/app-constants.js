export const QUALITY_OPTIONS = ["best", "1080p", "720p", "480p", "240p", "144p"];
export const CONCURRENT_FRAGMENT_OPTIONS = [1, 4, 8, 16];
export const PROJECT_REPO_URL = "https://github.com/Shripad735/streamfetch";
export const YTDLP_COOKIE_EXPORT_GUIDE_URL =
  "https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies";
export const RECOMMENDED_COOKIE_EXTENSION_URL =
  "https://chromewebstore.google.com/detail/cclelndahbckbenkjhflpdbgdldlbecc?utm_source=item-share-cb";
export const NO_FORMATS_TITLE = "Unable To Extract Formats";
export const NO_FORMATS_ERROR_MESSAGE =
  "Unable to extract video formats. This may be due to YouTube restrictions or a client mismatch. Try enabling authentication or retrying.";
export const NO_FORMATS_PROMPT_MESSAGE =
  "Unable to extract video formats for this video.\nThis may be due to YouTube restrictions or a client mismatch.\nTry enabling authentication or retrying.";
export const COOKIE_BROWSER_OPTIONS = [
  { value: "chrome", label: "Chrome" },
  { value: "edge", label: "Edge" },
  { value: "firefox", label: "Firefox" },
  { value: "brave", label: "Brave" }
];
export const VIEW_ITEMS = [
  { id: "new-download", label: "New Download", hint: "Capture and configure", metric: "Fetch" },
  { id: "active-queue", label: "Active Queue", hint: "Track jobs and logs", metric: "Queue" },
  { id: "history", label: "History", hint: "Search previous jobs", metric: "Archive" },
  { id: "settings", label: "Settings", hint: "Defaults and maintenance", metric: "Prefs" }
];
