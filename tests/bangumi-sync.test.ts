import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SETTINGS, normalizeAnimeListSettings } from "../src/app/settings-model";
import { BangumiSyncClient } from "../src/data/bangumi-sync/bangumi-sync-client";
import { setRequestUrlMock } from "./mocks/obsidian";
import {
  DEFAULT_BANGUMI_COLLECTION_TYPES,
  DEFAULT_SYNC_RECENT_DAYS,
  DEFAULT_AUTO_SYNC_COOLDOWN_MINUTES,
  bangumiTypeNumberToStatus,
  bangumiStatusToTypeNumber,
  bangumiStatusToMediaStatus,
  normalizeBangumiCollectionTypes,
} from "../src/domain/bangumi-sync/types";
import { extractBangumiSubjectId } from "../src/domain/bangumi-sync/subject-matching";
import { reconcileSingleItem } from "../src/domain/bangumi-sync/reconcile";
import { validateMediaNoteForm } from "../src/data/media-note-codec";
import { BangumiSyncService } from "../src/data/bangumi-sync/bangumi-sync-service";
import { bangumiSyncFeature } from "../src/features/bangumi-sync/feature";
import { decorateBangumiDetail } from "../src/features/bangumi-sync/detail";
import { DiffPreviewModal } from "../src/ui/bangumi-sync/diff-modal";
import {
  refreshSubjectMetadata,
  shouldFetchDeepSubjectMetadata,
  extractMetadataFromNormalizedSubject,
  extractMetadataFromBasicSubject,
} from "../src/domain/bangumi-sync/metadata-refresh";
import { TFile, TFolder } from "obsidian";
import type { ExternalMediaResult, MediaNoteForm } from "../src/domain/media-types";

describe("Bangumi sync settings defaults and normalization", () => {
  it("provides correct default settings", () => {
    assert.equal(DEFAULT_SETTINGS.bangumiAccessToken, "");
    assert.equal(DEFAULT_SETTINGS.bangumiPushOnEdit, true);
    assert.equal(DEFAULT_SETTINGS.syncRecentDays, DEFAULT_SYNC_RECENT_DAYS);
    assert.deepEqual(DEFAULT_SETTINGS.syncCollectionTypes, DEFAULT_BANGUMI_COLLECTION_TYPES);
    assert.equal(DEFAULT_SETTINGS.autoSyncOnStartup, false);
    assert.equal(DEFAULT_SETTINGS.autoSyncCooldownMinutes, DEFAULT_AUTO_SYNC_COOLDOWN_MINUTES);
    assert.equal(DEFAULT_SETTINGS.lastSyncTimestamp, 0);
  });

  it("normalizes settings safely", () => {
    const normalized = normalizeAnimeListSettings({
      bangumiAccessToken: "  token_xyz  ",
      bangumiPushOnEdit: false,
      syncRecentDays: 14.8,
      syncCollectionTypes: ["watching", "invalid_type", "watching", "dropped"],
      autoSyncOnStartup: true,
      autoSyncCooldownMinutes: 45.2,
      lastSyncTimestamp: 1700000000,
    });

    assert.equal(normalized.bangumiAccessToken, "token_xyz");
    assert.equal(normalized.bangumiPushOnEdit, false);
    assert.equal(normalized.syncRecentDays, 15);
    assert.deepEqual(normalized.syncCollectionTypes, ["watching", "dropped"]);
    assert.equal(normalized.autoSyncOnStartup, true);
    assert.equal(normalized.autoSyncCooldownMinutes, 45);
    assert.equal(normalized.lastSyncTimestamp, 1700000000);
  });

  it("falls back to defaults for invalid settings values", () => {
    const normalized = normalizeAnimeListSettings({
      bangumiAccessToken: 12345,
      bangumiPushOnEdit: "yes",
      syncRecentDays: -5,
      syncCollectionTypes: ["invalid_only"],
      autoSyncOnStartup: "yes",
      autoSyncCooldownMinutes: 0,
      lastSyncTimestamp: -100,
    });

    assert.equal(normalized.bangumiAccessToken, "");
    assert.equal(normalized.bangumiPushOnEdit, true);
    assert.equal(normalized.syncRecentDays, 30);
    assert.deepEqual(normalized.syncCollectionTypes, ["watching", "completed"]);
    assert.equal(normalized.autoSyncOnStartup, false);
    assert.equal(normalized.autoSyncCooldownMinutes, 30);
    assert.equal(normalized.lastSyncTimestamp, 0);
  });
});

describe("Bangumi collection status and type mappings", () => {
  it("maps type numbers to collection statuses and back", () => {
    assert.equal(bangumiTypeNumberToStatus(1), "wishlist");
    assert.equal(bangumiTypeNumberToStatus(2), "completed");
    assert.equal(bangumiTypeNumberToStatus(3), "watching");
    assert.equal(bangumiTypeNumberToStatus(4), "on_hold");
    assert.equal(bangumiTypeNumberToStatus(5), "dropped");
    assert.equal(bangumiTypeNumberToStatus(99), null);

    assert.equal(bangumiStatusToTypeNumber("wishlist"), 1);
    assert.equal(bangumiStatusToTypeNumber("completed"), 2);
    assert.equal(bangumiStatusToTypeNumber("watching"), 3);
    assert.equal(bangumiStatusToTypeNumber("on_hold"), 4);
    assert.equal(bangumiStatusToTypeNumber("dropped"), 5);
  });

  it("maps collection statuses to internal MediaStatus", () => {
    assert.equal(bangumiStatusToMediaStatus("watching"), "ongoing");
    assert.equal(bangumiStatusToMediaStatus("completed"), "completed");
    assert.equal(bangumiStatusToMediaStatus("wishlist"), "planned");
    assert.equal(bangumiStatusToMediaStatus("on_hold"), "planned");
    assert.equal(bangumiStatusToMediaStatus("dropped"), "dropped");
  });

  it("normalizes collection types lists safely", () => {
    assert.deepEqual(normalizeBangumiCollectionTypes(null), ["watching", "completed"]);
    assert.deepEqual(normalizeBangumiCollectionTypes([]), ["watching", "completed"]);
    assert.deepEqual(normalizeBangumiCollectionTypes(["unknown"]), ["watching", "completed"]);
    assert.deepEqual(
      normalizeBangumiCollectionTypes(["watching", "watching", "wishlist"]),
      ["watching", "wishlist"],
    );
  });
});

describe("BangumiSyncClient connection verification", () => {
  it("verifies valid token and parses profile", async () => {
    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    let passedHeaders: Record<string, string> = {};
    let passedUrl = "";

    setRequestUrlMock((options) => {
      passedUrl = options.url;
      passedHeaders = options.headers;
      if (options.url === "https://api.bgm.tv/v0/users/-/me") {
        return {
          status: 404,
          text: JSON.stringify({
            title: "Not Found",
            details: { path: "/v0/users/-/me", method: "GET" },
            description: "This is default response, if you see this response, please check your request",
          }),
        };
      }
      if (options.url === "https://api.bgm.tv/v0/me") {
        return {
          status: 200,
          json: {
            id: 123456,
            username: "anime_fan",
            nickname: "AnimeFan",
            avatar: {
              large: "https://lain.bgm.tv/pic/user/l/000/12/34/123456.jpg",
              medium: "https://lain.bgm.tv/pic/user/m/000/12/34/123456.jpg",
              small: "https://lain.bgm.tv/pic/user/s/000/12/34/123456.jpg",
            },
            sign: "Anime is life",
          },
        };
      }
      return { status: 404 };
    });

    const profile = await client.verifyToken("test_secret_token_123");
    assert.equal(passedUrl, "https://api.bgm.tv/v0/me");
    assert.equal(profile.id, 123456);
    assert.equal(profile.username, "anime_fan");
    assert.equal(profile.nickname, "AnimeFan");
    assert.equal(profile.avatar?.large, "https://lain.bgm.tv/pic/user/l/000/12/34/123456.jpg");
    assert.equal(passedHeaders.Authorization, "Bearer test_secret_token_123");
  });

  it("rejects empty token without making network request", async () => {
    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    let called = false;
    setRequestUrlMock(() => {
      called = true;
      return { status: 200 };
    });

    await assert.rejects(
      () => client.verifyToken("   "),
      /Token is required/i,
    );
    assert.equal(called, false);
  });

  it("handles 401 Unauthorized without leaking token into error", async () => {
    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const secret = "super_secret_pat_98765";

    setRequestUrlMock(() => {
      const err = new Error("Request failed, status 401");
      (err as any).status = 401;
      throw err;
    });

    await assert.rejects(
      () => client.verifyToken(secret),
      (err: Error) => {
        assert.ok(!err.message.includes(secret), "Error message must not leak secret token");
        assert.match(err.message, /401|invalid or expired/i);
        return true;
      },
    );
  });

  it("queries user collections using resolved username", async () => {
    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const requestedUrls: string[] = [];

    setRequestUrlMock((options) => {
      requestedUrls.push(options.url);
      if (options.url === "https://api.bgm.tv/v0/me") {
        return {
          status: 200,
          json: { id: 586142, username: "kougami", nickname: "Kougami" },
        };
      }
      if (options.url.startsWith("https://api.bgm.tv/v0/users/kougami/collections")) {
        return {
          status: 200,
          json: { total: 1, limit: 30, offset: 0, data: [] },
        };
      }
      return { status: 404 };
    });

    const res = await client.fetchUserCollections("test_token");
    assert.equal(res.total, 1);
    assert.ok(requestedUrls.some((u) => u.startsWith("https://api.bgm.tv/v0/users/kougami/collections")));
  });

  it("queries single collection using resolved username", async () => {
    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const requestedUrls: string[] = [];

    setRequestUrlMock((options) => {
      requestedUrls.push(options.url);
      if (options.url === "https://api.bgm.tv/v0/me") {
        return {
          status: 200,
          json: { id: 586142, username: "kougami", nickname: "Kougami" },
        };
      }
      if (options.url === "https://api.bgm.tv/v0/users/kougami/collections/12345") {
        return {
          status: 200,
          json: { subject_id: 12345, type: 2, ep_status: 12, rate: 8, updated_at: "2024-01-01T00:00:00Z" },
        };
      }
      return { status: 404 };
    });

    const item = await client.fetchCollection("test_token", 12345);
    assert.ok(item !== null);
    assert.equal(item?.subject_id, 12345);
    assert.ok(requestedUrls.includes("https://api.bgm.tv/v0/users/kougami/collections/12345"));
  });
});

