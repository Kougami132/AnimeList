# Spec: Bangumi Uncollected Subject Push and Metadata Refresh

Status: ready-for-agent

## Problem Statement

Users of AnimeList often create anime notes directly within Obsidian—either manually or through provider search—before or during watching, or migrate historical libraries where an explicit Bangumi Subject ID is recorded in the note's frontmatter. However, these anime may not yet be cataloged in the user's remote Bangumi collection.

Currently, the synchronization workflow between AnimeList and Bangumi (`BangumiSyncService`) is almost strictly a one-way pull pipeline from remote collections into local notes. In both the batch diff synchronization modal and startup auto-sync:
1. Anime that exist in the local Obsidian vault with a valid Bangumi ID but have no collection record on Bangumi are completely excluded from the candidate list; they are never surfaced in the Diff Preview Modal and never pushed to Bangumi.
2. When a user runs "Sync from Bangumi" on an individual note that is not yet collected on Bangumi, the operation simply fails with a notification stating that the anime is not in their collection, without offering to push or create it.
3. Anime notes created early (e.g. before an upcoming anime airs or when total episodes were not yet finalized) often have `progress_total: 0` or missing broadcast season and studio details. Subsequent syncs only update watching status, progress, and user rating, permanently leaving the note's objective metadata stale and incomplete.

Consequently, users are forced to either manually open the Bangumi website to click "wishlist" or "watching", manually push every single note one by one, and manually re-edit note frontmatter to fix total episode counts.

## Solution

Enhance Bangumi synchronization across all entry points (Single Note Sync, Batch Diff Sync, and Startup Auto-Sync) into a comprehensive bidirectional sync engine featuring **Uncollected Subject Push** and **Subject Metadata Refresh**:

1. **Uncollected Subject Push (未收藏条目推送建档)**:
   - Identify local anime notes that have a valid Bangumi Subject ID (`bangumi_id`) but no corresponding user collection on Bangumi.
   - For uncollected subjects, sync automatically writes them back to Bangumi: creating the collection on Bangumi via API v0 collection upsert with local status and score, and scrobbling watched episodes via dual-mode episode progress reconciliation.
   - In the Diff Preview Modal, uncollected anime are presented under a dedicated `Push (待推送)` category tab, pre-selected by default for convenient batch synchronization.
   - In single note sync, finding an uncollected subject immediately triggers a push and creates the remote collection.
   - In startup auto-sync, uncollected subjects are safely pushed in the background alongside pull updates.
   - For already-collected subjects, sync strictly preserves the Remote-Authoritative pull baseline established in ADR-0002.

2. **Subject Metadata Refresh (条目元数据刷新)**:
   - During sync, retrieve the latest objective metadata from Bangumi and align local frontmatter fields:
     - Update `progress_total` (total episodes) to match remote official episodes.
     - When local status is `completed` and `progress_total` is refreshed or modified, automatically align local `progress` to the total.
     - Update `source_score` to Bangumi's community score.
     - Enrich missing or outdated broadcast season (`season`, `season_year`) and animation studios (`studios`).
   - Strictly protect user private records: user personal rating (`score`), watching status (for existing collections), start and completion dates, personal tags (`user_tags`), and custom note body content are never overwritten.

3. **High-Performance Two-Tier Fetching**:
   - Establish remote collection existence by fetching the user's collection subject IDs efficiently via paginated collection listings.
   - Refresh basic metadata (`progress_total`, `source_score`) directly from embedded `collection.subject` payloads with zero additional network requests.
   - Perform detailed subject fetching (`GET /v0/subjects/{id}`) on demand only when local notes are missing deep metadata (such as `progress_total === 0` or missing `studios`).

## User Stories

