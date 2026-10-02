# Anime Episode Progress Dual-mode Reconciliation

## Context

In Bangumi, sequel anime seasons and split cours are frequently cataloged as independent subjects where episode `sort` numbering continues sequentially from earlier seasons (for example, Season 2 episodes numbered 13 to 25 with a total count of 13 episodes).

In Obsidian, AnimeList models anime progress strictly as **Relative Episode Progress**: the count of episodes watched within that specific season note ($0 \le progress \le total$, e.g. 13/13).

Prior to this decision, the writeback client compared episode sort directly against local progress (`sort <= progress`). This caused two critical sync bugs:
1. Pushing a finished sequel season (progress 13) only marked episode 13 watched on Bangumi (since only $13 \le 13$), leaving episodes 14–25 uncollected. Bangumi then recorded `ep_status = 1`.
2. Syncing back from Bangumi pulled `ep_status = 1`, corrupting the local note from 13/13 down to 1/13.
3. In addition, users often mark an anime as "completed" (看过) on Bangumi without checking individual episodes, yielding `ep_status = 0` or partial counts that degraded completed notes into 0/12.

## Decision

We establish two coordinated reconciliation rules across the push and pull pipelines:

1. **Dual-mode Push Reconciliation with Completion Fallback**:
   - When pushing to Bangumi, if note status is `completed`, unconditionally mark all normal episodes (`type === 0`) in the subject as watched (`type: 2`).
   - If local progress falls within the season's total episode count ($progress \le totalEpisodes$), mark the first $progress$ normal episodes in `sort` order as watched.
   - If local progress falls within the subject's absolute episode range ($minSort \le progress \le maxSort$ where $minSort > 1$), match by absolute episode sort (`sort <= progress`).
   - Episodes beyond the determined boundary are marked unwatched (`type: 0`), accurately supporting intentional progress rollback.

2. **Completed Progress Alignment on Pull**:
   - During pull reconciliation (`reconcileSingleItem`), determine the effective total episodes prioritizing remote `subject.eps` (when $> 0$) and falling back to local note `episodes` / `total`.
   - When remote collection status is `completed` and valid total episodes exist ($total > 0$):
     - If remote `epStatus < total`, automatically align the local reconciled progress to $total$.
     - If remote `epStatus >= total`, preserve remote `epStatus`.
   - For non-completed statuses (such as `ongoing`), faithfully preserve remote `ep_status` without truncation, allowing any external discrepancy to be surfaced to the user.

## Consequences & Trade-offs

- **Consistency**: Completed anime in Obsidian will reliably display full progress (100%) even if the user never clicked individual episode checkmarks on the Bangumi website.
- **Sequel season support**: Users can record sequel anime as relative counts (e.g. 13/13 or 3/13) or absolute episode numbers (e.g. 15), and writeback will map them correctly to Bangumi's underlying episode IDs.
- **Rollback safety**: Decreasing progress locally (e.g. from 3 to 1) safely unmarks the removed episodes on Bangumi without affecting earlier watched episodes.
- **Trade-off on non-completed overflow**: Ongoing anime where remote `ep_status` exceeds local `total` are left un-clamped so users can spot out-of-date metadata rather than masking it behind silent truncation.
