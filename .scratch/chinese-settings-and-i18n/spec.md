# Spec: Simplified Chinese Settings and Interface i18n Baseline

Status: ready-for-agent

## Problem Statement

When Chinese-speaking Obsidian users open the AnimeList plugin settings tab to configure library paths, metadata providers, Bangumi synchronization, or maintenance tools, the entire settings interface is rendered exclusively in English. Even when the user has set Obsidian's language or the plugin interface language to Chinese, the settings tab remains locked in English due to a legacy design decision. Furthermore, secondary maintenance and migration dialogs triggered from the settings page (such as tag management, filename reconciliation, and duplicate cover cleanup) present English instructions and prompts. This creates cognitive friction, misconfiguration risks, and a disjointed user experience for the plugin's primary audience.

## Solution

1. **Direct Simplified Chinese Settings Tab**:
   Rewrite all text within the AnimeList Settings Tab directly into Simplified Chinese (hardcoded), removing the legacy lock that forced settings copy to English. All 5 top-level settings pages (常规, 搜索与元数据, 功能特性, 维护, 更新与清理), section headers, setting item titles, descriptions, placeholders, toggle descriptions, and dropdown option labels are presented in clear, idiomatic Simplified Chinese.

2. **Expanded i18n Baseline with Simplified Chinese (`zh-CN`)**:
   Incorporate `zh-CN` (Simplified Chinese) into the centralized internationalization text catalog alongside `zh-TW`, `en`, `ja`, and `ko`, setting `zh-CN` as the primary default Chinese locale. Chinese environment inputs (`zh`, `zh-CN`, `zh-Hans`) automatically resolve to `zh-CN`, while Traditional Chinese inputs (`zh-TW`, `zh-HK`, `zh-Hant`) continue resolving to `zh-TW`.

3. **Complete Localization of Secondary Management Modals**:
   Ensure all secondary dialogs and modals launched directly from the settings interface—including the Tag Manager, Version Updates (note filename reconciliation and duplicate cover cleanup), Bangumi Sync (diff review and sync summary), and Serial Cover Migration—are presented with complete, idiomatic Simplified Chinese copy, rules, progress indicators, and action buttons.

## User Stories

