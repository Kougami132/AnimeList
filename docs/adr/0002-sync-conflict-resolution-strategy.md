# Bangumi Sync Conflict Resolution Strategy

For synchronization between local Obsidian notes and Bangumi user collections:
1. Progress and watching status treat Bangumi as authoritative and overwrite local fields.
2. Existing local completion dates (`completed_at`) are preserved unless empty, in which case Bangumi's `updated_at` date is used.
3. Ratings follow asymmetric resolution: if Bangumi has no rating but local has one, the local score is pushed to Bangumi (Score Push); if both have matching scores, no-op; if both have differing scores, the entry is skipped and flagged as a Score Conflict for user manual resolution.
