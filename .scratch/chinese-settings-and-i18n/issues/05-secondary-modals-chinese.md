# 05: Secondary Management Modals Simplified Chinese Rewrite

**What to build:** Rewrite all secondary management and cleanup dialogs launched from settings into idiomatic Simplified Chinese, ensuring users encounter an entirely localized experience across note filename reconciliation, duplicate cover cleanup, tag management, legacy metadata cleanup, and serial cover migration.

**Blocked by:** 04: Maintenance & Updates/Cleanup Settings Sections Simplified Chinese Rewrite

**Status:** resolved

- [x] `DuplicateCoverCleanupModal` displays modal title ("清理笔记内重复嵌入封面"), explanatory hint, full rule checklist in Simplified Chinese, scanning status counter, and "确认清理" CTA button.
- [x] `MediaNoteFilenameCleanupModal` displays modal title ("同步笔记文件名与作品标题"), explanatory hint, safety rule checklist in Simplified Chinese, scanning status counter, and "确认重命名" CTA button.
- [x] `UserTagManagerModal` renders tag search placeholder ("搜索标签…"), new tag input placeholder ("新建标签"), add button ("添加标签"), empty/no-match states, usage count ("被 {count} 部作品使用"), rename/delete action buttons, and work association removal prompts in Simplified Chinese.
- [x] `LegacyMetadataCleanupModal` and `SerialCoverMigrationModal` display phase progression, progress counters, metric summaries, and completion reports in Simplified Chinese.
- [x] Component unit tests for modal DOM rendering are updated or added to confirm that all visible modal strings are rendered in Simplified Chinese.
