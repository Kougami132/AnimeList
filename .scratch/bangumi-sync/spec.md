# Spec: Bangumi Sync

Status: ready-for-agent

## Problem Statement

Users who track their anime-watching progress on both Bangumi (bgm.tv) and Obsidian currently have to manually record their progress, status, and ratings in two separate places. When binge-watching or keeping up with seasonal broadcasts, manual duplicate data entry quickly leads to desynchronized episode counts, forgotten ratings, and mismatched completion dates. The user needs a seamless way to pull recent viewing progress from Bangumi into Obsidian notes, keep them aligned automatically, and propagate unrecorded ratings back to Bangumi without manual copy-pasting or risking local note content loss.

## Solution

A bidirectional Bangumi synchronization engine built into the Obsidian AnimeList plugin. The engine connects directly to the Bangumi API v0 using the user's Personal Access Token (PAT). It supports:
1. **Batch Sync**: Fetches user collections updated within a configurable rolling window (recent N days, default 30 days) filtered by collection status (e.g., watching, completed). It displays a Diff Preview modal categorizing items into New, Updated, Conflict, and Synced, allowing users to review and select items before execution.
2. **Conflict Resolution & Score Push**:
   - Bangumi progress (episodes) and status (watching/completed/etc.) authoritatively overwrite local note values.
   - If Bangumi has no rating but the local note has one, the local rating is pushed to Bangumi via API (Score Push).
   - If both sides have different non-null ratings, the anime is flagged as a Score Conflict and skipped, protecting both datasets until the user manually resolves the difference.
   - Existing local completion dates are preserved; only empty completion dates are filled using Bangumi update timestamps.
3. **Startup Auto-Sync**: An optional background sync that executes when Obsidian loads, constrained by a cooldown interval (default 30 minutes) and restricted to updating only notes that already exist in the vault.
4. **Single Item Sync**: Immediate synchronization for an individual anime directly from its note details card, the command palette, or the file menu.

## User Stories

1. As an anime viewer, I want to configure my Bangumi Personal Access Token in the plugin settings, so that the plugin can authenticate with my Bangumi account to read and update my collections.
2. As an anime viewer, I want to test my Bangumi token connection directly in the settings tab, so that I know my token is valid and active before attempting to sync.
3. As an anime viewer, I want to customize the sync window in days (default 30 days), so that I can control how far back recent Bangumi updates are checked.
4. As an anime viewer, I want to select which collection statuses (Watching, Completed, Wishlist, On Hold, Dropped) are included in batch sync, so that I only sync entries that matter to my tracking habits.
5. As an anime viewer, I want to trigger a manual batch sync from the settings or the command palette, so that I can pull my recent activity on demand.
6. As an anime viewer, I want to see a Diff Preview modal before batch syncing, so that I can inspect which notes will be created, which will be updated, and which have conflicts.
7. As an anime viewer, I want new anime entries in the Diff Preview to be checked by default, so that I can easily import all newly started shows into my vault.
8. As an anime viewer, I want updated anime entries in the Diff Preview to be checked by default, so that my local episode progress and watch status stay up to date.
9. As an anime viewer, I want un-updated (already synced) entries to be unchecked by default, so that unnecessary file writes are avoided.
10. As an anime viewer, I want the Diff Preview modal to highlight score conflicts and disable their selection, so that contradictory ratings are not inadvertently overwritten.
11. As an anime viewer, I want to manually uncheck individual items in the Diff Preview modal, so that I have final control over which notes get written.
12. As an anime viewer, I want batch sync to run through a rate-limited request queue with an inter-request delay, so that my Bangumi account is never rate-limited or blocked by the API.
13. As an anime viewer, I want to see a real-time progress indicator while a batch sync is running, so that I know the plugin is actively working and how many items remain.
14. As an anime viewer, I want to see a sync summary report after manual batch sync completes, so that I can review total additions, updates, and skipped conflict items.
15. As an anime viewer, I want the sync summary report to provide direct links to conflicting notes, so that I can immediately open and inspect them to resolve discrepancies.
16. As an anime viewer, I want the plugin to push my local rating to Bangumi if Bangumi has no recorded rating for that anime, so that my ratings on Bangumi stay complete without manual re-entry.
17. As an anime viewer, I want synchronization to strictly match local notes to Bangumi subjects by explicit Bangumi subject ID, so that different seasons or adaptations with similar titles are never mismatched.
18. As an anime viewer, I want the sync process to only modify note frontmatter and leave my Markdown body and custom notes untouched, so that my personal reflections, reviews, and logs are never altered or lost.
19. As an anime viewer, I want local custom tags and local cover overrides to be preserved during sync, so that my personal vault organization is kept intact.
20. As an anime viewer, I want existing completion dates on local notes to be preserved, so that the historical date I finished a series is not replaced by subsequent Bangumi edit timestamps.
21. As an anime viewer, I want newly imported completed anime without a Bangumi rating to be created without validation errors, so that incomplete third-party records do not break note creation.
22. As an anime viewer, I want newly imported anime notes to use my configured default anime template and download the official Bangumi cover art, so that new entries look consistent with my manually created notes.
23. As an anime viewer, I want a single-item sync button on the anime detail card, so that I can refresh or push updates for a specific show with one click while viewing it.
24. As an anime viewer, I want a single-item sync command in the command palette and note title context menu, so that I can trigger synchronization from anywhere in my workspace.
25. As an anime viewer, I want single-item sync to notify me via a toast notice if the remote score conflicts with my local score, so that I am alerted to the difference without unexpected changes.
26. As an anime viewer, I want an option to enable automatic sync whenever Obsidian starts up, so that my vault stays fresh without manual intervention.
27. As an anime viewer, I want startup auto-sync to adhere to a minimum cooldown interval (e.g., 30 minutes), so that frequently opening and closing Obsidian does not spam the Bangumi API.
28. As an anime viewer, I want startup auto-sync to strictly update existing vault notes and ignore new subjects, so that my vault is not silently flooded with new files in the background.
29. As an anime viewer, I want startup auto-sync to run quietly with a brief notice only upon completion or conflict discovery, so that it does not disrupt my regular Obsidian workflow.

