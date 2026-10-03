# Score Dashboard Screenshot Rasterization and Export

## Context

Users track ratings for dozens or hundreds of anime, manga, and novel entries in the AnimeList score dashboard. A primary sharing use case is exporting the entire tier board as a standalone, high-resolution long screenshot (评分看板长图) to share in community forums or social media.

Capturing the score dashboard presents unique challenges:
1. **Vertical overflow**: The board spans 21 score tiers (10.0 to 1.0 plus unrated) and easily exceeds the visible scroll viewport. A naive viewport screencap truncates the majority of the collection.
2. **Interactive clutter**: The live dashboard includes navigation tabs, search/filter buttons, batch management bars, and zoom sliders. Exporting these interactive controls degrades the presentation of the tier list.
3. **Canvas tainting and reliability**: Naive DOM-to-image techniques (such as SVG `<foreignObject>` or third-party DOM serialization libraries) frequently encounter cross-origin image tainting, font-rendering mismatches, and severe bundle bloat. If any cover image taints the canvas, `canvas.toBlob()` throws a `SecurityError`, entirely breaking clipboard copy and file export.

## Decision

We adopt deterministic 2D Canvas synthesis with an interactive preview modal and native file system export:

1. **Canvas 2D Long-board Synthesis**:
   - Synthesize the entire board at 2x device pixel ratio (Retina sharpness) using standard Canvas 2D primitives.
   - Render a polished informational header (title, media type badge, rating count, average score, and export timestamp) while omitting interactive buttons and sliders.
   - Mirror the dashboard domain model (`buildScoreDashboardData` and `scoreDashboardPosterMetrics`), laying out score groups, lanes, and posters systematically.
   - Preload cover images with a 3-second timeout, falling back gracefully to media-type vector placeholders (clapperboard for anime, book for reading media) upon load failure.

2. **WYSIWYG Theme Sampling**:
   - Query active Obsidian CSS variables (`--background-primary`, `--background-secondary`, `--text-normal`, `--text-muted`, `--interactive-accent`, `--al-score-color`) at render time so the exported image naturally matches the user's active dark or light theme.

3. **Preview Modal with Dual Actions**:
   - Render a scrollable preview modal (`ScoreDashboardScreenshotModal`) displaying the synthesized long image and metadata (dimensions and byte size).
   - **Copy Button**: Writes the PNG blob directly to the system clipboard via `copyPngBlobToClipboard`, providing temporary visual feedback ("已复制 ✓") and an Obsidian notice.
   - **Download Button**: Invokes the OS-native Save File Picker (`window.showSaveFilePicker`) with sensible defaults (`AnimeList-评分看板-{媒体分类}-{时间戳}.png`), smoothly falling back to standard anchor download on environments where the File System Access API is unavailable.
   - Canceling the save dialog is handled silently without error notices, keeping the preview modal open.

## Consequences & Trade-offs

- **Security & Portability**: Direct canvas drawing with preloaded images avoids canvas tainting, ensuring reliable clipboard writes and downloads across desktop and mobile.
- **Visual Quality**: Fixed 2x scaling provides clean, high-density text and artwork suitable for social sharing and zooming.
- **Memory Responsibility**: Bitmap and Object URL resources are explicitly revoked upon preview modal closure.
- **Trade-off on Layout Sync**: Any future CSS layout adjustments to score dashboard poster metrics must maintain parity with the canvas layout metrics.
