# 02: General & Search/Metadata Settings Page Simplified Chinese Rewrite

**What to build:** Rewrite all text within the General (常规) and Search & Metadata (搜索与元数据) pages of the AnimeList Settings Tab directly into Simplified Chinese, eliminating the artificial `withActiveLocale("en")` wrapper so that settings remain stably displayed in Simplified Chinese regardless of the user's active interface language.

**Blocked by:** 01: Core i18n Baseline & Locale Resolution for zh-CN

**Status:** resolved

- [x] Top-level settings tab navigation buttons and page descriptions in `src/app/settings-layout.ts` are rewritten to idiomatic Simplified Chinese (常规, 搜索与元数据, 功能特性, 维护, 更新与清理).
- [x] The Display Language setting explicitly notes that changing the interface language updates main views while settings remain in Chinese, and offers "跟随系统", "简体中文", "繁体中文", "English", "日本語", and "한국어".
- [x] Storage Layout ("分类托管模式" / "单文件夹模式") and all path configuration settings (Library root, Flat media folder, Additional scan folders, Cover folder, Template folder) have complete Simplified Chinese titles, descriptions, and placeholders.
- [x] Timeline Max Stack Depth setting and description are rewritten in Simplified Chinese.
- [x] Title search language toggles (中文标题, 英文标题, 原语言标题) and Metadata provider options (Bangumi, AniList, Open Library) have complete Simplified Chinese descriptions.
- [x] All `withActiveLocale("en")` wrappers in `src/ui/settings.ts` are removed.
- [x] `tests/search-settings.test.ts` is updated to verify that settings definitions output Simplified Chinese and remain stable when the active interface locale changes to non-Chinese languages.