describe("BangumiSyncClient.upsertCollection and postCollection", () => {
  it("sends PATCH when subject already exists", async () => {
    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    let patchUrl = "";
    let patchMethod = "";
    let patchBody = "";

    setRequestUrlMock((options) => {
      patchUrl = options.url;
      patchMethod = options.method;
      patchBody = options.body;
      return { status: 200, json: {} };
    });

    await client.upsertCollection("test_token", 9999, { type: 3, ep_status: 5, rate: 8 });
    assert.equal(patchUrl, "https://api.bgm.tv/v0/users/-/collections/9999");
    assert.equal(patchMethod, "PATCH");
    assert.deepEqual(JSON.parse(patchBody), { type: 3, ep_status: 5, rate: 8 });
  });

  it("falls back to POST when PATCH returns 404 (uncollected)", async () => {
    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const requests: Array<{ method: string; url: string; body: string }> = [];

    setRequestUrlMock((options) => {
      requests.push({ method: options.method, url: options.url, body: options.body });
      if (options.method === "PATCH") {
        return { status: 404, json: { title: "Not Found" } };
      }
      if (options.method === "POST") {
        return { status: 201, json: {} };
      }
      return { status: 200 };
    });

    await client.upsertCollection("test_token", 9999, { type: 2, ep_status: 12, rate: 9 });
    assert.equal(requests.length, 2);
    assert.equal(requests[0].method, "PATCH");
    assert.equal(requests[1].method, "POST");
    assert.equal(requests[1].url, "https://api.bgm.tv/v0/users/-/collections/9999");
    assert.deepEqual(JSON.parse(requests[1].body), { type: 2, ep_status: 12, rate: 9 });
  });

  it("throws 401 when token is invalid or expired", async () => {
    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    setRequestUrlMock(() => ({ status: 401, json: { title: "Unauthorized" } }));

    await assert.rejects(
      () => client.upsertCollection("expired_token", 9999, { type: 3 }),
      (err: Error) => err.message.includes("401 Unauthorized"),
    );
  });

  it("accepts HTTP 202 Accepted on POST collection create", async () => {
    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    setRequestUrlMock((options) => {
      if (options.method === "PATCH") return { status: 404 };
      if (options.method === "POST") return { status: 202 };
      return { status: 200 };
    });

    await client.upsertCollection("test_token", 8888, { type: 3, rate: 8 });
  });
});

describe("BangumiSyncClient episode progress updates", () => {
  it("fetches user subject episodes and patches unwatched episodes to watched", async () => {
    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const requests: Array<{ method: string; url: string; body?: string }> = [];

    setRequestUrlMock((options) => {
      requests.push({ method: options.method, url: options.url, body: options.body });
      if (options.method === "GET" && options.url.includes("/users/-/collections/1001/episodes")) {
        return {
          status: 200,
          json: {
            total: 3,
            data: [
              { episode: { id: 11, sort: 1, type: 0 }, type: 0 },
              { episode: { id: 12, sort: 2, type: 0 }, type: 0 },
              { episode: { id: 13, sort: 3, type: 0 }, type: 0 },
            ],
          },
        };
      }
      if (options.method === "PATCH" && options.url.includes("/users/-/collections/1001/episodes")) {
        return { status: 204 };
      }
      return { status: 200 };
    });

    await client.updateAnimeEpisodeProgress("test_token", 1001, 2);

    const patchReq = requests.find((r) => r.method === "PATCH");
    assert.ok(patchReq, "Expected a PATCH request for episodes");
    assert.equal(patchReq.url, "https://api.bgm.tv/v0/users/-/collections/1001/episodes");
    assert.deepEqual(JSON.parse(patchReq.body!), {
      episode_id: [11, 12],
      type: 2,
    });
  });

  it("unmarks episodes when progress decreases", async () => {
    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const requests: Array<{ method: string; url: string; body?: string }> = [];

    setRequestUrlMock((options) => {
      requests.push({ method: options.method, url: options.url, body: options.body });
      if (options.method === "GET" && options.url.includes("/users/-/collections/1002/episodes")) {
        return {
          status: 200,
          json: {
            total: 3,
            data: [
              { episode: { id: 21, sort: 1, type: 0 }, type: 2 },
              { episode: { id: 22, sort: 2, type: 0 }, type: 2 },
              { episode: { id: 23, sort: 3, type: 0 }, type: 2 },
            ],
          },
        };
      }
      if (options.method === "PATCH") {
        return { status: 204 };
      }
      return { status: 200 };
    });

    // Decrease from 3 to 1: episodes 22 and 23 should be unmarked (type 0)
    await client.updateAnimeEpisodeProgress("test_token", 1002, 1);

    const patchReq = requests.find((r) => r.method === "PATCH");
    assert.ok(patchReq, "Expected a PATCH request to unmark episodes");
    assert.deepEqual(JSON.parse(patchReq.body!), {
      episode_id: [22, 23],
      type: 0,
    });
  });

  it("does not make PATCH requests when episodes are already in desired state", async () => {
    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const patchCalls: any[] = [];

    setRequestUrlMock((options) => {
      if (options.method === "PATCH") patchCalls.push(options);
      if (options.method === "GET") {
        return {
          status: 200,
          json: {
            total: 2,
            data: [
              { episode: { id: 31, sort: 1, type: 0 }, type: 2 },
              { episode: { id: 32, sort: 2, type: 0 }, type: 0 },
            ],
          },
        };
      }
      return { status: 200 };
    });

    await client.updateAnimeEpisodeProgress("test_token", 1003, 1);
    assert.equal(patchCalls.length, 0, "No PATCH should be sent when progress already matches");
  });

  it("marks all normal episodes when status is completed and progress is 0", async () => {
    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    let patchBody: any = null;

    setRequestUrlMock((options) => {
      if (options.method === "GET") {
        return {
          status: 200,
          json: {
            total: 2,
            data: [
              { episode: { id: 41, sort: 1, type: 0 }, type: 0 },
              { episode: { id: 42, sort: 2, type: 0 }, type: 0 },
            ],
          },
        };
      }
      if (options.method === "PATCH") {
        patchBody = JSON.parse(options.body);
        return { status: 204 };
      }
      return { status: 200 };
    });

    await client.updateAnimeEpisodeProgress("test_token", 1004, 0, "completed");
    assert.deepEqual(patchBody, {
      episode_id: [41, 42],
      type: 2,
    });
  });

  it("marks all episodes watched when relative progress matches total episodes for sequel anime (e.g. 13/13 with sort 13-25)", async () => {
    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    let patchBody: any = null;

    const sequelEpisodes = Array.from({ length: 13 }, (_, i) => ({
      episode: { id: 100 + i, sort: 13 + i, type: 0 },
      type: 0,
    }));

    setRequestUrlMock((options) => {
      if (options.method === "GET") {
        return {
          status: 200,
          json: {
            total: 13,
            data: sequelEpisodes,
          },
        };
      }
      if (options.method === "PATCH") {
        patchBody = JSON.parse(options.body);
        return { status: 204 };
      }
      return { status: 200 };
    });

    // Local progress is 13 (relative 13/13)
    await client.updateAnimeEpisodeProgress("test_token", 2001, 13, "ongoing");
    assert.ok(patchBody, "Expected PATCH request to be made");
    assert.deepEqual(patchBody, {
      episode_id: sequelEpisodes.map((e) => e.episode.id),
      type: 2,
    });
  });

  it("marks first N episodes watched for partial relative progress in sequel anime (e.g. 3/13 with sort 13-25)", async () => {
    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    let patchBody: any = null;

    const sequelEpisodes = Array.from({ length: 13 }, (_, i) => ({
      episode: { id: 100 + i, sort: 13 + i, type: 0 },
      type: 0,
    }));

    setRequestUrlMock((options) => {
      if (options.method === "GET") {
        return {
          status: 200,
          json: {
            total: 13,
            data: sequelEpisodes,
          },
        };
      }
      if (options.method === "PATCH") {
        patchBody = JSON.parse(options.body);
        return { status: 204 };
      }
      return { status: 200 };
    });

    // Local progress is 3 (relative 3/13): first 3 episodes (sort 13, 14, 15 -> ids 100, 101, 102)
    await client.updateAnimeEpisodeProgress("test_token", 2002, 3, "ongoing");
    assert.ok(patchBody, "Expected PATCH request to be made");
    assert.deepEqual(patchBody, {
      episode_id: [100, 101, 102],
      type: 2,
    });
  });

  it("marks episodes watched using absolute sort matching when progress is in [minSort, maxSort] (e.g. progress 15 for sort 13-25)", async () => {
    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    let patchBody: any = null;

    const sequelEpisodes = Array.from({ length: 13 }, (_, i) => ({
      episode: { id: 100 + i, sort: 13 + i, type: 0 },
      type: 0,
    }));

    setRequestUrlMock((options) => {
      if (options.method === "GET") {
        return {
          status: 200,
          json: {
            total: 13,
            data: sequelEpisodes,
          },
        };
      }
      if (options.method === "PATCH") {
        patchBody = JSON.parse(options.body);
        return { status: 204 };
      }
      return { status: 200 };
    });

    // Local progress is 15: absolute sort matching up to sort 15 (sort 13, 14, 15 -> ids 100, 101, 102)
    await client.updateAnimeEpisodeProgress("test_token", 2003, 15, "ongoing");
    assert.ok(patchBody, "Expected PATCH request to be made");
    assert.deepEqual(patchBody, {
      episode_id: [100, 101, 102],
      type: 2,
    });
  });

  it("unconditionally marks all normal episodes when status is completed for sequel anime", async () => {
    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    let patchBody: any = null;

    const sequelEpisodes = Array.from({ length: 13 }, (_, i) => ({
      episode: { id: 100 + i, sort: 13 + i, type: 0 },
      type: 0,
    }));

    setRequestUrlMock((options) => {
      if (options.method === "GET") {
        return {
          status: 200,
          json: {
            total: 13,
            data: sequelEpisodes,
          },
        };
      }
      if (options.method === "PATCH") {
        patchBody = JSON.parse(options.body);
        return { status: 204 };
      }
      return { status: 200 };
    });

    await client.updateAnimeEpisodeProgress("test_token", 2004, 0, "completed");
    assert.ok(patchBody, "Expected PATCH request to be made");
    assert.deepEqual(patchBody, {
      episode_id: sequelEpisodes.map((e) => e.episode.id),
      type: 2,
    });
  });

  it("unmarks episodes when progress in sequel anime decreases (e.g. from 3 to 1)", async () => {
    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const patchCalls: any[] = [];

    // Sort 13, 14, 15 already marked watched (type 2)
    const sequelEpisodes = Array.from({ length: 13 }, (_, i) => ({
      episode: { id: 100 + i, sort: 13 + i, type: 0 },
      type: i < 3 ? 2 : 0,
    }));

    setRequestUrlMock((options) => {
      if (options.method === "GET") {
        return {
          status: 200,
          json: {
            total: 13,
            data: sequelEpisodes,
          },
        };
      }
      if (options.method === "PATCH") {
        patchCalls.push({ url: options.url, body: JSON.parse(options.body) });
        return { status: 204 };
      }
      return { status: 200 };
    });

    // Decrease from 3 to 1: only sort 13 should remain watched, sort 14 and 15 should be unmarked
    await client.updateAnimeEpisodeProgress("test_token", 2005, 1, "ongoing");
    assert.equal(patchCalls.length, 1);
    assert.deepEqual(patchCalls[0].body, {
      episode_id: [101, 102],
      type: 0,
    });
  });
});

