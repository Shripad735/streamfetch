# StreamFetch

Cross-platform desktop downloader for YouTube and other platforms, built with Electron + React and powered by `yt-dlp`. Pre-built release artifacts are published for Windows, macOS, and Linux.

## Screenshots

![StreamFetch Screenshot 1](Screenshots/Pic1%20(1).png)
![StreamFetch Screenshot 2](Screenshots/Pic1%20(2).png)

## Highlights

- Queue-based downloads with per-item progress and logs
- Pause, resume, cancel, and retry controls
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
- Advanced format picker from extracted format IDs
- Playlist range controls (`start`, `end`, include, exclude)
- Global + per-download speed limits (`500K`, `2M`, `1.5M`)
- Download history and runtime logs
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

## Release Workflow

- GitHub workflow runs on `v*` tags (for example `v1.2.0`).
- Tagged releases build artifacts for Windows, macOS, and Linux.
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
