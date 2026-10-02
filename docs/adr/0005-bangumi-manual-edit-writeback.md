# Bangumi Manual Edit Writeback

To support anime watched outside automated scrobblers (e.g. Jellyfin completion not triggering Bangumi status changes, or untracked shows), AnimeList allows writing episode progress, watching status, and score back to Bangumi.

Writeback is strictly scoped to AnimeList UI edit submissions (`MediaUpdateService`) and explicit push commands, accompanied by dirty checking against previous frontmatter. It never attaches to global Obsidian vault file modification events (`vault.on('modify')`).

When pushing, uncollected subjects are automatically created on Bangumi via `POST /v0/users/-/collections/{subject_id}`. User-initiated edits authoritatively overwrite remote scores without raising a `Score Conflict`. Failures degrade gracefully: local note persistence always succeeds, while push errors display non-blocking notices. Pull synchronization retains ADR-0002's authoritative remote baseline.
