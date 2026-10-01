# AnimeList Domain Glossary

Terminology and concepts governing the tracking and synchronization of anime media entries within Obsidian.

## Synchronization

**Bangumi Sync**:
The process of aligning local Obsidian anime media notes with user collection activity on Bangumi.
_Avoid_: Bangumi Import, Bangumi Mirror

**Sync Window**:
A configurable rolling interval in days (default 30) used to scope Bangumi user collection retrieval based on remote update time (`updated_at`).
_Avoid_: Time filter, Sync range

**Score Conflict**:
A sync state where an anime entry has different non-null ratings in the local vault and Bangumi, requiring user intervention to resolve.
_Avoid_: Rating mismatch, Score error

**Score Push**:
The write-back operation of uploading a local score to Bangumi when Bangumi has no recorded rating for that subject.
_Avoid_: Rating upload, Score sync

**Existing Note Sync**:
An automated sync strategy that only modifies anime notes already present in the vault, ignoring newly discovered Bangumi collections.
_Avoid_: In-place sync, Shallow sync

**Diff Preview**:
The pre-sync modal interface displaying classified discrepancies (New, Updated, Conflict, Synced) and selection toggles before executing batch updates.
_Avoid_: Sync list, Import preview

**Strict Subject Matching**:
The identification strategy that pairs local media notes with remote Bangumi subjects exclusively via explicit Bangumi subject ID frontmatter fields.
_Avoid_: Title matching, Fuzzy matching
