# 01: Bangumi Client Upsert and Single Note Push Core

**What to build:** An end-to-end push capability in the Bangumi integration that allows pushing an individual anime note's current status, episode progress, and score to Bangumi. When pushing, if the anime is already in the user's collection, update it; if it is not yet in the collection (remote returns 404), automatically create the collection entry on Bangumi. Scores authoritatively overwrite remote scores without conflict stops, and non-blocking notifications report success or network failure to the user.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Provide client upsert functionality that updates existing collections and automatically falls back to creating uncollected subjects via `POST /v0/users/-/collections/{subject_id}`
- [x] Map anime watching statuses accurately: `ongoing` -> watching (3), `completed` -> completed (2), `planned` -> wishlist (1), `dropped` -> dropped (5)
- [x] Map episode progress to non-negative integer `ep_status` and score to 1-10 integer `rate` (or 0 when cleared)
- [x] Overwrite remote score authoritatively upon manual push without raising `Score Conflict`
- [x] Display an immediate success toast notice upon successful push, or a polite non-blocking warning notice if the request fails
- [x] Include unit tests covering normal push, 404 creation fallback, value mappings, and error handling
