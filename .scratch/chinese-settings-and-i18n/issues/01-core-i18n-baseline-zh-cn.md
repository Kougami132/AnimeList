# 01: Core i18n Baseline & Locale Resolution for zh-CN

**What to build:** Introduce `zh-CN` (Simplified Chinese) into the centralized internationalization text catalog as the default primary Chinese locale, update locale resolution so that Chinese system preferences resolve seamlessly to Simplified Chinese (while preserving `zh-TW` for Traditional Chinese preferences), and ensure all 18 catalog namespaces are completely translated with matching interpolation placeholders.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] `SUPPORTED_LOCALES` in `src/i18n/locale.ts` includes `"zh-CN"`, `"zh-TW"`, `"en"`, `"ja"`, and `"ko"`, with `"zh-CN"` as `DEFAULT_INTERFACE_LANGUAGE`.
- [x] `normalizeSupportedLocale` and `resolveInterfaceLocale` correctly resolve `zh`, `zh-CN`, and `zh-Hans` to `zh-CN`, and `zh-TW`, `zh-HK`, and `zh-Hant` to `zh-TW`.
- [x] Complete Simplified Chinese catalog files for all 18 namespaces are added under `src/i18n/locales/zh-CN/` and registered in `BUNDLED_LOCALE_CATALOGS`.
- [x] Any lingering English strings in `zh-TW` catalogs (such as user-tag and legacy-metadata) are translated to Chinese.
- [x] `tests/contracts/text-catalog.test.ts` validates that `zh-CN` is fully registered with matching keys and matching interpolation placeholders across all 18 namespaces.
