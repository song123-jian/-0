# Test Handoff

## Target and Environment

Scodex Workbench 1.3.31, Windows x64, Electron 45 and Node.js 24.11.0. Acceptance used the actual packaged and installed desktop application with isolated profiles, the real React interface, IPC, file tools and persistence. Only model HTTP responses came from a controlled loopback server.

Installer: `Scodex-Workbench-Setup-1.3.31-x64.exe`, 189910973 bytes, SHA-256 `4701036f0ef136ad67e5353a8e067168a53478fb9add514dcab1bd42d78474e9`. Installed application ASAR SHA-256: `2813d9f25bd8f877a3fd380369e9564bf9a9929f16d8fbfe7a32adcc9372a888`.

| Scope | Steps and expected behavior | Actual result |
| --- | --- | --- |
| Logical regression | `node --test tests/projectless-chat.test.mjs tests/project-registry.test.mjs tests/conversations.test.mjs`; empty registry, legacy migration, chat binding, archived-project rejection and general directory selection | 19/19 passed |
| Empty startup and ordinary chat | Start an isolated profile with zero projects, send a message and read persisted history | Passed in the actual installed app |
| Optional-project switching | Create a project, select Ordinary Chat and send while the optional project remains | Passed in the actual installed app |
| Last-project deletion | Delete through the actual menu and confirmation; read project registry, conversations and original disk file | Passed: no registered projects, ordinary history retained, disk file retained |
| Projectless local task | Send in full-access mode; execute real `write_file` and read the exact Chinese result | Passed in the actual installed app |
| Restart | Exit and reopen, check zero-project state and saved task result, send another message | Passed in the actual installed app |
| Last-project archive/restore | Use actual candidate menus, archive the final project, restore and select it | Passed; valid candidate result reused |
| Build and install | Fix 138 source inputs, build renderer, unpacked Electron and prepackaged NSIS, install over the existing directory | Passed; no source drift, installer exit 0, 81 installed files matched the candidate |
| Incremental review | Review this change only; verify UTF-8 without BOM, syntax, version metadata and unchanged dependencies | Passed; no remaining high-confidence finding in this scope |

## Reproduction and Reuse

`tests/projectless-ui.cjs` exercises the actual executable with controlled HTTP. Set `SCODEX_PROJECTLESS_EXE` to the installed executable, `SCODEX_PROJECTLESS_OUTPUT` to an evidence directory, `SCODEX_PROJECTLESS_DEFAULT_HOME=1`, and `SCODEX_PROJECTLESS_SCOPE=formal` for the six installed-app scenarios. It creates an isolated profile and removes its temporary fixture on success. Candidate archive/restore runs with the default scope. `tests/build-projectless.cjs` records fixed build inputs for this release.

The published desktop inputs correspond to the accepted installed package; excluded mobile source and mobile npm scripts are not desktop build inputs. Existing 1.3.30 results remain valid only for unchanged scope (403 distinct logical cases after targeted helper repair). No unrelated full test run or new public-model integration result is claimed.

## Limitations and Follow-up Conditions

Public model generation, unrelated integrations, mobile features and second-device acceptance were not part of this increment. Earlier failed fixture reports remain recorded locally and were not changed to passing. Failed temporary fixtures were moved to a local manual-cleanup directory after automatic deletion was rejected; they are not published. Successful fixtures were removed. No application or test process must remain running for these results.

Recheck only affected behavior if relevant source, configuration, dependencies, executable identity or acceptance criteria change. Release publication and public download identity are checked separately against the installer hash.
