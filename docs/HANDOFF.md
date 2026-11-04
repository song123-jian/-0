# Project Handoff

## Active Increment — 1.3.36, 2026-11-04

- Goal: improve bounded command capture and the reported ~47-second delay before model work. Delivery 1.3.36 replaces installed 1.3.35 using the established patch mapping; this round does not increment again.
- Checkpoint: implementation, candidate/installed acceptance, build, replacement, incremental review and documentation checks completed. Publication completed; no finite operation pending.
- Source/entry: this checkout on main; C:/Program Files/scodex-workbench/Scodex工作台.exe. Model, credential and chosen reasoning level were unchanged. Preserve user data, unrelated electron/third-party-licenses.json stat change and previous evidence.

| Requirement | Actual result | Evidence under release/delivery-1.3.36 |
| --- | --- | --- |
| Faster bounded capture | Reuse unchanged metadata; 16 MiB memory plus 128 MiB encrypted spill; 2 MiB/file, 6,000 entries, cooperative 2-second guard; snapshot after command approval | 45 focused cases; candidate and installed real encrypted capture |
| Honest file summary | Incomplete coverage lists reasons, does not invent zero changes and disables batch undo; actual diffs load on demand | Installed UI 5/5; independent-window boundary UI 3/3 |
| Faster response/tool channel | Complete SSE finishes without gateway tail; first reasoning/tool/text timing; immediate first text then 32-ms batches; no reasoning body persisted | Controlled tail first tool 534 -> 2 ms; actual installed tool continuation 1,110 ms despite 5-second tail |
| Measured limits | Four command snapshots 2,581 -> 474 ms under identical 20 MiB fixture; public short request preparation 9 ms, first activity 8,669 ms, first text 11,771 ms | performance-benchmark.json; external/external-latency.json |
| Program delivery | Renderer/unpacked/NSIS all exit 0; installer exit 0; 26/26 candidate files match; 2,946 user-profile files unchanged immediately after installation | installation.json and build logs |
| Installed acceptance | Five actual UI checks and existing-profile startup/history/normal-exit checks passed; four critical profile files unchanged; all test apps exited 0 | installed-ui/latency-capture-ui.json; installed-startup.json |

- Installer: release/Scodex-Workbench-Setup-1.3.36-x64.exe, 181102112 bytes, SHA-256 177daacfbedad180aa9b5981594a10600c4a17d9a85eea4e10fad6646f3b622e. Installed EXE 8af5c8027b8e25cf9dbf173f35a11d607d40cb4b1593141290f21bfd3b5e0527; ASAR d329963fb8b9137968a23d083c06362e9427789f2f37e0644c41dfc93e2fba57.
- Build: npm run build; npm exec electron-builder -- --win --dir --x64 --config.electronDist=node_modules/electron/dist; npm exec electron-builder -- --win nsis --x64 --prepackaged release/win-unpacked --config.electronDist=node_modules/electron/dist.
- Rollback: delivery-1.3.36/rollback-1.3.35 contains 29 verified old application files. Quit normally before restoring application files or reinstalling the retained 1.3.35 installer; preserve APPDATA. Full identity/backup list: installation.json.
- Published source 6587faa6dd207638e1ea0a7b29c1d893925547dd; GitHub v1.3.36 is Latest. Release/tag/asset size and SHA-256 readback passed; local evidence: release-publication.json and source-publication.json.
- Limits: controlled benchmarks use an encryption stub; actual-app UI substitutes loopback model responses. One public glm-5.3/ultra short request is not the same input as the original 47-second task, so no 47-to-12-second speedup is claimed. Excluded/protected/external paths and capture guards remain intentional boundaries; remote inference waiting remains measurable.
- Cleanup: automatic approval rejected deletion as “blocked by policy”; no delete/move executed or retried. Six task-owned fixtures remain in their original paths, enumerated in cleanup.json; reports, screenshots, baselines, installer and rollback are retained. Prior denied cleanup is untouched.
- Incremental review: 21 code/test/version files passed; fingerprints in incremental-review.json. Unchanged results reused: 45/45 focused and 21/21 direct regression. No further high-confidence in-scope refactor is justified.
- Skills: requirement-understanding 95 (30/20/16/15/9/5), code-write-review 94 (30/20/15/15/9/5), reused; no subagents. Test detail: [Test Handoff](TEST_HANDOFF.md).

## Previous Delivery — 1.3.35, 2026-11-04

- Goal: show actual task file changes below that task's completion answer, replacing the incorrect conversation-version cards. Local implementation, review, builds, installation and actual installed-app acceptance are complete. Source commit 7c2b1b3a9b2abf20938d176f51add537643f2f5b is pushed and remotely verified. GitHub v1.3.35 is published and marked Latest; tag target, asset size and server-side SHA-256 match the accepted installer.
- Source: this checkout, branch main; pre-delivery HEAD f598df9a14a104cb87afaef040e34f04d00f5242. Existing authorized learning-memory changes are retained; the task baseline separates them from this file-card increment.
- Actual entry: C:/Program Files/scodex-workbench/Scodex工作台.exe, version 1.3.35. User data: %APPDATA%/scodex-workbench. All verification applications exited normally; no build or test is pending.
- Plan/checkpoint: implementation completed; candidate acceptance completed; installer/replacement completed; installed acceptance completed; source/Release publication completed; final dual-handoff records updated and validated. No additional product refactor is justified by the reviewed scope.
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

## Publication and Cleanup

- Published source commit 7c2b1b3a9b2abf20938d176f51add537643f2f5b; remote main matched at source publication. Release [v1.3.35](https://github.com/song123-jian/-0/releases/tag/v1.3.35) is published and Latest. Tag points to that source commit; asset Scodex-Workbench-Setup-1.3.35-x64.exe is uploaded, 181099770 bytes, server digest sha256:489685a4c02b8aacd95904f7013f55e5b3f2f044df00ba7ac9d318995f3d1c94. Actual API readback: release-publication.json. Public release-page readback also displays v1.3.35 and Latest. A docs-only handoff synchronization follows the code commit; global Git settings are unchanged.
- Automatic approval review rejected cleanup with “blocked by policy”. Six task-owned fixture directories remain in their original locations; no delete or move ran and none was retried. Reports, final screenshots, baseline and rollback remain deliberately retained. See [Test Handoff](TEST_HANDOFF.md) and local cleanup.json for exact manual paths.
- No remaining high-confidence in-scope defect or justified extra refactor was identified. Outstanding manual cleanup does not affect the accepted executable.

See [Test Handoff](TEST_HANDOFF.md) and [Workflow](WORKFLOW.md).
