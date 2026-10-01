# 04: Startup Auto-Sync and Cooldown Control

**What to build:**
An automated background synchronization triggered on Obsidian startup when enabled in settings. It verifies the elapsed time since the last synchronization against the configured cooldown interval (default 30 minutes); if within the cooldown window, it quietly exits. When executed, it checks recent Bangumi activity and applies the "Existing Note Sync" strategy: only notes already present in the vault are updated (with score pushes where applicable), while brand new anime subjects on Bangumi are ignored to prevent unwanted file creation in the background. Operates silently, emitting a lightweight notification only when updates occur or when score conflicts require user attention.

**Blocked by:** 03: Batch Sync Diff Preview and Selective Ingestion

**Status:** resolved

- [x] Register an initialization hook triggered upon plugin load when `autoSyncOnStartup` is enabled.
- [x] Enforce cooldown check against stored `lastSyncTimestamp`; skip execution if elapsed time is less than `autoSyncCooldownMinutes`.
- [x] Execute Existing Note Sync strategy: fetch recent N days collections, match against existing vault notes, update progress/status/score push, and ignore uncreated subjects.
- [x] Suppress modal dialogs during startup sync; surface a non-intrusive toast notice summarizing updates or notifying of score conflicts.
- [x] Update `lastSyncTimestamp` in settings upon successful completion.
- [x] Add unit tests verifying cooldown gating, existing-only filtering, and silent execution semantics.

## Answer

Implemented startup auto-sync with cooldown control:
1. Registered `installStartupAutoSync` in `bangumiSyncFeature` lifecycle hook running after plugin initialization when `autoSyncOnStartup` is enabled.
2. Enforced cooldown check in `BangumiSyncService.executeStartupAutoSync` verifying elapsed minutes against `autoSyncCooldownMinutes` (default 30) using `lastSyncTimestamp`.
3. Applied Existing Note Sync strategy: only notes already matching existing vault notes are updated; new subjects from Bangumi are strictly ignored to avoid background file creation.
4. Suppressed modal popups, showing only a lightweight toast notice on completion summarizing updates and conflicts.
5. Persisted updated `lastSyncTimestamp` in settings upon completion.
6. Added unit tests verifying cooldown suppression, existing-only filtering, and non-intrusive execution.
