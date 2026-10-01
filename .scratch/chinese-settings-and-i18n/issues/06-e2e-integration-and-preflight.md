# 06: End-to-End Settings Integration Verification & Preflight Check

**What to build:** Perform complete end-to-end verification across both declarative (Obsidian 1.13+) and imperative settings lifecycles, ensuring settings search indexing operates flawlessly with Simplified Chinese strings, and executing the full preflight test suite and static type check to ensure zero regressions.

**Blocked by:** 03: Features Settings Sections Simplified Chinese Rewrite, 05: Secondary Management Modals Simplified Chinese Rewrite

**Status:** resolved

- [x] Declarative settings tree (`AnimeListSettingTab.getSettingDefinitions()`) produces searchable items with Chinese names and descriptions matching the imperative render tree.
- [x] Switching between all five settings tabs (`general`, `search-metadata`, `features`, `maintenance`, `updates-cleanup`) functions properly via mouse click and keyboard arrow navigation.
- [x] Dynamic visibility logic (such as `libraryRoot` visible only when Managed mode is active, and `flatMediaFolder` visible only when Flat mode is active) functions correctly with Chinese settings labels.
- [x] Full quality check pass: `npm run check` (TypeScript standard compilation, `tsconfig.strict.json` strict type check, ESLint, architecture boundary checks, and full 570+ test suite).