## Implementation Decisions

1. **Direct Bangumi API v0 Client Integration**:
   - The plugin communicates directly with `https://api.bgm.tv/v0` via Obsidian's `requestUrl`.
   - Endpoints utilized:
     - `GET /v0/users/-/collections` with pagination and query parameters (`subject_type=2`, `type`, `limit`, `offset`) using Bearer token authentication.
     - `GET /v0/users/{username}/collections` for public fallback when configured.
     - `PATCH /v0/users/-/collections/{subject_id}` to push score updates and progress.
     - `GET /v0/subjects/{subject_id}` for rich subject metadata when creating new notes.
2. **Domain Synchronization Service (`BangumiSyncService`)**:
   - Central deep module orchestrating collection fetching, local note reconciliation, conflict detection, score pushing, and note persistence.
   - Operates against high-level interfaces: media repository, media note codec/service, and Bangumi client.
3. **Data Matching & Conflict Rules**:
   - **Matching**: Matches existing notes where `source_provider === "bangumi"` and `source_id === subject_id`, or where `source_urls` contains `bgm.tv/subject/{subject_id}`.
   - **Progress & Status**: Bangumi's `ep_status` and collection `type` authoritatively map to local `progress` and `status` (`watching`, `completed`, `on_hold`, `dropped`, `plan_to_watch`).
   - **Score Reconciliation**:
     - Remote score null & Local score non-null: Enqueue `PATCH /v0/users/-/collections/{subject_id}` with `rate: localScore`.
     - Remote score non-null & Local score non-null & equal: No-op.
     - Remote score non-null & Local score non-null & unequal: Flag as `Score Conflict`, skip note update and score push.
     - Remote score non-null & Local score null: Update local note score to match Bangumi.
   - **Completion Date**: If local `completed_at` is non-empty, keep it. If empty and status is `completed`, derive `YYYY-MM-DD` from Bangumi's `updated_at`.
   - **Frontmatter Exclusivity**: Modifications apply exclusively through `applyEditableMediaForm` or frontmatter patchers; note body text, detail codeblocks, and custom frontmatter properties are preserved.
4. **Validation Adjustments**:
   - Adjust `MediaNoteCodec` or provide a sync-specific validation path allowing `completed` anime notes to have a `null` score when imported from third-party synchronization.
5. **Rate Limiting & Execution Pipeline**:
   - Batch sync runs sequentially with a minimum 200ms throttle between HTTP requests.
   - Handles HTTP 429 backoff gracefully with retry or polite abort.
6. **UI Components**:
   - **Diff Preview Modal**: Modal listing candidate actions with multi-select checkboxes, badges (`[New]`, `[Update]`, `[Conflict]`, `[Synced]`), search/filter bar, and execution button.
   - **Sync Summary Modal**: Modal displayed after manual batch sync detailing successes, pushes, and conflicts with clickable file links.
   - **Settings Tab Section**: Under settings, dedicated "Bangumi Synchronization" section containing token input, token verification button, sync window slider/input, collection status checkboxes, auto-sync toggle, cooldown input, and manual sync action button.
   - **Detail View & Command Actions**: Action icon on detail cards and registered commands:
     - `AnimeList: Sync current anime with Bangumi`
     - `AnimeList: Batch sync recent anime from Bangumi`

## Testing Decisions

- **Testing Philosophy**: Test external behavior at the highest possible seam. Avoid testing private implementation details, request scheduling internals, or DOM markup.
- **Primary Testing Seam**:
  - `BangumiSyncService` / Domain Sync Coordinator.
  - Given: A mock Bangumi API responder and an in-memory/mock vault media repository.
  - When: Executing batch sync, single sync, or startup auto-sync with various local note states and remote collection states.
  - Then: Verify:
    1. Items are accurately categorized into New, Updated, Conflict, and Synced.
    2. Local frontmatter updates correctly reflect Bangumi episode progress and status.
    3. Existing local completion dates are preserved when present, or populated from Bangumi timestamps when empty.
    4. Local scores are pushed to Bangumi when remote score is null.
    5. Discrepant non-null scores halt updates for that entry, emit a conflict result, and leave both local note and remote collection untouched.
    6. Startup auto-sync obeys the cooldown period and filters out new subjects, only touching existing notes.
    7. Completed items with null remote scores pass validation and are written cleanly.
- **Prior Art**: Follow the established pattern in `tests/release-tracking-state-service.test.ts`, `tests/library-import.test.ts`, and `tests/media-library-index.test.ts` using `node:test` and `node:assert/strict`.

## Out of Scope

- Synchronizing media types other than Anime (Manga, Light Novels, and Games are excluded from this phase).
- Syncing Bangumi episode-level comments, characters, staff lists, or personal review essays.
- Pushing local episode progress from Obsidian to Bangumi (Bangumi remains the authoritative source of truth for watch progress and status; only missing ratings are pushed).
- Full two-way automatic resolution of differing non-null scores without user confirmation.
- Integrating through external daemon bridges such as `bangumi-syncer`.

## Further Notes

- The feature respects the project's existing ADRs (`docs/adr/0001-direct-bangumi-api-integration.md` and `docs/adr/0002-sync-conflict-resolution-strategy.md`) and domain glossary (`GLOSSARY.md`).
- Bangumi API v0 rate guidelines recommend polite request pacing; the 200ms sequential throttle satisfies these community expectations.
