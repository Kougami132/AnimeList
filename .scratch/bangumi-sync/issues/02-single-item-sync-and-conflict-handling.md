# 02: Single Item Sync and Conflict Handling

**What to build:**
On-demand single-item synchronization between an active anime note and its remote Bangumi counterpart. Triggerable via a sync button in the anime detail card toolbar, the command palette ("AnimeList: Sync current anime with Bangumi"), or the file context menu. Bangumi watching progress (`progress`) and status (`status`) authoritatively overwrite local frontmatter. Local completion dates (`completed_at`) are preserved if already set, or populated from Bangumi's `updated_at` date if empty. If local has a score and Bangumi has none, the local score is pushed to Bangumi via `PATCH /v0/users/-/collections/{subject_id}` (Score Push). If both have scores and they differ, the item update is aborted, flagged as a Score Conflict, and a warning notification is displayed to prevent overwriting. Validation is adjusted so completed anime without a Bangumi rating can be cleanly saved.

**Blocked by:** 01: Bangumi Token Configuration and Connection Verification

**Status:** resolved

- [x] Add single-item sync action to detail view card, command palette, and file menu for notes containing a valid Bangumi `source_id` or Bangumi URL.
- [x] Implement Bangumi collection fetch and update endpoints (`GET` and `PATCH /v0/users/-/collections/{subject_id}`).
- [x] Authoritatively overwrite local note `progress` and `status` with Bangumi values while preserving Markdown body, moments, user tags, and custom cover images.
- [x] Preserve existing `completed_at` values; fallback to Bangumi `updated_at` (date portion) only if local `completed_at` is empty.
- [x] Execute Score Push (`PATCH`) to Bangumi when local note has a score and Bangumi collection has no score.
- [x] Detect Score Conflict when both local and remote have differing non-null scores, halt updates for that note, and display an actionable conflict warning.
- [x] Adjust form/codec validation to allow completed anime to have null scores when derived from third-party synchronization.
- [x] Add unit and domain tests covering score push, conflict halting, status/progress overwrite, and date preservation.

## Answer

Implemented single item synchronization and conflict handling:
1. Created `extractBangumiSubjectId` in `src/domain/bangumi-sync/subject-matching.ts` to identify Bangumi subjects from `source_provider === "bangumi"`, `source_urls` containing Bangumi URLs, or numeric anime source IDs.
2. Built `reconcileSingleItem` in `src/domain/bangumi-sync/reconcile.ts` governing authoritative progress/status overwrite, date preservation, score push, and score conflict detection.
3. Implemented `BangumiSyncService.syncSingleNote` in `src/data/bangumi-sync/bangumi-sync-service.ts` updating note frontmatter via `app.fileManager.processFrontMatter` while preserving Markdown body, moments, user tags, and custom cover images.
4. Added single item sync actions to:
   - Anime detail view card toolbar via `decorateBangumiDetail`
   - Command palette ("Sync current anime with Bangumi")
   - File context menu for notes with Bangumi subjects
5. Updated `validateMediaNoteFormForType`, `applyEditableMediaForm`, and `buildMediaMarkdown` in `src/data/media-note-codec.ts` with `allowEmptyCompletedScore: true` option.
6. Added domain and service unit tests in `tests/bangumi-sync.test.ts` covering score conflict halting, score push execution, status/progress overwriting, and date preservation.
