# AnimeList Enhanced

AnimeList Enhanced is a local-first Obsidian plugin for tracking anime, manga, and novels in ordinary Markdown files. It provides a shared workspace for the Library, Timeline, Score Dashboard, and Images, plus Bangumi two-way synchronization & writeback, metadata search, local covers, progress tracking, ratings, templates, release tracking, reusable note media, and portable Library export.

This project is an enhanced fork of the original [cwh555/AnimeList](https://github.com/cwh555/AnimeList).

> [!NOTE]
> [中文说明文档 (Chinese README)](./README.md) is also available.

Your Markdown notes remain the source of truth. Removing the plugin does not remove your records, notes, or images.

> [!CAUTION]
> **Existing libraries and update cleanup**
>
> Existing 1.4.0 and older libraries remain readable without an automatic startup migration. Older notes may still be missing classification metadata introduced in 1.3, and older generated note bodies may contain a redundant standalone cover below `animelist-detail`. Back up or sync the vault before using **Settings → Updates & cleanup**. The available cleanup tools are explicit, review-first operations and preserve unrelated frontmatter and Markdown body content.

<table>
  <tr>
    <td width="50%" align="center">
      <img src="docs/images/library-card.png" alt="AnimeList library in card view" width="100%"><br>
      <sub><b>Library</b></sub>
    </td>
    <td width="50%" align="center">
      <img src="docs/images/score-dashboard.png" alt="AnimeList Score Dashboard"><br>
      <sub><b>Score Dashboard</b></sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="docs/images/image-session.png" alt="AnimeList note with reusable image and Moment sections" width="100%"><br>
      <sub><b>Note media</b></sub>
    </td>
    <td width="50%" align="center">
      <img src="docs/images/timeline.png" alt="AnimeList completion timeline"><br>
      <sub><b>Timeline</b></sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="docs/images/image-library.png" alt="AnimeList image library"><br>
      <sub><b>Image Library</b></sub>
    </td>
    <td width="50%" align="center">
      <img src="docs/images/tracking.png" alt="AnimeList latest tracking"><br>
      <sub><b>Tracking</b></sub>
    </td>
  </tr>
</table>

## Key Enhancements over Upstream (cwh555/AnimeList)

- **Bangumi Two-Way Sync**: Fetch and synchronize collection status, watch progress, and ratings between Bangumi and local Markdown notes, complete with customizable sync windows and diff preview conflict resolution.
- **Bangumi Writeback**: Auto-push watching progress, status, and scores on manual edit with smart dirty checking, plus explicit manual push commands and detail-view push actions.
- **Native Simplified Chinese (`zh-CN`) Support**: Native Simplified Chinese UI localization and completely rewritten native tabbed Settings in Simplified Chinese.
- **Broadcasting Season Alignment**: Accurately resolves anime broadcasting seasons based on industry schedule and provider metadata instead of naive calendar-month thresholds.
- **Score Dashboard Filters**: Full multi-dimensional filtering (studios, quarters, user tags) matching the main Library view.
- **Seamless Upgrade & Migration**: Full backward compatibility with existing `animelist` code blocks and automatic legacy configuration migration from `animelist/data.json`.

## Features

- One Markdown-based library for anime, manga, and novels.
- Metadata search through Bangumi, AniList, and Open Library, with structured classification metadata for supported works.
- Card, list, and poster views with search, sorting, combined company/quarter/tag filters, and persisted Card/Thumbnail row-density controls.
- Media-specific progress tracking and dated serial entries with optional per-entry covers.
- Optional manga/novel latest-release tracking that is separate from personal reading progress.
- Reusable Image Sections and Moments stored directly in ordinary Markdown notes, including masonry image ordering and optional whole-image stacked Moments.
- A shared AnimeList workspace for Library, Timeline, Score Dashboard, and Images.
- An Images browser derived from existing Image Sections without copying source assets.
- A Score Dashboard for direct and batch rating changes.
- Favorite mode or reusable Masterpiece categories.
- A pannable, independently scalable completion timeline with History mode and a density overview.
- Versioned JSON and readable Text Library export with safe templates.
- Local series, serial-entry, Image Section, and Moment images with safe reference-aware cleanup.
- Simplified Chinese, Traditional Chinese, English, Japanese, and Korean interface support.
- Desktop and mobile support without a Dataview dependency.

## Installation

### Community plugins

1. Open **Settings → Community plugins** in Obsidian.
2. Select **Browse** and search for **AnimeList Enhanced**.
3. Install and enable the plugin.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the matching GitHub release.
2. Copy them into `<vault>/.obsidian/plugins/animelist-enhanced/`.
3. Reload Obsidian and enable **AnimeList Enhanced** under **Community plugins**.

## Metadata, network access, and privacy

- Search and enrichment queries are sent only to enabled metadata providers.
- Release tracking, when enabled, contacts its configured public metadata/catalog sources and supported official public chapter pages; it does not send personal ratings, progress, dates, or note-body text.
- Bangumi sync and writeback communicate strictly with official Bangumi APIs via secure user access tokens without third-party proxy servers.
- Personal ratings, progress, dates, labels, Moments text, and note content stay in the vault.
- Covers and note-media images are stored locally when available, with remote-image fallback only where the relevant feature supports it.
- AnimeList Enhanced does not include telemetry or a private remote library database.

## Credits

Special thanks to [cwh555](https://github.com/cwh555) for the original [AnimeList](https://github.com/cwh555/AnimeList) plugin architecture and implementation.

## License

[MIT](LICENSE)