describe("extractBangumiSubjectId", () => {
  it("extracts from source_provider bangumi and source_id", () => {
    assert.equal(
      extractBangumiSubjectId({ source_provider: "bangumi", source_id: 12345 }),
      12345,
    );
    assert.equal(
      extractBangumiSubjectId({ source_provider: "bangumi", source_id: "67890" }),
      67890,
    );
  });

  it("extracts from source_urls matching bgm.tv or bangumi.tv", () => {
    assert.equal(
      extractBangumiSubjectId({ source_urls: ["https://bgm.tv/subject/99887"] }),
      99887,
    );
    assert.equal(
      extractBangumiSubjectId({ source_urls: "https://bangumi.tv/subject/11223" }),
      11223,
    );
  });

  it("extracts from numeric source_id for anime", () => {
    assert.equal(
      extractBangumiSubjectId({ media_type: "anime", source_id: "33445" }),
      33445,
    );
  });

  it("returns null when no Bangumi subject can be found", () => {
    assert.equal(extractBangumiSubjectId(null), null);
    assert.equal(extractBangumiSubjectId({}), null);
    assert.equal(extractBangumiSubjectId({ source_provider: "anilist", source_id: "123" }), null);
  });
});

describe("reconcileSingleItem", () => {
  it("authoritatively overwrites progress and status", () => {
    const local = { status: "ongoing", progress: 5, score: null, completedAt: "" };
    const remote = { type: 2, epStatus: 12, rate: 0, updatedAt: "2024-03-15T10:00:00Z" };

    const result = reconcileSingleItem(local, remote);
    assert.equal(result.kind, "update");
    if (result.kind === "update") {
      assert.equal(result.status, "completed");
      assert.equal(result.progress, 12);
      assert.equal(result.changed, true);
    }
  });

  it("preserves existing completed_at date", () => {
    const local = { status: "completed", progress: 12, score: 9, completedAt: "2023-01-01" };
    const remote = { type: 2, epStatus: 12, rate: 9, updatedAt: "2024-03-15T10:00:00Z" };

    const result = reconcileSingleItem(local, remote);
    assert.equal(result.kind, "update");
    if (result.kind === "update") {
      assert.equal(result.completedAt, "2023-01-01");
      assert.equal(result.changed, false);
    }
  });

  it("populates completed_at from Bangumi updated_at when local completed_at is empty", () => {
    const local = { status: "ongoing", progress: 10, score: null, completedAt: "" };
    const remote = { type: 2, epStatus: 12, rate: 0, updatedAt: "2024-03-15T10:00:00Z" };

    const result = reconcileSingleItem(local, remote);
    assert.equal(result.kind, "update");
    if (result.kind === "update") {
      assert.equal(result.completedAt, "2024-03-15");
    }
  });

  it("aligns completed progress to totalEpisodes when remote epStatus is incomplete (e.g. epStatus 1 with total 13)", () => {
    const local = { status: "completed", progress: 13, score: 9, completedAt: "2024-03-15" };
    // Bangumi returned epStatus: 1 due to web interface marking or previous partial sync
    const remote = { type: 2, epStatus: 1, rate: 9, updatedAt: "2024-03-15T10:00:00Z" };

    const result = reconcileSingleItem(local, remote, 13);
    assert.equal(result.kind, "update");
    if (result.kind === "update") {
      assert.equal(result.status, "completed");
      assert.equal(result.progress, 13, "Progress should be aligned to totalEpisodes (13), not corrupted to 1");
      assert.equal(result.changed, false, "Local 13 matches aligned target 13, so unchanged");
    }
  });

  it("aligns completed progress to totalEpisodes when remote epStatus is 0", () => {
    const local = { status: "ongoing", progress: 0, score: null, completedAt: "" };
    const remote = { type: 2, epStatus: 0, rate: 8, updatedAt: "2024-03-15T10:00:00Z" };

    const result = reconcileSingleItem(local, remote, 12);
    assert.equal(result.kind, "update");
    if (result.kind === "update") {
      assert.equal(result.status, "completed");
      assert.equal(result.progress, 12, "Progress should be aligned to totalEpisodes (12) for completed entry");
      assert.equal(result.changed, true);
    }
  });

  it("preserves remote epStatus when status is completed and remote epStatus >= total", () => {
    const local = { status: "ongoing", progress: 10, score: null, completedAt: "" };
    const remote = { type: 2, epStatus: 14, rate: 8, updatedAt: "2024-03-15T10:00:00Z" };

    const result = reconcileSingleItem(local, remote, 13);
    assert.equal(result.kind, "update");
    if (result.kind === "update") {
      assert.equal(result.progress, 14, "Progress should preserve higher remote epStatus");
    }
  });

  it("faithfully preserves remote epStatus without clamping when status is ongoing even if epStatus > total", () => {
    const local = { status: "ongoing", progress: 5, score: null, completedAt: "" };
    // Remote is watching (type 3), epStatus is 15 (exceeding total 12)
    const remote = { type: 3, epStatus: 15, rate: 0, updatedAt: "2024-03-15T10:00:00Z" };

    const result = reconcileSingleItem(local, remote, 12);
    assert.equal(result.kind, "update");
    if (result.kind === "update") {
      assert.equal(result.status, "ongoing");
      assert.equal(result.progress, 15, "Ongoing progress should not be clamped to totalEpisodes");
    }
  });

  it("pushes score to Bangumi when local has score and remote has none (flooring decimal rating)", () => {
    const local = { status: "completed", progress: 12, score: 9.5, completedAt: "2024-01-01" };
    const remote = { type: 2, epStatus: 12, rate: 0, updatedAt: "2024-01-01T00:00:00Z" };

    const result = reconcileSingleItem(local, remote);
    assert.equal(result.kind, "update");
    if (result.kind === "update") {
      assert.equal(result.scoreToPush, 9);
      assert.equal(result.score, 9.5);
      assert.equal(result.changed, true);
    }
  });

  it("pushes score to Bangumi when local has score 8.5 and remote has none", () => {
    const local = { status: "completed", progress: 12, score: 8.5, completedAt: "2024-01-01" };
    const remote = { type: 2, epStatus: 12, rate: 0, updatedAt: "2024-01-01T00:00:00Z" };

    const result = reconcileSingleItem(local, remote);
    assert.equal(result.kind, "update");
    if (result.kind === "update") {
      assert.equal(result.scoreToPush, 8);
      assert.equal(result.score, 8.5);
      assert.equal(result.changed, true);
    }
  });

  it("updates local score from remote when remote has score and local has none", () => {
    const local = { status: "completed", progress: 12, score: null, completedAt: "2024-01-01" };
    const remote = { type: 2, epStatus: 12, rate: 8, updatedAt: "2024-01-01T00:00:00Z" };

    const result = reconcileSingleItem(local, remote);
    assert.equal(result.kind, "update");
    if (result.kind === "update") {
      assert.equal(result.score, 8);
      assert.equal(result.scoreToPush, null);
      assert.equal(result.changed, true);
    }
  });

  it("detects score conflict when both sides have differing scores", () => {
    const local = { status: "completed", progress: 12, score: 7, completedAt: "2024-01-01" };
    const remote = { type: 2, epStatus: 12, rate: 9, updatedAt: "2024-01-01T00:00:00Z" };

    const result = reconcileSingleItem(local, remote);
    assert.equal(result.kind, "conflict");
    if (result.kind === "conflict") {
      assert.equal(result.localScore, 7);
      assert.equal(result.remoteRate, 9);
      assert.match(result.reason, /conflict/i);
    }
  });

  it("does not report conflict when local score has a 0.5 difference with Bangumi floored integer rating (9.5 vs 9)", () => {
    const local = { status: "completed", progress: 12, score: 9.5, completedAt: "2024-01-01" };
    const remote = { type: 2, epStatus: 12, rate: 9, updatedAt: "2024-01-01T00:00:00Z" };

    const result = reconcileSingleItem(local, remote);
    assert.equal(result.kind, "update");
    if (result.kind === "update") {
      assert.equal(result.score, 9.5, "Preserves local score of 9.5");
      assert.equal(result.scoreToPush, null, "Does not re-push since Bangumi already has 9");
      assert.equal(result.changed, false);
    }
  });

  it("detects conflict when local score is 9.5 and Bangumi has 10 (since 9.5 floors to 9, 10 is a difference)", () => {
    const local = { status: "completed", progress: 12, score: 9.5, completedAt: "2024-01-01" };
    const remote = { type: 2, epStatus: 12, rate: 10, updatedAt: "2024-01-01T00:00:00Z" };

    const result = reconcileSingleItem(local, remote);
    assert.equal(result.kind, "conflict");
    if (result.kind === "conflict") {
      assert.equal(result.localScore, 9.5);
      assert.equal(result.remoteRate, 10);
    }
  });

  it("detects conflict when local score is 9.5 and Bangumi has 8", () => {
    const local = { status: "completed", progress: 12, score: 9.5, completedAt: "2024-01-01" };
    const remote = { type: 2, epStatus: 12, rate: 8, updatedAt: "2024-01-01T00:00:00Z" };

    const result = reconcileSingleItem(local, remote);
    assert.equal(result.kind, "conflict");
    if (result.kind === "conflict") {
      assert.equal(result.localScore, 9.5);
      assert.equal(result.remoteRate, 8);
    }
  });

  it("detects conflict when local score is 8.5 and Bangumi has 9 (since 8.5 floors to 8)", () => {
    const local = { status: "completed", progress: 12, score: 8.5, completedAt: "2024-01-01" };
    const remote = { type: 2, epStatus: 12, rate: 9, updatedAt: "2024-01-01T00:00:00Z" };

    const result = reconcileSingleItem(local, remote);
    assert.equal(result.kind, "conflict");
    if (result.kind === "conflict") {
      assert.equal(result.localScore, 8.5);
      assert.equal(result.remoteRate, 9);
    }
  });

  it("does not report conflict when local score is 8.5 and Bangumi has 8", () => {
    const local = { status: "completed", progress: 12, score: 8.5, completedAt: "2024-01-01" };
    const remote = { type: 2, epStatus: 12, rate: 8, updatedAt: "2024-01-01T00:00:00Z" };

    const result = reconcileSingleItem(local, remote);
    assert.equal(result.kind, "update");
    if (result.kind === "update") {
      assert.equal(result.score, 8.5);
      assert.equal(result.scoreToPush, null);
    }
  });
});

