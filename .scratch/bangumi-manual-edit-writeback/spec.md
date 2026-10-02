# Spec: Bangumi Manual Edit Writeback

Status: ready-for-agent

## Problem Statement

Users frequently watch anime tracked in external media servers like Jellyfin or track shows that are not part of an automated media server library. When finishing a series on Jellyfin, Bangumi does not automatically transition the series status from "watching" (在看) to "completed" (看过). In addition, for standalone or offline anime, users manually update episode progress, completion status, and scores directly in their Obsidian notes.

Currently, Bangumi synchronization in AnimeList is almost entirely unidirectional from Bangumi to Obsidian, only allowing score writeback when Bangumi has no rating. When a user manually finishes a series or records progress in Obsidian, those changes never propagate back to Bangumi. Consequently, users are forced to open Bangumi in a browser and manually re-enter their progress, status, and score to keep their remote profile accurate.

## Solution

Enable bi-directional writeback to Bangumi triggered strictly by manual note edits and explicit push commands. When a user modifies an anime note's progress, watching status, or score via the AnimeList edit dialog (or invokes the explicit push action), AnimeList updates the local note and automatically pushes the changes to Bangumi via the Bangumi API v0.

If the anime has not yet been collected by the user on Bangumi, AnimeList automatically initializes the user collection with the current status, progress, and score. If network latency or API failures occur, local persistence is guaranteed first, and non-blocking toast notifications inform the user without losing local changes.

## User Stories

1. As an anime viewer, I want changes made in the anime edit dialog to automatically push to Bangumi, so that my Bangumi collection stays up to date without manual browser data entry.
2. As an anime viewer, I want changes to episode progress to be written back to Bangumi as `ep_status`, so that my watched episode count on Bangumi reflects my local notes.
3. As an anime viewer, I want changes to watching status (`ongoing`, `completed`, `planned`, `dropped`) to be written back to Bangumi, so that finishing a show in Obsidian marks it as "看过" on Bangumi.
4. As an anime viewer, I want changes to my score to be written back to Bangumi, so that my personal rating is updated on Bangumi when I review or rate an anime locally.
5. As an anime viewer, I want my manual rating changes to authoritatively overwrite any existing remote score, so that my latest intentional score is always respected without false conflict errors.
6. As an anime viewer, I want anime that are not yet in my Bangumi collection to be automatically added to my collection when I push changes, so that I can track offline or non-Jellyfin shows seamlessly.
7. As an anime viewer, I want my local note changes to always save successfully even if the Bangumi API request fails, so that my personal notes are never lost or blocked by network errors.
8. As an anime viewer, I want a clear warning notification when a Bangumi push fails, so that I am aware that the remote service did not receive the update.
9. As an anime viewer, I want a success notification when a Bangumi push succeeds, so that I have immediate confirmation that my remote collection is synced.
10. As an anime viewer, I want an explicit "Push to Bangumi" command in the command palette, so that I can push current note data on demand or retry after an earlier network failure.
11. As an anime viewer, I want an explicit "Push to Bangumi" action button on the anime detail card, so that I can conveniently trigger a manual push with a single click.
12. As an anime viewer, I want a setting toggle "Push to Bangumi on edit" (defaulting to enabled), so that I can disable automatic push behavior if I prefer manual control.
13. As an anime viewer, I want the edit dialog to perform a dirty check on progress, status, and score, so that unnecessary API requests are avoided when only title, tags, or other metadata fields are edited.
14. As an anime viewer, I want background pull sync (batch sync and startup auto-sync) to continue treating Bangumi as the authoritative source of truth, so that bulk data imports remain predictable and consistent with ADR-0002.
15. As an anime viewer, I want the system to avoid global vault file listeners, so that external file edits, Dataview updates, or third-party sync tools do not trigger accidental network storms or rate-limiting bans.
16. As an anime viewer, I want local `planned` status to map cleanly to Bangumi `wishlist` (想看), so that planning to watch a show reflects standard Bangumi semantics.
17. As an anime viewer, I want non-anime notes (manga, novels) to never trigger Bangumi push operations, so that unrelated media types are unaffected.
18. As an anime viewer, I want requests to Bangumi to adhere to the existing sequential throttling rate limit, so that my account is never rate-limited or blocked by the API.

## Implementation Decisions

1. **Scoped Trigger Boundary (`Push On Edit`)**:
   - Writeback is exclusively triggered at the service layer when a note is updated via `MediaUpdateService.update` or when the user invokes the explicit push command/card action.
   - Global vault file mutation events (`vault.on('modify')`) are explicitly avoided to eliminate infinite sync loops, typing-latency thrashing, and unauthenticated background spam.

