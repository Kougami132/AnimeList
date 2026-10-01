# 04: Maintenance & Updates/Cleanup Settings Sections Simplified Chinese Rewrite

**What to build:** Rewrite all settings sections on the Maintenance (维护) and Updates & Cleanup (更新与清理) pages directly into Simplified Chinese, covering folder creation, built-in template copying, unreferenced file cleanup, serial cover recovery, and one-time migration actions.

**Blocked by:** 02: General & Search/Metadata Settings Page Simplified Chinese Rewrite

**Status:** resolved

- [x] Maintenance page sections are rewritten in Simplified Chinese:
  - Library setup: "创建预设文件夹" and "复制内置模板" setting titles, descriptions, button labels, and toast notices.
  - Storage cleanup: "清理无引用文件" title, description, button label ("清理无引用文件"), and progress notices.
  - Serial cover recovery: "补全缺失连载封面" title, description, and button label ("扫描并补全封面").
- [x] Updates & Cleanup page sections are rewritten in Simplified Chinese:
  - Version updates: section heading ("版本更新兼容维护") and description.
  - Note filename reconciliation: title ("同步笔记文件名与作品标题"), description, and CTA button ("查看重命名预览").
  - Duplicate cover cleanup: title ("清理笔记内重复嵌入封面"), description, and CTA button ("查看清理预览").
  - Legacy metadata cleanup: title ("升级旧版元数据规范"), description, and CTA button ("扫描并升级").
- [x] Tests verifying maintenance and cleanup settings copy (e.g. `tests/contracts/legacy-metadata-cleanup.test.ts`) are updated to assert the Simplified Chinese copy.