describe("MediaNoteCodec sync validation", () => {
  it("allows completed anime without score when allowEmptyCompletedScore is true", () => {
    const form: MediaNoteForm = {
      title: "Completed Anime",
      status: "completed",
      score: "",
      completedAt: "2024-01-01",
    };
    const result: ExternalMediaResult = {
      title: "Completed Anime",
      mediaType: "anime",
      provider: "bangumi",
      sourceId: "123",
      sourceUrls: [],
    };
    assert.throws(
      () => validateMediaNoteForm(result, form),
    );
    const validated = validateMediaNoteForm(result, form, { allowEmptyCompletedScore: true });
    assert.equal(validated.status, "completed");
    assert.equal(validated.score, null);
  });
});

describe("BangumiSyncService.syncSingleNote", () => {
  function createTestHarness(initialFm: Record<string, unknown>, settingsOverride = {}) {
    const file = new TFile();
    file.path = "AnimeList/Anime/Test.md";
    file.basename = "Test";
    const frontmatter = { ...initialFm };
    const app = {
      vault: {
        getAbstractFileByPath(path: string) { return path === file.path ? file : null; },
      },
      metadataCache: {
        getFileCache(target: TFile) { return target === file ? { frontmatter } : null; },
      },
      fileManager: {
        async processFrontMatter(target: TFile, apply: (value: Record<string, unknown>) => void) {
          assert.equal(target, file);
          apply(frontmatter);
        },
      },
    };
    const settings = {
      ...DEFAULT_SETTINGS,
      bangumiAccessToken: "valid_test_token",
      ...settingsOverride,
    };
    return { app: app as any, file, frontmatter, settings };
  }

  it("halts note update and displays conflict when scores differ", async () => {
    const { app, file, frontmatter, settings } = createTestHarness({
      title: "Steins;Gate",
      source_provider: "bangumi",
      source_id: 100,
      status: "completed",
      progress: 24,
      score: 9,
      completed_at: "2023-01-01",
    });

    let patched = false;
    setRequestUrlMock((options) => {
      if (options.method === "GET") {
        return {
          status: 200,
          json: {
            subject_id: 100,
            type: 2,
            ep_status: 24,
            rate: 10, // differs from local score 9!
            updated_at: "2024-03-01T00:00:00Z",
          },
        };
      }
      if (options.method === "PATCH") {
        patched = true;
        return { status: 200 };
      }
      return { status: 200 };
    });

    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const service = new BangumiSyncService(app, () => settings, client);

    const result = await service.syncSingleNote(file);
    assert.equal(result.kind, "conflict");
    assert.equal(patched, false, "Must not patch Bangumi on conflict");
    assert.equal(frontmatter.score, 9, "Must not change local score on conflict");
    assert.equal(frontmatter.completed_at, "2023-01-01");
  });

  it("executes score push when local has score and Bangumi has none", async () => {
    const { app, file, frontmatter, settings } = createTestHarness({
      title: "Frieren",
      source_provider: "bangumi",
      source_id: 200,
      status: "ongoing",
      progress: 10,
      score: 8.5,
      completed_at: "",
    });

    let patchedPayload: any = null;
    setRequestUrlMock((options) => {
      if (options.method === "GET") {
        return {
          status: 200,
          json: {
            subject_id: 200,
            type: 2, // completed
            ep_status: 28,
            rate: 0, // unrated on Bangumi!
            updated_at: "2024-03-22T10:00:00Z",
          },
        };
      }
      if (options.method === "PATCH") {
        patchedPayload = JSON.parse(options.body);
        return { status: 200 };
      }
      return { status: 200 };
    });

    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const service = new BangumiSyncService(app, () => settings, client);

    const result = await service.syncSingleNote(file);
    assert.equal(result.kind, "success");
    assert.deepEqual(patchedPayload, { rate: 8 }); // floored 8.5 to 8
    assert.equal(frontmatter.status, "completed");
    assert.equal(frontmatter.progress, 28);
    assert.equal(frontmatter.score, 8.5);
    assert.equal(frontmatter.completed_at, "2024-03-22");
  });

  it("authoritatively overwrites progress and status while preserving existing completed_at", async () => {
    const { app, file, frontmatter, settings } = createTestHarness({
      title: "Evangelion",
      source_urls: ["https://bgm.tv/subject/300"],
      status: "ongoing",
      progress: 5,
      score: 9,
      completed_at: "2020-05-20",
      custom_tags: ["mecha", "classic"],
    });

    setRequestUrlMock(() => {
      return {
        status: 200,
        json: {
          subject_id: 300,
          type: 2, // completed
          ep_status: 26,
          rate: 9, // matching
          updated_at: "2024-01-01T00:00:00Z",
        },
      };
    });

    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const service = new BangumiSyncService(app, () => settings, client);

    const result = await service.syncSingleNote(file);
    assert.equal(result.kind, "success");
    assert.equal(frontmatter.status, "completed");
    assert.equal(frontmatter.progress, 26);
    assert.equal(frontmatter.completed_at, "2020-05-20", "Existing completed_at must be preserved");
    assert.deepEqual(frontmatter.custom_tags, ["mecha", "classic"], "Custom tags must be preserved");
  });

  it("does not conflict when local score is 9.5 and remote rate is 9, preserving local 9.5", async () => {
    const { app, file, frontmatter, settings } = createTestHarness({
      title: "Clannad",
      source_provider: "bangumi",
      source_id: 350,
      status: "completed",
      progress: 24,
      score: 9.5,
      completed_at: "2024-01-01",
    });

    let patched = false;
    setRequestUrlMock((options) => {
      if (options.method === "GET") {
        return {
          status: 200,
          json: {
            subject_id: 350,
            type: 2,
            ep_status: 24,
            rate: 9, // integer 9 vs local 9.5
            updated_at: "2024-01-01T00:00:00Z",
          },
        };
      }
      if (options.method === "PATCH") {
        patched = true;
        return { status: 200 };
      }
      return { status: 200 };
    });

    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const service = new BangumiSyncService(app, () => settings, client);

    const result = await service.syncSingleNote(file);
    assert.equal(result.kind, "success");
    assert.equal(patched, false, "Must not patch Bangumi when scores are consistent within 0.5");
    assert.equal(frontmatter.score, 9.5, "Must preserve exact local 9.5 score");
  });

  it("aligns completed anime progress to total episodes when pulling with incomplete remote ep_status", async () => {
    const { app, file, frontmatter, settings } = createTestHarness({
      title: "Mushoku Tensei S2 Part 2",
      source_provider: "bangumi",
      source_id: 444557,
      status: "completed",
      progress: 13,
      episodes: 13,
      score: 9,
      completed_at: "2024-07-01",
    });

    setRequestUrlMock(() => {
      return {
        status: 200,
        json: {
          subject_id: 444557,
          type: 2, // completed
          ep_status: 1, // corrupted/incomplete on Bangumi!
          rate: 9,
          updated_at: "2024-07-01T00:00:00Z",
          subject: {
            eps: 13,
          },
        },
      };
    });

    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const service = new BangumiSyncService(app, () => settings, client);

    const result = await service.syncSingleNote(file);
    assert.equal(result.kind, "success");
    assert.equal(result.changed, false, "Should be considered unchanged since progress aligns to 13");
    assert.equal(frontmatter.progress, 13, "Local progress should remain 13, not corrupted to 1");
  });
});

