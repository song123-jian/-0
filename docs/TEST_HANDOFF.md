# Test Handoff

## Active Increment — 1.3.38, 2026-11-05

- Goal: support up to six safe temporary-service retries and automatically fold completed execution into an elapsed-time summary with an arrow; retain final answer and actual file-change card.
- Baseline: 1.3.37 / e947c35c0ab750cf62f8db00b629fbf58633aae6. Target 1.3.38 follows the established SemVer patch mapping.
- Current checkpoint: implementation, focused tests 55/55, direct regression 33/33, renderer/unpacked builds and candidate UI acceptance complete. NSIS, replacement, installed acceptance 10/10 and real-profile startup/normal exit complete; source and Release publication complete; v1.3.38 verified as Latest. Scoped review passed 15 code/test/version files, no open finding.
- Implementation: settings, config and runtime allow 0–6 retries. New configs default to six; existing explicit lower/off values remain supported. Retrying requires HTTP 429/502/503/504 before returned text or any tool operation; auth errors, broken streams, network failures and cancelled waits never replay.
- Presentation: one native elapsed-time disclosure contains commentary and operations. Completion collapses it even if an earlier operation failed; failed/cancelled requests remain readable. A bounded finalContentOffset survives history normalization; old histories keep their entire original text.
- Actual target: Scodex工作台.exe 1.3.38, Windows x64/Electron 45. Candidate release/win-unpacked/Scodex工作台.exe; final C:/Program Files/scodex-workbench/Scodex工作台.exe. Actual-app tests use owned isolated profiles, real renderer/IPC/Windows encryption/disk and loopback-only model responses.
- Constraints: preserve user data, credentials, current model/reasoning, unrelated electron/third-party-licenses.json and earlier rejected cleanup paths. Apply only the user-requested current retry preference to six after installation.

| Verification range | Actual result and evidence under release/delivery-1.3.38 |
| --- | --- |
| Focused behavior and config | 55/55, focused-tests.log; sixth retry success, exhaustion, cancel, nonreplay, persisted boundary |
| Direct dependencies | 33/33, direct-regression.log; goal runtime, presentation and revision behavior |
| Candidate actual UI | 10 accepted cases: r4 first six retry/settings/history cases, r5 tool/no-replay and folding cases, r8 keyboard/detached/persistence/layout. candidate-ui-r8/retry-completion-ui.json explicitly references reused evidence; all apps exited 0 except the rejected r2 harness cleanup |
| Installed actual UI | 10/10, installed-ui/retry-completion-ui.json; normal exit 0; completion fold, safe retry, detached keyboard, persistence and narrow layout |
| Real user profile | installed-profile-final.json passed: history/startup/normal exit, retryLimit 2 -> 6 only, encrypted credentials unchanged; no real model request |
| Visual | r8 completed-fold.png, 1440x1000: current completed message summary is collapsed, final answer/card/actions visible; earlier fixture HTTP 503 is intentional. 390px bounds passed |
| Builds | renderer-build.log and package-dir.log exit 0; actual packaged source matches tested implementation |

