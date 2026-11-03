# Project Handoff

## Current State — 1.3.32 installed; source push pending

The desktop workbench supports ordinary conversations and local tasks without a registered project. Projects remain optional. An explicitly empty project registry survives restart; deleting or archiving the last project returns to Ordinary Chat. Legacy workspace migration remains supported.

| Completed requirement | Change and scope | Validation |
| --- | --- | --- |
| Optional projects | Project registry, main-process request binding, and Ordinary Chat navigation | 19 focused logical cases passed |
| Projectless file tasks | A general workspace outside protected app data, retaining existing permission and binding checks | Actual installed 1.3.31: real file write and Chinese text readback passed |
| Persistence and project lifecycle | Empty startup, ordinary message save, optional-project switching, last-project deletion, and restart | Six actual installed-app scenarios passed; candidate archive/restore also passed |
| Windows 1.3.31 installer | Fixed build inputs, renderer build, unpacked Electron build, NSIS, installation over 1.3.30 | Build/install succeeded; 81 installed files matched the accepted candidate |
| Message operations and answer branching | Added copy/edit/regenerate actions for messages, answer-level branching to a new chat, isolated message IDs, display-only operation history without replay, and strict detached-window action filtering | `conversation-revisions.test.mjs` passed 10/10 after the final IPC filtering fix; real Electron DOM check exposed all five actions and preserved `run_command` disclosure |
| Running-task steering | Added bounded text-only steering queues, a preload/IPC bridge, next-model-round injection, expiry events, and a separate stop plus “提交引导但不中断模型运行” UI action | Steering queue/runtime tests passed; real Electron loopback model check confirmed a second request received the steering text and completed normally |
| Completed progress and command disclosures | Completed progress is compact by default, operation details expose stable disclosure IDs and names, and command/output remain toggleable | Focused UI contract tests and real Electron DOM check passed |
| Windows 1.3.32 installer and replacement | Rebuilt with the local Electron distribution and installed over `C:\Program Files\scodex-workbench` | Installer exit 0; installed EXE and ASAR match the accepted candidate hashes; actual startup loaded both existing chats without history errors |

## Decisions and Constraints

- Public source retains the 1.3.30 packaging conventions. Unfinished mobile changes and mobile-only npm scripts are excluded from this release.
- Dependencies are unchanged. Only root version metadata in the lockfile changes.
- Existing user profiles and disk project files are preserved. New computers still require model service and key configuration.
- The installer is distributed as a GitHub Release asset: [v1.3.31](https://github.com/song123-jian/-0/releases/tag/v1.3.31). Its SHA-256 is `4701036f0ef136ad67e5353a8e067168a53478fb9add514dcab1bd42d78474e9` (189910973 bytes).
- Upgrade by running the installer and selecting the existing application directory. Keep the 1.3.30 installer or program backup for rollback; do not overwrite or delete user data during rollback.
- Private credentials, profiles, local build artifacts, machine-specific evidence and backups are excluded from source uploads.

## Existing Results and Limits

Earlier 1.3.30 validation covered 403 distinct automated cases after a targeted test-helper cleanup repair. Those results remain valid only for unchanged scope; no full-suite rerun is claimed for 1.3.31. Earlier file/editor and packaging validation is historical evidence, not a new whole-system acceptance.

Only model HTTP responses were replaced by a controlled loopback fixture during the 1.3.31 actual-app checks. Public model generation, unrelated integrations and unfinished mobile features are outside this acceptance. No further refactoring is required by this increment.

The restored source checkout used for this increment is `C:\Users\宋建建\source\repos\scodex-workbench-restored`; it is an extracted working tree without Git metadata. The original GitHub commit archive was used as a read-only comparison baseline, and its temporary extracted comparison directory was removed after review. Dependencies were installed from `package-lock.json` for validation and are not part of the source handoff. The current renderer build completed successfully after temporarily supplying the Electron package's missing `dist/LICENSE` input for license generation; that temporary file was removed afterward.

Known limits: running-task steering accepts text only; attachments, file context, message editing, revision switching, and answer branching remain blocked while the target chat is running. A steering item submitted after the final model round is reported as expired instead of being silently dropped. The affected focused suites passed 23/23 (including 10/10 conversation revision cases); a later full `npm test` run passed its initial 50+ cases but produced no further output for several minutes and was stopped, so no clean full-suite result is claimed. The renderer `npm run build` completed successfully. Actual Electron loopback/UI checks remain valid evidence for the previously tested packaged candidate.

See [Test Handoff](TEST_HANDOFF.md) and [Workflow](WORKFLOW.md).

## Current Checkpoint — 2026-11-03

- Installed 1.3.32 steering acceptance passed: the active request continued, the next model round contained guidance and real read_file results, and the final answer persisted (release/delivery-1.3.32/steering-installed.json).
- Current focused verification passed 15/15 on the upload copy; incremental review found no remaining confirmed in-scope issue. Earlier valid results are reused, without claiming a clean full-suite run.
- Lightweight refactoring assessment: no evidence supports additional refactoring for this delivery; retained temporary data is a documented manual cleanup follow-up.

- The source changes for progress disclosures, message operations, answer branching, and running-task steering are implemented in the current source tree and staged in this upload repository.
- The latest actual packaged-app steering check passed on the 1.3.31 executable with an isolated profile and loopback model. The focused changed suites passed 32/32; no clean full-suite result is claimed.
- Standard and initial local-cache builds timed out. The diagnostic run found the missing Electron `45.0.0` ZIP; that download stalled and was stopped.
- The 1.3.32 installer build passed using `node_modules/electron/dist` through `electronDist`, with verified local NSIS and `rcedit` paths. Installer: `release/Scodex-Workbench-Setup-1.3.32-x64.exe`, 181089600 bytes, SHA-256 `1323D3C0419ECAEA86B6A6EF0D07D5E0AC2ED94B0355211B3B419F2184307E03`. Candidate executable file version `1.3.32`, SHA-256 `3AAA10F56A81927C1504472877861A61E31DAC6D73DF435E0B50C8438C6E87FE`; ASAR SHA-256 `E911964F195BF5F3014AD2DFFD4F524DBAED150C8725A79B3CF7A5605D9B261B`.
- Actual 1.3.32 candidate UI acceptance passed for completed progress, command/output disclosure, copy, edit, regenerate, and answer branching. Progress starts collapsed at 13px against 16px body text.
- The 1.3.32 installer replaced `C:\Program Files\scodex-workbench`; actual startup reported version `1.3.32`, loaded two conversations and four visible messages, and returned no history error. Pre-install and post-install hashes matched for `conversations.json`, `settings.json`, `model-connection.json`, and `device-profile.json`. The old `repairs` directory is absent; all 27 candidate files are installed plus two uninstaller files.
- The verified source is staged in the Git upload working copy. Package and lockfile root versions are aligned to 1.3.32; commit, push to main and remote commit verification remain pending.
- Cleanup remains a manual follow-up because automatic approval review rejected it; retained paths and the manual procedure are recorded in TEST_HANDOFF.md.