describe("BangumiSyncService.classifyCandidates", () => {
  it("accurately classifies candidates into new, updated, conflict, and synced", () => {
    const fileUpdated = new TFile();
    fileUpdated.path = "AnimeList/Anime/Updated.md";
    fileUpdated.basename = "Updated";
    const fmUpdated = {
      title: "Updated Show",
      source_provider: "bangumi",
      source_id: 101,
      status: "ongoing",
      progress: 5,
      score: null,
      completed_at: "",
    };

    const fileConflict = new TFile();
    fileConflict.path = "AnimeList/Anime/Conflict.md";
    fileConflict.basename = "Conflict";
    const fmConflict = {
      title: "Conflict Show",
      source_provider: "bangumi",
      source_id: 102,
      status: "completed",
      progress: 12,
      score: 8,
      completed_at: "2024-01-01",
    };

    const fileSynced = new TFile();
    fileSynced.path = "AnimeList/Anime/Synced.md";
    fileSynced.basename = "Synced";
    const fmSynced = {
      title: "Synced Show",
      source_provider: "bangumi",
      source_id: 103,
      status: "completed",
      progress: 24,
      score: 9,
      completed_at: "2024-02-01",
    };

    const files = [fileUpdated, fileConflict, fileSynced];
    const folder = new TFolder();
    folder.path = "AnimeList";
    folder.children = files;

    const cacheMap = new Map<TFile, any>([
      [fileUpdated, { frontmatter: fmUpdated }],
      [fileConflict, { frontmatter: fmConflict }],
      [fileSynced, { frontmatter: fmSynced }],
    ]);

    const app = {
      vault: {
        getMarkdownFiles() { return files; },
        getAbstractFileByPath(path: string) {
          if (path === "AnimeList") return folder;
          return files.find((f) => f.path === path) ?? null;
        },
      },
      metadataCache: {
        getFileCache(target: TFile) { return cacheMap.get(target) ?? null; },
      },
    };

    const service = new BangumiSyncService(app as any, () => DEFAULT_SETTINGS);

    const collections = [
      {
        subject_id: 999, // not in vault
        subject_type: 2,
        rate: 0,
        type: 3,
        ep_status: 1,
        vol_status: 0,
        updated_at: "2024-03-01T00:00:00Z",
        subject: { id: 999, name: "New Anime", name_cn: "全新動畫", eps: 12 },
      },
      {
        subject_id: 101, // in vault, local progress 5 -> remote 12
        subject_type: 2,
        rate: 0,
        type: 2, // completed
        ep_status: 12,
        vol_status: 0,
        updated_at: "2024-03-01T00:00:00Z",
        subject: { id: 101, name: "Updated Show", name_cn: "更新動畫" },
      },
      {
        subject_id: 102, // in vault, local score 8 vs remote score 10
        subject_type: 2,
        rate: 10,
        type: 2,
        ep_status: 12,
        vol_status: 0,
        updated_at: "2024-03-01T00:00:00Z",
        subject: { id: 102, name: "Conflict Show", name_cn: "衝突動畫" },
      },
      {
        subject_id: 103, // in vault, already matched
        subject_type: 2,
        rate: 9,
        type: 2,
        ep_status: 24,
        vol_status: 0,
        updated_at: "2024-02-01T00:00:00Z",
        subject: { id: 103, name: "Synced Show", name_cn: "已同步動畫" },
      },
    ];

    const classified = service.classifyCandidates(collections);
    assert.equal(classified.length, 4);

    assert.equal(classified[0].subjectId, 999);
    assert.equal(classified[0].action, "new");

    assert.equal(classified[1].subjectId, 101);
    assert.equal(classified[1].action, "updated");

    assert.equal(classified[2].subjectId, 102);
    assert.equal(classified[2].action, "conflict");
    assert.match(classified[2].conflictReason ?? "", /conflict/i);

    assert.equal(classified[3].subjectId, 103);
    assert.equal(classified[3].action, "synced");
  });
});

describe("BangumiSyncService.fetchRecentCollections", () => {
  it("filters collections by date cutoff and collection statuses", async () => {
    const now = Date.now();
    const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();
    const fortyDaysAgo = new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString();

    setRequestUrlMock(() => {
      return {
        status: 200,
        json: {
          total: 3,
          limit: 30,
          offset: 0,
          data: [
            {
              subject_id: 1,
              type: 3, // watching
              ep_status: 5,
              updated_at: tenDaysAgo, // within 30 days
            },
            {
              subject_id: 2,
              type: 5, // dropped
              ep_status: 2,
              updated_at: tenDaysAgo, // within 30 days, but dropped!
            },
            {
              subject_id: 3,
              type: 2, // completed
              ep_status: 12,
              updated_at: fortyDaysAgo, // older than 30 days
            },
          ],
        },
      };
    });

    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const service = new BangumiSyncService({} as any, () => DEFAULT_SETTINGS, client);

    const results = await service.fetchRecentCollections("token", 30, ["watching", "completed"]);
    assert.equal(results.length, 1);
    assert.equal(results[0].subject_id, 1);
  });
});

describe("BangumiSyncService.executeBatchSync", () => {
  it("executes batch operations, creates new notes, updates existing, and returns summary", async () => {
    const createdNotes: Array<{ path: string; content: string }> = [];
    const updatedFrontmatters: Record<string, any> = {};

    const existingFile = new TFile();
    existingFile.path = "AnimeList/Anime/Existing.md";
    existingFile.basename = "Existing";
    const existingFm = {
      title: "Existing Show",
      source_provider: "bangumi",
      source_id: 501,
      status: "ongoing",
      progress: 2,
      score: null,
      completed_at: "",
    };

    const app = {
      vault: {
        getAbstractFileByPath(path: string) {
          if (path === existingFile.path) return existingFile;
          return null;
        },
        async create(path: string, content: string) {
          createdNotes.push({ path, content });
          return new TFile();
        },
        async createFolder() {},
      },
      metadataCache: {
        getFileCache(f: TFile) {
          if (f === existingFile) return { frontmatter: existingFm };
          return null;
        },
      },
      fileManager: {
        async processFrontMatter(f: TFile, apply: (draft: any) => void) {
          apply(existingFm);
          updatedFrontmatters[f.path] = { ...existingFm };
        },
      },
    };

    setRequestUrlMock((options) => {
      if (options.url.includes("/subjects/502")) {
        return {
          status: 200,
          json: {
            id: 502,
            name: "New Show",
            name_cn: "新番動畫",
            eps: 12,
            images: {},
            tags: [],
          },
        };
      }
      if (options.url.includes("/collections/501")) {
        return {
          status: 200,
          json: {
            subject_id: 501,
            type: 2, // completed
            ep_status: 12,
            rate: 8,
            updated_at: "2024-03-01T00:00:00Z",
          },
        };
      }
      return { status: 200, json: {} };
    });

    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const settings = { ...DEFAULT_SETTINGS, bangumiAccessToken: "test_token" };
    let savedSettingsCalled = false;

    const service = new BangumiSyncService(
      app as any,
      () => settings,
      client,
      {
        refreshViews() {},
        async saveSettings() { savedSettingsCalled = true; },
      },
    );

    const candidates: any[] = [
      {
        subjectId: 502,
        title: "新番動畫",
        action: "new",
        remoteStatus: "watching",
        remoteEpStatus: 3,
        remoteRate: null,
        remoteUpdatedAt: "2024-03-01T00:00:00Z",
      },
      {
        subjectId: 501,
        title: "Existing Show",
        action: "updated",
        localPath: existingFile.path,
        remoteStatus: "completed",
        remoteEpStatus: 12,
        remoteRate: 8,
        remoteUpdatedAt: "2024-03-01T00:00:00Z",
      },
      {
        subjectId: 503,
        title: "Conflict Show",
        action: "conflict",
        conflictReason: "Score mismatch: 7 vs 9",
      },
      {
        subjectId: 504,
        title: "Synced Show",
        action: "synced",
      },
    ];

    const progressReports: number[] = [];
    const summary = await service.executeBatchSync("test_token", candidates, (completed, total) => {
      progressReports.push(completed);
    });

    assert.equal(summary.added, 1, "Should have 1 added");
    assert.equal(summary.updated, 1, "Should have 1 updated");
    assert.equal(summary.synced, 1, "Should have 1 synced");
    assert.equal(summary.conflicts.length, 1, "Should have 1 conflict");
    assert.equal(summary.conflicts[0].subjectId, 503);
    assert.equal(createdNotes.length, 1, "New note should be created");
    assert.ok(createdNotes[0].content.includes("新番動畫"));
    assert.equal(updatedFrontmatters[existingFile.path].status, "completed");
    assert.equal(updatedFrontmatters[existingFile.path].progress, 12);
    assert.equal(savedSettingsCalled, true);
    assert.ok(settings.lastSyncTimestamp > 0);
  });
});

describe("BangumiSyncService.executeStartupAutoSync", () => {
  it("skips execution when within cooldown interval", async () => {
    let networkCalled = false;
    setRequestUrlMock(() => {
      networkCalled = true;
      return { status: 200, json: {} };
    });

    const now = Date.now();
    const settings = {
      ...DEFAULT_SETTINGS,
      autoSyncOnStartup: true,
      bangumiAccessToken: "test_token",
      autoSyncCooldownMinutes: 30,
      lastSyncTimestamp: now - 10 * 60 * 1000, // only 10 minutes ago!
    };

    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const service = new BangumiSyncService({} as any, () => settings, client);

    const result = await service.executeStartupAutoSync();
    assert.equal(result, null);
    assert.equal(networkCalled, false, "Must not make network requests during cooldown");
  });

  it("executes when cooldown has passed and updates only existing vault notes", async () => {
    const createdNotes: string[] = [];
    const updatedFrontmatters: Record<string, any> = {};

    const existingFile = new TFile();
    existingFile.path = "AnimeList/Anime/Existing.md";
    existingFile.basename = "Existing";
    const existingFm = {
      title: "Existing Anime",
      source_provider: "bangumi",
      source_id: 601,
      status: "ongoing",
      progress: 3,
      score: null,
      completed_at: "",
    };

    const files = [existingFile];
    const folder = new TFolder();
    folder.path = "AnimeList";
    folder.children = files;

    const app = {
      vault: {
        getMarkdownFiles() { return files; },
        getAbstractFileByPath(path: string) {
          if (path === "AnimeList") return folder;
          if (path === existingFile.path) return existingFile;
          return null;
        },
        async create(path: string) {
          createdNotes.push(path);
          return new TFile();
        },
        async createFolder() {},
      },
      metadataCache: {
        getFileCache(f: TFile) {
          if (f === existingFile) return { frontmatter: existingFm };
          return null;
        },
      },
      fileManager: {
        async processFrontMatter(f: TFile, apply: (draft: any) => void) {
          apply(existingFm);
          updatedFrontmatters[f.path] = { ...existingFm };
        },
      },
    };

    const now = Date.now();
    const recentDate = new Date(now - 1000).toISOString();

    setRequestUrlMock((options) => {
      if (options.url.includes("/collections/601")) {
        return {
          status: 200,
          json: {
            subject_id: 601,
            type: 2, // completed
            ep_status: 12,
            rate: 0,
            updated_at: recentDate,
          },
        };
      }
      if (options.url.includes("/users/-/collections")) {
        return {
          status: 200,
          json: {
            total: 2,
            limit: 30,
            offset: 0,
            data: [
              {
                subject_id: 601, // exists in vault
                type: 2,
                ep_status: 12,
                updated_at: recentDate,
                subject: { id: 601, name: "Existing Anime" },
              },
              {
                subject_id: 602, // NEW - does NOT exist in vault!
                type: 3,
                ep_status: 4,
                updated_at: recentDate,
                subject: { id: 602, name: "Brand New Anime" },
              },
            ],
          },
        };
      }
      return { status: 200, json: {} };
    });

    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const settings = {
      ...DEFAULT_SETTINGS,
      autoSyncOnStartup: true,
      bangumiAccessToken: "test_token",
      autoSyncCooldownMinutes: 30,
      lastSyncTimestamp: now - 60 * 60 * 1000, // 60 minutes ago
    };

    let settingsSaved = false;
    const service = new BangumiSyncService(
      app as any,
      () => settings,
      client,
      {
        refreshViews() {},
        async saveSettings() { settingsSaved = true; },
      },
    );

    const summary = await service.executeStartupAutoSync();
    assert.ok(summary !== null);
    assert.equal(summary?.updated, 1, "Must update the 1 existing anime");
    assert.equal(summary?.added, 0, "Must NOT add any new anime during background auto-sync");
    assert.equal(createdNotes.length, 0, "Must not create files for new subjects");
    assert.equal(updatedFrontmatters[existingFile.path].status, "completed");
    assert.equal(updatedFrontmatters[existingFile.path].progress, 12);
    assert.equal(settingsSaved, true);
    assert.ok(settings.lastSyncTimestamp >= now);
  });
});

