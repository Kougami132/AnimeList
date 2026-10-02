import { TFile } from "obsidian";
import { defineFeature, type AnimeListFeatureHost } from "../../app/feature-types";
import { extractBangumiSubjectId } from "../../domain/bangumi-sync/subject-matching";
import { decorateBangumiDetail } from "./detail";
import { createBangumiSyncSettingsSection } from "./settings";
import { installStartupAutoSync, openBatchSyncWorkflow } from "./controller";
import { bangumiSyncText } from "./text";

export const bangumiSyncFeature = defineFeature<AnimeListFeatureHost>({
  id: "bangumi-sync",
  contributions: [
    {
      kind: "lifecycle",
      activate(host) {
        installStartupAutoSync(host);

        host.addCommand({
          id: "bangumi-sync-current",
          name: bangumiSyncText("command.syncCurrent"),
          callback: async () => {
            await host.syncBangumiCurrentAnime();
          },
        });

        host.addCommand({
          id: "bangumi-push-current",
          name: bangumiSyncText("command.pushCurrent"),
          callback: async () => {
            await host.pushBangumiCurrentAnime();
          },
        });

        host.addCommand({
          id: "bangumi-batch-sync",
          name: bangumiSyncText("command.batchSync"),
          callback: async () => {
            await openBatchSyncWorkflow(host);
          },
        });

        host.registerEvent(
          host.app.workspace.on("file-menu", (menu, file) => {
            if (!(file instanceof TFile)) return;
            const cache = host.app.metadataCache.getFileCache(file);
            const fm = cache?.frontmatter;
            if (!extractBangumiSubjectId(fm)) return;

            menu.addItem((item) => {
              item
                .setTitle(bangumiSyncText("menu.sync"))
                .setIcon("refresh-cw")
                .onClick(() => {
                  void host.syncBangumiNote(file);
                });
            });

            menu.addItem((item) => {
              item
                .setTitle(bangumiSyncText("menu.push"))
                .setIcon("upload")
                .onClick(() => {
                  void host.pushBangumiNote(file);
                });
            });
          }),
        );
      },
    },
    {
      kind: "detail",
      afterRender({ host, container, sourcePath, frontmatter }) {
        decorateBangumiDetail(host, container, sourcePath, frontmatter);
      },
    },
    {
      kind: "settings",
      sections(host) {
        return createBangumiSyncSettingsSection(host, () => {
          void openBatchSyncWorkflow(host);
        });
      },
    },
  ],
});