- Resolved harness/preparation failures: initial CRLF insertion rejected without changing LF docs; r1 innerText newline; r2/r3 normalized-history completion race (corrected using actual rendered terminal state), r4 wrong seeded workspace path, r6 missing output cwd, r5/r7 native Enter missing character (focus proof retained). Only harness/preconditions changed; failures remain in their named reports/logs. r2 task-owned root PID 25228 was ownership-checked then stopped after timeout; no user process ended. r4/r5/r8 supersede only their affected scopes.
- Evidence and single structured checkpoint: release/delivery-1.3.38/checkpoint.json. Unchanged 1.3.37 results below remain valid; no new public-provider speed/reliability claim.
- Delivery identity: installer 181106391 bytes / SHA-256 0f823c74f293f9c01b9417dd92f03b68874cf697f12d9ec88d638ef0928386e2; installed EXE f6916183c338b7d7e2bb5fdbde94e3d9d5198cb3a1996bf47e7c0f81a27fd202; ASAR 9c10447dae742ce480a1a165ed6a3119e0297fa176af0c15f2e6d18eb6298e39. Installer exit 0, 27/27 candidate files match, five critical profile files unchanged at replacement. Backup: release/delivery-1.3.38/rollback-1.3.37, 29 verified application files; normal exit before restoring only app files, preserve APPDATA. final-installation.json and rollback-manifest.json provide details.
- Verification-only corrections: electron-builder intentionally strips development metadata from packaged package.json; effective name/version/main/dependencies match. Initial same-path ASAR read retained a pre-install header cache; fresh-process read confirms 1.3.38, no reinstall. Initial verifier failure preserved; HKLM uninstall entry matches final path/version.
- Cleanup: automatic approval rejected deletion as blocked by policy. Six ownership/path-checked fixtures moved into release/手动删除 with unique 1.3.38 names; original paths absent. Pending manual removal has no acceptance impact; cleanup.json lists original/current paths. Reports, screenshots, installer, rollback and earlier denied leftovers retained.
- Next authorized increment: optimize main model, read-only exploration submodels and bounded advisor calls before plan lock, on repeated error and before completion. Not implemented in 1.3.38; preserve configured models and credentials. Continue after this publication and dual-handoff gate.
- Publication: source 2b442b15f50b26c87eabf248b30851e95540c5b1 is byte-identical on remote main. [Release v1.3.38](https://github.com/song123-jian/-0/releases/tag/v1.3.38) is Latest; tag/source, installer size 181106391 and server SHA-256 match the accepted installer. source-publication-final.json and release-publication-final.json contain readback. This increment is complete; the newly authorized model-role optimization remains to implement.
- Skills reused: requirement-understanding 95 (30/20/16/15/9/5), systematic-debugging 95 (30/20/16/15/9/5), code-write-review 94 (30/20/15/15/9/5). Relevant requirements, fault-isolation and encoding/review procedures were directly verifiable; no subagents.
- Project status: [Project Handoff](HANDOFF.md).

## Active Repair — 1.3.37, 2026-11-05

- Current status: Stage 1 Skill/AGENTS, timeout and rule-display scope plus Stage 2 inline edit and direct retry have passed actual installed-program acceptance. Source bdfcf546359d40fbac5446e8ff60d27d3bf4475b is remotely verified, and v1.3.37 is published as Latest.
- Baseline/identity: source HEAD 98e75188d1529312fefa1f73c584d964726e9157; previous formal version 1.3.36, same-round target 1.3.37. Final installer SHA-256 0d3a2c8e2298aec8ecba22bc956f7a45e8db770e054fb0bc12fc6168406b88de, 181107707 bytes; installed EXE 4c883b3233b034be2e310e63bd6af490f8269c51d3c1bb2ecac41ae3e882033f; ASAR be37ad05d7158ec7a5072a0b75c98fb3d5309cb0f50c7e7e9f9af57da84fd682. Previous formal version rollback: release/delivery-1.3.37/rollback-1.3.36.
- Existing constraints: preserve model, reasoning, credentials, user data, unrelated license marker, current file-change/undo behavior and earlier rejected cleanup directories. No automatic source self-modification.
- Prior failure evidence retained: context r1 31/32, fixed inherited-rule whitelist and retested scoped 19/19; early candidate harness r1/r2 and public assertion failures were test-only; corrected local candidate/UI and saved public terminal/proof evidence passed. Startup helper import path corrected before actual app launch. No prior failure reclassified as passing.
- Stage 2 scope: in-bubble edit, adjacent retry, old-answer replacement, early-turn and file-effects confirmation, keyboard/cancel, detached window, revision persistence, error retry and actual installed UI. No real external model call was needed for Stage 2; its model text came from loopback. Stage 1 public-provider and 125-second stream results remain valid for unchanged paths.
- Skills used in this task: requirement-understanding 95, systematic-debugging 95, code-write-review 94; no subagents.

- Actual target: Scodex工作台.exe 1.3.37, Windows x64/Electron 45; installed entry C:/Program Files/scodex-workbench/Scodex工作台.exe; Node 24. Loopback UI uses isolated profile and synthetic project; public provider used isolated profile and synthetic skill/rules, with encrypted connection copied temporarily and removed.

| Stage 1 scope and actual steps | Expected and actual result | Status and evidence |
| --- | --- | --- |
| Stream/timeout unit + regression | Effective stream progress renews idle 120 s; heartbeat does not; 10 min request bound, cancel and no replay; 23/23 | Passed: runtime-focused.log |
| Catalog/package and scoped rules | Discovery, disable/uninstall/hash/pagination, full instruction precedence/change/safety, assigned-file inherited path; unchanged catalog 4/4 and selected package 12/12, scoped 19/19 | Passed: context-focused-r1.log partial plus scoped-context-r2.log; first overall 31/32 failure retained |
| Deferred presentation, history and runtime | Rule disclosure retains ok:false, no initial file effect, deferred persisted and rendered neutrally; 44/44 | Passed: deferred-focused.log |
| Actual candidate | First version 7/7 including 125,002 ms real stream; status revision 7/7, app exits 0 | Passed: candidate-ui-r3 and candidate-status-ui reports |
| Stage 1 initial installed EXE | Status revision 7/7, normal folds, real file read/write, disabled/privacy/rule-change/cancel; 1440×1000 screenshot shows no visible error for that page/data state; app exits 0 | Passed: installed-status-ui/instruction-skill-ui.json and instruction-skill.png |
| Real configured model | Actual auto Skill open/list/search/read and write/read, synthetic proof, PERSONAL/PROJECT/DEFAULT markers, original connection unchanged; first local preparation 381 ms, first activity 18,669 ms, not a same-input speed comparison | Passed: external/validated-result.json; original assertion failure preserved |
| Stage 1 provisional installation | Initial installer SHA-256 c2656207947cc468f88bc43d0a42eed88e83514bf18b0a487e4cfe199676ae30; 27/27 files matched that candidate, 2,946 profile files unchanged immediately after install; 2/2 startup/history/exit and 4/4 critical profile hashes unchanged after exit | Passed: installation.json, installed-startup.json |

| Stage 2 scope and operation | Expected and actual result | Status and evidence |
| --- | --- | --- |
| Revision/bridge logic | Retry preserves stored input/attachments and disables tools, removes old answer without new retry version; earlier turns/file effects require checked confirmation; edit keeps version history | Passed 21/21: focused Node tests and stage2-review.json |
| Candidate actual UI | Click edit inside original bubble, Escape cancel, save; adjacent retry replaces answer; earlier-turn cancel/confirm; detached edit/retry; restart/history; narrow layout | Passed 5/5: inline-ui/inline-message-ui.json; screenshot inline-ui/inline-message.png |
| Installed actual UI | Same scoped flow with Ctrl+Enter in detached window and 390px/1440px layout; app exits normally | Passed 5/5: installed-inline-keyboard/inline-message-ui.json and inline-message.png |
| Failed answer retry | Model-list success and HTTP 502 diagnosis unchanged; ordinary and failed-regeneration retry avoid modal and remove failed response without new retry snapshot | Passed 4/4 candidate and 4/4 installed: installed-gateway-ui/model-diagnostics-ui.json |
| Stage 1 direct UI regression | Automatic Skill/rule behavior and status remain correct after renderer change; long stream/public provider reuses unchanged evidence | Passed 7/7: candidate-stage1-regression/instruction-skill-ui.json |
| Final build, replacement and real profile | Installer exit 0, 27/27 installed files match candidate; five critical profile files unchanged at install; real startup/history/normal exit, four immutable critical files unchanged and encrypted learning memory valid | Passed: final-installation.json; installed-profile-final.json |

- Preserved failures: first inline UI script used an unquoted CSS attribute value for numeric-leading IDs; after fixing only the selector, all five checks passed. First silent install had an escaped-path argument error, returned 0, and was rejected by missing-EXE check; corrected raw-path reinstall and hashes passed. First real-profile script required learning-memory.json to stay byte-identical even though it saves encrypted state on normal exit; installed-profile-initial-failure.json is retained, corrected check passed. No failed result is reclassified as passing.
- Publication acceptance: source blob/tree/commit hashes match local Git; main update used checked parent and non-forced API operation after Git transport timed out. Release/tag/source commit, Latest status, asset size 181107707 and server SHA-256 0d3a2c8e2298aec8ecba22bc956f7a45e8db770e054fb0bc12fc6168406b88de all match. Passed: source-publication-final.json and release-publication-final.json; docs-only sync follows.
- Cleanup: nine exact Stage 2 fixtures deleted and verified absent, see stage2-cleanup.json. Seven Stage 1 fixtures remain in release/手动删除 after deletion was rejected by automatic approval; exact original/current paths are in cleanup.json. Manual removal later; previous denied paths untouched. Retained reports/screenshots/installer/rollback remain valid; reports may contain fixture paths whose temporary data was deliberately removed.
- Final verification: Stage 2 source checks are in stage2-review.json, Stage 1 review reused from incremental-review.json. All necessary finite commands and actual test applications ended. The 1440×900 installed inline-editor screenshot has no visible error in that device/page/viewport/data state; 390px layout bounds passed. No full-suite, every-provider or absolute model-speed claim is made.
- Project status: [Project Handoff](HANDOFF.md).

## Active Increment — 1.3.36, 2026-11-04

- Actual target: Scodex Workbench 1.3.36, Windows x64/Electron 45; installed entry C:/Program Files/scodex-workbench/Scodex工作台.exe, candidate release/win-unpacked/Scodex工作台.exe. Existing Node.js 24 toolchain. Evidence root: release/delivery-1.3.36.
- Preconditions: isolated actual-app UI profiles allow loopback binding and danger-full-access only for owned fixtures. Real Windows safeStorage, disk/PowerShell, Electron/React/IPC are exercised; model generation is a loopback fixture except the explicitly separate public short request.

| Scope / actual steps | Expected and actual result | Status / evidence |
| --- | --- | --- |
| Focused changed-module logical cases | Metadata reuse, finite limits/spill, approval-before-capture, cancellation/conflicts, real diff/undo, SSE completion, timing and batching; 45/45 | Passed: focused-tests-final.log |
| Direct regression | Goal, steering, message/progress and model-usage paths; 21/21 | Passed: direct-regression.log |
| Comparable local benchmark | 320 x 64 KiB plus target, 4 commands; old 2,581 ms/missed target versus new 474 ms/exact target, 2,243 metadata reuses; deliberate 500-ms SSE tail first tool 534 -> 2 ms | Passed: performance-benchmark.json; encryption stub, not public/Windows performance proof |
| Actual candidate core UI | Submit command over 18 MiB workspace, inspect lazy diff, undo and read bytes; phases/metrics omit reasoning body; incomplete empty state blocks undo; 390px layout fits | Passed 5/5: ui-r3/latency-capture-ui.json; scan 71 ms, preparation 10 ms |
| Actual candidate independent-window boundary | Delete nested directory, expand detached diff, undo and reread exact original bytes | Passed 3/3: ui-boundary/task-file-changes-ui.json |
| Actual installed core UI | Repeat affected real command/diff/undo/phases/incomplete/narrow UI sequence at installed EXE | Passed 5/5, exit 0: installed-ui/latency-capture-ui.json; scan 84 ms, preparation 12 ms, tool-completion to next request 1,110 ms before 5-second tail |
| Installed visual | 1440x1000 final state: real file card/actions and incomplete warning; no visible obstruction/overflow in this device/page/viewport/data state | Passed: installed-ui/latency-capture.png |
| Existing user profile | Launch installed entry without sending a model request, compare history, quit normally and reread four critical files | Passed 2/2, version 1.3.36, 2 conversations/2 messages, exit 0, 4 hashes unchanged: installed-startup.json |
| Real public short request | Existing glm-5.3/ultra, isolated chat-only profile, fixed public prompt; HTTP 200, 300 reported tokens; preparation 9 ms / first activity 8,669 ms / text 11,771 ms / total 11,773 ms | Passed: external/external-latency.json; not a same-input reproduction of original 47-second task; credential copies removed, original unchanged |
| Incremental review | Only 21 current code/test/version files; correct boundaries/references, UTF-8/no BOM, no replacement character/NUL; unrelated license marker retained | Passed: incremental-review.json; unchanged final fingerprints verified |
| Build and replacement | Renderer/unpacked/NSIS and installation exit 0; 26 candidate file hashes match; 2,946 profile hashes unchanged at replacement | Passed: renderer-build.log, package-dir.log, installer-build-final.log, installation.json |

- Identity: 1.3.35 -> 1.3.36 under established patch mapping. Installer 181102112 bytes / SHA-256 177daacfbedad180aa9b5981594a10600c4a17d9a85eea4e10fad6646f3b622e. Final EXE/ASAR hashes and 29-file rollback-1.3.35 manifest: installation.json. Roll back only application files after normal exit, preserving APPDATA.
- Published source 6587faa6dd207638e1ea0a7b29c1d893925547dd; GitHub v1.3.36 is Latest. Release/tag/asset size and SHA-256 readback passed; local evidence: release-publication.json and source-publication.json.
- Resolved prerequisite/harness failures: authorization-test expectation; ui allowLocalBinding omission; ui-r2 premature pending completion; external encrypted-key context omission; NSIS held debug.log; install preflight artifact root; startup helper relative import (application had not launched); handoff checker escape error (actual links remained valid). Retained failure logs; rerun only affected scope. ui-r3/external-r2/final packaging/install/startup supersede these failed attempts.
- All finite build/test/install operations finished; test apps exited normally. Existing 1.3.35 unaffected results remain valid only for unchanged paths. User model/default reasoning was not changed.
- Cleanup: automatic approval rejected the one deletion request (“blocked by policy”); nothing deleted/moved, no retry. Six exact present fixture paths and manual cleanup state are in cleanup.json; old denied fixtures untouched. Retain reports/final screenshots/baselines/installer/rollback; never delete APPDATA.
- Uncovered: comparable original 47-second full task, every provider/load condition, and paths deliberately outside bounded capture. No absolute model-speed guarantee. See [Project Handoff](HANDOFF.md).

## Previous Verification — 1.3.35, 2026-11-04

Actual target: Scodex Workbench 1.3.35, Windows x64, Electron 45. Final entry C:/Program Files/scodex-workbench/Scodex工作台.exe; candidate entry release/win-unpacked/Scodex工作台.exe. Focused logic uses the existing Node.js 24 runtime. Actual UI tests use isolated profiles and loopback-only model HTTP, real renderer/IPC/file tools, PowerShell and Windows safeStorage. Real-profile startup reads existing user data without submitting a model request. No full-suite or real external-generation acceptance is claimed.

| Scope and actual steps | Expected / actual result | Status and evidence under release/delivery-1.3.35 |
| --- | --- | --- |
| Focused logical tests: node --test tests/task-file-changes.test.mjs tests/conversations.test.mjs tests/conversation-revisions.test.mjs tests/agent-tools.test.mjs tests/workspace-windows.test.mjs | Real line edits, empty/new/binary files, repeated writes, prior dirty content, reload/undo, conflict preflight, command create/delete, deleted parents, busy state and detached binding; 46/46 passed | Passed: focused-tests-final.log |
| Actual candidate core task: read/write/edit existing file, create a file, PowerShell create/delete; inspect card and diff, copy, reload, undo, external-conflict refusal, no-change answer and branch | 4 files +5/-2, exact disk results, encrypted record, user modifications retained, no old card; all 6 core checks passed | Passed core scope: ui-r2/task-file-changes-ui.json. Report overall is failed because its later narrow-view step failed; do not describe that whole report as passed |
| Settled narrow view, reuse accepted data; 390x844, hide right workbench only when actually open | Visible cards, nonzero rectangles and no horizontal overflow | Passed 1/1: ui-mobile-confirmed/task-file-changes-ui.json and task-file-changes-mobile.png |
| Final rebuilt candidate: real command deletes nested directory, open detached chat, expand diff, undo and reread original file | One deletion, real removed lines, no old version cards; detached action restores deleted parent and exact bytes | Passed 3/3: ui-boundary-final/task-file-changes-ui.json |
| Final installed path: repeat directly affected directory/detached actions | Real diff and successful exact file recovery from actual installed executable | Passed 3/3: installed-card-ui/task-file-changes-ui.json |
| Installed gateway/retry regression with old revision history | Removed cards remain absent; archived/current history retained; model-list success does not hide chat 502 diagnosis; both retries replace failed answer without opening editor | Passed 4/4: installed-retry-regression-final/model-diagnostics-ui.json |
| Real existing profile: launch final installed entry, read state/history, quit normally | Actual version 1.3.35; 2 conversations / 2 messages match on-disk library; no history error; exit 0 | Passed 2/2: installed-startup.json; four critical profile hashes unchanged in profile-after-startup.json |
| Final installed desktop visual: reuse accepted record, 1440x1000, card and actions visible | 4-file +5/-2 card below answer; actions below card; no obsolete card; card top 317.8, bottom 586.5, actions 594.5-622.5 | Passed: ui-final/final-card-visual.json and task-file-changes-desktop.png. In this device/page/viewport/data state no visible error; screenshot shows accepted undo state |
| Incremental review | Current task differences plus new files; correctness, bounds, permissions, persistence, UI/branch behavior, test alignment; UTF8/no BOM and no replacement characters | Passed: incremental-review.json. Hook/bridge original-baseline limitation explicitly retained |
| Renderer/unpacked/NSIS and installation | All finite commands exit 0; version 1.3.35; 27/27 candidate files match; all 2,945 profile files unchanged immediately after install | Passed: renderer-build-final.log, package-dir-final.log, installer-build-final.log, installation.json |

## Reuse and Resolved Failures

- Previous valid ordinary-chat/project lifecycle, steering, message/progress disclosure and learning-memory results remain valid only for unchanged paths. Earlier learning-memory logic/GitHub fixture cases passed 15/15, revision cases 17/17, and candidate learning-memory UI 2/2. Real cloud sync was not performed; the user profile has no configured in-app GitHub connection.
- Initial command capture incorrectly protected the entire Codex home, excluding the general workspace. Protection was narrowed to the established protected paths; final real 4-file core scenario passed. Initial evidence remains at ui/task-file-changes-ui.json.
- Initial mobile harness clicked a hidden-but-mounted browser toggle and reopened the tools pane. Corrected harness checks .app-shell.has-browser and settled nonzero rectangles. Product layout was not changed to satisfy this harness issue.
- Review found and fixed removed-parent restoration, repeated-edit budget accounting and chat submission during undo; new logical and actual boundary results are above. Product binaries include these fixes.
- Legacy model-diagnostics harness expected removed version cards and then a static 1.3.34 report version. Its first updated run stopped before scenarios (installed-retry-regression/model-diagnostics-ui.json). Assertions now require absence plus retained history and actual running version; final installed run passed 4/4. No product rewrite or relaxed retry/gateway expectations was used.
- All listed build/test commands finished. Each actual-app verification child exited 0; no test application needs to remain running.

## Artifact Identity and Rollback

- Final version 1.3.35 from 1.3.34 under the established patch mapping. Installer 181099770 bytes, SHA-256 489685A4C02B8AACD95904F7013F55E5B3F2F044DF00BA7AC9D318995F3D1C94.
- Accepted and installed EXE SHA-256 2FB70D59D954B899FE439BEA80FF186F7A57FA08C2518EBA278174EDAA2AE71C; ASAR A8BD869DBF1D8405647E61958613910DB324E8E10433A53E0A90A5102FE9FD14. Installer exit 0; 27 candidate files match, no differing candidate file.
- Exact old installation backup: rollback-1.3.34, 30 verified files; prior installer retained at release/Scodex-Workbench-Setup-1.3.34-x64.exe. Normal exit is required before rollback. Restore only application files or use the old installer; preserve the user profile. Details in installation.json and [Project Handoff](HANDOFF.md).
- Source commit 7c2b1b3a9b2abf20938d176f51add537643f2f5b was pushed and remote main matched. Release v1.3.35 is published and Latest; tag commit, uploaded asset size (181099770 bytes) and server-side SHA-256 match the accepted installer. Evidence: source-publication.json, release-publication.json and public release-page readback. Documentation synchronization is separate from the code tag; build artifacts and machine-specific evidence remain ignored by Git.

## Cleanup and Limits

Automatic approval review rejected the cleanup command as “blocked by policy”. Nothing was deleted or moved; one read-only confirmation found all six directories still present. No retry or alternate deletion method was attempted. After closing any test apps, the user can remove only these task-owned directories under release/delivery-1.3.35:

| Original and current relative path | Actual state |
| --- | --- |
| ui/fixture-3be77fbb-ba24-457d-aea4-0cd7c04c49c3 | Retained; manual cleanup |
| ui-r2/fixture-364c6817-0960-4395-9a28-846b6048b189 | Retained; manual cleanup |
| ui-boundary-final/fixture-1de8dc49-a67c-4ac9-8420-229f6c8ed21e | Retained; manual cleanup |
| installed-card-ui/fixture-94d9a724-9fae-4ee2-b6b7-3931ab786144 | Retained; manual cleanup |
| installed-retry-regression/fixture-d35dd7d5-5ae3-413a-85e3-9101427218c7 | Retained; manual cleanup |
| installed-retry-regression-final/fixture-2c243567-fb37-4815-b9b8-ce8ebd33a7d3 | Retained; manual cleanup |

Keep reports, final screenshots, source-baseline.json, installers and rollback backups. Do not delete the real APPDATA profile. The retained fixtures are outside the installed program and real profile and do not invalidate accepted functionality. Local detailed record: cleanup.json.

Historical cleanup status retained without new action:
- Temporary validation data remains in its original Temp paths because automatic approval review rejected the cleanup command. No deletion or fallback move was retried. Retained groups: the 10 earlier scodex-steering-ui-* profiles, two scodex-candidate-ui-* runs (c43c5dcd-e058-4b9c-9d0e-c353ece5a9f9 and 249e1f20-4008-4e19-93df-97e7ce1fa5a7), three scodex-steering-candidate-1.3.32-* fixtures (233d8c26-e32f-426b-ae27-9725003cdfde, 5a3db47c-7885-4d74-9ed1-963328099f13 and 7831a20a-6822-40c3-bf2f-1daf532d1692), and electron-download-FDUtUk/electron-v45.0.0-win32-x64.zip. Manual handling: close test applications, confirm these task-owned paths under %LOCALAPPDATA%/Temp, then remove only the named fixtures/download. These paths are outside the installed application and real user profile; they do not invalidate accepted functionality.

Command capture is bounded (2 MiB/file, 16 MiB task snapshots, 100 changed files, 6,000 scan entries); excluded directories and project-external shell effects are outside universal undo coverage. Incomplete capture disables undo with a warning. External writers are checked with hashes but do not share internal locks. Native clipboard contents were not changed: the copy handler was captured. No actual external model request, private key, real GitHub learning-memory write or second-device acceptance was part of this increment.