describe("BangumiSyncService.pushSingleNote and pushAnimeData", () => {
  function createHarness(initialFm: Record<string, unknown>, settingsOverride = {}) {
    const file = new TFile();
    file.path = "AnimeList/Anime/PushTest.md";
    file.basename = "PushTest";
    const frontmatter = { ...initialFm };
    const app = {
      vault: {
        getAbstractFileByPath(path: string) { return path === file.path ? file : null; },
      },
      metadataCache: {
        getFileCache(target: TFile) { return target === file ? { frontmatter } : null; },
      },
      fileManager: {
        async processFrontMatter(target: TFile, apply: (value: Record<string, unknown>) => void) {
          apply(frontmatter);
        },
      },
    };
    const settings = {
      ...DEFAULT_SETTINGS,
      bangumiAccessToken: "valid_test_token",
      ...settingsOverride,
    };
    return { app: app as any, file, frontmatter, settings };
  }

  it("successfully pushes anime note without ep_status in collection payload when collection endpoint rejects ep_status", async () => {
    const { app, file, settings } = createHarness({
      title: "Sousou no Frieren",
      media_type: "anime",
      source_provider: "bangumi",
      source_id: 4001,
      status: "ongoing",
      progress: 5,
      score: 8,
    });

    setRequestUrlMock((options) => {
      if (options.url.includes("/users/-/collections/") && !options.url.includes("/episodes")) {
        const body = JSON.parse(options.body || "{}");
        if (body.ep_status !== undefined || body.vol_status !== undefined) {
          const err: any = new Error("Request failed, status 400: can't set 'vol_status' or 'ep_status' on non-book subject");
          err.status = 400;
          throw err;
        }
      }
      return { status: 200, json: {} };
    });

    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const service = new BangumiSyncService(app, () => settings, client);

    const result = await service.pushSingleNote(file);
    // This asserts success, but currently it fails with 400 error because pushAnimeData sends ep_status to collection endpoint!
    assert.equal(result.kind, "success", `Expected success but got: ${JSON.stringify(result)}`);
  });

  it("pushes anime note data authoritatively to Bangumi", async () => {
    const { app, file, settings } = createHarness({
      title: "Sousou no Frieren",
      media_type: "anime",
      source_provider: "bangumi",
      source_id: 4001,
      status: "completed",
      progress: 28,
      score: 10,
    });

    let sentPayload: any = null;
    let sentMethod = "";
    setRequestUrlMock((options) => {
      if (options.url.includes("/users/-/collections/") && !options.url.includes("/episodes")) {
        sentMethod = options.method;
        sentPayload = JSON.parse(options.body);
      }
      return { status: 200, json: {} };
    });

    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const service = new BangumiSyncService(app, () => settings, client);

    const result = await service.pushSingleNote(file);
    assert.equal(result.kind, "success");
    assert.equal(result.subjectId, 4001);
    assert.equal(sentMethod, "PATCH");
    assert.deepEqual(sentPayload, { type: 2, rate: 10 });
  });

  it("floors decimal score when pushing to Bangumi (e.g. 9.5 pushes rate 9)", async () => {
    const { app, file, settings } = createHarness({
      title: "Steins;Gate",
      media_type: "anime",
      source_provider: "bangumi",
      source_id: 4009,
      status: "completed",
      progress: 24,
      score: 9.5,
    });

    let sentPayload: any = null;
    setRequestUrlMock((options) => {
      if (options.url.includes("/users/-/collections/") && !options.url.includes("/episodes")) {
        sentPayload = JSON.parse(options.body);
      }
      return { status: 200, json: {} };
    });

    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const service = new BangumiSyncService(app, () => settings, client);

    const result = await service.pushSingleNote(file);
    assert.equal(result.kind, "success");
    assert.deepEqual(sentPayload, { type: 2, rate: 9 });
  });

  it("creates collection via POST fallback when subject is uncollected (404)", async () => {
    const { app, file, settings } = createHarness({
      title: "New Uncollected Anime",
      media_type: "anime",
      source_provider: "bangumi",
      source_id: 4002,
      status: "ongoing",
      progress: 3,
      score: 8,
    });

    const methods: string[] = [];
    setRequestUrlMock((options) => {
      if (options.url.includes("/users/-/collections/") && !options.url.includes("/episodes")) {
        methods.push(options.method);
        if (options.method === "PATCH") return { status: 404 };
        if (options.method === "POST") return { status: 200 };
      }
      return { status: 200, json: {} };
    });

    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const service = new BangumiSyncService(app, () => settings, client);

    const result = await service.pushSingleNote(file);
    assert.equal(result.kind, "success");
    assert.deepEqual(methods, ["PATCH", "POST"]);
  });

  it("fails gracefully and surfaces error on network failure", async () => {
    const { app, file, settings } = createHarness({
      title: "Failing Anime",
      media_type: "anime",
      source_provider: "bangumi",
      source_id: 4003,
      status: "ongoing",
      progress: 1,
    });

    setRequestUrlMock(() => {
      throw new Error("Network offline");
    });

    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const service = new BangumiSyncService(app, () => settings, client);

    const result = await service.pushSingleNote(file);
    assert.equal(result.kind, "error");
    assert.ok(result.message.includes("Network offline"));
  });

  it("refuses to push when note is not an anime", async () => {
    const { app, file, settings } = createHarness({
      title: "Chainsaw Man Manga",
      media_type: "manga",
      source_provider: "bangumi",
      source_id: 5001,
      status: "ongoing",
      progress: 50,
    });

    let networkCalled = false;
    setRequestUrlMock(() => {
      networkCalled = true;
      return { status: 200 };
    });

    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const service = new BangumiSyncService(app, () => settings, client);

    const result = await service.pushSingleNote(file);
    assert.equal(result.kind, "error");
    assert.equal(result.message, "Not an anime note");
    assert.equal(networkCalled, false);
  });

  it("refuses to push when note has no Bangumi subject ID", async () => {
    const { app, file, settings } = createHarness({
      title: "No ID Anime",
      media_type: "anime",
      status: "ongoing",
      progress: 1,
    });

    let networkCalled = false;
    setRequestUrlMock(() => {
      networkCalled = true;
      return { status: 200 };
    });

    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const service = new BangumiSyncService(app, () => settings, client);

    const result = await service.pushSingleNote(file);
    assert.equal(result.kind, "error");
    assert.equal(result.message, "No Bangumi subject ID found");
    assert.equal(networkCalled, false);
  });

  it("returns error when token is not configured", async () => {
    const { app, file, settings } = createHarness(
      { title: "No Token Anime", source_provider: "bangumi", source_id: 123 },
      { bangumiAccessToken: "" },
    );

    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const service = new BangumiSyncService(app, () => settings, client);

    const result = await service.pushSingleNote(file);
    assert.equal(result.kind, "error");
    assert.equal(result.message, "Token not configured");
  });
});

describe("bangumiSyncFeature commands and lifecycle", () => {
  it("registers push command and sync command upon activation", () => {
    const commands: any[] = [];
    const host = {
      settings: DEFAULT_SETTINGS,
      addCommand(cmd: any) { commands.push(cmd); },
      registerEvent() {},
      register() {},
      syncBangumiCurrentAnime: async () => {},
      pushBangumiCurrentAnime: async () => {},
      app: { workspace: { on() {} } },
    };

    const lifecycle = bangumiSyncFeature.contributions.find((c) => c.kind === "lifecycle");
    assert.ok(lifecycle);
    lifecycle.activate(host as any);

    const pushCmd = commands.find((c) => c.id === "bangumi-push-current");
    assert.ok(pushCmd, "Push command must be registered");
    const syncCmd = commands.find((c) => c.id === "bangumi-sync-current");
    assert.ok(syncCmd, "Sync command must be registered");
  });

  it("decorates detail card with push button alongside sync button", () => {
    class FakeNode {
      tagName: string;
      className = "";
      textContent = "";
      type = "";
      title = "";
      children: FakeNode[] = [];
      parentElement: FakeNode | null = null;
      attributes: Record<string, string> = {};
      listeners: Record<string, Function[]> = {};

      constructor(tag: string) {
        this.tagName = tag.toUpperCase();
      }

      setAttribute(k: string, v: string) { this.attributes[k] = v; }
      getAttribute(k: string) { return this.attributes[k]; }
      appendChild(child: FakeNode) {
        child.parentElement = this;
        this.children.push(child);
        return child;
      }
      insertBefore(newChild: FakeNode, refChild: FakeNode | null) {
        const idx = refChild ? this.children.indexOf(refChild) : -1;
        if (idx >= 0) {
          newChild.parentElement = this;
          this.children.splice(idx, 0, newChild);
        } else {
          this.appendChild(newChild);
        }
        return newChild;
      }
      addEventListener(event: string, fn: Function) {
        (this.listeners[event] ??= []).push(fn);
      }
      click() {
        for (const fn of this.listeners.click ?? []) {
          fn({ preventDefault() {}, stopPropagation() {} });
        }
      }
      querySelector(sel: string): FakeNode | null {
        for (const c of this.children) {
          if (sel.startsWith(".") && c.className.split(" ").includes(sel.slice(1))) return c;
          const found = c.querySelector(sel);
          if (found) return found;
        }
        return null;
      }
    }

    const previousCreateEl = (globalThis as any).createEl;
    (globalThis as any).createEl = (tag: string) => new FakeNode(tag);

    try {
      const container = new FakeNode("div");
      const buttons = new FakeNode("div");
      buttons.className = "al-detail-buttons";
      const more = new FakeNode("button");
      more.className = "al-detail-more";
      buttons.appendChild(more);
      container.appendChild(buttons);

      let pushed = false;
      const host = {
        app: {
          vault: {
            getAbstractFileByPath: () => new TFile(),
          },
        },
        pushBangumiNote: async () => { pushed = true; },
        syncBangumiNote: async () => {},
      };

      decorateBangumiDetail(
        host as any,
        container as any,
        "AnimeList/Anime/Frieren.md",
        { source_provider: "bangumi", source_id: 12345 },
      );

      const pushBtn = buttons.querySelector(".al-detail-bangumi-push");
      const syncBtn = buttons.querySelector(".al-detail-bangumi-sync");
      assert.ok(pushBtn !== null, "Push button should be created");
      assert.ok(syncBtn !== null, "Sync button should be created");

      pushBtn?.click();
      assert.equal(pushed, true);
    } finally {
      (globalThis as any).createEl = previousCreateEl;
    }
  });
});

