# 01: Bangumi Token Configuration and Connection Verification

**What to build:**
A dedicated Bangumi Synchronization configuration section in the plugin settings tab. Users can enter their Bangumi Personal Access Token (PAT) and test connection with a single click. When tested, the plugin queries the official Bangumi API v0, confirms token validity, and displays the authenticated username/nickname and avatar (or a detailed error message upon failure). It also introduces the underlying persistence schema for sync settings (recent window days, tracked collection statuses, auto-sync toggle, and cooldown).

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Add settings fields for `bangumiAccessToken`, `syncRecentDays` (default 30), `syncCollectionTypes` (default: watching, completed), `autoSyncOnStartup` (default false), and `autoSyncCooldownMinutes` (default 30).
- [x] Add a "Test Connection" button in the settings UI that validates the PAT against `GET /v0/users/-/me` (or `GET /v0/users/-/collections`).
- [x] Render feedback showing the user profile (nickname, username, avatar) on success, or a clear error message on invalid token/network failure.
- [x] Ensure the token is persisted safely in the plugin settings store without leaking into logs.
- [x] Add unit tests verifying setting defaults, serialization, and connection test response handling.

## Answer

Implemented Bangumi PAT configuration and connection verification:
1. Extended `AnimeListSettings` with `bangumiAccessToken`, `syncRecentDays` (default 30), `syncCollectionTypes` (default: watching, completed), `autoSyncOnStartup` (default false), `autoSyncCooldownMinutes` (default 30), and `lastSyncTimestamp` (default 0).
2. Added `BangumiSyncClient` in `src/data/bangumi-sync/bangumi-sync-client.ts` implementing `verifyToken` against `GET /v0/users/-/me` with Bearer auth, custom user-agent, timeout protection, rate limiting, and safe error handling that never leaks tokens into logs.
3. Created `createBangumiSyncSettingsSection` in `src/features/bangumi-sync/settings.ts` with masked PAT input, a "Test connection" button displaying user avatar, nickname, and `@username` on success, clear failure feedback, and inputs for sync window days, collection status filters, and startup auto-sync settings.
4. Added unit tests in `tests/bangumi-sync.test.ts` covering defaults, normalization, status mapping, and connection test verification.
