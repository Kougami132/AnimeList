# 03: Batch Sync Diff Preview and Selective Ingestion

**What to build:**
A batch synchronization workflow querying Bangumi user collections within the configured rolling window (recent N days, default 30 days) filtered by target collection statuses. Before making any changes, the plugin displays a Diff Preview modal showing classified candidate entries: `[New]` (checked by default), `[Updated]` (checked by default), `[Conflict]` (disabled and highlighted in red), and `[Synced]` (unchecked by default). Users can filter by keyword and toggle selections. Upon confirmation, a rate-limited queue executes operations sequentially with a 200ms throttle between requests, downloading cover artwork and applying the default template for new anime notes, and updating frontmatter / pushing scores for existing notes. Finally, a Sync Summary modal displays total additions, updates, and direct links to any conflicting notes.

**Blocked by:** 02: Single Item Sync and Conflict Handling

**Status:** resolved

- [x] Fetch user collections updated in the last N days matching the configured collection statuses using pagination.
- [x] Strictly match Bangumi subjects with existing vault notes by matching `source_id` or `source_urls` containing the Bangumi subject ID.
- [x] Implement Diff Preview modal categorizing items into `[New]`, `[Updated]`, `[Conflict]`, and `[Synced]`, with default selections and search/filter.
- [x] Implement sequential execution queue with 200ms rate-limiting throttle between network requests and visual progress indicators.
- [x] Ingest new notes using the configured default anime template and download remote cover art to the designated cover folder.
- [x] Display Sync Summary modal upon completion with statistics and links to jump to conflicting notes.
- [x] Expose "Batch sync recent anime from Bangumi" in settings and the command palette.
- [x] Add integration tests verifying classification accuracy, queue execution, throttle pacing, and summary generation.

## Answer

Implemented batch synchronization workflow with Diff Preview and selective ingestion:
1. Implemented `fetchRecentCollections` in `BangumiSyncService` with pagination and date cutoff within rolling N days window.
2. Built `classifyCandidates` strictly matching vault notes via `source_id` or `source_urls` and classifying entries into `[New]`, `[Updated]`, `[Conflict]`, and `[Synced]`.
3. Created `DiffPreviewModal` in `src/ui/bangumi-sync/diff-modal.ts` with keyword search filtering, select all / deselect all, appropriate default checkboxes, disabled conflict rows, and a visual progress indicator.
4. Implemented rate-limited sequential queue execution with 200ms throttling in `BangumiSyncClient` and `executeBatchSync`.
5. Created `SyncSummaryModal` in `src/ui/bangumi-sync/summary-modal.ts` detailing additions, updates, synced, and clickable links to jump to conflicting notes.
6. Exposed "Batch sync recent anime from Bangumi" command in command palette and "Batch sync now" button in Settings.
7. Added integration tests covering candidate classification, collection retrieval, batch execution, and summary reporting.
