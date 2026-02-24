# StreamFetch

Fast Windows desktop downloader for YouTube and other platforms, built with Electron + React and powered by `yt-dlp`.

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
  bin/             # yt-dlp.exe and optional ffmpeg.exe
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

## Build and Runtime Prerequisite (macOS and Linux)
StreamFetch relies on `yt-dlp` being available on your system at both build time and runtime. The application will not function without it.

On Linux and macOS, make sure the `yt-dlp` binary exists in your `$PATH` so that it can be invoked while the app is running.

Linux:
Download the binary from the official releases or build from source. 
Download link: <https://github.com/yt-dlp/yt-dlp/releases/download/2026.02.21/yt-dlp_linux>

macOS: 

```bash 
brew install yt-dlp 
```

## Build (MacOS or Linux)
```bash
npm run build 
```

## Build Windows Installer + Portable

```bash
npm run build:win
```

Artifacts are created in `release/` using these patterns:
- `StreamFetch-Setup-<version>.exe` (installer)
- `StreamFetch-Portable-<version>.exe` (portable)

## Release Workflow

- GitHub workflow runs on `v*` tags (for example `v1.0.10`).
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

For source-based development, place these files in `bin/`:
- `yt-dlp.exe` (required)
- `ffmpeg.exe` (optional, enables merged best-quality outputs)

These binaries are not committed to git to keep repository size small.

## Releases

Install from GitHub Releases to avoid manual setup. Each release includes:
- Windows installer (`Setup .exe`)
- Portable executable (`.exe`)

## License

MIT