1. As a Chinese-speaking user, I want the Settings Tab navigation buttons to display in Simplified Chinese (常规, 搜索与元数据, 功能特性, 维护, 更新与清理), so that I can immediately understand and navigate each configuration area.
2. As a Chinese-speaking user, I want each settings page to display a clear Simplified Chinese overview description, so that I understand what each page governs before tweaking options.
3. As a Chinese-speaking user, I want to see "界面语言" with an explicit description explaining that setting the language changes the main interface while the settings tab stays in Chinese, so that I have clear expectations when choosing a display language.
4. As a Chinese-speaking user, I want the language selection dropdown to include "跟随系统", "简体中文", "繁体中文", "English", "日本語", and "한국어", so that I can switch display languages smoothly.
5. As a Chinese-speaking user, I want the Storage Layout setting to clearly explain "分类托管模式" (Managed Mode) and "单文件夹模式" (Flat Mode) in Simplified Chinese, so that I select the right folder structure for my vault.
6. As a Chinese-speaking user, I want the Library Root, Flat Media Folder, Additional Scan Folders, Cover Folder, and Template Folder setting names and descriptions to be in Simplified Chinese, so that I can configure my storage paths accurately without misunderstandings.
7. As a Chinese-speaking user, I want the Timeline Max Stack Depth setting and descriptions to be in Simplified Chinese, so that I can configure the layout density of my visual timeline.
8. As a Chinese-speaking user, I want metadata provider settings (Bangumi, AniList, Open Library) to describe their capabilities and language strengths in Simplified Chinese, so that I know which providers to enable for anime, manga, and novel metadata.
9. As a Chinese-speaking user, I want title search language toggles (中文标题, 英文标题, 原语言标题) and their descriptions to be in Simplified Chinese, so that I can control search discovery behavior intuitively.
10. As a Chinese-speaking user, I want the Maintenance page actions ("创建预设文件夹" and "复制内置模板") to have Chinese button labels, descriptions, and completion notices, so that initial library bootstrapping is straightforward.
11. As a Chinese-speaking user, I want the Storage Cleanup setting to explain safe deletion of unreferenced managed assets to Obsidian's trash in Simplified Chinese, so that I can safely reclaim disk space.
12. As a Chinese-speaking user, I want the Bangumi synchronization settings to use standard terminology (个人访问令牌 PAT, 连接测试, 同步时间窗口, 状态复选框, 启动时自动同步, 冷却时间, 批量同步) in Simplified Chinese, so that I can configure sync without cross-referencing external docs.
13. As a Chinese-speaking user, I want Bangumi connection testing feedback (such as "已连接", "请输入个人访问令牌") to be in Simplified Chinese, so that authentication errors or confirmations are immediately clear.
14. As a Chinese-speaking user, I want the Bangumi batch sync Diff Preview and Summary modals to show badges ("新增", "更新", "冲突", "已同步") and instructions in Simplified Chinese, so that I review pre-sync changes with confidence.
15. As a Chinese-speaking user, I want the Release Tracking settings to show clear Chinese options for enabling tracking, daily automatic checks, opening the dashboard, and managing tracked works, so that tracking ongoing series is easy to manage.
16. As a Chinese-speaking user, I want the Special Labels setting to explain "普通收藏 (Favorite)" and "神作分级 (Masterpiece)" modes in Simplified Chinese, so that I can choose my preferred rating categorization style.
17. As a Chinese-speaking user, I want the Serial Cover settings to explain Google Books API fallback configuration and missing cover loading in Simplified Chinese, so that I can resolve missing covers without guessing.
18. As a Chinese-speaking user, I want the Tag Manager modal launched from Settings to present search, addition, deletion, renaming, and work reference counts in Simplified Chinese, so that global tag curation is effortless.
19. As a Chinese-speaking user, I want the Note Filename Reconciliation modal in Version Updates to explain renaming safety rules and collision handling in Simplified Chinese before I confirm execution, so that I have zero anxiety about vault data integrity.
20. As a Chinese-speaking user, I want the Duplicate Note Cover Cleanup modal in Version Updates to clearly state which lines will be removed and display scanning progress in Simplified Chinese, so that I understand exactly what changes will take place.
21. As a Chinese-speaking user, I want the Legacy Metadata Cleanup modal to display step-by-step progress phases and results in Simplified Chinese, so that schema upgrades are transparent.
22. As a user operating in a non-Chinese interface language (e.g., English or Japanese), I want the Settings Tab to remain stably functional and predictable in Chinese without breaking or throwing missing-key exceptions, while the rest of the workspace reflects my chosen interface language.
23. As a Traditional Chinese user, I want the option to select `zh-TW` in the interface language setting so that my main library views, cards, and dialogs continue rendering in Traditional Chinese if preferred.

## Implementation Decisions

1. **Decoupled Settings Representation from Active Interface Locale**:
   - The settings tab renders all page descriptions, section headers, setting item names, hints, placeholders, dropdown items, and button labels directly in Simplified Chinese strings.
   - The legacy `withActiveLocale("en")` wrapper pattern is entirely removed from the settings tab and declarative settings definitions.
   - Changing the plugin interface language updates the main workspace, views, and notices, while the settings tab maintains a fixed, stable Simplified Chinese interface.

2. **Expanded Supported Locales and System Resolution**:
   - Add `zh-CN` to `SUPPORTED_LOCALES` (`["zh-CN", "zh-TW", "en", "ja", "ko"]`), designating `zh-CN` as the primary default locale (`DEFAULT_INTERFACE_LANGUAGE`).
   - Update `normalizeSupportedLocale` and `resolveInterfaceLocale`:
     - System locale or input starting with `zh-TW`, `zh-HK`, or `zh-Hant` normalizes to `zh-TW`.
     - System locale or input starting with `zh`, `zh-CN`, or `zh-Hans` normalizes to `zh-CN`.
   - Update `defineTextCatalog` and catalog registration so that `zh-CN` serves as the primary base message catalog across all 18 namespaces, while bundled catalogs for `zh-TW`, `en`, `ja`, and `ko` register their respective translations.

