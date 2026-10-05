# 03: Uncollected Discovery and Diff Preview Push Group

**What to build:**
Enable reliable discovery of local anime notes that have a valid Bangumi ID but are not in the user's Bangumi collection. The sync client retrieves the user's full anime collection IDs across pages to establish an authoritative set of collected subjects, avoiding false uncollected classifications caused by the rolling sync window. The sync service classifies these uncollected local notes with `action: "push"`. In the Diff Preview Modal, add a dedicated "Push" (待推送) filter tab and badge alongside New, Updated, Conflict, and Synced. Display the local status, progress, and score for push candidates, pre-select them by default, and update the modal's bottom counter to show breakdown statistics (pull vs. push).

**Blocked by:** 02: Single Note Sync Uncollected Push

**Status:** resolved

- [x] The Bangumi sync client provides a method to paginate and retrieve the full set of user anime collection subject IDs.
- [x] `classifyCandidates` accurately detects local anime notes with `bangumi_id` that are missing from Bangumi collections, tagging them with `action: "push"`.
- [x] Push candidates capture local note file path, status, progress, and score.
- [x] Diff Preview Modal renders a dedicated "Push" / "待推送" filter tab.
- [x] Diff Preview Modal displays a distinct badge and local state summary for push items.
- [x] Push items are included in `selectedIds` by default alongside new and updated items.
- [x] The footer summary indicates the total selected count and differentiates pull vs. push operations.

## Comments
Implemented `BangumiSyncClient.fetchAllCollectionSubjectIds`, updated `classifyCandidates` to discover uncollected notes using full ID sets, and added the dedicated Push category tab, badge, and summary count in `DiffPreviewModal`.
