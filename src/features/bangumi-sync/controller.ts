import { Notice } from "obsidian";
import type { AnimeListFeatureHost } from "../../app/feature-types";
import { DiffPreviewModal } from "../../ui/bangumi-sync/diff-modal";
import { bangumiSyncText } from "./text";

export async function openBatchSyncWorkflow(host: AnimeListFeatureHost): Promise<void> {
  const token = host.settings.bangumiAccessToken.trim();
  if (!token) {
    new Notice(bangumiSyncText("notice.notConfigured"));
    return;
  }

  const notice = new Notice(bangumiSyncText("notice.fetchingCollections"), 0);
  try {
    const service = host.bangumiSyncService();
    const [collections, allCollectedIds] = await Promise.all([
      service.fetchRecentCollections(
        token,
        host.settings.syncRecentDays,
        host.settings.syncCollectionTypes,
      ),
      service.fetchAllCollectionSubjectIds(token),
    ]);

    notice.hide();

    const candidates = service.classifyCandidates(collections, allCollectedIds);
    if (candidates.length === 0) {
      new Notice(bangumiSyncText("diff.noItems"));
      return;
    }

    new DiffPreviewModal(host.app, host, candidates, service).open();
  } catch (error) {
    notice.hide();
    const message = error instanceof Error ? error.message : "Failed to fetch collections";
    new Notice(`Bangumi sync failed: ${message}`);
  }
}

export function installStartupAutoSync(host: AnimeListFeatureHost): void {
  if (!host.settings.autoSyncOnStartup) return;
  const timer = window.setTimeout(() => {
    void host.bangumiSyncService().executeStartupAutoSync();
  }, 2000);
  host.register(() => {
    window.clearTimeout(timer);
  });
}
