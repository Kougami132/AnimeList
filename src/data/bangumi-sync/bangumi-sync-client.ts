import { requestUrl } from "obsidian";
import { USER_AGENT } from "../../app-metadata";
import type { BangumiUserProfile } from "../../domain/bangumi-sync/types";

const BANGUMI_API_BASE = "https://api.bgm.tv/v0";
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

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringProp(obj: Record<string, unknown>, key: string, fallback = ""): string {
  const val = obj[key];
  return typeof val === "string" ? val : fallback;
}

function numProp(obj: Record<string, unknown>, key: string, fallback = 0): number {
  const val = obj[key];
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string") {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export interface BangumiEpisodeItem {
  id: number;
  sort: number;
  type: number;
  ep?: number;
  name?: string;
  name_cn?: string;
}

export interface BangumiUserEpisodeCollectionItem {
  episode: BangumiEpisodeItem;
  type: number;
}

export interface BangumiCollectionResponseItem {
  subject_id: number;
  subject_type: number;
  rate: number;
  type: number;
  ep_status: number;
  vol_status: number;
  updated_at: string;
  subject?: {
    id: number;
    name: string;
    name_cn: string;
    eps?: number;
    total_episodes?: number;
    score?: number;
    date?: string;
    images?: {
      large?: string;
      common?: string;
      medium?: string;
      small?: string;
      grid?: string;
    };
  };
}

export interface BangumiUserCollectionsResponse {
  total: number;
  limit: number;
  offset: number;
  data: BangumiCollectionResponseItem[];
}

export class BangumiSyncClient {
  private lastRequestTime = 0;
  private minIntervalMs = 200;
  private usernameCache = new Map<string, string>();

  constructor(options?: { minIntervalMs?: number }) {
    if (typeof options?.minIntervalMs === "number") {
      this.minIntervalMs = options.minIntervalMs;
    }
  }

  async getUsername(token: string): Promise<string> {
    const trimmed = token.trim();
    const cached = this.usernameCache.get(trimmed);
    if (cached) return cached;
    try {
      const profile = await this.verifyToken(trimmed);
      if (profile.username) {
        this.usernameCache.set(trimmed, profile.username);
        return profile.username;
      }
    } catch {
      // Fall back to '-' if verification fails or username is not available
    }
    return "-";
  }

