# 02: Pull Completed Progress Alignment

**What to build:** An enhanced domain reconciliation and pull synchronization flow that resolves effective total episodes from remote and local metadata, aligning completed entries to their total episode count when remote `ep_status` is incomplete or zero, and recording the architectural decision in ADR-0007.

**Blocked by:** 01-dual-mode-push-progress-reconciliation.md

**Status:** resolved

- [x] Extend `reconcileSingleItem` signature and contract to accept optional `totalEpisodes?: number`
- [x] Align reconciled `progress` to `totalEpisodes` when remote status is `completed` and `epStatus < totalEpisodes`
- [x] Faithfully preserve remote `ep_status` without truncation when status is non-completed (e.g. `ongoing`)
- [x] In `BangumiSyncService` (both batch sync and single note pull), determine `totalEpisodes` prioritizing remote `subject.eps` (when $> 0$) and falling back to local note `episodes`/`total`, passing it to `reconcileSingleItem`
- [x] Record `docs/adr/0007-anime-episode-progress-dual-mode-reconciliation.md` detailing the background, trade-offs, and rules of dual-mode push matching and pull completed progress alignment
- [x] Add unit tests in `tests/bangumi-sync.test.ts` verifying pull reconciliation for completed anime with incomplete remote progress and ongoing anime with remote progress

## Comments

Implemented in `reconcileSingleItem` (`src/domain/bangumi-sync/reconcile.ts`) and wired across `BangumiSyncService` (`syncSingleNote`, `classifyCandidates`, and `ingestNewSubject`). ADR-0007 documented in `docs/adr/0007-anime-episode-progress-dual-mode-reconciliation.md`. Verified with automated unit and integration tests.
