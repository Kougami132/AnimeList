import type { MediaSeason } from "../domain/media-classification";
import { mediaSeasonFromTagValues, mediaSeasonFromValue } from "../domain/media-classification";
import { normalizeAnimeStudios, normalizeBroadGenres, normalizeGenres } from "../domain/media-metadata";
import { asArray, stringValue } from "../domain/value-normalization";

const LEGACY_SELECTED_TAG_KEYS = [
  "classification_genres",
  "classification_tags",
  "classification_selected_genres",
  "classification_selected_tags",
] as const;

const LEGACY_SOURCE_TAG_KEYS = [
  "classification_source_genres",
  "classification_source_tags",
  "classification_raw_genres",
  "classification_raw_tags",
  "classification_tags_raw",
] as const;

const LEGACY_STUDIO_KEYS = [
  "classification_studios",
  "classification_studio",
  "classification_companies",
  "classification_company",
  "classification_people",
] as const;

const LEGACY_SEASON_KEYS = ["classification_season", "classification_quarter"] as const;
const LEGACY_SEASON_YEAR_KEYS = ["classification_season_year", "classification_year"] as const;
const LEGACY_STRUCTURAL_SUFFIX = /(?:version|count|threshold|rank|min|max)$/i;
const FORMAT_OR_NOISE = /^(?:tv|ova|ona|web|movie|special|music|manga|novel|one[_ -]?shot)$/i;
const COMPANY_HINT = /(?:studio|pictures?|animation|works|films?|動画工房|動畫工房|动画工房|アニメーション|スタジオ)/i;
const ALL_CAPS_COMPANY = /^[A-Z][A-Z0-9&.]{2,}(?:[- ][A-Z0-9&.]+)*$/;

function strings(value: unknown): string[] {
  return asArray(value)
    .map((entry) => stringValue(entry).normalize("NFKC").trim())
    .filter(Boolean);
}

