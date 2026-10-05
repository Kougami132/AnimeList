import { requestUrl } from "obsidian";
import { USER_AGENT } from "../../app-metadata";
import type { MediaType } from "../../domain/media-types";
import { asArray } from "../../domain/value-normalization";
import type { MetadataProviderClient, MetadataProviderPage } from "../external-media-provider";
import { normalizeBangumiAnimationStudiosFromPersons, normalizeBangumiSubject } from "../provider-normalizers";

const BANGUMI_SEARCH_ENDPOINT = "https://api.bgm.tv/v0/search/subjects";
const BANGUMI_LEGACY_SEARCH_ENDPOINT = "https://api.bgm.tv/search/subject";
const BANGUMI_SUBJECT_ENDPOINT = "https://api.bgm.tv/v0/subjects";
const BANGUMI_SUBJECT_PERSONS_SUFFIX = "/persons";
const BANGUMI_PAGE_SIZE = 20;
const REQUEST_TIMEOUT_MS = 15000;

async function requestWithTimeout(options: Parameters<typeof requestUrl>[0]): Promise<Awaited<ReturnType<typeof requestUrl>>> {
  let timer: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(`Bangumi request timed out after ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS);
  });
  try {
    return await Promise.race([requestUrl(options), timeoutPromise]);
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
}

async function requestWithRetry(options: Parameters<typeof requestUrl>[0], maxAttempts = 2): Promise<Awaited<ReturnType<typeof requestUrl>>> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await requestWithTimeout(options);
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => window.setTimeout(r, 400));
      }
    }
  }
  throw lastError;
}

function extractSubjectIdFromQuery(query: string): number | null {
  const trimmed = query.trim();
  if (/^\d+$/.test(trimmed)) {
    const num = Number(trimmed);
    return Number.isInteger(num) && num > 0 ? num : null;
  }
  const match = trimmed.match(/(?:bgm\.tv|bangumi\.tv|chii\.in)\/subject\/(\d+)/);
  if (match) {
    const num = Number(match[1]);
    return Number.isInteger(num) && num > 0 ? num : null;
  }
  return null;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function optionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export class BangumiClient implements MetadataProviderClient {
  readonly id = "bangumi" as const;
  readonly label = "Bangumi";
  readonly supportsChineseDiscovery = true;

  constructor(private readonly getAccessToken?: () => string) {}

  supports(_mediaType: MediaType): boolean { return true; }

  async fetchById(mediaType: MediaType, sourceId: string): Promise<ReturnType<typeof normalizeBangumiSubject> | null> {
    const id = sourceId.trim();
    if (!id) return null;
    const token = this.getAccessToken?.()?.trim();
    const response = await requestWithRetry({
      url: `${BANGUMI_SUBJECT_ENDPOINT}/${encodeURIComponent(id)}`,
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const parsed: unknown = response.json ?? JSON.parse(response.text || "{}");
    const subject = record(parsed);
    if (!Object.keys(subject).length) return null;

    const normalized = normalizeBangumiSubject(subject, mediaType);
    if (mediaType !== "anime" || normalized.people.length) return normalized;

    try {
      const personsResponse = await requestWithTimeout({
        url: `${BANGUMI_SUBJECT_ENDPOINT}/${encodeURIComponent(id)}${BANGUMI_SUBJECT_PERSONS_SUFFIX}`,
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": USER_AGENT,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const persons: unknown = personsResponse.json ?? JSON.parse(personsResponse.text || "[]");
      const studios = normalizeBangumiAnimationStudiosFromPersons(persons);
      return studios.length ? { ...normalized, people: studios } : normalized;
    } catch {
      // The relation endpoint is a reliability fallback. Preserve the exact
      // subject result if it is temporarily unavailable; AniList enrichment
      // remains an independent secondary source.
      return normalized;
    }
  }

  async searchPage(mediaType: MediaType, query: string, page: number): Promise<MetadataProviderPage> {
    const directId = extractSubjectIdFromQuery(query);
    if (directId) {
      try {
        const direct = await this.fetchById(mediaType, String(directId));
        if (direct) {
          return { results: [direct], hasMore: false };
        }
      } catch (directErr) {
        console.warn(`Bangumi direct ID lookup failed for "${query}":`, directErr);
      }
    }

    const token = this.getAccessToken?.()?.trim();
    const normalizedPage = Math.max(1, Math.floor(page));
    const offset = (normalizedPage - 1) * BANGUMI_PAGE_SIZE;

    // 1. Try API v0 search
    try {
      const response = await requestWithRetry({
        url: `${BANGUMI_SEARCH_ENDPOINT}?limit=${BANGUMI_PAGE_SIZE}&offset=${offset}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": USER_AGENT,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          keyword: query,
          sort: "match",
          filter: { type: [mediaType === "anime" ? 2 : 1], nsfw: false },
        }),
      });
      const parsed: unknown = response.json ?? JSON.parse(response.text || "{}");
      const payload = record(parsed);
      const subjects = asArray(payload.data);
      const total = optionalNumber(payload.total);
      if (subjects.length > 0) {
        return {
          results: subjects.map((subject) => normalizeBangumiSubject(subject, mediaType)),
          hasMore: total === null
            ? subjects.length === BANGUMI_PAGE_SIZE
            : offset + subjects.length < total,
        };
      }
    } catch (v0Error) {
      console.warn(`Bangumi API v0 search failed for "${query}", attempting legacy fallback:`, v0Error);
    }

    // 2. Fallback to legacy GET search (/search/subject/{keyword})
    try {
      const typeNum = mediaType === "anime" ? 2 : 1;
      const legacyUrl = `${BANGUMI_LEGACY_SEARCH_ENDPOINT}/${encodeURIComponent(query)}?type=${typeNum}&responseGroup=large&max_results=${BANGUMI_PAGE_SIZE}&start=${offset}`;
      const response = await requestWithRetry({
        url: legacyUrl,
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": USER_AGENT,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const parsed: unknown = response.json ?? JSON.parse(response.text || "{}");
      const payload = record(parsed);
      const subjects = asArray(payload.list);
      const total = optionalNumber(payload.results);
      return {
        results: subjects.map((subject) => normalizeBangumiSubject(subject, mediaType)),
        hasMore: total === null
          ? subjects.length === BANGUMI_PAGE_SIZE
          : offset + subjects.length < total,
      };
    } catch (legacyError) {
      console.warn(`Bangumi legacy search fallback failed for "${query}":`, legacyError);
      return { results: [], hasMore: false };
    }
  }
}
