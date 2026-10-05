# 02: Single Note Sync Uncollected Push

**What to build:**
When a user triggers "Sync from Bangumi" on an individual anime note whose Bangumi subject is not yet in their collection (API returns 404 or null), automatically convert the operation into an uncollected push. Push the local note's status, episode progress, and rating to Bangumi via `upsertCollection` and `updateAnimeEpisodeProgress`, creating the collection remotely. Concurrently refresh the local note's objective metadata (total episodes, community score, studios, season) and persist the refreshed fields. Display an informative notice confirming that the anime was pushed and cataloged to Bangumi, instead of showing a "not collected" error message.

**Blocked by:** 01: Subject Metadata Refresh and Completed Alignment

**Status:** resolved

- [x] Invoking `syncSingleNote` on a note that is not collected on Bangumi initiates an uncollected push rather than halting with an error notice.
- [x] The local watching status (`ongoing`, `completed`, `planned`, `dropped`) and score are pushed to Bangumi via `upsertCollection`.
- [x] Watched episode progress is scrobbled to Bangumi via dual-mode episode progress reconciliation.
- [x] Remote subject metadata (total episodes, official rating, season, studios) is fetched and updated in the note frontmatter.
- [x] Completed notes have their local progress aligned to the refreshed total if needed.
- [x] A success notice informs the user that the note was created and pushed to their Bangumi collection.
- [x] Single sync result type reflects the push outcome cleanly without breaking existing caller contracts.

## Comments
Implemented in `BangumiSyncService.syncSingleNote` with uncollected fallback to `pushAnimeData` and subsequent metadata refresh. Result typed with `kind: "pushed"`.
