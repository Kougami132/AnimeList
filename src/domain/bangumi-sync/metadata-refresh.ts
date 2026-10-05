import type { ExternalMediaResult } from "../media-types";

export interface SubjectMetadataRefreshInput {
  totalEpisodes?: number | null;
  sourceScore?: number | null;
  season?: string | null;
  seasonYear?: number | null;
  studios?: string[] | null;
  originalTitle?: string | null;
}

export function extractMetadataFromBasicSubject(
  basic?: {
    eps?: number;
    total_episodes?: number;
    score?: number;
    name?: string;
    date?: string;
  } | null,
): SubjectMetadataRefreshInput {
  if (!basic) return {};

  const total = typeof basic.eps === "number" && basic.eps > 0
    ? basic.eps
    : typeof basic.total_episodes === "number" && basic.total_episodes > 0
      ? basic.total_episodes
      : null;

  const score = typeof basic.score === "number" && basic.score > 0 ? basic.score : null;
  const originalTitle = typeof basic.name === "string" && basic.name.trim() ? basic.name.trim() : null;

  return {
    totalEpisodes: total,
    sourceScore: score,
    originalTitle,
  };
}

export function extractMetadataFromNormalizedSubject(
  normalized: ExternalMediaResult,
  fallbackBasic?: { eps?: number; total_episodes?: number; score?: number; name?: string } | null,
): SubjectMetadataRefreshInput {
  const total = typeof normalized.total === "number" && normalized.total > 0
    ? normalized.total
    : (typeof fallbackBasic?.eps === "number" && fallbackBasic.eps > 0)
      ? fallbackBasic.eps
      : (typeof fallbackBasic?.total_episodes === "number" && fallbackBasic.total_episodes > 0)
        ? fallbackBasic.total_episodes
        : null;

  const score = typeof normalized.externalScore === "number" && normalized.externalScore > 0
    ? normalized.externalScore
    : (typeof fallbackBasic?.score === "number" && fallbackBasic.score > 0)
      ? fallbackBasic.score
      : null;

  const studios = Array.isArray(normalized.people) && normalized.people.length > 0
    ? normalized.people.filter(Boolean)
    : null;
  const season = normalized.classification?.season || null;
  const seasonYear = typeof normalized.classification?.seasonYear === "number" && normalized.classification.seasonYear > 0
    ? normalized.classification.seasonYear
    : null;
  const originalTitle = typeof normalized.originalTitle === "string" && normalized.originalTitle.trim()
    ? normalized.originalTitle.trim()
    : (typeof fallbackBasic?.name === "string" && fallbackBasic.name.trim())
      ? fallbackBasic.name.trim()
      : null;

  return {
    totalEpisodes: total,
    sourceScore: score,
    season,
    seasonYear,
    studios,
    originalTitle,
  };
}

export function shouldFetchDeepSubjectMetadata(
  frontmatter: Record<string, unknown>,
  basicSubject?: { eps?: number; total_episodes?: number } | null,
): boolean {
  // Check if studios are missing
  const hasStudios = Array.isArray(frontmatter.studios) && frontmatter.studios.filter(Boolean).length > 0;
  if (!hasStudios) return true;

  // Check if season is missing
  const hasSeason = typeof frontmatter.season === "string" && frontmatter.season.trim().length > 0;
  if (!hasSeason) return true;

  // Check if total episodes is missing locally and not provided in basic collection subject
  const localTotal = typeof frontmatter.progress_total === "number" && frontmatter.progress_total > 0
    ? frontmatter.progress_total
    : typeof frontmatter.episodes === "number" && frontmatter.episodes > 0
      ? frontmatter.episodes
      : typeof frontmatter.total === "number" && frontmatter.total > 0
        ? frontmatter.total
        : 0;

  const basicTotal = (basicSubject?.eps && basicSubject.eps > 0)
    ? basicSubject.eps
    : (basicSubject?.total_episodes && basicSubject.total_episodes > 0)
      ? basicSubject.total_episodes
      : 0;

  if (localTotal === 0 && basicTotal === 0) {
    return true;
  }

  return false;
}

export function refreshSubjectMetadata(
  draft: Record<string, unknown>,
  input: SubjectMetadataRefreshInput,
): boolean {
  let changed = false;

  // 1. Total episodes & completed progress alignment
  if (typeof input.totalEpisodes === "number" && input.totalEpisodes > 0) {
    const currentTotal = typeof draft.progress_total === "number" && draft.progress_total > 0
      ? draft.progress_total
      : typeof draft.total === "number" && draft.total > 0
        ? draft.total
        : typeof draft.episodes === "number" && draft.episodes > 0
          ? draft.episodes
          : 0;

    if (currentTotal !== input.totalEpisodes) {
      draft.progress_total = input.totalEpisodes;
      changed = true;
    }

    if (draft.status === "completed") {
      const currentProgress = typeof draft.progress === "number" ? draft.progress : 0;
      if (currentProgress !== input.totalEpisodes) {
        draft.progress = input.totalEpisodes;
        changed = true;
      }
    }
  }

  // 2. Bangumi official score (source_score)
  if (typeof input.sourceScore === "number" && input.sourceScore > 0) {
    if (draft.source_score !== input.sourceScore) {
      draft.source_score = input.sourceScore;
      changed = true;
    }
  }

  // 3. Broadcasting season & year (enrich if missing)
  if (typeof input.season === "string" && input.season.trim()) {
    const currentSeason = typeof draft.season === "string" ? draft.season.trim() : "";
    if (!currentSeason) {
      draft.season = input.season.trim();
      changed = true;
    }
  }
  if (typeof input.seasonYear === "number" && input.seasonYear > 0) {
    const currentYear = typeof draft.season_year === "number" ? draft.season_year : 0;
    if (!currentYear) {
      draft.season_year = input.seasonYear;
      changed = true;
    }
  }

  // 4. Animation studios (enrich if missing)
  if (Array.isArray(input.studios) && input.studios.length > 0) {
    const currentStudios = Array.isArray(draft.studios) ? draft.studios.filter(Boolean) : [];
    if (currentStudios.length === 0) {
      draft.studios = [...input.studios];
      changed = true;
    }
  }

  // 5. Original title (enrich if missing and distinct from title)
  if (typeof input.originalTitle === "string" && input.originalTitle.trim()) {
    const trimmedOrig = input.originalTitle.trim();
    const currentOrig = typeof draft.title_original === "string" ? draft.title_original.trim() : "";
    if (!currentOrig && draft.title !== trimmedOrig) {
      draft.title_original = trimmedOrig;
      changed = true;
    }
  }

  return changed;
}
