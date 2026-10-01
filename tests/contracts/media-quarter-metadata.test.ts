import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TFile } from "obsidian";
import {
  normalizeAniListClassification,
  resolveMediaSeasonMetadata,
} from "../../src/domain/media-classification";
import type { ExternalMediaResult } from "../../src/domain/media-types";
import { buildMediaMarkdown } from "../../src/data/media-note-codec";
import { cleanupLegacyMetadataNotes } from "../../src/data/legacy-metadata-cleanup";
import { mediaClassificationFieldValues } from "../../src/ui/media-classification-fields";
import { mediaQuarterLabel } from "../../src/ui/media-quarter-label";

function animeResult(overrides: Partial<ExternalMediaResult> = {}): ExternalMediaResult {
  return {
    provider: "bangumi",
    sourceId: "bgm-quarter",
    sourceUrl: "https://bgm.tv/subject/quarter",
    mediaType: "anime",
    title: "Quarter test",
    originalTitle: "Quarter test",
    romajiTitle: "Quarter test",
    format: "tv",
    year: 2025,
    coverUrl: "",
    genres: ["戀愛"],
    rawGenres: ["戀愛"],
    people: ["Studio"],
    platforms: [],
    total: 24,
    unit: "episode",
    summary: "",
    externalScore: null,
    releaseStatus: "releasing",
    searchTitles: ["Quarter test"],
    sources: [{ provider: "bangumi", sourceId: "bgm-quarter", sourceUrl: "https://bgm.tv/subject/quarter" }],
    ...overrides,
  };
}

function noteFrontmatter(markdown: string): string {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, "generated note must start with YAML frontmatter");
  return match[1];
}