1. As an anime viewer who creates anime notes in Obsidian, I want the batch sync feature to discover my local anime notes that are not yet collected on Bangumi, so that I can bulk-push them to my Bangumi account without manual entry on the website.
2. As an anime viewer, I want the Diff Preview Modal to display a dedicated "Push" (待推送) category for uncollected local anime, so that I can clearly distinguish items being pushed to Bangumi from items being pulled to Obsidian.
3. As an anime viewer, I want uncollected anime to be pre-selected in the Diff Preview Modal by default, so that I can sync both directions with a single click of the "Execute Sync" button.
4. As an anime viewer, I want to filter the Diff Preview list specifically by the "Push" category, so that I can review pending outbound writes before committing them.
5. As an anime viewer, I want the Diff Preview summary bar to indicate both the number of items to pull and the number of items to push, so that I understand the exact scope of the pending synchronization.
6. As an anime viewer, I want executing a batch sync to create remote collections on Bangumi with my local watching status (`ongoing`, `completed`, `planned`, `dropped`), so that my remote profile accurately reflects my watch state.
7. As an anime viewer, I want executing a batch sync to upload my local episode progress to Bangumi, so that Bangumi records the exact episodes I have watched using dual-mode episode reconciliation.
8. As an anime viewer, I want executing a batch sync to upload my local score to Bangumi when creating the collection, so that my ratings appear on Bangumi without separate manual edits.
9. As an anime viewer, I want clicking "Sync from Bangumi" on a single note that is not yet collected on Bangumi to automatically push it to Bangumi and create the collection, so that I don't see an unhelpful "not collected" error message.
10. As an anime viewer, I want single note sync to display a clear notice indicating that the anime was pushed and created in my Bangumi collection, so that I have immediate feedback of the action.
11. As an anime viewer, I want startup auto-sync to silently push uncollected local anime to Bangumi in the background, so that my remote collection stays synchronized even if I forget to open the manual sync modal.
12. As an anime viewer, I want the startup auto-sync completion notice to report how many items were updated and how many items were pushed, so that I am informed of background activity.
13. As an anime viewer, I want the sync push process to apply only to local notes that contain a valid Bangumi subject ID, so that untracked or non-Bangumi notes are never mistakenly pushed.
14. As an anime viewer, I want the sync process to distinguish between uncollected anime and already-collected anime updated in the distant past, so that older collections are never accidentally re-pushed or duplicated.
15. As an anime viewer, I want already-collected anime to continue following the remote-authoritative pull model, so that updates made on the Bangumi website or mobile apps are never accidentally overwritten by outdated local notes.
16. As an anime viewer, I want sync to refresh `progress_total` from Bangumi when a previously recorded anime now has a confirmed episode count (such as updating from 0 to 12), so that my note has accurate episode data.
17. As an anime viewer, I want my completed anime progress to automatically align to the new total when `progress_total` updates from 0, so that finished shows never display 0/12 or incomplete progress.
18. As an anime viewer, I want sync to update the Bangumi community score (`source_score`) in the frontmatter, so that I can see the latest community rating in my note.
19. As an anime viewer, I want sync to populate missing animation studios (`studios`) and broadcast season (`season`, `season_year`) from Bangumi metadata, so that my notes have complete classification details.
20. As an anime viewer, I want my personal score (`score`), start date (`started_at`), completion date (`completed_at`), user tags (`user_tags`), and Markdown body content to remain untouched during metadata refresh, so that my personal annotations and reviews are never lost.
21. As an anime viewer, I want metadata refresh to reuse embedded subject data from collection responses whenever possible, so that synchronization remains fast and avoids unnecessary API calls.
22. As an anime viewer, I want deep metadata fetching to execute on demand only for notes that genuinely lack core data, so that my API rate limits are preserved.
23. As an anime viewer, I want network failures during individual push or metadata refresh operations to fail gracefully without corrupting local files or halting the rest of the batch sync, so that robust partial progress is maintained.

## Implementation Decisions

1. **Uncollected Discovery via Full Collection Subject ID Set**:
   - The sync client introduces a lightweight discovery helper that retrieves the user's full anime collection subject IDs from Bangumi (`GET /v0/users/-/collections?subject_type=2&limit=50`).
   - By constructing an in-memory `Set<number>` of all collected subject IDs, the sync service can partition local anime notes with `bangumi_id` into:
     - **Collected subjects**: Present in the remote collection ID set. Reconciled via existing pull logic (ADR-0002).
     - **Uncollected subjects**: Absent from the remote collection ID set. Flagged for **Uncollected Subject Push**.
   - This eliminates false positives caused by the rolling `syncRecentDays` window.

2. **Unified Action Model in Candidate Classification**:
   - Extend `BangumiSyncAction` to include `"push"`:
     - `"new"`: Present on Bangumi, absent locally (Action: Pull & create local note).
     - `"updated"`: Present on both, remote has newer watch state or score (Action: Pull & update local note).
     - `"conflict"`: Present on both with diverging scores (Action: Halt for user resolution).
     - `"synced"`: Present on both and identical.
     - `"push"`: Present locally with valid `bangumi_id`, absent on Bangumi (Action: Push & create remote collection).
   - In candidate objects with action `"push"`, capture the local status, progress, score, and file path.

3. **Diff Preview Modal Integration**:
   - Add a "Push" filter tab alongside All, New, Updated, Conflict, and Synced in the diff preview filter controls.
   - For `"push"` items, render a dedicated action badge (e.g. `Push / 待推送`) and display local status, progress, and score.
   - Include `"push"` items in `selectedIds` by default, allowing users to execute two-way synchronization in a single batch operation.
   - Update the bottom status line to summarize selections across operations (e.g. "Selected: N (Pull: X, Push: Y)").

