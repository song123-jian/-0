# Test Handoff

## Target and Environment

Scodex Workbench 1.3.32, Windows x64, Electron 45 and Node.js 24.17.0 for the candidate UI harness (the application build used Node.js 24.11.0). Prior acceptance used the actual packaged and installed 1.3.31 application with isolated profiles, the real React interface, IPC, file tools and persistence. Only model HTTP responses came from a controlled loopback server.

Installer: `Scodex-Workbench-Setup-1.3.31-x64.exe`, 189910973 bytes, SHA-256 `4701036f0ef136ad67e5353a8e067168a53478fb9add514dcab1bd42d78474e9`. Installed application ASAR SHA-256: `2813d9f25bd8f877a3fd380369e9564bf9a9929f16d8fbfe7a32adcc9372a888`.

1.3.32 installer: `release/Scodex-Workbench-Setup-1.3.32-x64.exe`, 181089600 bytes, SHA-256 `1323D3C0419ECAEA86B6A6EF0D07D5E0AC2ED94B0355211B3B419F2184307E03`. Candidate executable: `release/win-unpacked/Scodex工作台.exe`, file version `1.3.32`, SHA-256 `3AAA10F56A81927C1504472877861A61E31DAC6D73DF435E0B50C8438C6E87FE`. Candidate `app.asar` SHA-256: `E911964F195BF5F3014AD2DFFD4F524DBAED150C8725A79B3CF7A5605D9B261B`. Installed executable and ASAR hashes match these values.

| Scope | Steps and expected behavior | Actual result |
| --- | --- | --- |
| Logical regression | `node --test tests/projectless-chat.test.mjs tests/project-registry.test.mjs tests/conversations.test.mjs`; empty registry, legacy migration, chat binding, archived-project rejection and general directory selection | 19/19 passed |
| Empty startup and ordinary chat | Start an isolated profile with zero projects, send a message and read persisted history | Passed in the actual installed app |
| Optional-project switching | Create a project, select Ordinary Chat and send while the optional project remains | Passed in the actual installed app |
| Last-project deletion | Delete through the actual menu and confirmation; read project registry, conversations and original disk file | Passed: no registered projects, ordinary history retained, disk file retained |
| Projectless local task | Send in full-access mode; execute real `write_file` and read the exact Chinese result | Passed in the actual installed app |
| Restart | Exit and reopen, check zero-project state and saved task result, send another message | Passed in the actual installed app |
| Last-project archive/restore | Use actual candidate menus, archive the final project, restore and select it | Passed; valid candidate result reused |
| 1.3.31 baseline build and install | Build renderer, unpacked Electron and prepackaged NSIS, install over the prior directory | Passed as the historical 1.3.31 baseline; 81 installed files matched that candidate |
| 1.3.32 installer build and replacement | Build renderer, unpacked Electron and NSIS installer with the local Electron distribution and verified local NSIS tools; install over the existing directory | Passed; installer exit 0. Installed EXE/ASAR match the candidate. Old `repairs` directory is absent; all 27 candidate files are installed plus two uninstaller files. |
| 1.3.32 candidate UI: completed progress and command disclosure | Launch actual packaged candidate in an isolated profile; inspect completed state, compare progress/body font sizes, expand/collapse activity and `run_command` details | Passed: progress starts collapsed at 13px vs 16px body; operation and output show when opened and collapse again independently. Initial harness selection omitted a prerequisite scenario; corrected ordered run passed. |
| 1.3.32 candidate UI: message actions and answer branch | Use actual message buttons in the packaged renderer; capture clipboard handler values without changing the system clipboard; branch at an assistant answer | Passed: user/assistant text copied exactly; answer branch retained the four-message prefix and parent ID. Existing edit, attachment/draft preservation, follow-up, and regenerate UI scenarios passed in the same 5-check run. |
| Installed 1.3.32 running-task steering | Hold first loopback response; submit guidance through the running UI; release an actual read_file call; inspect second model request and persisted final answer | Passed: task continued, two requests total, next request included guidance and real read_file contents, operation succeeded, final answer persisted, EXE exit 0. Evidence: release/delivery-1.3.32/steering-installed.json. Initial fixture location was corrected to the real projectless workspace; the failure evidence is retained separately. |
| Current focused logical verification | node --test tests/conversation-revisions.test.mjs tests/message-progress.test.mjs tests/steering.test.mjs on the Git upload copy, Node.js 24.17.0 | Passed 15/15; package/lock root versions all 1.3.32, 17 changed code/package inputs match accepted source after line-ending normalization, dependencies unchanged. |
| Installed 1.3.32 startup and user-data preservation | Run installed executable against the existing profile; verify app state, saved history count and settings; compare critical user-data hashes across installation | Passed: version `1.3.32`, two chats, four visible messages, no history error, font size 16; hashes for conversations, settings, model connection and device profile were unchanged. App exited 0. |
| Current incremental review | Compare HEAD baseline with this requirement only: 15 code/test files plus package metadata; inspect direct references, IPC filtering, steering lifecycle, branching prefix/state and disclosure behavior | Completed; no remaining confirmed issue in the reviewed increment. Existing full-suite interruption and public-model/native clipboard limits remain explicit. |

