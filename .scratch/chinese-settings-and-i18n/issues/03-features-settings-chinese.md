# 03: Features Settings Sections Simplified Chinese Rewrite

**What to build:** Rewrite all feature-specific settings sections under the Features (功能特性) page into idiomatic Simplified Chinese, covering Bangumi Synchronization, Release Tracking, User Tags, Special Labels (Masterpiece), Serial Covers, and Library Layout Density.

**Blocked by:** 01: Core i18n Baseline & Locale Resolution for zh-CN

**Status:** resolved

- [x] Bangumi sync settings section is rewritten in Simplified Chinese: PAT input and placeholder, test connection button, test feedback ("已连接", "请输入个人访问令牌"), sync window (days), collection status checkboxes (在看, 看过, 想看, 搁置, 抛弃), startup auto-sync toggle, auto-sync cooldown (minutes), and batch sync button.
- [x] Release tracking settings section is rewritten in Simplified Chinese: tracking toggle, daily automatic check toggle, dashboard button, and manage tracked works button.
- [x] User tags settings section is rewritten in Simplified Chinese: section heading, tag manager setting name, description, and "管理标签…" launcher button.
- [x] Special labels (Masterpiece) settings section is rewritten in Simplified Chinese: mode dropdown ("普通收藏 (Favorite)", "神作分级 (Masterpiece)") and descriptions.
- [x] Serial cover settings section is rewritten in Simplified Chinese: Google Books API key input, descriptions, and placeholder.
- [x] Library layout settings section is rewritten in Simplified Chinese: "卡片视图每行数量" and "缩略图视图每行数量" sliders and descriptions.
- [x] Affected tests (such as `tests/user-tag-settings.test.ts` and `tests/library-layout.test.ts`) are updated to assert the new Simplified Chinese settings copy.
