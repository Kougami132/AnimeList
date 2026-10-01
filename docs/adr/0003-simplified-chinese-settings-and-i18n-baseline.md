# Simplified Chinese Settings and Interface i18n Baseline

We rewrite all text in Obsidian's AnimeList Settings Tab directly into Simplified Chinese (hardcoded), while adding `zh-CN` as the primary Chinese locale alongside `zh-TW`, `en`, `ja`, and `ko` in the centralized i18n catalog.

Context and trade-offs:
1. Previously, settings were artificially locked to English via `withActiveLocale("en")` to avoid maintaining settings translations across all four locales. However, this created a jarring user experience for Chinese-speaking users, who comprise the primary user base for Bangumi and anime tracking.
2. Rewriting the settings page directly in Simplified Chinese removes translation indirection and prevents drift, while keeping the main workspace and views (Library, Timeline, Score Dashboard, Modals) fully internationalized with `zh-CN` as a first-class supported locale.
