# Project Handoff

## Current Checkpoint — 1.3.35, 2026-11-04

- Goal: show actual task file changes below that task's completion answer, replacing the incorrect conversation-version cards. Local implementation, review, builds, installation and actual installed-app acceptance are complete. Source push and GitHub Release publication are pending and must be read back before claiming publication.
- Source: this checkout, branch main; pre-delivery HEAD f598df9a14a104cb87afaef040e34f04d00f5242. Existing authorized learning-memory changes are retained; the task baseline separates them from this file-card increment.
- Actual entry: C:/Program Files/scodex-workbench/Scodex工作台.exe, version 1.3.35. User data: %APPDATA%/scodex-workbench. All verification applications exited normally; no build or test is pending.
- Plan/checkpoint: implementation completed; candidate acceptance completed; installer/replacement completed; installed acceptance completed; source/Release publication pending; final dual-handoff publication update pending. No additional product refactor is justified by the reviewed scope.
- Skills: requirement-understanding 95/100 (30/20/16/15/9/5); code-write-review 94/100 (30/20/15/15/9/5). No subagent delegation.

## Completed Requirements

| Requirement | Result and scope | Evidence |
| --- | --- | --- |
| Per-answer file summary | Below completed answer and activity, above message actions; total files and green additions/red deletions, per-file counts | Core actual UI: 4 files, +5/-2; final installed 1440x1000 visual check passed |
| Real changes | Actual tool before/after bytes, bounded command snapshots, repeated edits aggregated from task baseline | 46 focused logical checks; actual file tools and PowerShell |
| View and undo | Real text diff; encrypted persistent snapshots; workspace/conversation/permission binding; preflight rejects later edits; deleted parent directories restored | Candidate 3/3 and installed-path 3/3 boundary UI checks |
| Correct display object | Removed old ConversationVersions cards in main and detached chat windows; retained message edit/regenerate behavior and history | Installed regression 4/4; old/current history retained |
| Copy and new-chat branch | Existing answer copy and “在新对话中分支” below the card; branch cannot inherit source undo capability | Core UI copy/branch checks passed; final installed geometry/actions passed |
| Existing authorized functionality | Optional projects, ordinary chat, steering, progress/command disclosure, retry and encrypted learning memory retained | Historical valid scoped results reused; current installed retry/gateway regression passed |

## Architecture and Constraints

- electron/task-file-changes.cjs owns per-request aggregation, encrypted records, real diff and guarded undo. electron/file-commit.cjs observes writes inside the existing commit lock. main/preload persist only a record ID in each answer. The shared React card and existing detached-window action bridge render it.
- Source baseline/review: release/delivery-1.3.35/source-baseline.json and incremental-review.json. Review covers 15 directly changed code/test files; unrelated inherited differences are not attributed to this increment. Two hook/bridge baselines were captured after initial edits, so their known patches and source were reviewed without claiming an original byte baseline.
- Limits: 2 MiB per file, 16 MiB snapshot budget, 100 changed files, 6,000 command scan entries. Excluded dependency/build/Git/sensitive/protected paths and project-external shell effects are not universally captured. Incomplete records display a warning and disable undo. Binary/non-UTF8 or over-budget text comparisons show no invented line counts.
- External applications do not share the internal lock. Hash preflight and write/readback detect conflicts; arbitrary OS activity cannot be made transactional. Old answers without saved snapshots cannot acquire retroactive real diffs.
- Model responses in acceptance were loopback fixtures; actual Electron, React, IPC, Windows encryption, disk files and PowerShell were used. External generation and real learning-memory synchronization were not accepted by these fixtures.

## Version, Build and Replacement

- Established project version mapping: 1.3.34 to 1.3.35, one patch increment for this delivery. package.json and both root lock versions agree; failed builds and tests did not increment again.
- Build: npm run build; npm exec electron-builder -- --win --dir --x64 --config.electronDist=node_modules/electron/dist; npm exec electron-builder -- --win nsis --x64 --prepackaged release/win-unpacked --config.electronDist=node_modules/electron/dist. All exited 0; existing bundle-size/dependency-metadata warnings remain.
- Installer: release/Scodex-Workbench-Setup-1.3.35-x64.exe, 181099770 bytes; SHA-256 489685A4C02B8AACD95904F7013F55E5B3F2F044DF00BA7AC9D318995F3D1C94.
- EXE SHA-256 2FB70D59D954B899FE439BEA80FF186F7A57FA08C2518EBA278174EDAA2AE71C; app.asar SHA-256 A8BD869DBF1D8405647E61958613910DB324E8E10433A53E0A90A5102FE9FD14.
- Installer exited 0 over the confirmed 1.3.34 target. All 27 candidate files match the installed files. All 2,945 profile files were byte-identical immediately after installation; conversations/settings/model-connection/device-profile remain unchanged after real-profile startup and normal exit.
- Recoverable exact old installation: release/delivery-1.3.35/rollback-1.3.34 (30 files, verified). Old installer retained: release/Scodex-Workbench-Setup-1.3.34-x64.exe, SHA-256 848D705FDD76D299F09AADC83AD276C08314CE2045E9EA3F7756B42425A01E0B. Rollback: quit normally and reinstall 1.3.34 or restore the verified application backup; preserve APPDATA. Do not restore profile caches over live user data.
- Detailed local identity/profile manifest: release/delivery-1.3.35/installation.json. User-specific profiles, rollback copies, fixture data, credentials and build outputs stay out of Git.

## Remaining Publication and Cleanup

- Publish the reviewed authorized source to main, create v1.3.35 using the verified installer, then verify remote commit and Release asset. Authenticated GitHub access for song123-jian was confirmed; no publication has yet been claimed. Use the existing per-command proxy, without changing global Git settings.
- Automatic approval review rejected cleanup with “blocked by policy”. Six task-owned fixture directories remain in their original locations; no delete or move ran and none was retried. Reports, final screenshots, baseline and rollback remain deliberately retained. See [Test Handoff](TEST_HANDOFF.md) and local cleanup.json for exact manual paths.
- No remaining high-confidence in-scope defect or justified extra refactor was identified. Outstanding manual cleanup does not affect the accepted executable.

See [Test Handoff](TEST_HANDOFF.md) and [Workflow](WORKFLOW.md).
