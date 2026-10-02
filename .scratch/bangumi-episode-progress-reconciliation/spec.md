# Spec: Anime Episode Progress Dual-mode Reconciliation

Status: ready-for-agent

## Problem Statement

When tracking anime seasons that do not begin at episode 1 (such as second seasons, split cours, or sequel arcs where episodes are sequentially numbered, e.g., episodes 13 to 25), users encounter severe synchronization and progress corruption issues between Obsidian and Bangumi:

1. **Push corruption**: The user records their local anime note as having total 13 episodes and marks progress as 13/13 (all watched). Upon pushing this note to Bangumi via manual push or edit writeback, the push logic mistakenly compares the local progress number directly against the Bangumi episode `sort` number (`sort <= progress`). Because the episodes have `sort` values 13 through 25, only the first episode (sort 13) satisfies `13 <= 13`, while episodes 14 through 25 are treated as unwatched or actively unmarked. As a result, Bangumi registers only a single watched episode.
2. **Pull corruption**: When syncing back from Bangumi (batch sync or auto sync), Bangumi returns `ep_status = 1` (reflecting only the 1 episode marked as watched). AnimeList's authoritative reconciliation overwrites the local progress with 1. Consequently, the user's local note changes from `13/13` to `1/13`.
3. **Incomplete completed entries**: On Bangumi, users sometimes mark an anime series as "completed" (看过) without clicking individual episode checkmarks, causing Bangumi to store an `ep_status` of 0 or an incomplete count. When pulled into Obsidian, the completed anime note ends up with `0/12` or incomplete progress, which contradicts the completed status and corrupts progress bars and completion statistics.

## Solution

1. **Relative Episode Progress Standard**: Establish a clear domain standard in AnimeList that local anime note `progress` always represents the **count of watched episodes within that specific entry/season** ($0 \le progress \le total$), matching the entry's `total` (e.g. 13/13).
2. **Dual-mode Episode Push Matching with Completion Fallback**:
   - When pushing to Bangumi, if the note status is `completed`, unconditionally mark all normal episodes (`type === 0`) in the subject as watched (`type: 2`).
   - For non-completed notes, retrieve the normal episodes ordered by `sort`.
   - If the local progress falls within the entry's relative episode count range ($progress \le totalEpisodes$), mark the first $progress$ episodes as watched.
   - If the local progress falls within the subject's absolute episode range ($minSort \le progress \le maxSort$), match by absolute episode sort (`sort <= progress`).
   - Any episodes beyond the progress boundary are marked as unwatched (`type: 0`), supporting legitimate progress rollback.
3. **Pull Progress Reconciliation Alignment for Completed Entries**:
   - During pull reconciliation, resolve the authoritative total episodes by prioritizing remote `subject.eps` (when $> 0$) and falling back to the local `episodes` / `total`.
   - When the remote collection status is `completed` and valid total episodes are known ($total > 0$), if remote `epStatus < total`, automatically align the local reconciled progress to $total$.
   - For non-completed statuses (such as `ongoing`), faithfully respect the remote `ep_status` without silent truncation.

## User Stories

1. As an anime viewer watching a second season (episodes 13 to 25), I want my local `13/13` progress to mark all 13 episodes (13 through 25) as watched on Bangumi when pushed, so that my remote profile accurately reflects that I finished the season.
2. As an anime viewer syncing back from Bangumi after pushing a completed season, I want my local progress to remain `13/13` rather than regressing to `1/13`, so that my local viewing progress is never corrupted by synchronization.
3. As an anime viewer watching a second season in progress (e.g. 3 of 13 episodes watched), I want setting local `progress: 3` to mark the first 3 episodes of the season (sort 13, 14, 15) as watched on Bangumi, so that partial seasonal progress syncs correctly.
4. As an anime viewer who prefers recording global episode numbers (e.g. entering `progress: 15` for episode 15), I want the push algorithm to recognize numbers within the season's `[minSort, maxSort]` range and mark episodes up to 15 as watched, so that absolute episode notation is supported without manual calculation.
5. As an anime viewer marking an anime as `completed` with `progress: 0` or empty progress, I want pushing to Bangumi to mark every normal episode as watched, so that a finished show never has un-checked episodes on Bangumi.
6. As an anime viewer pulling collections from Bangumi where a show was marked "看过" (completed) on the web without checking individual episodes (`ep_status: 0`), I want Obsidian to automatically set local progress to the total episode count, so that my completed anime does not display as `0/12`.
7. As an anime viewer pulling collections from Bangumi for an ongoing anime where remote `ep_status` temporarily exceeds total episodes, I want the remote number preserved as-is without silent truncation, so that I can see the discrepancy and refresh metadata or correct notes.
8. As an anime viewer reducing local progress (e.g. from 5 to 2), I want the push operation to unmark episodes 3, 4, and 5 on Bangumi, so that progress corrections and rewatches can be rolled back accurately.
9. As an anime viewer with special episodes (SP, OP, ED) in a Bangumi subject, I want the episode progress calculation to only target normal story episodes (`type === 0`), so that special episodes do not throw off the progress index.
10. As a developer maintaining the codebase, I want `reconcileSingleItem` to accept `totalEpisodes` as a parameter, so that domain reconciliation can make informed decisions about completed progress alignment without tight coupling to network clients.
11. As a developer maintaining the codebase, I want clear domain glossary terms for `Relative Episode Progress` and `Dual-mode Push Reconciliation`, so that future contributors understand the distinction between relative seasonal progress and remote episode sorting.
12. As a developer maintaining the codebase, I want an architectural decision record (ADR-0007) documenting the trade-offs of dual-mode matching and completed progress alignment, so that these non-obvious synchronization rules are permanently preserved.

