# Scodex Workbench

A Windows desktop workbench built with Electron, React, and Vite. Start a conversation and complete local tasks without creating a project; projects are optional and the last project can be archived or deleted. It brings project files, coding tasks, Git and pull-request workflows, installed skills, and MCP connections into one local application.

## Current source: 1.3.66

Automatic model handoff now saves an enable switch and capability levels for three modes. Two consecutive same-class tool failures or an explicit assistance request can select a configured stronger model, then return to mode one to verify, refine, and continue the same task. Manual selection takes priority and cancellation stops the relay. Settings default to off/unranked; model names are not used to guess capability.

AGENTS override/scoped-rule checks, progressive Skill discovery and resource reading, authorized Skill script execution, and encrypted learning-memory restart recovery are implemented in the application. Learning memory is saved context, not model training. Existing file links, `/compact`, full history, and model-connection categories remain available.

See the [1.3.66 acceptance summary](docs/verification/1.3.66.json), [final handoff view](docs/verification/auto-handoff-1.3.66.png), [alignment and limits](docs/CODEX_ALIGNMENT.md), [file-link verification](docs/verification/1.3.65.json), [context-summary verification](docs/verification/1.3.64.json), and [model settings preview](docs/verification/model-connection-1.3.64.png). Validation uses the actual Windows EXE and isolated profiles; model-dependent scenarios use a loopback service. Public-provider summary quality and Codex remote compaction are not certified.

## Download

The complete Windows x64 application is available from the [Scodex Workbench 1.3.66 release](https://github.com/song123-jian/-0/releases/tag/v1.3.66), or [download the ZIP directly](https://github.com/song123-jian/-0/releases/download/v1.3.66/Scodex-Workbench-1.3.66-win-x64.zip). Source and release assets have been uploaded and remotely verified.

Extract the entire ZIP into one folder and run `Scodex工作台.exe`. Keep `resources`, `locales`, and the other files beside the EXE. The package includes all 80 files from the verified 1.3.66 application; earlier releases remain available for rollback.

ZIP SHA-256: `9ab13f48c07095742fd210fb5ba7f0b47444503d6d609320db5494db3cda9ad6`

The release also includes `SHA256SUMS.txt` and `Scodex-Workbench-1.3.66-files.json` for archive and per-file verification. Program files are published as Release assets; source remains on `main`. The `v1.3.66` tag identifies source commit `0a36514bf41cd8d60b7b45016e16cc2dfcfa5646`; later documentation updates retain that program version. Anonymous API/CDN checks passed, the direct ZIP URL returned HTTP 200 with the expected length, and both manifests matched byte-for-byte.

On a new computer, model settings start blank. Saved settings remain associated with their computer, and transferring a marked profile does not load the original computer's credentials or chats.

During desktop automation, a non-activating status bar lets you stop the current run with Esc or the Stop button, including while another app has focus.

## Requirements

- Windows 10 or later, x64
- Node.js 24.x and npm for source development; the downloaded application includes its workspace runtimes

## Development

```powershell
npm ci
npm run dev
```

Run the automated tests and build the renderer with:

```powershell
npm test
npm run build
```

Create the Windows x64 portable build and run the smoke checks with:

```powershell
npm run dist
```

The portable build uses the Node, Python, and pip archives under `resources/workspace-tools-bundle/`. Build outputs and local application data are not source files and are excluded from Git.

## Project layout

- `electron/` — main process, IPC, local tools, Git/PR, SKILL, and MCP services
- `src/` — React interface and renderer-side application code
- `tests/` — unit tests and isolated UI acceptance drivers
- `scripts/` — build-time support scripts
- `docs/WORKFLOW.md` — development, verification, Git, SKILL, and MCP workflow notes

## Data and external services

Application credentials and user data remain local and are not included in this repository. GitHub and MCP access use the user-configured services and authentication. Local loopback fixtures are for development tests only; they do not establish compatibility with public services.