2. **Dirty Checking Pre-flight**:
   - Before dispatching any network request during an edit, the service compares the newly submitted `progress`, `status`, and `score` against the previous frontmatter values.
   - If none of the three fields have changed (e.g. only title, tags, or completion note were edited), no Bangumi API call is dispatched.

3. **Status and Value Mapping**:
   - `MediaStatus` maps to Bangumi collection status type numbers:
     - `ongoing` -> `3` (watching / 在看)
     - `completed` -> `2` (completed / 看过)
     - `planned` -> `1` (wishlist / 想看)
     - `dropped` -> `5` (dropped / 抛弃)
   - Progress maps to non-negative integer `ep_status`: `Math.max(0, Math.floor(Number(progress) || 0))`.
   - Score maps to integer `rate` between 1 and 10, or `0` when empty: `score ? Math.max(1, Math.min(10, Math.round(Number(score)))) : 0`.

4. **Remote Upsert Strategy (Collection Creation Fallback)**:
   - When pushing to Bangumi, the client targets `/v0/users/-/collections/{subject_id}`.
   - If the subject is already collected, `PATCH` updates the specified fields.
   - If the remote returns HTTP 404 (the subject is not in the user's collection), the client falls back to `POST /v0/users/-/collections/{subject_id}` with `{ type, ep_status, rate }` to create the collection entry.

5. **Authoritative Score Overwrite on Manual Edit**:
   - In contrast to bulk pull sync (which flags differing non-null scores as a `Score Conflict`), manual edit submission expresses direct user intent. The submitted score authoritatively updates Bangumi without conflict halting.

6. **Local Persistence Precedence & Graceful Error Handling**:
   - Local note frontmatter persistence always executes and succeeds first.
   - The Bangumi push runs immediately following local write. If the API request throws (network error, invalid token, HTTP 4xx/5xx), the error is caught, logged, and surfaced via an Obsidian `Notice`. The local note remains saved.

7. **Configurability & UI Extensions**:
   - Add `bangumiPushOnEdit: boolean` (default `true`) to `AnimeListSettings`.
   - Add toggle in the Settings tab under Bangumi Synchronization.
   - Register command: `AnimeList: Push current anime to Bangumi`.
   - Add push action icon to the anime detail view header alongside the existing sync icon.
   - Add localized text entries across all supported locales (`zh-CN`, `zh-TW`, `en`, `ja`, `ko`).

## Testing Decisions

- **Testing Philosophy**:
  - Test external behavior at the highest possible architectural seam. Avoid testing UI DOM layout details or private HTTP serialization helpers in isolation.
  - Verify state changes through vault frontmatter and mock network request recordings.

- **Primary Testing Seam**:
  - **Single Seam**: `MediaUpdateService` combined with `BangumiSyncService` / mock `requestUrl`.
  - Given: A local anime note with an extracted Bangumi subject ID and configured mock HTTP responder.
  - When:
    1. `updateMediaNote` is called with modified status/progress/score -> verify HTTP PATCH is sent with correct payload, local note is updated, and success notification is emitted.
    2. Remote returns 404 -> verify HTTP POST fallback creates the collection on Bangumi.
    3. `updateMediaNote` is called with identical status/progress/score (only title changed) -> verify no HTTP request is made (dirty check).
    4. Network request fails (e.g. timeout / 500) -> verify local note is still successfully updated in the vault and error notice is captured.
    5. `pushOnEdit` is set to `false` -> verify local note is updated without any HTTP request.
    6. `pushCurrentAnime` action is executed -> verify current frontmatter values are pushed to Bangumi.

- **Prior Art**:
  - `tests/bangumi-sync.test.ts` (mocking `requestUrl` and testing collection synchronization).
  - `tests/contracts/media-update-service.test.ts` (testing note updates, frontmatter persistence, and validation).

## Out of Scope

- Bi-directional sync for Manga, Light Novels, or Games.
- Global vault file change listening (`vault.on('modify')`).
- Pushing episode-level comments, tags, or discussion forum posts to Bangumi.
- Two-way conflict arbitration during background batch pull sync (ADR-0002 pull rules remain unchanged).

## Further Notes

- ADR references: `docs/adr/0002-sync-conflict-resolution-strategy.md` (baseline pull strategy) and `docs/adr/0005-bangumi-manual-edit-writeback.md` (manual edit writeback extension).
- Glossary updates: `Bangumi Manual Push` and `Push On Edit` added to `GLOSSARY.md`.
