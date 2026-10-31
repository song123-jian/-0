# Scodex Workbench

A Windows desktop workbench built with Electron, React, and Vite. It brings project files, coding tasks, Git and pull-request workflows, installed skills, and MCP connections into one local application.

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