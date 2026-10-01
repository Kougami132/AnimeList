import { Notice, TFile, normalizePath, type App } from "obsidian";
import type { AnimeListSettings } from "../../domain/settings-types";
import type { ExternalMediaResult, MediaNoteForm } from "../../domain/media-types";
import {
  type BangumiCollectionStatus,
  type BangumiSyncItem,
  type BangumiSyncSummary,
  bangumiTypeNumberToStatus,
} from "../../domain/bangumi-sync/types";
import { extractBangumiSubjectId } from "../../domain/bangumi-sync/subject-matching";
import { reconcileSingleItem, type LocalMediaState, type RemoteBangumiState } from "../../domain/bangumi-sync/reconcile";
import { BangumiSyncClient, type BangumiCollectionResponseItem } from "./bangumi-sync-client";
import { buildMediaMarkdown } from "../media-note-codec";
import { getScopedMarkdownFiles } from "../vault-scope";
import { slugify } from "../../domain/value-normalization";
import { normalizeBangumiSubject } from "../provider-normalizers";
import { requestUrl } from "obsidian";
import { USER_AGENT } from "../../app-metadata";

export interface BangumiSyncCallbacks {
  refreshViews(): void;
  saveSettings(): Promise<void>;
}

export type SingleSyncResult =
  | { kind: "success"; subjectId: number; title: string; changed: boolean; pushedScore: number | null }
  | { kind: "conflict"; subjectId: number; title: string; reason: string; localScore: number; remoteRate: number }
  | { kind: "not_collected"; subjectId: number; title: string }
  | { kind: "error"; subjectId: number; title: string; message: string };