describe("Subject metadata refresh and completed alignment domain", () => {
  it("updates progress_total and aligns progress when anime is completed", () => {
    const draft: Record<string, unknown> = {
      title: "Solo Leveling",
      status: "completed",
      progress: 0,
      progress_total: 0,
      score: 9,
    };
    const changed = refreshSubjectMetadata(draft, {
      totalEpisodes: 12,
      sourceScore: 8.3,
    });
    assert.equal(changed, true);
    assert.equal(draft.progress_total, 12);
    assert.equal(draft.progress, 12, "Completed anime progress must align to new total");
    assert.equal(draft.source_score, 8.3);
    assert.equal(draft.score, 9, "User score must be preserved");
  });

  it("does not force progress alignment when anime is ongoing", () => {
    const draft: Record<string, unknown> = {
      title: "One Piece",
      status: "ongoing",
      progress: 50,
      progress_total: 0,
    };
    const changed = refreshSubjectMetadata(draft, {
      totalEpisodes: 1100,
    });
    assert.equal(changed, true);
    assert.equal(draft.progress_total, 1100);
    assert.equal(draft.progress, 50, "Ongoing anime progress must not be overwritten");
  });

  it("enriches missing broadcast season, studios, and original title without touching existing", () => {
    const draft: Record<string, unknown> = {
      title: "Bocchi the Rock!",
      season: "",
      studios: [],
      title_original: "",
      user_tags: ["music", "comedy"],
      started_at: "2022-10-01",
      completed_at: "2022-12-25",
    };
    const changed = refreshSubjectMetadata(draft, {
      season: "fall",
      seasonYear: 2022,
      studios: ["CloverWorks"],
      originalTitle: "ぼっち・ざ・ろっく！",
    });
    assert.equal(changed, true);
    assert.equal(draft.season, "fall");
    assert.equal(draft.season_year, 2022);
    assert.deepEqual(draft.studios, ["CloverWorks"]);
    assert.equal(draft.title_original, "ぼっち・ざ・ろっく！");
    assert.deepEqual(draft.user_tags, ["music", "comedy"]);
    assert.equal(draft.started_at, "2022-10-01");
    assert.equal(draft.completed_at, "2022-12-25");
  });

  it("shouldFetchDeepSubjectMetadata accurately detects notes missing core metadata", () => {
    assert.equal(shouldFetchDeepSubjectMetadata({}, null), true, "Empty note needs deep metadata");
    assert.equal(shouldFetchDeepSubjectMetadata({ studios: ["Kyoto Animation"] }, null), true, "Missing season needs deep metadata");
    assert.equal(shouldFetchDeepSubjectMetadata({ studios: ["Kyoto Animation"], season: "spring" }, null), true, "Missing total episodes needs deep metadata");
    assert.equal(
      shouldFetchDeepSubjectMetadata(
        { studios: ["Kyoto Animation"], season: "spring", progress_total: 12 },
        null,
      ),
      false,
      "Complete note does not need deep metadata",
    );
    assert.equal(
      shouldFetchDeepSubjectMetadata(
        { studios: ["Kyoto Animation"], season: "spring" },
        { eps: 12 },
      ),
      false,
      "Basic subject providing eps avoids deep fetch",
    );
  });
});

describe("BangumiSyncClient.fetchAllCollectionSubjectIds", () => {
  it("paginates user collections and returns all subject IDs as a Set", async () => {
    let callCount = 0;
    setRequestUrlMock((options) => {
      const url = new URL(options.url);
      if (url.pathname === "/v0/me") {
        return { status: 200, json: { username: "testuser" } };
      }
      if (url.pathname.includes("/collections")) {
        callCount += 1;
        const offset = Number(url.searchParams.get("offset") || "0");
        if (offset === 0) {
          return {
            status: 200,
            json: {
              total: 3,
              limit: 2,
              offset: 0,
              data: [{ subject_id: 101 }, { subject_id: 102 }],
            },
          };
        }
        return {
          status: 200,
          json: {
            total: 3,
            limit: 2,
            offset: 2,
            data: [{ subject_id: 103 }],
          },
        };
      }
      return { status: 200 };
    });

    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const ids = await client.fetchAllCollectionSubjectIds("test_token", { limit: 2 });
    assert.equal(callCount, 2);
    assert.deepEqual([...ids].sort(), [101, 102, 103]);
  });
});

describe("Uncollected subject push on single note sync", () => {
  function createTestHarness(initialFm: Record<string, unknown>) {
    const file = new TFile();
    file.path = "AnimeList/Anime/Uncollected.md";
    file.basename = "Uncollected";
    const frontmatter = { ...initialFm };
    const app = {
      vault: {
        getAbstractFileByPath(path: string) { return path === file.path ? file : null; },
      },
      metadataCache: {
        getFileCache(target: TFile) { return target === file ? { frontmatter } : null; },
      },
      fileManager: {
        async processFrontMatter(target: TFile, apply: (value: Record<string, unknown>) => void) {
          assert.equal(target, file);
          apply(frontmatter);
        },
      },
    };
    const settings = {
      ...DEFAULT_SETTINGS,
      bangumiAccessToken: "valid_test_token",
    };
    return { app: app as any, file, frontmatter, settings };
  }

  it("initiates uncollected push when subject is not in user collection, creating collection and returning pushed", async () => {
    const { app, file, frontmatter, settings } = createTestHarness({
      title: "Dungeon Meshi",
      source_provider: "bangumi",
      source_id: 999,
      status: "ongoing",
      progress: 7,
      score: 8.5,
    });

    let postedPayload: any = null;
    let episodesUpdated = false;
    let deepSubjectFetched = false;

    setRequestUrlMock((options) => {
      const url = new URL(options.url);
      if (url.pathname === "/v0/me") {
        return { status: 200, json: { username: "testuser" } };
      }
      if (options.method === "GET" && url.pathname.includes("/users/testuser/collections/999")) {
        return { status: 404, text: "Not Found" };
      }
      if (options.method === "PATCH" && url.pathname.includes("/collections/999")) {
        return { status: 404, text: "Not Found" };
      }
      if (options.method === "POST" && url.pathname.includes("/collections/999")) {
        postedPayload = JSON.parse(options.body);
        return { status: 201 };
      }
      if (url.pathname.includes("/episodes")) {
        episodesUpdated = true;
        return { status: 200, json: { data: [] } };
      }
      if (options.method === "GET" && url.pathname === "/v0/subjects/999") {
        deepSubjectFetched = true;
        return {
          status: 200,
          json: {
            id: 999,
            name: "ダンジョン飯",
            eps: 24,
            rating: { score: 8.4 },
            infobox: [{ key: "动画制作", value: "Trigger" }],
          },
        };
      }
      return { status: 200 };
    });

    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const service = new BangumiSyncService(app, () => settings, client);

    const result = await service.syncSingleNote(file);
    assert.equal(result.kind, "pushed");
    assert.equal(result.subjectId, 999);
    assert.deepEqual(postedPayload, { rate: 8, type: 3 });
    assert.equal(episodesUpdated, true);
    assert.equal(deepSubjectFetched, true);
    assert.equal(frontmatter.progress_total, 24);
    assert.equal(frontmatter.source_score, 8.4);
    assert.deepEqual(frontmatter.studios, ["Trigger"]);
    assert.equal(frontmatter.title_original, "ダンジョン飯");
    assert.equal(frontmatter.score, 8.5, "User local score must remain intact");
  });
});

describe("Uncollected discovery and DiffPreviewModal push group", () => {
  it("classifyCandidates identifies local notes not in collected set as action: push", () => {
    const file1 = new TFile();
    file1.path = "AnimeList/Anime/A.md";
    file1.basename = "A";
    const file2 = new TFile();
    file2.path = "AnimeList/Anime/B.md";
    file2.basename = "B";

    const localNotes = [
      { file: file1, subjectId: 100, frontmatter: { title: "Anime A", status: "ongoing", progress: 3, source_provider: "bangumi", source_id: 100 } },
      { file: file2, subjectId: 200, frontmatter: { title: "Anime B", status: "completed", progress: 12, progress_total: 12, score: 9, source_provider: "bangumi", source_id: 200 } },
    ];

    const files = [file1, file2];
    const folder = new TFolder();
    folder.path = "AnimeList";
    folder.children = files;

    const app = {
      vault: {
        getAbstractFileByPath: (path: string) => (path === "AnimeList" ? folder : null),
        getMarkdownFiles: () => files,
      },
      metadataCache: {
        getFileCache: (f: TFile) => {
          const found = localNotes.find((n) => n.file === f);
          return found ? { frontmatter: found.frontmatter } : null;
        },
      },
    };

    const service = new BangumiSyncService(app as any, () => DEFAULT_SETTINGS);
    const collections = [
      {
        subject_id: 100,
        subject_type: 2,
        rate: 0,
        type: 3,
        ep_status: 3,
        vol_status: 0,
        updated_at: "2024-03-01T00:00:00Z",
      },
    ];
    const allCollectedIds = new Set([100]);

    const candidates = service.classifyCandidates(collections, allCollectedIds);
    assert.equal(candidates.length, 2);

    assert.equal(candidates[0].action, "push", "Push items must be placed before synced items");
    assert.equal(candidates[1].action, "synced");

    const syncedItem = candidates.find((c) => c.subjectId === 100);
    assert.ok(syncedItem);
    assert.equal(syncedItem.action, "synced");

    const pushItem = candidates.find((c) => c.subjectId === 200);
    assert.ok(pushItem);
    assert.equal(pushItem.action, "push");
    assert.equal(pushItem.localStatus, "completed");
    assert.equal(pushItem.localProgress, 12);
    assert.equal(pushItem.localScore, 9);
    assert.equal(pushItem.totalEps, 12);
  });
});

