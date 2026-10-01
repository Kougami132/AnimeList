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
import { TFile, TFolder } from "obsidian";
import type { ExternalMediaResult, MediaNoteForm } from "../src/domain/media-types";

describe("Bangumi sync settings defaults and normalization", () => {
  it("provides correct default settings", () => {
    assert.equal(DEFAULT_SETTINGS.bangumiAccessToken, "");
    assert.equal(DEFAULT_SETTINGS.syncRecentDays, DEFAULT_SYNC_RECENT_DAYS);
    assert.deepEqual(DEFAULT_SETTINGS.syncCollectionTypes, DEFAULT_BANGUMI_COLLECTION_TYPES);
    assert.equal(DEFAULT_SETTINGS.autoSyncOnStartup, false);
    assert.equal(DEFAULT_SETTINGS.autoSyncCooldownMinutes, DEFAULT_AUTO_SYNC_COOLDOWN_MINUTES);
    assert.equal(DEFAULT_SETTINGS.lastSyncTimestamp, 0);
  });

  it("normalizes settings safely", () => {
    const normalized = normalizeAnimeListSettings({
      bangumiAccessToken: "  token_xyz  ",
      syncRecentDays: 14.8,
      syncCollectionTypes: ["watching", "invalid_type", "watching", "dropped"],
      autoSyncOnStartup: true,
      autoSyncCooldownMinutes: 45.2,
      lastSyncTimestamp: 1700000000,
    });

    assert.equal(normalized.bangumiAccessToken, "token_xyz");
    assert.equal(normalized.syncRecentDays, 15);
    assert.deepEqual(normalized.syncCollectionTypes, ["watching", "dropped"]);
    assert.equal(normalized.autoSyncOnStartup, true);
    assert.equal(normalized.autoSyncCooldownMinutes, 45);
    assert.equal(normalized.lastSyncTimestamp, 1700000000);
  });

  it("falls back to defaults for invalid settings values", () => {
    const normalized = normalizeAnimeListSettings({
      bangumiAccessToken: 12345,
      syncRecentDays: -5,
      syncCollectionTypes: ["invalid_only"],
      autoSyncOnStartup: "yes",
      autoSyncCooldownMinutes: 0,
      lastSyncTimestamp: -100,
    });

    assert.equal(normalized.bangumiAccessToken, "");
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

    setRequestUrlMock((options) => {
      passedHeaders = options.headers;
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
    });

    const profile = await client.verifyToken("test_secret_token_123");
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

  it("pushes score to Bangumi when local has score and remote has none", () => {
    const local = { status: "completed", progress: 12, score: 8.5, completedAt: "2024-01-01" };
    const remote = { type: 2, epStatus: 12, rate: 0, updatedAt: "2024-01-01T00:00:00Z" };

    const result = reconcileSingleItem(local, remote);
    assert.equal(result.kind, "update");
    if (result.kind === "update") {
      assert.equal(result.scoreToPush, 9);
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
    assert.deepEqual(patchedPayload, { rate: 9 }); // rounded 8.5 to 9
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
