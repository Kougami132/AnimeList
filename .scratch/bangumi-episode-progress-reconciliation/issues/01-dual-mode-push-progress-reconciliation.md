# 01: Dual-mode Push Progress Reconciliation

**What to build:** An intelligent episode matching and writeback engine in the Bangumi integration client that resolves relative seasonal progress, completion fallbacks, and absolute episode numbers for anime starting at arbitrary episode sorts (such as second seasons with episodes 13 to 25), while recording the canonical domain terms in the glossary.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Unconditionally mark all normal episodes (`type === 0`) as watched when local status is `completed`
- [x] Support relative seasonal progress matching: when $progress \le totalEpisodes$, mark the first $progress$ sorted episodes as watched
- [x] Support absolute sort matching: when $progress > totalEpisodes$, $minSort > 1$, and $progress \le maxSort$, mark episodes with $sort \le progress$ as watched
- [x] Accurately unmark episodes beyond the progress boundary (`type: 0`) to support progress rollback
- [x] Add `Relative Episode Progress` and `Dual-mode Push Reconciliation` definitions to `GLOSSARY.md`
- [x] Add end-to-end unit tests in `tests/bangumi-sync.test.ts` for sequel anime (episodes 13 to 25) verifying relative push (13/13, 3/13), absolute push (15), completed fallback, and rollback

## Comments

Implemented in `BangumiSyncClient.updateAnimeEpisodeProgress`, verified with unit tests in `tests/bangumi-sync.test.ts` for relative progress (13/13, 3/13), absolute progress (15), completed fallback, and rollback unmarking. Domain terms added to `GLOSSARY.md`.
