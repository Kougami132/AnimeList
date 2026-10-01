import { Modal, type App } from "obsidian";
import type { AnimeListFeatureHost } from "../../app/feature-types";
import type { BangumiSyncSummary } from "../../domain/bangumi-sync/types";
import { bangumiSyncText } from "../../features/bangumi-sync/text";

export class SyncSummaryModal extends Modal {
  constructor(
    app: App,
    private readonly host: AnimeListFeatureHost,
    private readonly summary: BangumiSyncSummary,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("al-bangumi-summary-modal");

    const header = contentEl.createDiv({ cls: "al-bangumi-modal-header" });
    header.createEl("h2", { text: bangumiSyncText("summary.title") });

    const grid = contentEl.createDiv({ cls: "al-bangumi-summary-grid" });

    const addCard = grid.createDiv({ cls: "al-bangumi-summary-card" });
    addCard.createDiv({ cls: "al-bangumi-summary-number", text: String(this.summary.added) });
    addCard.createDiv({ cls: "al-bangumi-summary-label", text: bangumiSyncText("summary.added", { count: this.summary.added }) });

    const updateCard = grid.createDiv({ cls: "al-bangumi-summary-card" });
    updateCard.createDiv({ cls: "al-bangumi-summary-number", text: String(this.summary.updated) });
    updateCard.createDiv({ cls: "al-bangumi-summary-label", text: bangumiSyncText("summary.updated", { count: this.summary.updated }) });

    const syncedCard = grid.createDiv({ cls: "al-bangumi-summary-card" });
    syncedCard.createDiv({ cls: "al-bangumi-summary-number", text: String(this.summary.synced) });
    syncedCard.createDiv({ cls: "al-bangumi-summary-label", text: bangumiSyncText("summary.synced", { count: this.summary.synced }) });

    const conflictCard = grid.createDiv({ cls: "al-bangumi-summary-card" });
    conflictCard.createDiv({ cls: "al-bangumi-summary-number", text: String(this.summary.conflicts.length) });
    conflictCard.createDiv({ cls: "al-bangumi-summary-label", text: bangumiSyncText("summary.conflicts", { count: this.summary.conflicts.length }) });

    if (this.summary.conflicts.length > 0) {
      contentEl.createEl("h3", { text: "Score conflicts" });
      const conflictList = contentEl.createDiv({ cls: "al-bangumi-conflict-list" });

      for (const conflict of this.summary.conflicts) {
        const itemEl = conflictList.createDiv({ cls: "al-bangumi-conflict-item" });
        const textWrapper = itemEl.createDiv();
        textWrapper.createDiv({ cls: "al-bangumi-conflict-name", text: conflict.title });
        textWrapper.createDiv({ cls: "al-bangumi-diff-meta", text: conflict.reason });

        if (conflict.filePath) {
          const link = itemEl.createEl("a", { cls: "al-bangumi-conflict-link", text: "Open note" });
          link.addEventListener("click", (event) => {
            event.preventDefault();
            this.close();
            void this.host.openMediaFile(conflict.filePath);
          });
        }
      }
    }

    const footer = contentEl.createDiv({ cls: "al-bangumi-diff-toolbar" });
    footer.createDiv();
    const closeBtn = footer.createEl("button", { text: bangumiSyncText("summary.close") });
    closeBtn.type = "button";
    closeBtn.addEventListener("click", () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
