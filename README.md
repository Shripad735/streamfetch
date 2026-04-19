# StreamFetch

Cross-platform desktop downloader for YouTube and other platforms, built with Electron + React and powered by `yt-dlp`. Pre-built release artifacts are published for Windows, macOS, and Linux.

## Screenshots

### Dashboard 01

![StreamFetch Main Dashboard](Images/Dashboard-01.png)

Main dashboard for pasting a link, fetching metadata, selecting clip range, enabling Turbo download, adding items to queue, and using the built-in `yt-dlp` updater.

### Dashboard 02

![StreamFetch Active Queue](Images/Dashboard-02.png)

Active queue workspace with download overview, per-job status, and inline logs for the selected item.

### Dashboard 03

![StreamFetch History Dashboard](Images/Dashboard-03.png)

History dashboard for browsing past downloads, completed items, failed jobs, and archived activity.

### Dashboard 04

![StreamFetch Settings Dashboard](Images/Dashboard-04.png)

Settings workspace for saving defaults, managing clipboard watcher preferences, and checking app/update status.

## Highlights

- Notion-like desktop workspace with dedicated `New Download`, `Active Queue`, `History`, and `Settings` views
- Queue-based downloads with per-item progress and logs
- Pause, resume, cancel, and retry controls
- Optional clip-range downloads with structured Clip Studio controls
- Smart fallback strategy for format/download failures
- Built-in `yt-dlp` updater
- In-app app-update notification (checks GitHub latest release)
- Conditional auth handling for age/bot-restricted content
- Clear centered popup when no downloadable formats are available

## Restricted/Age Content Handling

StreamFetch now handles restricted content in a guided flow:

1. Try normal fetch/download first.
2. If authentication is required, a popup appears (browser cookies).
3. If browser cookie access fails (DPAPI/locked DB), popup enables `cookies.txt` import.
4. Retry can be applied both at fetch-time and download-time.
5. If video still has no downloadable streams, StreamFetch shows a dedicated "No Downloadable Formats" popup.

## Features

- Single video and playlist support
- Structured workspace shell with sidebar navigation and saved defaults
- Advanced format picker from extracted format IDs
- Clip-range download for single videos (`ss`, `mm:ss`, `hh:mm:ss`)
- Playlist range controls (`start`, `end`, include, exclude`)
- Global + per-download speed limits (`500K`, `2M`, `1.5M`)
- Download history, runtime logs, and active queue overview
- Frameless desktop UI with custom window controls

## Tech Stack

- Electron 34
- React 18 + Vite 6
- Tailwind CSS 3
- `yt-dlp` + optional `ffmpeg`

## Project Structure

```text
streamfetch/
  electron/        # Main process + preload bridge
  src/             # React renderer
  bin/             # Platform binaries bundled into release builds
  release/         # Build outputs
```

## Quick Start (Development)

```bash
npm install
npm run dev
```

## Run Built Renderer + Electron

```bash
npm run build:renderer
npm start
```

## Build for macOS or Linux (Source)

Release builds bundle `yt-dlp` and `ffmpeg` automatically in CI.

For local source builds, provide binaries in `bin/` for your platform (`yt-dlp` and optional `ffmpeg`) or install them in your system `$PATH`, then clone and build:

```bash
git clone https://github.com/Shripad735/streamfetch.git
cd streamfetch
npm install
npm run build
```

## Build Windows Setup (Local)

Pre-built Windows setup executables are published with every release. To build locally:

```bash
npm run build:win
```

Artifact is created in `release/`:
- `StreamFetch-Setup-<version>.exe` (installer)

## Build macOS DMG (Local)

```bash
npm run build:mac
```

## Build Linux AppImage (Local)

```bash
npm run build:linux
```

## Clip-Range Download (Time Span)

You can download only a specific part of a single video:

1. Fetch video metadata.
2. In `Download Options`, enable `Clip Range`.
3. Enter `Start Time` and `End Time` using `ss`, `mm:ss`, or `hh:mm:ss`.
4. Queue the job.

Notes:
- Clip range is available only for single videos (not playlist jobs).
- `ffmpeg` is required for clip extraction.

## Release Workflow

- GitHub workflow runs on `v*` tags (for example `v1.2.0`).
- Workflow validates that tag version (`vX.Y.Z`) matches `package.json` version.
- Tagged releases build artifacts for Windows, Linux, and macOS.
- macOS build is configured as non-blocking in CI (to avoid blocking release when mac runners are unavailable).
- Release notes are auto-generated from commits between the previous release tag and the current tag.
- Notes are grouped into `Features`, `Fixes`, and `Other Changes` based on commit message prefix.

Use these commit prefixes to classify notes:

- `feat: add app update notification banner`
- `fix: handle age-restricted download retry`
- `hotfix: prevent renderer crash on startup`

## Security Model

- `nodeIntegration: false`
- `contextIsolation: true`
- Strict preload bridge for allowed IPC channels only
- Download execution uses validated `spawn` arguments

## Required Local Binaries

For source-based development, place these files in `bin/` for your target platform:
- `yt-dlp` or `yt-dlp.exe` (required)
- `ffmpeg` or `ffmpeg.exe` (optional, enables merged best-quality outputs)

These binaries are not committed to git to keep repository size small.

## Releases

Install from GitHub Releases for the easiest setup. Each tagged release includes:
- Windows installer (`Setup .exe`)
- macOS disk image (`.dmg`)
- Linux AppImage (`.AppImage`)

## License

MIT
