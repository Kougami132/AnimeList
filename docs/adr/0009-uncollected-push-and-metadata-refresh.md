# Uncollected Subject Push and Metadata Refresh in Bangumi Sync

## Context

Prior to this decision, Bangumi synchronization was predominantly a one-way pull pipeline (`ADR-0002`). While `Push On Edit` and explicit single-note push commands existed (`ADR-0005`), batch synchronization and startup auto-sync ignored local anime notes not present in the user's Bangumi collections. Furthermore, notes created when an anime was newly announced frequently recorded incomplete metadata (e.g., `progress_total: 0`), which was never refreshed during subsequent syncs.

## Decision

1. **Uncollected Subject Push (未收藏条目推送建档)**:
   - All synchronization entry points (Single Note Sync, Batch Diff Sync, and Startup Auto-Sync) now identify local anime notes with a valid `bangumi_id` that are not yet collected on Bangumi.
   - For uncollected subjects, sync pushes the local status, episode progress, and score to Bangumi via `POST /v0/users/-/collections/{subject_id}` and `updateAnimeEpisodeProgress`, creating the remote collection.
   - In Diff Preview, uncollected entries are surfaced under a dedicated `Push (待推送)` category and pre-selected by default.
   - In Startup Auto-Sync, uncollected entries are silently pushed alongside pull updates.
   - For already-collected subjects, sync retains Remote-Authoritative pull reconciliation per `ADR-0002`.

2. **Subject Metadata Refresh (条目元数据刷新)**:
   - During sync, remote objective metadata is updated in local note frontmatter:
     - `progress_total`: Aligned to remote total episodes. If local status is `completed`, `progress` is simultaneously aligned to the new total.
     - `source_score`: Updated to remote Bangumi rating.
     - `season`, `season_year`, `studios`: Enriched from remote subject infobox and tags when missing or outdated.
   - User private fields (`score`, `status` for uncollected pushes, `started_at`, `completed_at`, custom body, `user_tags`) remain strictly protected.

3. **Two-tier Fetch Optimization**:
   - Standard sync reads embedded `collection.subject` properties (`eps`, `score`, `date`, `name`) with zero extra network requests.
   - Deep subject metadata (`GET /v0/subjects/{id}`) is fetched on demand only when local notes lack core metadata (such as `progress_total === 0` or missing `studios`).

## Consequences & Trade-offs

- **Zero-loss Bidirectional Sync**: Users can create anime notes locally in Obsidian and have them automatically scrobbled and cataloged to Bangumi during normal sync routines.
- **Dynamic Metadata Correction**: Animes that originally had 0 episodes or unannounced broadcast seasons automatically correct themselves as official data finalizes.
- **Controlled Scope**: Push is strictly limited to uncollected subjects with explicit Bangumi IDs, preventing accidental remote overwrites of existing Bangumi collections.