  private async throttle(): Promise<void> {
    if (this.minIntervalMs <= 0) return;
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      await new Promise((resolve) => window.setTimeout(resolve, this.minIntervalMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  async verifyToken(token: string): Promise<BangumiUserProfile> {
    const trimmed = token.trim();
    if (!trimmed) {
      throw new Error("Bangumi Personal Access Token is required.");
    }

    await this.throttle();
    try {
      const response = await requestWithTimeout({
        url: `${BANGUMI_API_BASE}/me`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${trimmed}`,
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
      });

      if (response.status !== 200) {
        if (response.status === 401) {
          throw new Error("Invalid or expired Bangumi Personal Access Token (401 Unauthorized).");
        }
        throw new Error(`Bangumi API error: HTTP ${response.status}`);
      }

      const parsed: unknown = response.json ?? JSON.parse(response.text || "{}");
      const data = record(parsed);
      const avatarObj = record(data.avatar);

      const profile: BangumiUserProfile = {
        id: numProp(data, "id"),
        username: stringProp(data, "username"),
        nickname: stringProp(data, "nickname") || stringProp(data, "username"),
        avatar: {
          large: stringProp(avatarObj, "large") || undefined,
          medium: stringProp(avatarObj, "medium") || undefined,
          small: stringProp(avatarObj, "small") || undefined,
        },
        sign: stringProp(data, "sign") || undefined,
      };
      if (profile.username) {
        this.usernameCache.set(trimmed, profile.username);
      }
      return profile;
    } catch (error) {
      if (error instanceof Error) {
        const message = error.message;
        if (message.includes("401") || message.toLowerCase().includes("unauthorized")) {
          throw new Error("Invalid or expired Bangumi Personal Access Token (401 Unauthorized).");
        }
        // Do not leak token in error messages
        throw error;
      }
      throw new Error("Failed to connect to Bangumi API.");
    }
  }

  async fetchUserCollections(
    token: string,
    options: { subjectType?: number; type?: number; limit?: number; offset?: number; username?: string } = {},
  ): Promise<BangumiUserCollectionsResponse> {
    const trimmed = token.trim();
    if (!trimmed) throw new Error("Bangumi Personal Access Token is required.");

    const username = options.username || await this.getUsername(trimmed);
    const query = new URLSearchParams();
    if (typeof options.subjectType === "number") query.set("subject_type", String(options.subjectType));
    if (typeof options.type === "number") query.set("type", String(options.type));
    query.set("limit", String(options.limit ?? 30));
    query.set("offset", String(options.offset ?? 0));

    await this.throttle();
    const response = await requestWithTimeout({
      url: `${BANGUMI_API_BASE}/users/${encodeURIComponent(username)}/collections?${query.toString()}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${trimmed}`,
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    });

    if (response.status !== 200) {
      if (response.status === 401) {
        throw new Error("Invalid or expired Bangumi Personal Access Token (401 Unauthorized).");
      }
      throw new Error(`Bangumi API error: HTTP ${response.status}`);
    }

    const parsed: unknown = response.json ?? JSON.parse(response.text || "{}");
    const data = record(parsed);
    const list = Array.isArray(data.data) ? data.data : [];

    return {
      total: numProp(data, "total"),
      limit: numProp(data, "limit", 30),
      offset: numProp(data, "offset", 0),
      data: list as BangumiCollectionResponseItem[],
    };
  }

  async fetchAllCollectionSubjectIds(
    token: string,
    options?: { username?: string; limit?: number },
  ): Promise<Set<number>> {
    const trimmed = token.trim();
    if (!trimmed) throw new Error("Bangumi Personal Access Token is required.");

    const user = options?.username || await this.getUsername(trimmed);
    const subjectIds = new Set<number>();
    const limit = options?.limit ?? 50;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const page = await this.fetchUserCollections(token, {
        subjectType: 2, // anime
        limit,
        offset,
        username: user,
      });

      if (!page.data || page.data.length === 0) break;
      for (const item of page.data) {
        if (typeof item.subject_id === "number") {
          subjectIds.add(item.subject_id);
        }
      }

      const effectiveLimit = page.limit || limit;
      if (page.data.length < effectiveLimit || offset + page.data.length >= page.total) {
        hasMore = false;
      } else {
        offset += page.data.length;
      }
    }

    return subjectIds;
  }

  async fetchCollection(token: string, subjectId: number, username?: string): Promise<BangumiCollectionResponseItem | null> {
    const trimmed = token.trim();
    if (!trimmed) throw new Error("Bangumi Personal Access Token is required.");

    const user = username || await this.getUsername(trimmed);
    await this.throttle();
    try {
      const response = await requestWithTimeout({
        url: `${BANGUMI_API_BASE}/users/${encodeURIComponent(user)}/collections/${subjectId}`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${trimmed}`,
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
      });

      if (response.status === 404) return null;
      if (response.status !== 200) {
        if (response.status === 401) throw new Error("Invalid or expired Bangumi Personal Access Token (401 Unauthorized).");
        throw new Error(`Bangumi API error: HTTP ${response.status}`);
      }

      const parsed: unknown = response.json ?? JSON.parse(response.text || "{}");
      return parsed as BangumiCollectionResponseItem;
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) return null;
      throw error;
    }
  }

  async patchCollection(
    token: string,
    subjectId: number,
    patch: { rate?: number; ep_status?: number; type?: number },
  ): Promise<void> {
    const trimmed = token.trim();
    if (!trimmed) throw new Error("Bangumi Personal Access Token is required.");

    await this.throttle();
    const response = await requestWithTimeout({
      url: `${BANGUMI_API_BASE}/users/-/collections/${subjectId}`,
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${trimmed}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify(patch),
    });

    if (response.status < 200 || response.status >= 300) {
      if (response.status === 401) throw new Error("Invalid or expired Bangumi Personal Access Token (401 Unauthorized).");
      throw new Error(`Bangumi API error: HTTP ${response.status}`);
    }
  }

  async postCollection(
    token: string,
    subjectId: number,
    data: { rate?: number; ep_status?: number; type?: number },
  ): Promise<void> {
    const trimmed = token.trim();
    if (!trimmed) throw new Error("Bangumi Personal Access Token is required.");

    await this.throttle();
    const response = await requestWithTimeout({
      url: `${BANGUMI_API_BASE}/users/-/collections/${subjectId}`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${trimmed}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify(data),
    });

    if (response.status < 200 || response.status >= 300) {
      if (response.status === 401) throw new Error("Invalid or expired Bangumi Personal Access Token (401 Unauthorized).");
      throw new Error(`Bangumi API error: HTTP ${response.status}`);
    }
  }

  async upsertCollection(
    token: string,
    subjectId: number,
    data: { rate?: number; ep_status?: number; type?: number },
  ): Promise<void> {
    const trimmed = token.trim();
    if (!trimmed) throw new Error("Bangumi Personal Access Token is required.");

    await this.throttle();
    let is404 = false;
    try {
      const response = await requestWithTimeout({
        url: `${BANGUMI_API_BASE}/users/-/collections/${subjectId}`,
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${trimmed}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
        body: JSON.stringify(data),
      });

      if (response.status === 404) {
        is404 = true;
      } else if (response.status < 200 || response.status >= 300) {
        if (response.status === 401) throw new Error("Invalid or expired Bangumi Personal Access Token (401 Unauthorized).");
        throw new Error(`Bangumi API error: HTTP ${response.status}`);
      }
    } catch (error: unknown) {
      if (
        (typeof error === "object" && error !== null && "status" in error && error.status === 404)
        || (error instanceof Error && error.message.includes("404"))
      ) {
        is404 = true;
      } else {
        throw error;
      }
    }

    if (is404) {
      await this.postCollection(token, subjectId, data);
    }
  }

  async fetchSubject(subjectId: number): Promise<Record<string, unknown> | null> {
    await this.throttle();
    try {
      const response = await requestWithTimeout({
        url: `${BANGUMI_API_BASE}/subjects/${subjectId}`,
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
      });

      if (response.status === 404) return null;
      if (response.status !== 200) throw new Error(`Bangumi API error: HTTP ${response.status}`);

      const parsed: unknown = response.json ?? JSON.parse(response.text || "{}");
      return record(parsed);
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) return null;
      throw error;
    }
  }

  async fetchUserSubjectEpisodes(
    token: string,
    subjectId: number,
    options?: { episodeType?: number; limit?: number; offset?: number },
  ): Promise<{ total: number; limit: number; offset: number; data: BangumiUserEpisodeCollectionItem[] }> {
    const trimmed = token.trim();
    if (!trimmed) throw new Error("Bangumi Personal Access Token is required.");

    const query = new URLSearchParams();
    if (typeof options?.episodeType === "number") query.set("episode_type", String(options.episodeType));
    query.set("limit", String(options?.limit ?? 100));
    query.set("offset", String(options?.offset ?? 0));

    await this.throttle();
    const response = await requestWithTimeout({
      url: `${BANGUMI_API_BASE}/users/-/collections/${subjectId}/episodes?${query.toString()}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${trimmed}`,
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    });

    if (response.status < 200 || response.status >= 300) {
      if (response.status === 401) throw new Error("Invalid or expired Bangumi Personal Access Token (401 Unauthorized).");
      throw new Error(`Bangumi API error: HTTP ${response.status}`);
    }

    const parsed: unknown = response.json ?? JSON.parse(response.text || "{}");
    const data = record(parsed);
    const list = Array.isArray(data.data) ? data.data : [];

    return {
      total: numProp(data, "total"),
      limit: numProp(data, "limit", 100),
      offset: numProp(data, "offset", 0),
      data: list as BangumiUserEpisodeCollectionItem[],
    };
  }

  async fetchSubjectEpisodes(
    subjectId: number,
    options?: { type?: number; limit?: number; offset?: number },
  ): Promise<{ total: number; limit: number; offset: number; data: BangumiEpisodeItem[] }> {
    const query = new URLSearchParams();
    query.set("subject_id", String(subjectId));
    if (typeof options?.type === "number") query.set("type", String(options.type));
    query.set("limit", String(options?.limit ?? 100));
    query.set("offset", String(options?.offset ?? 0));

    await this.throttle();
    const response = await requestWithTimeout({
      url: `${BANGUMI_API_BASE}/episodes?${query.toString()}`,
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Bangumi API error: HTTP ${response.status}`);
    }

    const parsed: unknown = response.json ?? JSON.parse(response.text || "{}");
    const data = record(parsed);
    const list = Array.isArray(data.data) ? data.data : [];

    return {
      total: numProp(data, "total"),
      limit: numProp(data, "limit", 100),
      offset: numProp(data, "offset", 0),
      data: list as BangumiEpisodeItem[],
    };
  }

  async patchSubjectEpisodes(
    token: string,
    subjectId: number,
    episodeIds: number[],
    type: number,
  ): Promise<void> {
    if (!episodeIds.length) return;
    const trimmed = token.trim();
    if (!trimmed) throw new Error("Bangumi Personal Access Token is required.");

    await this.throttle();
    const response = await requestWithTimeout({
      url: `${BANGUMI_API_BASE}/users/-/collections/${subjectId}/episodes`,
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${trimmed}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({
        episode_id: episodeIds,
        type,
      }),
    });

    if (response.status < 200 || response.status >= 300) {
      if (response.status === 401) throw new Error("Invalid or expired Bangumi Personal Access Token (401 Unauthorized).");
      throw new Error(`Bangumi API error: HTTP ${response.status}`);
    }
  }

  async updateAnimeEpisodeProgress(
    token: string,
    subjectId: number,
    progress: number,
    status?: string,
  ): Promise<void> {
    const trimmed = token.trim();
    if (!trimmed) throw new Error("Bangumi Personal Access Token is required.");

    let episodeItems: BangumiUserEpisodeCollectionItem[] = [];
    try {
      const res = await this.fetchUserSubjectEpisodes(trimmed, subjectId, { episodeType: 0, limit: 1000 });
      episodeItems = res.data ?? [];
    } catch {
      try {
        const publicRes = await this.fetchSubjectEpisodes(subjectId, { type: 0, limit: 1000 });
        episodeItems = (publicRes.data ?? []).map((ep) => ({
          episode: ep,
          type: 0,
        }));
      } catch {
        return;
      }
    }

    if (!episodeItems.length) return;

    const normalEpisodes = episodeItems
      .filter((item) => (item.episode?.type ?? 0) === 0)
      .sort((a, b) => (a.episode?.sort ?? 0) - (b.episode?.sort ?? 0));

    if (!normalEpisodes.length) return;

    const isCompleted = status === "completed";
    const totalCount = normalEpisodes.length;
    const minSort = normalEpisodes[0]?.episode?.sort ?? 1;
    const maxSort = normalEpisodes[totalCount - 1]?.episode?.sort ?? totalCount;

    const toMarkWatched: number[] = [];
    const toUnmarkWatched: number[] = [];

    for (let index = 0; index < totalCount; index += 1) {
      const item = normalEpisodes[index];
      const sort = item.episode?.sort ?? (index + 1);
      const id = item.episode?.id;
      if (!id) continue;

      let shouldBeWatched = false;
      if (isCompleted) {
        shouldBeWatched = true;
      } else if (progress <= 0) {
        shouldBeWatched = false;
      } else if (progress <= totalCount) {
        shouldBeWatched = index < progress;
      } else if (minSort > 1 && progress <= maxSort) {
        shouldBeWatched = sort <= progress;
      } else if (progress > maxSort) {
        shouldBeWatched = true;
      } else {
        shouldBeWatched = sort <= progress;
      }

      if (shouldBeWatched) {
        if (item.type !== 2) {
          toMarkWatched.push(id);
        }
      } else {
        if (item.type === 2) {
          toUnmarkWatched.push(id);
        }
      }
    }

    if (toMarkWatched.length > 0) {
      await this.patchSubjectEpisodes(trimmed, subjectId, toMarkWatched, 2);
    }
    if (toUnmarkWatched.length > 0) {
      await this.patchSubjectEpisodes(trimmed, subjectId, toUnmarkWatched, 0);
    }
  }
}
