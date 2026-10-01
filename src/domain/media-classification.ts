import { normalizeGenres, normalizeStructuredAnimationStudios } from "./media-metadata";
import { asArray, stringValue } from "./value-normalization";

export const MEDIA_TAG_MIN_RANK = 60;

export type MediaSeason = "winter" | "spring" | "summer" | "fall";

export interface MediaTagMetadata {
  name: string;
  category: string;
  rank: number;
  isGeneralSpoiler: boolean;
  isMediaSpoiler: boolean;
  isAdult: boolean;
}

export interface MediaClassification {
  anilistId: string;
  genres: string[];
  tags: MediaTagMetadata[];
  season: MediaSeason | null;
  seasonYear: number | null;
  studios: string[];
  source: string;
  countryOfOrigin: string;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function optionalInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export function normalizeMediaSeason(value: unknown): MediaSeason | null {
  const season = stringValue(value).toLocaleLowerCase();
  return season === "winter" || season === "spring" || season === "summer" || season === "fall"
    ? season
    : null;
}

const DATE_SEASON_TOKEN = /(?:^|\D)((?:19|20)\d{2})\s*(?:年|[-/.])\s*(1[0-2]|0?[1-9])\s*(?:月)?(?:\D|$)/;
const YEAR_SEASON_TOKEN = /(?:^|\D)((?:19|20)\d{2})\s*(?:年)?\s*(春|夏|秋|冬)(?:季|度)?(?:\D|$)/;
const MONTH_ONLY_TOKEN = /(?:^|\D)(1[0-2]|0?[1-9])\s*月(?:\D|$)/;

export function mediaSeasonFromValue(value: unknown): MediaSeason | null {
  const normalized = stringValue(value).normalize("NFKC").trim().toLocaleLowerCase();
  if (!normalized) return null;
  if (normalized === "winter" || normalized === "q1" || /冬/.test(normalized)) return "winter";
  if (normalized === "spring" || normalized === "q2" || /春/.test(normalized)) return "spring";
  if (normalized === "summer" || normalized === "q3" || /夏/.test(normalized)) return "summer";
  if (normalized === "fall" || normalized === "autumn" || normalized === "q4" || /秋/.test(normalized)) return "fall";
  const monthMatch = normalized.match(MONTH_ONLY_TOKEN);
  if (monthMatch) {
    return mediaSeasonFromMonth(Number(monthMatch[1]));
  }
  return null;
}

export function mediaSeasonFromTagValues(
  values: readonly unknown[],
  fallbackYear: unknown = null,
): MediaSeasonMetadata {
  let season: MediaSeason | null = null;
  let seasonYear: number | null = null;

  for (const raw of values) {
    const text = stringValue(raw).normalize("NFKC").trim();
    if (!text) continue;

    const dateMatch = text.match(DATE_SEASON_TOKEN);
    if (dateMatch) {
      const year = Number(dateMatch[1]);
      const month = Number(dateMatch[2]);
      if (Number.isInteger(year)) seasonYear ??= year;
      const s = mediaSeasonFromMonth(month);
      if (s) season ??= s;
      if (season && seasonYear !== null) break;
      continue;
    }

    const yearSeasonMatch = text.match(YEAR_SEASON_TOKEN);
    if (yearSeasonMatch) {
      const year = Number(yearSeasonMatch[1]);
      if (Number.isInteger(year)) seasonYear ??= year;
      const s = mediaSeasonFromValue(yearSeasonMatch[2]);
      if (s) season ??= s;
      if (season && seasonYear !== null) break;
      continue;
    }

    const s = mediaSeasonFromValue(text);
    if (s) season ??= s;
    if (season && seasonYear !== null) break;
  }

  const fallback = optionalInteger(fallbackYear);
  if (seasonYear === null && fallback !== null && fallback > 0) {
    seasonYear = fallback;
  }

  return { season, seasonYear };
}

export function mediaSeasonFromMonth(value: unknown): MediaSeason | null {
  const month = optionalInteger(value);
  if (month === null || month < 1 || month > 12) return null;
  if (month <= 3) return "winter";
  if (month <= 6) return "spring";
  if (month <= 9) return "summer";
  return "fall";
}

export interface MediaSeasonMetadata {
  season: MediaSeason | null;
  seasonYear: number | null;
}

export interface MediaSeasonMetadataInput {
  season?: unknown;
  seasonYear?: unknown;
  startDate?: unknown;
  fallbackYear?: unknown;
  tagValues?: readonly unknown[];
}

/**
 * Resolve the canonical anime broadcasting season for a work.
 * Precedence:
 * 1. Explicit provider season metadata (e.g., AniList season / seasonYear).
 * 2. Tag-inferred broadcasting season (e.g., Bangumi "2026年7月", "2026夏").
 * 3. Start date calendar month fallback (Jan-Mar = Q1, Apr-Jun = Q2, Jul-Sep = Q3, Oct-Dec = Q4).
 */
export function resolveMediaSeasonMetadata(input: MediaSeasonMetadataInput): MediaSeasonMetadata {
  const explicitSeason = normalizeMediaSeason(input.season);
  const explicitYear = optionalInteger(input.seasonYear);
  const startDate = record(input.startDate);
  const startYear = optionalInteger(startDate.year);
  const fallbackYear = optionalInteger(input.fallbackYear);

  if (explicitSeason) {
    return {
      season: explicitSeason,
      seasonYear: explicitYear ?? startYear ?? fallbackYear,
    };
  }

  if (input.tagValues && input.tagValues.length > 0) {
    const fromTags = mediaSeasonFromTagValues(input.tagValues, explicitYear ?? startYear ?? fallbackYear);
    if (fromTags.season) {
      return {
        season: fromTags.season,
        seasonYear: fromTags.seasonYear ?? startYear ?? fallbackYear,
      };
    }
  }

  const startSeason = mediaSeasonFromMonth(startDate.month);
  return {
    season: startSeason,
    seasonYear: explicitYear ?? startYear ?? fallbackYear,
  };
}

export function mediaSeasonQuarter(season: MediaSeason | null | undefined): string {
  if (season === "winter") return "Q1";
  if (season === "spring") return "Q2";
  if (season === "summer") return "Q3";
  if (season === "fall") return "Q4";
  return "";
}

export function normalizeAniListClassification(value: unknown): MediaClassification | null {
  const media = record(value);
  const anilistId = stringValue(media.id).trim();
  if (!anilistId) return null;

  const tags = asArray(media.tags).map((rawTag): MediaTagMetadata | null => {
    const tag = record(rawTag);
    const name = stringValue(tag.name).trim();
    if (!name) return null;
    return {
      name,
      category: stringValue(tag.category).trim(),
      rank: Math.max(0, Math.min(100, optionalInteger(tag.rank) ?? 0)),
      isGeneralSpoiler: tag.isGeneralSpoiler === true,
      isMediaSpoiler: tag.isMediaSpoiler === true,
      isAdult: tag.isAdult === true,
    };
  }).filter((tag): tag is MediaTagMetadata => tag !== null);

  const studios = normalizeStructuredAnimationStudios(asArray(record(media.studios).nodes));
  const { season, seasonYear } = resolveMediaSeasonMetadata({
    season: media.season,
    seasonYear: media.seasonYear,
    startDate: media.startDate,
  });

  return {
    anilistId,
    genres: normalizeGenres(media.genres),
    tags,
    season,
    seasonYear,
    studios,
    source: stringValue(media.source).trim().toLocaleLowerCase(),
    countryOfOrigin: stringValue(media.countryOfOrigin).trim().toUpperCase(),
  };
}

export function persistedMediaTags(
  classification: MediaClassification | null | undefined,
  minimumRank = MEDIA_TAG_MIN_RANK,
): string[] {
  if (!classification) return [];
  const seen = new Set<string>();
  const output: string[] = [];
  for (const tag of classification.tags) {
    const name = tag.name.normalize("NFKC").trim();
    if (!name || tag.rank < minimumRank || tag.isGeneralSpoiler || tag.isMediaSpoiler || seen.has(name)) continue;
    seen.add(name);
    output.push(name);
  }
  return output;
}