describe("anime broadcasting season quarter metadata", () => {
  it("prioritizes provider explicit broadcasting season ahead of calendar start month", () => {
    const metadata = resolveMediaSeasonMetadata({
      season: "spring",
      seasonYear: 2024,
      startDate: { year: 2024, month: 3, day: 31 },
    });
    assert.deepEqual(metadata, { season: "spring", seasonYear: 2024 });

    const classification = normalizeAniListClassification({
      id: 42,
      genres: [],
      tags: [],
      studios: { nodes: [] },
      season: "SPRING",
      seasonYear: 2024,
      startDate: { year: 2024, month: 3, day: 31 },
      source: "ORIGINAL",
      countryOfOrigin: "JP",
    });
    assert.equal(classification?.season, "spring");
    assert.equal(classification?.seasonYear, 2024);
  });

  it("correctly classifies June 30 broadcast as summer (Q3) when provider or tags specify summer season", () => {
    const fromProvider = resolveMediaSeasonMetadata({
      season: "summer",
      seasonYear: 2026,
      startDate: { year: 2026, month: 6, day: 30 },
    });
    assert.deepEqual(fromProvider, { season: "summer", seasonYear: 2026 });

    const fromTags = resolveMediaSeasonMetadata({
      startDate: { year: 2026, month: 6, day: 30 },
      tagValues: ["2026年7月", "轻小说改"],
    });
    assert.deepEqual(fromTags, { season: "summer", seasonYear: 2026 });

    const markdown = buildMediaMarkdown(animeResult({
      startDate: { year: 2026, month: 6, day: 30 },
      classification: {
        anilistId: "196219",
        genres: ["戀愛"],
        tags: [],
        season: "summer",
        seasonYear: 2026,
        studios: ["MagicBus"],
        source: "LIGHT_NOVEL",
        countryOfOrigin: "JP",
      },
    }), {
      title: "无自觉圣女今天也无意识地释放力量",
      score: null,
      status: "ongoing",
      releaseStatus: "unknown",
      startedAt: "2026-06-30",
      completedAt: "",
      progress: 0,
      total: 12,
      unit: "episode",
      favorite: false,
      genres: ["戀愛"],
      templatePath: "",
      volumeLog: [],
    }, "", "");
    const yaml = noteFrontmatter(markdown);
    assert.match(yaml, /^season: "summer"$/m);
    assert.match(yaml, /^season_year: 2026$/m);
  });

  it("aligns cross-year winter anime airing in late December with the winter season year", () => {
    const crossYear = resolveMediaSeasonMetadata({
      season: "winter",
      seasonYear: 2026,
      startDate: { year: 2025, month: 12, day: 29 },
    });
    assert.deepEqual(crossYear, { season: "winter", seasonYear: 2026 });

    const result = animeResult({
      startDate: { year: 2025, month: 12, day: 29 },
      classification: {
        anilistId: "99999",
        genres: ["奇幻"],
        tags: [],
        season: "winter",
        seasonYear: 2026,
        studios: ["Studio"],
        source: "MANGA",
        countryOfOrigin: "JP",
      },
    });
    const quarter = mediaClassificationFieldValues(result).find((row) => row.key === "season");
    assert.equal(quarter?.value, "2026 Q1 (冬季)");
  });

  it("falls back to calendar start month only when explicit season and tags are unavailable", () => {
    assert.deepEqual(resolveMediaSeasonMetadata({
      startDate: { year: 2025, month: 6, day: 30 },
    }), { season: "spring", seasonYear: 2025 });

    assert.deepEqual(resolveMediaSeasonMetadata({
      season: "summer",
      seasonYear: 2025,
      startDate: { year: 2025, month: null, day: null },
    }), { season: "summer", seasonYear: 2025 });
  });

  it("keeps UI quarter display aligned with broadcasting season and hides year-only pseudo-quarters", () => {
    const result = animeResult({
      startDate: { year: 2025, month: 3, day: 31 },
      classification: {
        anilistId: "42",
        genres: ["戀愛"],
        tags: [],
        season: "spring",
        seasonYear: 2025,
        studios: ["Studio"],
        source: "original",
        countryOfOrigin: "JP",
      },
    });
    const quarter = mediaClassificationFieldValues(result).find((row) => row.key === "season");
    assert.equal(quarter?.value, "2025 Q2 (春季)");
    assert.equal(mediaQuarterLabel(null, 2025), "");
  });

  it("persists quarter from provider startDate even without AniList classification", () => {
    const markdown = buildMediaMarkdown(animeResult({
      startDate: { year: 2025, month: 7, day: 4 },
      classification: undefined,
    }), {
      title: "Cross-season show",
      score: null,
      status: "ongoing",
      releaseStatus: "unknown",
      startedAt: "",
      completedAt: "",
      progress: 14,
      total: 24,
      unit: "episode",
      favorite: false,
      genres: ["戀愛"],
      templatePath: "",
      volumeLog: [],
    }, "", "");
    const yaml = noteFrontmatter(markdown);
    assert.match(yaml, /^season: "summer"$/m);
    assert.match(yaml, /^season_year: 2025$/m);
  });

  it("backfills a missing quarter when an old note already has only season_year", async () => {
    const frontmatter: Record<string, unknown> = {
      schema_version: 6,
      media_type: "anime",
      source_provider: "bangumi",
      source_id: "quarter-only",
      source_urls: ["https://bgm.tv/subject/quarter-only"],
      anilist_id: "12345",
      title: "Cross-season show",
      year: 2025,
      season_year: 2025,
      genres: ["戀愛"],
      studios: ["Studio"],
    };
    const file = new TFile();
    file.path = "AnimeList/Anime/Cross-season show.md";
    file.basename = "Cross-season show";
    file.extension = "md";
    const app = {
      metadataCache: { getFileCache: () => ({ frontmatter }) },
      vault: { getRoot: () => ({ children: [file] }) },
      fileManager: {
        async processFrontMatter(_file: unknown, callback: (value: Record<string, unknown>) => void) {
          callback(frontmatter);
        },
      },
    } as any;

    const result = await cleanupLegacyMetadataNotes(app, [""], {
      apiIntervalMs: 0,
      enrich: async (source) => ({
        ...source,
        startDate: { year: 2025, month: 10, day: 3 },
      }),
    });

    assert.equal(frontmatter.season, "fall");
    assert.equal(frontmatter.season_year, 2025);
    assert.deepEqual(result.details[0]?.changes, ["season"]);
  });

  it("corrects a misclassified season during legacy metadata cleanup", async () => {
    const frontmatter: Record<string, unknown> = {
      schema_version: 6,
      media_type: "anime",
      source_provider: "bangumi",
      source_id: "571910",
      source_urls: ["https://bgm.tv/subject/571910"],
      anilist_id: "196219",
      title: "无自觉圣女今天也无意识地释放力量",
      year: 2026,
      season: "spring",
      season_year: 2026,
      source_genres: ["2026年7月", "轻小说改"],
      genres: ["戀愛"],
      studios: ["MagicBus"],
    };
    const file = new TFile();
    file.path = "AnimeList/Anime/无自觉圣女今天也无意识地释放力量.md";
    file.basename = "无自觉圣女今天也无意识地释放力量";
    file.extension = "md";
    const app = {
      metadataCache: { getFileCache: () => ({ frontmatter }) },
      vault: { getRoot: () => ({ children: [file] }) },
      fileManager: {
        async processFrontMatter(_file: unknown, callback: (value: Record<string, unknown>) => void) {
          callback(frontmatter);
        },
      },
    } as any;

    const result = await cleanupLegacyMetadataNotes(app, [""], {
      apiIntervalMs: 0,
      enrich: async (source) => ({
        ...source,
        startDate: { year: 2026, month: 6, day: 30 },
        classification: {
          anilistId: "196219",
          genres: ["戀愛"],
          tags: [],
          season: "summer",
          seasonYear: 2026,
          studios: ["MagicBus"],
          source: "LIGHT_NOVEL",
          countryOfOrigin: "JP",
        },
      }),
    });

    assert.equal(frontmatter.season, "summer");
    assert.equal(frontmatter.season_year, 2026);
    assert.ok(result.details[0]?.changes.includes("season"));
  });
});