function valuesFor(frontmatter: Record<string, unknown>, keys: readonly string[]): string[] {
  return keys.flatMap((key) => strings(frontmatter[key]));
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function legacyClassificationKeys(frontmatter: Record<string, unknown>): string[] {
  return Object.keys(frontmatter).filter((key) => key.startsWith("classification_"));
}

function unclaimedLegacyValues(frontmatter: Record<string, unknown>): string[] {
  const claimed = new Set<string>([
    ...LEGACY_SELECTED_TAG_KEYS,
    ...LEGACY_SOURCE_TAG_KEYS,
    ...LEGACY_STUDIO_KEYS,
    ...LEGACY_SEASON_KEYS,
    ...LEGACY_SEASON_YEAR_KEYS,
    "classification_anilist_id",
    "classification_source_material",
    "classification_source",
  ]);
  const output: string[] = [];
  for (const key of legacyClassificationKeys(frontmatter)) {
    if (claimed.has(key) || LEGACY_STRUCTURAL_SUFFIX.test(key)) continue;
    output.push(...strings(frontmatter[key]));
  }
  return output;
}

export function compatibleSourceGenres(frontmatter: Record<string, unknown>): string[] {
  return unique([
    ...strings(frontmatter.source_genres),
    ...valuesFor(frontmatter, LEGACY_SOURCE_TAG_KEYS),
    ...unclaimedLegacyValues(frontmatter),
  ]);
}

export function legacySelectedClassificationTags(frontmatter: Record<string, unknown>): string[] {
  return normalizeGenres(valuesFor(frontmatter, LEGACY_SELECTED_TAG_KEYS), 32);
}

export function compatibleGenres(frontmatter: Record<string, unknown>): string[] {
  return normalizeGenres([
    ...strings(frontmatter.genres),
    ...strings(frontmatter.user_tags),
    ...legacySelectedClassificationTags(frontmatter),
  ], 32);
}

export function writeCompatibleGenres(
  frontmatter: Record<string, unknown>,
  values: unknown,
): string[] {
  const genres = normalizeGenres(values, 32);
  if (genres.length) frontmatter.genres = genres;
  else delete frontmatter.genres;
  delete frontmatter.user_tags;
  for (const key of LEGACY_SELECTED_TAG_KEYS) delete frontmatter[key];
  return genres;
}

function seasonFromValue(value: unknown): MediaSeason | null {
  return mediaSeasonFromValue(value);
}

export interface CompatibleSeasonMetadata {
  season: MediaSeason | null;
  seasonYear: number | null;
}

export function seasonMetadataFromValues(values: readonly string[], fallbackYear: unknown = null): CompatibleSeasonMetadata {
  return mediaSeasonFromTagValues(values, fallbackYear);
}

export function compatibleSeasonMetadata(frontmatter: Record<string, unknown>): CompatibleSeasonMetadata {
  const canonicalSeason = seasonFromValue(frontmatter.season);
  const canonicalYear = Number(frontmatter.season_year);
  if (canonicalSeason && Number.isInteger(canonicalYear)) {
    return { season: canonicalSeason, seasonYear: canonicalYear };
  }

  const legacySeason = valuesFor(frontmatter, LEGACY_SEASON_KEYS).map(seasonFromValue).find(Boolean) ?? null;
  const legacyYear = valuesFor(frontmatter, LEGACY_SEASON_YEAR_KEYS)
    .map(Number)
    .find((value) => Number.isInteger(value) && value > 0) ?? null;
  const inferred = seasonMetadataFromValues(compatibleSourceGenres(frontmatter), frontmatter.year);
  return {
    season: canonicalSeason ?? legacySeason ?? inferred.season,
    seasonYear: Number.isInteger(canonicalYear) ? canonicalYear : legacyYear ?? inferred.seasonYear,
  };
}

function likelyLegacyStudio(value: string): boolean {
  const clean = value.normalize("NFKC").trim();
  if (!clean || FORMAT_OR_NOISE.test(clean) || /^\d{4}/.test(clean)) return false;
  if (normalizeBroadGenres([clean]).length) return false;
  return COMPANY_HINT.test(clean) || ALL_CAPS_COMPANY.test(clean);
}

export function compatibleStudios(frontmatter: Record<string, unknown>): string[] {
  const canonical = normalizeAnimeStudios(frontmatter.studios);
  if (canonical.length) return canonical;
  const explicit = normalizeAnimeStudios(valuesFor(frontmatter, LEGACY_STUDIO_KEYS));
  if (explicit.length) return explicit;
  return normalizeAnimeStudios(compatibleSourceGenres(frontmatter).filter(likelyLegacyStudio));
}

export interface LegacyClassificationMigration {
  changed: boolean;
  removedKeys: string[];
  canonicalKeys: string[];
}

export function migrateLegacyClassificationHeaders(frontmatter: Record<string, unknown>): LegacyClassificationMigration {
  const removedKeys = legacyClassificationKeys(frontmatter);
  if (!removedKeys.length) return { changed: false, removedKeys: [], canonicalKeys: [] };

  const canonicalKeys: string[] = [];
  const genres = compatibleGenres(frontmatter);
  const sourceGenres = compatibleSourceGenres(frontmatter);
  const studios = compatibleStudios(frontmatter);
  const season = compatibleSeasonMetadata(frontmatter);

  if (genres.length && JSON.stringify(strings(frontmatter.genres)) !== JSON.stringify(genres)) {
    frontmatter.genres = genres;
    canonicalKeys.push("genres");
  }
  if (sourceGenres.length && JSON.stringify(strings(frontmatter.source_genres)) !== JSON.stringify(sourceGenres)) {
    frontmatter.source_genres = sourceGenres;
    canonicalKeys.push("source_genres");
  }
  if (frontmatter.media_type === "anime" && studios.length && JSON.stringify(strings(frontmatter.studios)) !== JSON.stringify(studios)) {
    frontmatter.studios = studios;
    canonicalKeys.push("studios");
  }
  if (!stringValue(frontmatter.season).trim() && season.season) {
    frontmatter.season = season.season;
    canonicalKeys.push("season");
  }
  if (!Number.isInteger(Number(frontmatter.season_year)) && season.seasonYear !== null) {
    frontmatter.season_year = season.seasonYear;
    canonicalKeys.push("season_year");
  }
  const anilistId = stringValue(frontmatter.classification_anilist_id).trim();
  if (!stringValue(frontmatter.anilist_id).trim() && anilistId) {
    frontmatter.anilist_id = anilistId;
    canonicalKeys.push("anilist_id");
  }
  const sourceMaterial = stringValue(frontmatter.classification_source_material, stringValue(frontmatter.classification_source)).trim();
  if (!stringValue(frontmatter.source_material).trim() && sourceMaterial) {
    frontmatter.source_material = sourceMaterial;
    canonicalKeys.push("source_material");
  }

  for (const key of removedKeys) delete frontmatter[key];
  return { changed: true, removedKeys, canonicalKeys: unique(canonicalKeys) };
}
