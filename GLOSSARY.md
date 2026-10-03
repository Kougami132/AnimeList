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

**Bangumi Manual Push (番组手动推送回写)**:
The operation of pushing local anime progress, watching status, and score directly to Bangumi user collections upon manual form submission or explicit push command, creating collections if they do not exist.
_Avoid_: Auto file sync, Remote mirror push, File modify hook

**Push On Edit (编辑时自动回写)**:
The setting and behavior that triggers a Bangumi manual push automatically after saving modifications in the AnimeList edit dialog, subject to dirty checking.
_Avoid_: Edit listener, Background save hook


**Existing Note Sync**:
An automated sync strategy that only modifies anime notes already present in the vault, ignoring newly discovered Bangumi collections.
_Avoid_: In-place sync, Shallow sync

**Diff Preview**:
The pre-sync modal interface displaying classified discrepancies (New, Updated, Conflict, Synced) and selection toggles before executing batch updates.
_Avoid_: Sync list, Import preview

**Strict Subject Matching**:
The identification strategy that pairs local media notes with remote Bangumi subjects exclusively via explicit Bangumi subject ID frontmatter fields.
_Avoid_: Title matching, Fuzzy matching

**Relative Episode Progress (条目相对集数进度)**:
The domain rule that local anime note progress strictly records the count of watched episodes within that specific entry or season ($0 \le progress \le total$), rather than the global franchise episode index.
_Avoid_: Absolute episode sort, Cumulative franchise progress

**Dual-mode Push Reconciliation (双模集数对齐)**:
The push alignment strategy that compares local progress against normal Bangumi episodes: when local progress falls within the season's total episode count, it maps to the first N episodes by sort order; when local progress falls within the subject's absolute sort boundaries ($minSort \le progress \le maxSort$), it matches by absolute episode sort; and when local status is `completed`, it marks all normal episodes watched unconditionally.
_Avoid_: Naive sort comparison, Linear progress assumption

**Completed Progress Alignment (完结进度对齐)**:
The pull synchronization rule that automatically sets local progress to the entry's total episodes when the remote status is `completed` but remote `ep_status` is zero or less than the total, preventing finished shows from displaying incomplete or zero progress.
_Avoid_: Empty completed progress, Zero progress override



## Storage & Settings

**Managed Mode (分类托管模式)**:
The storage layout that organizes media notes into dedicated `Anime/`, `Manga/`, and `Novel/` subdirectories beneath the configured library root.
_Avoid_: Nested mode, Structured mode

**Flat Mode (单文件夹模式)**:
The storage layout that writes all media notes directly into a single folder without media-type subdirectories.
_Avoid_: Root mode, Single-dir mode

**Storage Cleanup (存储清理)**:
The maintenance routine that identifies and safely moves unreferenced managed covers and media assets to the Obsidian trash while removing stale caches.
_Avoid_: File purge, Trash empty

**Version Updates Maintenance (版本更新兼容维护)**:
The administrative toolset for one-time migrations required by newer plugin versions, such as note filename-title reconciliation, duplicate embedded cover cleanup, and legacy metadata schema upgrades.
_Avoid_: Migration center, Legacy fix

**Legacy Settings Migration (旧版配置平滑迁移)**:
The automated initial-run detection and migration of stored settings from upstream `animelist/data.json` into `animelist-enhanced/data.json` when upgrading from the upstream plugin.
_Avoid_: Config import, Settings overwrite

## Media Classification & Scheduling

**Anime Broadcasting Season (番组档期)**:
The industry broadcast quarter (winter/Q1, spring/Q2, summer/Q3, fall/Q4) governing when an anime program is scheduled and promoted, taking precedence over strict Gregorian calendar months when boundary dates diverge.
_Avoid_: Calendar quarter, Financial quarter, Release month

**Season Resolution Precedence (档期解析优先级)**:
The deterministic hierarchy for anime season and season year resolution: provider explicit season overrides tag-inferred season, which in turn overrides release date calendar month fallback.
_Avoid_: Month-first resolution, Calendar override

## Score Dashboard & Visualization

**Score Dashboard Screenshot (评分看板长图)**:
The high-resolution full-board raster export of the user's score dashboard reflecting active media type, filter, and unrated visibility states, synthesized with an informational header and excluding interactive UI controls.
_Avoid_: Board screencap, Viewport dump, Dashboard crop



