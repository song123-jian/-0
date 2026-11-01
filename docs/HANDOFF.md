# Project Handoff

## Current State — 1.3.31

The desktop workbench supports ordinary conversations and local tasks without a registered project. Projects remain optional. An explicitly empty project registry survives restart; deleting or archiving the last project returns to Ordinary Chat. Legacy workspace migration remains supported.

| Completed requirement | Change and scope | Validation |
| --- | --- | --- |
| Optional projects | Project registry, main-process request binding, and Ordinary Chat navigation | 19 focused logical cases passed |
| Projectless file tasks | A general workspace outside protected app data, retaining existing permission and binding checks | Actual installed 1.3.31: real file write and Chinese text readback passed |
| Persistence and project lifecycle | Empty startup, ordinary message save, optional-project switching, last-project deletion, and restart | Six actual installed-app scenarios passed; candidate archive/restore also passed |
| Windows 1.3.31 installer | Fixed build inputs, renderer build, unpacked Electron build, NSIS, installation over 1.3.30 | Build/install succeeded; 81 installed files matched the accepted candidate |

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

See [Test Handoff](TEST_HANDOFF.md) and [Workflow](WORKFLOW.md).
