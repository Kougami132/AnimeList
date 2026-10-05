# 01: Subject Metadata Refresh and Completed Alignment

**What to build:**
During Bangumi synchronization, automatically refresh objective anime metadata in local note frontmatter from Bangumi's latest records. When an anime originally recorded with 0 episodes (or an unfinalized episode count) has an official episode count on Bangumi, update `progress_total` to the remote value. If the local note is marked `completed`, automatically align `progress` to the updated total so finished shows never display incomplete progress. Refresh Bangumi official rating (`source_score`), broadcast season (`season`/`season_year`), animation studios (`studios`), and original title (`title_original`) when missing or updated. Strictly protect user personal records: user score (`score`), start and completion dates, user tags (`user_tags`), and custom note content are never overwritten. Implement two-tier request optimization: reuse embedded `collection.subject` properties with zero extra HTTP requests, fetching full subject details on demand only when core metadata is missing.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Updating an anime note during sync refreshes `progress_total` with remote total episodes when remote total is greater than 0.
- [x] When a completed anime note's `progress_total` is updated, `progress` is automatically aligned to match the new total.
- [x] Updating an anime note during sync refreshes `source_score` to match the remote Bangumi community rating.
- [x] Missing broadcast season (`season`, `season_year`) and animation studios (`studios`) are populated from Bangumi metadata.
- [x] User personal fields (`score`, `status`, `started_at`, `completed_at`, `user_tags`) and Markdown body content remain completely intact.
- [x] Embedded subject metadata from collection responses is prioritized to avoid unnecessary subject detail HTTP queries.
- [x] Detailed subject metadata is fetched on demand only when local notes lack core metadata (such as `progress_total === 0` or missing `studios`).

## Comments
Implemented in `src/domain/bangumi-sync/metadata-refresh.ts` and integrated into `BangumiSyncService.syncSingleNote` and batch sync. Tested with comprehensive domain and integration tests in `tests/bangumi-sync.test.ts`.