describe("Batch sync and startup auto sync with push execution", () => {
  it("executeBatchSync processes push items, updates remote and local metadata, and increments summary.pushed", async () => {
    const file = new TFile();
    file.path = "AnimeList/Anime/PushMe.md";
    file.basename = "PushMe";
    const frontmatter: Record<string, unknown> = {
      title: "Push Me",
      status: "completed",
      progress: 12,
      score: 8,
    };

    const app = {
      vault: {
        getAbstractFileByPath: (p: string) => (p === file.path ? file : null),
      },
      metadataCache: {
        getFileCache: () => ({ frontmatter }),
      },
      fileManager: {
        processFrontMatter: async (_target: TFile, apply: Function) => {
          apply(frontmatter);
        },
      },
    };

    let pushExecuted = false;
    setRequestUrlMock((options) => {
      const url = new URL(options.url);
      if (options.method === "PATCH" && url.pathname.includes("/collections/888")) {
        pushExecuted = true;
        return { status: 200 };
      }
      if (url.pathname.includes("/episodes")) {
        return { status: 200, json: { data: [] } };
      }
      if (options.method === "GET" && url.pathname === "/v0/subjects/888") {
        return {
          status: 200,
          json: {
            id: 888,
            name: "Push Me",
            eps: 12,
            rating: { score: 7.9 },
          },
        };
      }
      return { status: 200 };
    });

    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const service = new BangumiSyncService(app as any, () => ({ ...DEFAULT_SETTINGS, bangumiAccessToken: "token" }), client);

    const items = [
      {
        subjectId: 888,
        title: "Push Me",
        action: "push" as const,
        localPath: file.path,
        localStatus: "completed",
        localProgress: 12,
        localScore: 8,
      },
    ];

    const summary = await service.executeBatchSync("token", items);
    assert.equal(summary.pushed, 1);
    assert.equal(pushExecuted, true);
    assert.equal(frontmatter.source_score, 7.9);
    assert.equal(frontmatter.progress_total, 12);
  });

  it("refreshes progress_total, source_score, and completed progress on syncSingleNote for collected anime", async () => {
    const file = new TFile();
    file.path = "AnimeList/Anime/Collected.md";
    file.basename = "Collected";
    const frontmatter: Record<string, unknown> = {
      title: "Solo Leveling",
      source_provider: "bangumi",
      source_id: 400,
      status: "completed",
      progress: 0,
      progress_total: 0,
      score: 8.5,
      completed_at: "2024-03-30",
      user_tags: ["action", "fantasy"],
    };

    const app = {
      vault: {
        getAbstractFileByPath: (p: string) => (p === file.path ? file : null),
      },
      metadataCache: {
        getFileCache: () => ({ frontmatter }),
      },
      fileManager: {
        processFrontMatter: async (_target: TFile, apply: Function) => {
          apply(frontmatter);
        },
      },
    };

    setRequestUrlMock((options) => {
      const url = new URL(options.url);
      if (url.pathname === "/v0/me") return { status: 200, json: { username: "testuser" } };
      if (options.method === "GET" && url.pathname.includes("/users/testuser/collections/400")) {
        return {
          status: 200,
          json: {
            subject_id: 400,
            type: 2, // completed
            rate: 8, // matching floored 8.5
            ep_status: 0, // unaligned remote ep_status
            updated_at: "2024-03-31T00:00:00Z",
            subject: {
              id: 400,
              name: "俺だけレベルアップな件",
              eps: 12,
              score: 8.1,
            },
          },
        };
      }
      return { status: 200 };
    });

    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const service = new BangumiSyncService(app as any, () => ({ ...DEFAULT_SETTINGS, bangumiAccessToken: "token" }), client);

    const result = await service.syncSingleNote(file);
    assert.equal(result.kind, "success");
    assert.equal(frontmatter.progress_total, 12, "Total episodes must be refreshed from 0 to 12");
    assert.equal(frontmatter.progress, 12, "Completed anime progress must be aligned to 12");
    assert.equal(frontmatter.source_score, 8.1, "Bangumi score must be refreshed");
    assert.equal(frontmatter.score, 8.5, "User personal score must be preserved");
    assert.equal(frontmatter.completed_at, "2024-03-30", "User completion date must be preserved");
    assert.deepEqual(frontmatter.user_tags, ["action", "fantasy"], "User tags must be preserved");
  });

  it("executeStartupAutoSync pushes uncollected notes and updates existing notes", async () => {
    const filePush = new TFile();
    filePush.path = "AnimeList/Anime/StartupPush.md";
    filePush.basename = "StartupPush";
    const fmPush: Record<string, unknown> = {
      title: "Startup Push",
      source_provider: "bangumi",
      source_id: 701,
      status: "ongoing",
      progress: 3,
    };

    const fileUpdate = new TFile();
    fileUpdate.path = "AnimeList/Anime/StartupUpdate.md";
    fileUpdate.basename = "StartupUpdate";
    const fmUpdate: Record<string, unknown> = {
      title: "Startup Update",
      source_provider: "bangumi",
      source_id: 702,
      status: "ongoing",
      progress: 1,
    };

    const files = [filePush, fileUpdate];
    const folder = new TFolder();
    folder.path = "AnimeList";
    folder.children = files;

    const app = {
      vault: {
        getAbstractFileByPath: (p: string) => {
          if (p === "AnimeList") return folder;
          if (p === filePush.path) return filePush;
          if (p === fileUpdate.path) return fileUpdate;
          return null;
        },
        getMarkdownFiles: () => files,
      },
      metadataCache: {
        getFileCache: (f: TFile) => {
          if (f === filePush) return { frontmatter: fmPush };
          if (f === fileUpdate) return { frontmatter: fmUpdate };
          return null;
        },
      },
      fileManager: {
        processFrontMatter: async (f: TFile, apply: Function) => {
          if (f === filePush) apply(fmPush);
          if (f === fileUpdate) apply(fmUpdate);
        },
      },
    };

    let pushCount = 0;
    setRequestUrlMock((options) => {
      const url = new URL(options.url);
      if (url.pathname === "/v0/me") return { status: 200, json: { username: "testuser" } };
      if (options.method === "GET" && url.pathname.includes("/users/testuser/collections/702")) {
        return {
          status: 200,
          json: {
            subject_id: 702,
            type: 3,
            rate: 0,
            ep_status: 4,
            updated_at: new Date().toISOString(),
            subject: { id: 702, eps: 12 },
          },
        };
      }
      if (options.method === "GET" && url.pathname.endsWith("/collections")) {
        return {
          status: 200,
          json: {
            total: 1,
            limit: 50,
            offset: 0,
            data: [
              {
                subject_id: 702,
                subject_type: 2,
                type: 3, // ongoing
                ep_status: 4, // updated from 1 to 4
                rate: 0,
                updated_at: new Date().toISOString(),
                subject: { id: 702, eps: 12 },
              },
            ],
          },
        };
      }
      if (options.method === "PATCH" && url.pathname.includes("/collections/701")) {
        pushCount += 1;
        return { status: 200 };
      }
      if (url.pathname.includes("/episodes")) {
        return { status: 200, json: { data: [] } };
      }
      return { status: 200 };
    });

    const settings = {
      ...DEFAULT_SETTINGS,
      bangumiAccessToken: "valid_token",
      autoSyncOnStartup: true,
      lastSyncTimestamp: 0,
      autoSyncCooldownMinutes: 0,
    };

    const client = new BangumiSyncClient({ minIntervalMs: 0 });
    const service = new BangumiSyncService(app as any, () => settings, client);

    const summary = await service.executeStartupAutoSync();
    assert.ok(summary);
    assert.equal(summary.updated, 1, "Should update 1 anime");
    assert.equal(summary.pushed, 1, "Should push 1 anime");
    assert.equal(pushCount, 1);
    assert.equal(fmUpdate.progress, 4);
  });
});

describe("DiffPreviewModal category filtering and selection", () => {
  it("includes push items in default selection and provides accurate count text", () => {
    const items = [
      { subjectId: 1, title: "Item 1", action: "new" as const, remoteStatus: "watching" as const, remoteEpStatus: 1, remoteRate: null, remoteUpdatedAt: "" },
      { subjectId: 2, title: "Item 2", action: "updated" as const, remoteStatus: "completed" as const, remoteEpStatus: 12, remoteRate: null, remoteUpdatedAt: "" },
      { subjectId: 3, title: "Item 3", action: "push" as const, localStatus: "watching", localProgress: 5, localScore: 8 },
      { subjectId: 4, title: "Item 4", action: "conflict" as const, remoteStatus: "completed" as const, remoteEpStatus: 12, remoteRate: 7, remoteUpdatedAt: "", conflictReason: "Score conflict" },
      { subjectId: 5, title: "Item 5", action: "synced" as const, remoteStatus: "completed" as const, remoteEpStatus: 12, remoteRate: 8, remoteUpdatedAt: "" },
    ];

    const modal = new DiffPreviewModal(
      {} as any,
      { settings: DEFAULT_SETTINGS } as any,
      items,
      {} as any,
    );

    const selected = (modal as any).selectedIds as Set<number>;
    assert.equal(selected.has(1), true, "New must be selected by default");
    assert.equal(selected.has(2), true, "Updated must be selected by default");
    assert.equal(selected.has(3), true, "Push must be selected by default");
    assert.equal(selected.has(4), false, "Conflict must not be selected");
    assert.equal(selected.has(5), false, "Synced must not be selected");

    const countText = (modal as any).formatCountText();
    assert.equal(countText, "Selected: 3 / 5 (Pull: 2, Push: 1)");
  });
});