function titleString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export class BangumiSyncService {
  constructor(
    private readonly app: App,
    private readonly settings: () => AnimeListSettings,
    private readonly client: BangumiSyncClient = new BangumiSyncClient(),
    private readonly callbacks?: BangumiSyncCallbacks,
  ) {}

  private getScanFolders(): string[] {
    const s = this.settings();
    const roots = [s.libraryRoot, s.flatMediaFolder, ...s.additionalScanFolders];
    return [...new Set(roots.filter(Boolean))];
  }

  getBangumiAnimeNotes(): Array<{ file: TFile; subjectId: number; frontmatter: Record<string, unknown> }> {
    const files = getScopedMarkdownFiles(this.app, this.getScanFolders());
    const matches: Array<{ file: TFile; subjectId: number; frontmatter: Record<string, unknown> }> = [];

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter;
      if (!fm) continue;
      const subjectId = extractBangumiSubjectId(fm);
      if (subjectId) {
        matches.push({ file, subjectId, frontmatter: fm });
      }
    }

    return matches;
  }

  async syncSingleNote(file: TFile): Promise<SingleSyncResult> {
    const token = this.settings().bangumiAccessToken.trim();
    if (!token) {
      new Notice("Please configure your personal access token in settings first.");
      return { kind: "error", subjectId: 0, title: file.basename, message: "Token not configured" };
    }

    const cache = this.app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;
    const subjectId = extractBangumiSubjectId(fm);
    const title = titleString(fm?.title, file.basename);

    if (!subjectId) {
      new Notice(`Note "${file.basename}" does not have a valid Bangumi subject ID.`);
      return { kind: "error", subjectId: 0, title, message: "No Bangumi subject ID found" };
    }

    try {
      const collection = await this.client.fetchCollection(token, subjectId);
      if (!collection) {
        new Notice(`"${title}" is not in your Bangumi collection.`);
        return { kind: "not_collected", subjectId, title };
      }

      const local: LocalMediaState = {
        status: typeof fm?.status === "string" ? fm.status : "",
        progress: typeof fm?.progress === "number" ? fm.progress : 0,
        score: typeof fm?.score === "number" && fm.score > 0 ? fm.score : null,
        completedAt: typeof fm?.completed_at === "string" ? fm.completed_at.trim() : "",
      };

      const remote: RemoteBangumiState = {
        type: collection.type,
        epStatus: collection.ep_status ?? 0,
        rate: collection.rate ?? 0,
        updatedAt: collection.updated_at ?? "",
      };

      const reconciled = reconcileSingleItem(local, remote);

      if (reconciled.kind === "conflict") {
        new Notice(
          `Score conflict for "${title}": Local is ${reconciled.localScore}, Bangumi is ${reconciled.remoteRate}. Sync stopped to protect your data.`,
          8000,
        );
        return {
          kind: "conflict",
          subjectId,
          title,
          reason: reconciled.reason,
          localScore: reconciled.localScore,
          remoteRate: reconciled.remoteRate,
        };
      }

      // If local has score and remote does not, push score
      if (reconciled.scoreToPush !== null) {
        await this.client.patchCollection(token, subjectId, { rate: reconciled.scoreToPush });
      }

      // Authoritatively update note frontmatter
      await this.app.fileManager.processFrontMatter(file, (draft) => {
        draft.status = reconciled.status;
        draft.progress = reconciled.progress;
        if (reconciled.completedAt) draft.completed_at = reconciled.completedAt;
        if (reconciled.score != null) draft.score = reconciled.score;
        else delete draft.score;
      });

      this.callbacks?.refreshViews();

      const pushNotice = reconciled.scoreToPush !== null ? ` (Pushed score: ${reconciled.scoreToPush})` : "";
      new Notice(`Synced "${title}" with Bangumi${pushNotice}.`);

      return {
        kind: "success",
        subjectId,
        title,
        changed: reconciled.changed,
        pushedScore: reconciled.scoreToPush,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      new Notice(`Bangumi sync failed for "${title}": ${message}`);
      return { kind: "error", subjectId, title, message };
    }
  }

  async fetchRecentCollections(
    token: string,
    days: number,
    statuses: readonly BangumiCollectionStatus[],
  ): Promise<BangumiCollectionResponseItem[]> {
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
    const results: BangumiCollectionResponseItem[] = [];
    const limit = 50;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client.fetchUserCollections(token, {
        subjectType: 2, // anime
        limit,
        offset,
      });

      if (!response.data || response.data.length === 0) break;

      let reachedOlderThanCutoff = false;
      for (const item of response.data) {
        const itemUpdatedTime = item.updated_at ? new Date(item.updated_at).getTime() : 0;
        if (itemUpdatedTime < cutoffTime) {
          reachedOlderThanCutoff = true;
          break;
        }

        const status = bangumiTypeNumberToStatus(item.type);
        if (status && statuses.includes(status)) {
          results.push(item);
        }
      }

      if (reachedOlderThanCutoff || response.data.length < limit || offset + response.data.length >= response.total) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }

    return results;
  }

  classifyCandidates(
    collections: BangumiCollectionResponseItem[],
  ): BangumiSyncItem[] {
    const localNotes = this.getBangumiAnimeNotes();
    const notesBySubjectId = new Map<number, { file: TFile; frontmatter: Record<string, unknown> }>();
    for (const entry of localNotes) {
      notesBySubjectId.set(entry.subjectId, entry);
    }

    const items: BangumiSyncItem[] = [];

    for (const col of collections) {
      const subject = col.subject;
      const title = subject?.name_cn || subject?.name || `Subject ${col.subject_id}`;
      const originalTitle = subject?.name !== title ? subject?.name : undefined;
      const remoteStatus = bangumiTypeNumberToStatus(col.type) ?? "watching";
      const remoteRate = col.rate > 0 ? col.rate : null;
      const coverUrl = col.subject?.images?.large || col.subject?.images?.common || col.subject?.images?.medium;

      const matched = notesBySubjectId.get(col.subject_id);

      if (!matched) {
        items.push({
          subjectId: col.subject_id,
          title,
          originalTitle,
          action: "new",
          remoteStatus,
          remoteEpStatus: col.ep_status ?? 0,
          remoteRate,
          remoteUpdatedAt: col.updated_at,
          coverUrl,
          totalEps: col.subject?.eps,
        });
        continue;
      }

      const fm = matched.frontmatter;
      const local: LocalMediaState = {
        status: typeof fm.status === "string" ? fm.status : "",
        progress: typeof fm.progress === "number" ? fm.progress : 0,
        score: typeof fm.score === "number" && fm.score > 0 ? fm.score : null,
        completedAt: typeof fm.completed_at === "string" ? fm.completed_at.trim() : "",
      };

      const remote: RemoteBangumiState = {
        type: col.type,
        epStatus: col.ep_status ?? 0,
        rate: col.rate ?? 0,
        updatedAt: col.updated_at ?? "",
      };

      const reconciled = reconcileSingleItem(local, remote);

      if (reconciled.kind === "conflict") {
        items.push({
          subjectId: col.subject_id,
          title: titleString(fm.title, title),
          originalTitle,
          action: "conflict",
          remoteStatus,
          remoteEpStatus: col.ep_status ?? 0,
          remoteRate,
          remoteUpdatedAt: col.updated_at,
          localPath: matched.file.path,
          localStatus: local.status,
          localProgress: local.progress,
          localScore: local.score,
          conflictReason: reconciled.reason,
          coverUrl,
          totalEps: col.subject?.eps,
        });
      } else if (reconciled.changed) {
        items.push({
          subjectId: col.subject_id,
          title: titleString(fm.title, title),
          originalTitle,
          action: "updated",
          remoteStatus,
          remoteEpStatus: col.ep_status ?? 0,
          remoteRate,
          remoteUpdatedAt: col.updated_at,
          localPath: matched.file.path,
          localStatus: local.status,
          localProgress: local.progress,
          localScore: local.score,
          coverUrl,
          totalEps: col.subject?.eps,
        });
      } else {
        items.push({
          subjectId: col.subject_id,
          title: titleString(fm.title, title),
          originalTitle,
          action: "synced",
          remoteStatus,
          remoteEpStatus: col.ep_status ?? 0,
          remoteRate,
          remoteUpdatedAt: col.updated_at,
          localPath: matched.file.path,
          localStatus: local.status,
          localProgress: local.progress,
          localScore: local.score,
          coverUrl,
          totalEps: col.subject?.eps,
        });
      }
    }

    return items;
  }

  async applyBatchItem(
    _token: string,
    item: BangumiSyncItem,
  ): Promise<"added" | "updated" | "skipped"> {
    if (item.action === "conflict" || item.action === "synced") {
      return "skipped";
    }

    if (item.action === "updated" && item.localPath) {
      const file = this.app.vault.getAbstractFileByPath(item.localPath);
      if (file instanceof TFile) {
        const result = await this.syncSingleNote(file);
        if (result.kind === "success") return "updated";
      }
      return "skipped";
    }

    if (item.action === "new") {
      await this.ingestNewSubject(item);
      return "added";
    }

    return "skipped";
  }

  private async ingestNewSubject(item: BangumiSyncItem): Promise<void> {
    const rawSubject = await this.client.fetchSubject(item.subjectId);
    const mediaType = "anime" as const;
    const normalized: ExternalMediaResult = rawSubject
      ? normalizeBangumiSubject(rawSubject, mediaType)
      : {
          title: item.title,
          originalTitle: item.originalTitle || item.title,
          romajiTitle: "",
          mediaType,
          format: "anime",
          releaseStatus: "unknown",
          total: item.totalEps ?? 0,
          unit: "episode",
          externalScore: item.remoteRate,
          year: 0,
          genres: [],
          people: [],
          platforms: [],
          sourceUrl: `https://bgm.tv/subject/${item.subjectId}`,
          coverUrl: item.coverUrl ?? "",
          provider: "bangumi",
          sourceId: String(item.subjectId),
          summary: "",
          rawGenres: [],
        };

    const s = this.settings();
    const mediaFolder = s.storageMode === "flat"
      ? s.flatMediaFolder || "AnimeList"
      : `${s.libraryRoot || "AnimeList"}/Anime`;

    await this.ensureFolder(mediaFolder);

    let localCoverPath = "";
    if (normalized.coverUrl) {
      try {
        const coverFolder = `${s.coverFolder || "AnimeList/Covers"}/anime`;
        await this.ensureFolder(coverFolder);
        const coverFilename = `${slugify(normalized.title)}-bangumi-${item.subjectId}.jpg`;
        const targetCoverPath = normalizePath(`${coverFolder}/${coverFilename}`);
        // If file doesn't exist, download it
        const existingCover = this.app.vault.getAbstractFileByPath(targetCoverPath);
        if (existingCover instanceof TFile) {
          localCoverPath = targetCoverPath;
        } else {
          const resp = await requestUrl({
            url: normalized.coverUrl,
            headers: { "User-Agent": USER_AGENT },
          });
          if (resp.status === 200 && resp.arrayBuffer) {
            await this.app.vault.createBinary(targetCoverPath, resp.arrayBuffer);
            localCoverPath = targetCoverPath;
          }
        }
      } catch {
        // Fallback to remote cover if download fails
      }
    }

    const formStatus = item.remoteStatus === "completed"
      ? "completed"
      : item.remoteStatus === "dropped"
        ? "dropped"
        : item.remoteStatus === "wishlist" || item.remoteStatus === "on_hold"
          ? "planned"
          : "ongoing";

    let completedAt = "";
    if (formStatus === "completed" && item.remoteUpdatedAt) {
      completedAt = item.remoteUpdatedAt.slice(0, 10);
    }

    const templatePath = normalizePath(`${s.templateFolder || "AnimeList/Templates"}/anime.md`);
    let templateContent = "";
    const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
    if (templateFile instanceof TFile) {
      try {
        templateContent = await this.app.vault.read(templateFile);
      } catch {
        // Ignore template read failure
      }
    }

    const form: MediaNoteForm = {
      title: normalized.title,
      status: formStatus,
      releaseStatus: "unknown",
      progress: item.remoteEpStatus,
      total: normalized.total,
      unit: "episode",
      score: item.remoteRate != null ? item.remoteRate : "",
      favorite: false,
      startedAt: "",
      completedAt,
      genres: normalized.genres,
      templatePath,
      volumeLog: [],
    };

    const result: ExternalMediaResult = {
      ...normalized,
    };

    const markdown = buildMediaMarkdown(result, form, localCoverPath, templateContent, {
      allowEmptyCompletedScore: true,
    });

    const noteFilename = `${slugify(normalized.title)}.md`;
    let targetNotePath = normalizePath(`${mediaFolder}/${noteFilename}`);
    let counter = 1;
    while (this.app.vault.getAbstractFileByPath(targetNotePath)) {
      targetNotePath = normalizePath(`${mediaFolder}/${slugify(normalized.title)}-${counter}.md`);
      counter += 1;
    }

    await this.app.vault.create(targetNotePath, markdown);
  }

  private async ensureFolder(folderPath: string): Promise<void> {
    const normalized = normalizePath(folderPath).replace(/^\/+|\/+$/g, "");
    if (!normalized) return;
    const parts = normalized.split("/");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        await this.app.vault.createFolder(current);
      }
    }
  }

  async executeBatchSync(
    token: string,
    itemsToSync: BangumiSyncItem[],
    onProgress?: (completed: number, total: number, currentItem: BangumiSyncItem) => void,
  ): Promise<BangumiSyncSummary> {
    const summary: BangumiSyncSummary = {
      added: 0,
      updated: 0,
      synced: 0,
      conflicts: [],
      errors: [],
    };

    for (let index = 0; index < itemsToSync.length; index += 1) {
      const item = itemsToSync[index];
      onProgress?.(index, itemsToSync.length, item);

      if (item.action === "conflict") {
        summary.conflicts.push({
          subjectId: item.subjectId,
          title: item.title,
          filePath: item.localPath,
          reason: item.conflictReason || "Score conflict",
        });
        continue;
      }

      if (item.action === "synced") {
        summary.synced += 1;
        continue;
      }

      try {
        const actionResult = await this.applyBatchItem(token, item);
        if (actionResult === "added") summary.added += 1;
        else if (actionResult === "updated") summary.updated += 1;
        else summary.synced += 1;
      } catch (err) {
        summary.errors.push(`Failed to sync "${item.title}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    onProgress?.(itemsToSync.length, itemsToSync.length, itemsToSync[itemsToSync.length - 1]);

    // Update lastSyncTimestamp in settings
    this.settings().lastSyncTimestamp = Date.now();
    await this.callbacks?.saveSettings();
    this.callbacks?.refreshViews();

    return summary;
  }

  async executeStartupAutoSync(): Promise<BangumiSyncSummary | null> {
    const s = this.settings();
    if (!s.autoSyncOnStartup) return null;
    const token = s.bangumiAccessToken.trim();
    if (!token) return null;

    // Cooldown check
    const now = Date.now();
    const elapsedMinutes = (now - s.lastSyncTimestamp) / (60 * 1000);
    if (elapsedMinutes < s.autoSyncCooldownMinutes) {
      return null;
    }

    try {
      const recentCollections = await this.fetchRecentCollections(
        token,
        s.syncRecentDays,
        s.syncCollectionTypes,
      );

      const candidates = this.classifyCandidates(recentCollections);
      // Existing Note Sync strategy: only items that exist in vault are updated; new subjects ignored
      const existingCandidates = candidates.filter((item) => item.action === "updated" || item.action === "conflict");

      if (existingCandidates.length === 0) {
        s.lastSyncTimestamp = now;
        await this.callbacks?.saveSettings();
        return null;
      }

      const summary = await this.executeBatchSync(token, existingCandidates);

      // Lightweight toast notification summarizing updates or conflicts
      if (summary.updated > 0 || summary.conflicts.length > 0) {
        const parts: string[] = [];
        if (summary.updated > 0) parts.push(`updated ${summary.updated} anime`);
        if (summary.conflicts.length > 0) parts.push(`${summary.conflicts.length} score conflict(s)`);
        new Notice(`Bangumi auto-sync completed: ${parts.join(", ")}.`);
      }

      return summary;
    } catch (err) {
      console.error("AnimeList Bangumi startup auto-sync failed:", err);
      return null;
    }
  }
}