3. **Domain Glossary Alignment**:
   - Standardize terminology across settings and dialogs adhering to the updated `GLOSSARY.md`:
     - "分类托管模式" (Managed Mode) / "单文件夹模式" (Flat Mode)
     - "媒体库根目录" (Library Root)
     - "存储清理" / "清理无引用文件" (Storage Cleanup / Garbage Files)
     - "版本更新兼容维护" (Version Updates Maintenance)
     - "同步笔记文件名与作品标题" (Sync note filenames with titles)
     - "清理笔记内重复嵌入封面" (Remove duplicate note covers)
     - "旧版元数据规范升级" (Legacy metadata cleanup)
     - "Bangumi 同步" (Bangumi Synchronization)

4. **Secondary Modals Localization**:
   - Modals using the centralized i18n text catalog (e.g., Tag Manager, Legacy Metadata Cleanup, Serial Cover Migration, Bangumi Sync) receive complete, polished Simplified Chinese message sets in `src/i18n/locales/zh-CN/`.
   - Modals with hardcoded UI text (e.g., `DuplicateCoverCleanupModal`, `MediaNoteFilenameCleanupModal`) are rewritten with precise Simplified Chinese rule lists, status counters, and confirmation buttons.

5. **Deprecate Legacy Standards and Record Architecture Decisions**:
   - Record ADR `docs/adr/0003-simplified-chinese-settings-and-i18n-baseline.md`.
   - Update `CODING_STANDARDS.md` to formally deprecate "English settings page" and mandate "Simplified Chinese settings page".
   - Update and re-align existing unit and contract tests that previously asserted English copy on settings surfaces.

## Testing Decisions

- **External Behavior Verification**:
  - Test setting surfaces from the highest public seam (`AnimeListSettingTab.getSettingSections()` and `AnimeListSettingTab.getSettingDefinitions()`), verifying that all tab headers, section titles, setting names, and descriptions across all five pages contain valid Simplified Chinese text.
  - Verify settings stability under foreign active locales: when `setActiveLocale("en")` or `setActiveLocale("ja")` is executed, the settings tab definitions must continue producing Chinese text without throwing or falling back unexpectedly.
- **i18n Catalog Parity Testing**:
  - Extend `tests/contracts/text-catalog.test.ts` to assert that `zh-CN` is registered and contains 100% of required keys and interpolation placeholders matching the reference catalog across all 18 namespaces.
  - Test locale normalization logic across diverse inputs (`zh-CN`, `zh_CN`, `zh-Hans`, `zh-TW`, `zh-HK`, `zh-Hant`, `en-US`, `ja-JP`, `ko-KR`).
- **Secondary Modals DOM Testing**:
  - Verify modal opening and rendered rule/status elements in `DuplicateCoverCleanupModal`, `MediaNoteFilenameCleanupModal`, and `UserTagManagerModal` to ensure all visible strings are in Simplified Chinese.
- **Prior Art**:
  - `tests/search-settings.test.ts` (declarative and imperative settings inspection).
  - `tests/contracts/text-catalog.test.ts` (catalog completeness and placeholder verification).
  - `tests/user-tag-settings.test.ts` (settings section and modal triggering).

## Out of Scope

- Translation into languages outside the five supported locales (`zh-CN`, `zh-TW`, `en`, `ja`, `ko`).
- Modifying stored vault frontmatter keys or Markdown content schema (e.g., `status`, `score`, `title` frontmatter properties remain identical).
- Changing provider API response payloads or external data structures.

## Further Notes

All source code comments, commit messages, and internal type names remain in English in accordance with repository standards. User-facing strings in the settings tab and modals are in Simplified Chinese.
