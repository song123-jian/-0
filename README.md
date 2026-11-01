# Scodex Workbench

A Windows desktop workbench built with Electron, React, and Vite. Start a conversation and complete local tasks without creating a project; projects are optional and the last project can be archived or deleted. It brings project files, coding tasks, Git and pull-request workflows, installed skills, and MCP connections into one local application.

## Download

The Windows x64 installer is available from the [Scodex Workbench 1.3.31 release](https://github.com/song123-jian/-0/releases/tag/v1.3.31), or [download the installer directly](https://github.com/song123-jian/-0/releases/download/v1.3.31/Scodex-Workbench-Setup-1.3.31-x64.exe).

Version 1.3.31 replaces 1.3.30 as the current download. Earlier releases remain available for rollback.

SHA-256: `4701036f0ef136ad67e5353a8e067168a53478fb9add514dcab1bd42d78474e9`

On a new computer, model settings start blank. Saved settings remain associated with their computer, and transferring a marked profile does not load the original computer's credentials or chats.

During desktop automation, a non-activating status bar lets you stop the current run with Esc or the Stop button, including while another app has focus.

## Requirements

- Windows 10 or later
- Node.js 24.x and npm

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