## Implementation Decisions

1. **Relative Episode Progress Standard**:
   - In AnimeList frontmatter and UI, `progress` strictly represents the relative count of episodes watched for that media note ($0 \le progress \le total$).
   - For an anime with 13 episodes starting at sort 13, watching all 13 episodes is recorded as `progress: 13, total: 13`.

2. **Dual-mode Push Reconciliation Algorithm**:
   - In `BangumiSyncClient.updateAnimeEpisodeProgress`, normalize normal episodes sorted by `sort`:
     ```ts
     const normalEpisodes = episodeItems
       .filter((item) => (item.episode?.type ?? 0) === 0)
       .sort((a, b) => (a.episode?.sort ?? 0) - (b.episode?.sort ?? 0));
     ```
   - Let $N = normalEpisodes.length$, $minSort = normalEpisodes[0]?.sort$, $maxSort = normalEpisodes[N - 1]?.sort$.
   - If `status === "completed"`, mark all normal episodes as watched (`type: 2`).
   - If `progress <= 0`, mark all normal episodes as unwatched (`type: 0`).
   - If $progress \le N$: mark the first $progress$ items (by sorted array index $0 \le i < progress$) as watched (`type: 2`), and all subsequent items as unwatched (`type: 0`).
   - If $progress > N$ and $minSort > 1$ and $progress \le maxSort$: match by absolute sort ($sort \le progress$ marked as watched, $sort > progress$ marked as unwatched).
   - If $progress > maxSort$: mark all normal episodes as watched (`type: 2`).

3. **Pull Completed Progress Alignment**:
   - Update `reconcileSingleItem(local, remote, totalEpisodes?)`:
     - If remote status maps to `completed` and $totalEpisodes > 0$:
       - If remote `epStatus < totalEpisodes`, set `targetProgress = totalEpisodes`.
       - If remote `epStatus >= totalEpisodes`, set `targetProgress = remote.epStatus`.
     - Otherwise, set `targetProgress = Math.max(0, remote.epStatus)`.
   - In `BangumiSyncService` (both batch sync and single note sync), calculate `totalEpisodes`:
     ```ts
     const totalEpisodes = remoteSubjectEps > 0 ? remoteSubjectEps : localTotalEpisodes;
     ```
     and pass it to `reconcileSingleItem`.

4. **Domain Documentation**:
   - Document `Relative Episode Progress` and `Dual-mode Push Reconciliation` in `GLOSSARY.md`.
   - Record ADR `docs/adr/0007-anime-episode-progress-dual-mode-reconciliation.md`.

## Testing Decisions

- **Test Behavior, Not Implementation**: Verify the external observable behavior:
  - For push: check the HTTP PATCH payload sent to Bangumi (`episode_id` array and `type: 2` or `type: 0`).
  - For pull / reconcile: check the returned `ReconciliationResult` (`progress`, `status`, `changed`).
- **Target Test Suites**:
  - `tests/bangumi-sync.test.ts`: Add test cases for second season anime (sort 13~25) covering:
    - Push with relative progress (e.g. 13/13, 3/13).
    - Push with absolute progress (e.g. 15).
    - Push with completed status and 0 progress (marks all 13~25).
    - Push progress regression (marks reduced episodes unwatched).
    - Reconcile pull for completed anime with `ep_status: 0` or `1` aligning to `total`.
    - Reconcile pull for ongoing anime preserving remote `ep_status`.
- **Prior Art**:
  - Existing client episode progress test cases in `tests/bangumi-sync.test.ts` lines 320–445.
  - Existing reconcile test cases in `tests/bangumi-sync.test.ts` lines 500–560.

## Out of Scope

- Modifying non-anime media progress (manga chapters/volumes, novel volumes).
- Custom UI for manually picking individual arbitrary episodes to mark as watched (e.g. watching episode 15 without watching 14). Progress remains sequential.
- Modifying Bangumi subject wiki metadata directly.

## Further Notes

- Bangumi API v0 does not allow modifying anime progress via `PATCH /v0/users/-/collections/{subject_id}` (`ep_status` on collections only works for books). All anime episode state changes must flow through `PATCH /v0/users/-/collections/{subject_id}/episodes`.
- Some anime entries have non-integer episode numbers (e.g. 13.5 recap). Non-integer sorts are ignored or sorted numerically, and normal episode filtering ensures only `type === 0` episodes participate in the count.