4. **Batch Execution of Push Items**:
   - In `applyBatchItem`, when `item.action === "push"`:
     - Read the local note frontmatter to acquire current status, progress, and score.
     - Invoke `pushAnimeData(item.subjectId, item.title, { status, progress, score })`.
     - Refresh local metadata (total episodes, community score, season, studios) to ensure bidirectional completeness.
     - Return `"pushed"` status for batch summary tracking.
   - Update `BangumiSyncSummary` to track `pushed: number` alongside `added`, `updated`, and `synced`.

5. **Single Note Sync Enhancement**:
   - In `syncSingleNote(file)`:
     - Check remote collection status via `client.fetchCollection(token, subjectId)`.
     - If the collection returns `null` (HTTP 404):
       - Instead of showing a notice and returning `"not_collected"`, directly execute `pushAnimeData` with the note's status, progress, and score.
       - Fetch the remote subject metadata to refresh total episodes, season, studios, and `source_score`.
       - Persist the updated metadata into the note frontmatter.
       - Display a success notice (e.g. "Pushed note to Bangumi collection and refreshed metadata").
       - Return a success status with `kind: "pushed"`.

6. **Startup Auto-Sync Silent Push & Refresh**:
   - In `executeStartupAutoSync()`:
     - Include candidates with action `"push"` alongside `"updated"`.
     - Execute silent batch sync for both update items and push items.
     - Format the completion toast notice to summarize both: `updated X anime, pushed Y anime`.

7. **Subject Metadata Refresh Strategy**:
   - Create a dedicated domain/service function `refreshNoteMetadata(frontmatter, subjectData)`:
     - **Total episodes (`progress_total`)**:
       - If remote `eps` or `total_episodes` $> 0$, set `progress_total = remoteEps`.
       - If note `status === "completed"`, align `progress = progress_total`.
     - **Community score (`source_score`)**:
       - Update `source_score` if remote rating score exists.
     - **Broadcasting season (`season`, `season_year`)**:
       - Derive broadcasting season from tags and air date per ADR-0004 if local fields are missing or empty.
     - **Studios (`studios`)**:
       - Populate from normalized infobox person relations if missing in local frontmatter.
     - **Title original (`title_original`)**:
       - Populate if missing and remote has a distinct original title.
     - **Protected Fields**:
       - Never touch `score`, `status` (for existing collections), `started_at`, `completed_at`, `user_tags`, or custom frontmatter properties.

8. **Two-Tier Request Optimization**:
   - First tier: Read `collection.subject` from collection API responses (contains `eps`, `score`, `date`, `name_cn`, `name`). If local note only needs `progress_total` and `source_score`, apply them without making another HTTP request.
   - Second tier: If local note has `progress_total === 0` and `collection.subject.eps === 0`, or lacks `studios` / `season`, dispatch `fetchSubject(subjectId)` to query full infobox and tag metadata.

## Testing Decisions

- **Test Boundaries & Seams**:
  - The feature will be tested through the existing high-level service seam: `BangumiSyncService` interacting with a mock Obsidian `App`, `Vault`, and `BangumiSyncClient`.
  - External behavior will be tested rather than private methods:
    1. Given a vault containing notes with `bangumi_id` that are absent in Bangumi collections, `classifyCandidates` yields items with `action: "push"`.
    2. `executeBatchSync` successfully calls `upsertCollection` and `updateAnimeEpisodeProgress` for push candidates and records `summary.pushed`.
    3. `syncSingleNote` on an uncollected note executes collection creation and episode writeback, updates frontmatter metadata, and returns success.
    4. Metadata refresh correctly updates `progress_total` from 0 to remote total, pulls `source_score`, and aligns `progress` for completed anime, while keeping user `score` and `user_tags` untouched.
    5. `executeStartupAutoSync` processes push candidates and produces a combined summary notice.
    6. `DiffPreviewModal` correctly groups, filters, and selects `"push"` items.
- **Prior Art**:
  - `tests/bangumi-sync.test.ts` (existing 1800+ lines of comprehensive Bangumi sync and diff preview tests).
  - `tests/contracts/media-update-service.test.ts` (characterizes writeback dirty checking and local persistence precedence).

## Out of Scope

- Pushing notes that lack a valid Bangumi Subject ID (Strict Subject Matching remains non-negotiable; title-based fuzzy auto-linking on push is strictly out of scope).
- Reverse overwriting already-collected anime whose local progress is higher than remote (already-collected anime remain Remote-Authoritative per ADR-0002).
- Non-anime media types (Manga, Light Novels) pushing to Bangumi collections.
- Global file modification listeners (`vault.on('modify')`).

## Further Notes

- Governed by architectural decisions in `docs/adr/0002-sync-conflict-resolution-strategy.md`, `docs/adr/0005-bangumi-manual-edit-writeback.md`, `docs/adr/0007-anime-episode-progress-dual-mode-reconciliation.md`, and `docs/adr/0009-uncollected-push-and-metadata-refresh.md`.
- Vocabulary strictly conforms to `GLOSSARY.md`.
