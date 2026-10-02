# 03: Push On Edit Setting and Multi-language Localization

**What to build:** User configuration toggle and comprehensive multi-language text catalogs for the manual writeback feature. Users can enable or disable "Push to Bangumi on edit" in the Bangumi Synchronization settings tab (defaulting to enabled). Success, failure, and informational notices are fully translated into all five supported languages.

**Blocked by:** 01: Bangumi Client Upsert and Single Note Push Core

**Status:** ready-for-agent

- [x] Add `bangumiPushOnEdit: boolean` to `AnimeListSettings` with a default value of `true` and safe normalization
- [x] Add a toggle setting under Bangumi Synchronization in the plugin settings tab with clear descriptive text
- [x] Add localized string keys for push success, push error, push network failure, and settings labels across all supported locales (`zh-CN`, `zh-TW`, `en`, `ja`, `ko`)
- [x] Ensure settings page follows the project standard of Simplified Chinese while UI notices respect catalog translations
- [x] Include unit tests verifying default settings and normalization for the new configuration option
