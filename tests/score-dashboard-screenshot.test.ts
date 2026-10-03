import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildScoreDashboardData } from "../src/domain/score-dashboard/model";
import { planScoreDashboardScreenshot } from "../src/domain/score-dashboard/screenshot-layout";
import { formatByteSize } from "../src/ui/score-dashboard/screenshot-modal";
import { scoreColor } from "../src/ui/score-dashboard/screenshot-raster";
import { downloadPngBlobWithPicker } from "../src/ui/score-dashboard/screenshot-download";
import { renderScoreDashboard, type ScoreDashboardUiAdapters } from "../src/ui/score-dashboard/renderer";
import type { MediaItem } from "../src/types";

function mockMediaItem(title: string, score: number | null, mediaType: "anime" | "manga" | "novel" = "anime"): MediaItem {
  return {
    filePath: `media/${title}.md`,
    title,
    originalTitle: title,
    mediaType,
    format: mediaType,
    status: "completed",
    releaseStatus: "completed",
    progress: 12,
    total: 12,
    unit: "ep",
    score,
    favorite: false,
    year: "2024",
    genres: [],
    mediaTags: [],
    userTags: [],
    season: "spring",
    seasonYear: "2024",
    sourceMaterial: "",
    countryOfOrigin: "JP",
    anilistId: "",
    people: [],
    platforms: [],
    sourceUrls: [],
    cover: `covers/${title}.webp`,
    updated: 1700000000,
    updatedLabel: "",
  };
}

describe("score dashboard screenshot layout planning", () => {
  it("calculates accurate board and lane layout with row wrapping and stats", () => {
    const items: MediaItem[] = [
      mockMediaItem("Masterpiece 1", 10),
      mockMediaItem("Masterpiece 2", 10),
      mockMediaItem("Great 1", 9.5),
      mockMediaItem("Good 1", 8.0),
      mockMediaItem("Unrated 1", null),
    ];

    const data = buildScoreDashboardData(items, "anime");
    const plan = planScoreDashboardScreenshot(data, { showUnrated: true });

    assert.equal(plan.width, 1080);
    assert.ok(plan.height > 200);
    assert.equal(plan.stats.total, 5);
    assert.equal(plan.stats.rated, 4);
    assert.equal(plan.stats.averageScore, "9.4"); // (10 + 10 + 9.5 + 8) / 4 = 37.5 / 4 = 9.375 -> "9.4"

    // Group 10
    const group10 = plan.groups.find((g) => g.major === 10);
    assert.ok(group10);
    assert.equal(group10.itemCount, 2);
    assert.equal(group10.lanes.length, 1);
    assert.equal(group10.lanes[0].posters.length, 2);
    assert.equal(group10.lanes[0].empty, false);

    // Group 9
    const group9 = plan.groups.find((g) => g.major === 9);
    assert.ok(group9);
    assert.equal(group9.itemCount, 1);
    assert.equal(group9.lanes.length, 2); // 9.5 and 9.0
    const lane95 = group9.lanes.find((l) => l.score === 9.5);
    const lane90 = group9.lanes.find((l) => l.score === 9.0);
    assert.ok(lane95);
    assert.ok(lane90);
    assert.equal(lane95.posters.length, 1);
    assert.equal(lane90.posters.length, 0);
    assert.equal(lane90.empty, true);

    // Unrated group
    const unratedGroup = plan.groups.find((g) => g.major === null);
    assert.ok(unratedGroup);
    assert.equal(unratedGroup.itemCount, 1);
    assert.equal(unratedGroup.lanes[0].posters.length, 1);
  });

  it("omits unrated group when showUnrated is false", () => {
    const items: MediaItem[] = [
      mockMediaItem("Rated 1", 9.0),
      mockMediaItem("Unrated 1", null),
    ];

    const data = buildScoreDashboardData(items, "all");
    const plan = planScoreDashboardScreenshot(data, { showUnrated: false });

    const unratedGroup = plan.groups.find((g) => g.major === null);
    assert.equal(unratedGroup, undefined);
    assert.equal(plan.stats.rated, 1);
    assert.equal(plan.stats.total, 2);
  });

  it("wraps posters to multiple rows when a lane exceeds single-row capacity", () => {
    const items: MediaItem[] = Array.from({ length: 25 }, (_, i) => (
      mockMediaItem(`Item ${i + 1}`, 8.5)
    ));

    const data = buildScoreDashboardData(items, "anime");
    const plan = planScoreDashboardScreenshot(data, { showUnrated: false });

    const group8 = plan.groups.find((g) => g.major === 8);
    assert.ok(group8);
    const lane85 = group8.lanes.find((l) => l.score === 8.5);
    assert.ok(lane85);
    assert.equal(lane85.posters.length, 25);
    assert.ok(lane85.laneBox.height > 250); // multiple rows
  });
});

describe("score dashboard screenshot utilities", () => {
  it("formats file size in human-readable units", () => {
    assert.equal(formatByteSize(512), "512 B");
    assert.equal(formatByteSize(1024 * 50), "50.0 KB");
    assert.equal(formatByteSize(1024 * 1024 * 3.5), "3.5 MB");
  });

  it("calculates score colors consistently", () => {
    assert.match(scoreColor(10), /^hsl\(\d+ 72% 62%\)$/);
    assert.match(scoreColor(5), /^hsl\(\d+ 72% 62%\)$/);
    assert.notEqual(scoreColor(10), scoreColor(1));
  });

  it("handles native save file picker and graceful cancellation", async () => {
    let writeCalled = false;
    let closedCalled = false;
    const mockWritable = {
      write: async () => { writeCalled = true; },
      close: async () => { closedCalled = true; },
    };

    const originalWindow = globalThis.window;
    (globalThis as any).window = {
      showSaveFilePicker: async () => ({
        createWritable: async () => mockWritable,
      }),
    };

    try {
      const blob = new Blob(["test"], { type: "image/png" });
      await downloadPngBlobWithPicker(blob, "test.png");
      assert.equal(writeCalled, true);
      assert.equal(closedCalled, true);
    } finally {
      (globalThis as any).window = originalWindow;
    }
  });

  it("silently ignores AbortError on picker cancellation", async () => {
    const originalWindow = globalThis.window;
    (globalThis as any).window = {
      showSaveFilePicker: async () => {
        const error = new Error("User cancelled");
        error.name = "AbortError";
        throw error;
      },
    };

    try {
      const blob = new Blob(["test"], { type: "image/png" });
      // Should not throw
      await downloadPngBlobWithPicker(blob, "cancelled.png");
    } finally {
      (globalThis as any).window = originalWindow;
    }
  });
});
