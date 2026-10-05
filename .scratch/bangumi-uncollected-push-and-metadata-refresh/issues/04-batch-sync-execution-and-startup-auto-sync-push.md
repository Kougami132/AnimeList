# 04: Batch Sync Execution and Startup Auto-Sync Push

**What to build:**
Implement batch execution for `action: "push"` items in `executeBatchSync`. When executing batch sync, push uncollected candidates to Bangumi (upserting remote collection and scrobbling episode progress) while refreshing their local metadata, incrementing `summary.pushed`. In `executeStartupAutoSync`, automatically include uncollected local notes alongside updated notes for silent two-way synchronization in the background. Update completion notices to report combined summary results (e.g. "updated 3 anime, pushed 1 anime").

**Blocked by:** 03: Uncollected Discovery and Diff Preview Push Group

**Status:** resolved

- [x] `applyBatchItem` handles `action: "push"` by calling `pushAnimeData`, updating note metadata, and returning `"pushed"`.
- [x] `executeBatchSync` tracks pushed items in `summary.pushed` and displays accurate completion results in the summary modal.
- [x] `executeStartupAutoSync` identifies uncollected push candidates and executes silent background push alongside existing note updates.
- [x] Startup auto-sync notice reflects both updated and pushed counts when changes occur.
- [x] Failures on individual push items fail gracefully without halting the remaining batch execution.

## Comments
Implemented batch push processing in `applyBatchItem`, added `pushed` tracking to `BangumiSyncSummary` and `SyncSummaryModal`, and enhanced `executeStartupAutoSync` to silently push uncollected anime alongside pull updates.