## Reproduction and Reuse

`tests/projectless-ui.cjs` exercises the actual executable with controlled HTTP. Set `SCODEX_PROJECTLESS_EXE` to the installed executable, `SCODEX_PROJECTLESS_OUTPUT` to an evidence directory, `SCODEX_PROJECTLESS_DEFAULT_HOME=1`, and `SCODEX_PROJECTLESS_SCOPE=formal` for the six installed-app scenarios. It creates an isolated profile and removes its temporary fixture on success. Candidate archive/restore runs with the default scope. `tests/build-projectless.cjs` records fixed build inputs for this release.

The published desktop inputs correspond to the accepted installed package; excluded mobile source and mobile npm scripts are not desktop build inputs. Existing 1.3.30 results remain valid only for unchanged scope (403 distinct logical cases after targeted helper repair). No unrelated full test run or new public-model integration result is claimed.

## Limitations and Follow-up Conditions

Public model generation, unrelated integrations, mobile features, second-device acceptance and native Windows clipboard contents were not verified in this increment. Candidate copy buttons were tested through their real handlers with an in-memory clipboard substitute; public model replies were replaced only by loopback HTTP fixtures. Failed fixture reports remain separate from passing reports. No app or finite test command remains running.

## Current Build Checkpoint

- Target version: `1.3.32`, derived from the confirmed `1.3.31` baseline by one `0.01` increment.
- Candidate executable used for the latest steering check: `C:\Users\宋建建\source\repos\scodex-workbench-restored\release\win-unpacked\Scodex工作台.exe`, version `1.3.31`.
- Standard and initial local-cache builds timed out. The diagnostic run identified the missing Electron `45.0.0` ZIP; that download stalled and was stopped.
- The 1.3.32 installer build passed using `node_modules/electron/dist` through `electronDist`, with verified local NSIS and `rcedit` paths. The installer, executable and ASAR versions/hashes are recorded above.
- Candidate UI report: release/delivery-1.3.32/candidate-ui.json (5/5 actual UI checks; candidate EXE SHA-256 matches the recorded package).
- Installed target: `C:\Program Files\scodex-workbench\Scodex工作台.exe`, version `1.3.32`, SHA-256 `3AAA10F56A81927C1504472877861A61E31DAC6D73DF435E0B50C8438C6E87FE`; actual launch used the existing profile at `C:\Users\宋建建\AppData\Roaming\scodex-workbench` and exited 0 after state verification.
- Temporary validation data remains in its original Temp paths because automatic approval review rejected the cleanup command. No deletion or fallback move was retried. Retained groups: the 10 earlier scodex-steering-ui-* profiles, two scodex-candidate-ui-* runs (c43c5dcd-e058-4b9c-9d0e-c353ece5a9f9 and 249e1f20-4008-4e19-93df-97e7ce1fa5a7), three scodex-steering-candidate-1.3.32-* fixtures (233d8c26-e32f-426b-ae27-9725003cdfde, 5a3db47c-7885-4d74-9ed1-963328099f13 and 7831a20a-6822-40c3-bf2f-1daf532d1692), and electron-download-FDUtUk/electron-v45.0.0-win32-x64.zip. Manual handling: close test applications, confirm these task-owned paths under %LOCALAPPDATA%/Temp, then remove only the named fixtures/download. These paths are outside the installed application and real user profile; they do not invalidate accepted functionality.

Recheck only affected behavior if relevant source, configuration, dependencies, executable identity or acceptance criteria change. Release publication and public download identity are checked separately against the installer hash.

## Delivery Evidence

- Accepted candidate UI report: release/delivery-1.3.32/candidate-ui.json (5/5 actual UI checks).
- Accepted installed steering report: release/delivery-1.3.32/steering-installed.json (version 1.3.32, request and real-tool assertions passed, exit 0).
- Preserved fixture failures: candidate-fixture-failure.json and steering-fixture-failure.json in the same local evidence directory. Controller-only syntax/path failures occurred before acceptance and were not treated as app failures.
- The 1.3.31 installer remains the rollback artifact; no damaged old application directory was retained, as requested. Reinstall that package only if rollback is needed, preserving the real user profile.
- Temporary validation data remains in its original Temp paths because automatic approval review rejected the cleanup command. No deletion or fallback move was retried. Retained groups: the 10 earlier scodex-steering-ui-* profiles, two scodex-candidate-ui-* runs (c43c5dcd-e058-4b9c-9d0e-c353ece5a9f9 and 249e1f20-4008-4e19-93df-97e7ce1fa5a7), three scodex-steering-candidate-1.3.32-* fixtures (233d8c26-e32f-426b-ae27-9725003cdfde, 5a3db47c-7885-4d74-9ed1-963328099f13 and 7831a20a-6822-40c3-bf2f-1daf532d1692), and electron-download-FDUtUk/electron-v45.0.0-win32-x64.zip. Manual handling: close test applications, confirm these task-owned paths under %LOCALAPPDATA%/Temp, then remove only the named fixtures/download. These paths are outside the installed application and real user profile; they do not invalidate accepted functionality.
