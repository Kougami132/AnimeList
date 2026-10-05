import { Modal, type App } from "obsidian";
import type { AnimeListFeatureHost } from "../../app/feature-types";
import type { BangumiSyncItem, BangumiSyncItemAction } from "../../domain/bangumi-sync/types";
import type { BangumiSyncService } from "../../data/bangumi-sync/bangumi-sync-service";
import { bangumiSyncText } from "../../features/bangumi-sync/text";
import { SyncSummaryModal } from "./summary-modal";

export class DiffPreviewModal extends Modal {
  private selectedIds: Set<number>;
  private filterQuery = "";
  private activeFilterAction: BangumiSyncItemAction | "all" = "all";
  private isExecuting = false;

  constructor(
    app: App,
    private readonly host: AnimeListFeatureHost,
    private readonly items: BangumiSyncItem[],
    private readonly service: BangumiSyncService,
  ) {
    super(app);
    this.selectedIds = new Set<number>();
    for (const item of items) {
      if (item.action === "new" || item.action === "updated" || item.action === "push") {
        this.selectedIds.add(item.subjectId);
      }
    }
  }

  onOpen(): void {
    this.modalEl.addClass("al-bangumi-diff-modal-window");
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("al-bangumi-diff-modal");

    const header = contentEl.createDiv({ cls: "al-bangumi-modal-header" });
    header.createEl("h2", { text: bangumiSyncText("diff.title") });
    header.createEl("p", { cls: "animelist-settings-intro", text: bangumiSyncText("diff.description") });

    // Category filter tabs
    const categoryBar = contentEl.createDiv({ cls: "al-bangumi-category-bar" });
    const categories: Array<{ id: BangumiSyncItemAction | "all"; label: string }> = [
      { id: "all", label: "All" },
      { id: "new", label: bangumiSyncText("diff.badgeNew") },
      { id: "updated", label: bangumiSyncText("diff.badgeUpdated") },
      { id: "push", label: bangumiSyncText("diff.badgePush") },
      { id: "conflict", label: bangumiSyncText("diff.badgeConflict") },
      { id: "synced", label: bangumiSyncText("diff.badgeSynced") },
    ];
    for (const cat of categories) {
      const btn = categoryBar.createEl("button", {
        cls: `al-bangumi-filter-btn${this.activeFilterAction === cat.id ? " is-active" : ""}`,
        text: cat.label,
      });
      btn.type = "button";
      btn.disabled = this.isExecuting;
      btn.addEventListener("click", () => {
        this.activeFilterAction = cat.id;
        categoryBar.querySelectorAll<HTMLElement>(".al-bangumi-filter-btn").forEach((el) => {
          el.removeClass("is-active");
        });
        btn.addClass("is-active");
        this.updateList();
      });
    }

    // Search and selection actions bar
    const searchBar = contentEl.createDiv({ cls: "al-bangumi-search-bar" });
    const searchInput = searchBar.createEl("input", {
      type: "search",
      cls: "al-bangumi-search-input",
    });
    searchInput.placeholder = bangumiSyncText("diff.filterPlaceholder");
    searchInput.value = this.filterQuery;
    searchInput.disabled = this.isExecuting;
    searchInput.addEventListener("input", () => {
      this.filterQuery = searchInput.value.trim().toLocaleLowerCase();
      this.updateList();
    });

    const selectAllBtn = searchBar.createEl("button", { text: bangumiSyncText("diff.selectAll") });
    selectAllBtn.type = "button";
    selectAllBtn.disabled = this.isExecuting;
    selectAllBtn.addEventListener("click", () => {
      for (const item of this.filteredItems()) {
        if (item.action !== "conflict") {
          this.selectedIds.add(item.subjectId);
        }
      }
      this.updateList();
    });

    const deselectAllBtn = searchBar.createEl("button", { text: bangumiSyncText("diff.deselectAll") });
    deselectAllBtn.type = "button";
    deselectAllBtn.disabled = this.isExecuting;
    deselectAllBtn.addEventListener("click", () => {
      for (const item of this.filteredItems()) {
        this.selectedIds.delete(item.subjectId);
      }
      this.updateList();
    });

    // List container
    const listContainer = contentEl.createDiv({ cls: "al-bangumi-diff-list" });
    this.renderListItems(listContainer);

    // Progress container
    const progressContainer = contentEl.createDiv({ cls: "al-bangumi-progress-container" });
    progressContainer.toggleClass("u-hidden", !this.isExecuting);
    const track = progressContainer.createDiv({ cls: "al-bangumi-progress-track" });
    const fill = track.createDiv({ cls: "al-bangumi-progress-fill" });
    fill.setCssStyles({ width: "0%" });
    const progressText = progressContainer.createDiv({ cls: "al-bangumi-progress-text", text: "" });

    // Footer toolbar
    const footer = contentEl.createDiv({ cls: "al-bangumi-diff-toolbar" });
    const countInfo = footer.createDiv({ cls: "al-bangumi-diff-meta" });
    countInfo.textContent = this.formatCountText();

    const actions = footer.createDiv({ cls: "al-bangumi-diff-actions" });

    const cancelBtn = actions.createEl("button", { text: "Cancel" });
    cancelBtn.type = "button";
    cancelBtn.disabled = this.isExecuting;
    cancelBtn.addEventListener("click", () => this.close());

    const syncBtn = actions.createEl("button", { cls: "mod-cta", text: bangumiSyncText("diff.syncButton") });
    syncBtn.type = "button";
    syncBtn.disabled = this.isExecuting || this.selectedIds.size === 0;

    syncBtn.addEventListener("click", () => {
      void (async () => {
        const selected = this.items.filter((item) => this.selectedIds.has(item.subjectId));
        if (selected.length === 0) return;

        this.isExecuting = true;
        syncBtn.disabled = true;
        cancelBtn.disabled = true;
        searchInput.disabled = true;
        selectAllBtn.disabled = true;
        deselectAllBtn.disabled = true;
        progressContainer.removeClass("u-hidden");

        const token = this.host.settings.bangumiAccessToken.trim();
        const summary = await this.service.executeBatchSync(
          token,
          selected,
          (completed, total, currentItem) => {
            const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
            fill.setCssStyles({ width: `${percent}%` });
            if (currentItem) {
              progressText.textContent = bangumiSyncText("diff.progress", {
                completed,
                total,
                title: currentItem.title,
              });
            }
          },
        );

        this.close();
        new SyncSummaryModal(this.app, this.host, summary).open();
      })();
    });
  }

  private filteredItems(): BangumiSyncItem[] {
    let result = this.items;
    if (this.activeFilterAction !== "all") {
      result = result.filter((item) => item.action === this.activeFilterAction);
    }
    if (this.filterQuery) {
      result = result.filter((item) => {
        const titleMatch = item.title.toLocaleLowerCase().includes(this.filterQuery);
        const originalMatch = item.originalTitle?.toLocaleLowerCase().includes(this.filterQuery);
        return titleMatch || originalMatch;
      });
    }
    return result;
  }

  private formatCountText(): string {
    let pullCount = 0;
    let pushCount = 0;
    for (const item of this.items) {
      if (this.selectedIds.has(item.subjectId)) {
        if (item.action === "push") pushCount += 1;
        else if (item.action === "new" || item.action === "updated") pullCount += 1;
      }
    }
    const parts: string[] = [];
    if (pullCount > 0) parts.push(`Pull: ${pullCount}`);
    if (pushCount > 0) parts.push(`Push: ${pushCount}`);
    const details = parts.length > 0 ? ` (${parts.join(", ")})` : "";
    return `Selected: ${this.selectedIds.size} / ${this.items.length}${details}`;
  }

  private updateList(): void {
    const listContainer = this.contentEl.querySelector<HTMLElement>(".al-bangumi-diff-list");
    if (listContainer) {
      listContainer.empty();
      this.renderListItems(listContainer);
    }
    const countInfo = this.contentEl.querySelector<HTMLElement>(".al-bangumi-diff-toolbar .al-bangumi-diff-meta");
    if (countInfo) {
      countInfo.textContent = this.formatCountText();
    }
    const syncBtn = this.contentEl.querySelector<HTMLButtonElement>(".mod-cta");
    if (syncBtn && !this.isExecuting) {
      syncBtn.disabled = this.selectedIds.size === 0;
    }
  }

  private renderListItems(container: HTMLElement): void {
    const items = this.filteredItems();

    if (items.length === 0) {
      container.createDiv({ cls: "al-bangumi-diff-meta", text: "No matching items found." });
      return;
    }

    for (const item of items) {
      const row = container.createDiv({
        cls: `al-bangumi-diff-row${item.action === "conflict" ? " is-conflict" : ""}`,
      });

      const checkbox = row.createEl("input", { type: "checkbox" });
      checkbox.checked = this.selectedIds.has(item.subjectId);
      checkbox.disabled = this.isExecuting || item.action === "conflict";

      checkbox.addEventListener("change", () => {
        if (checkbox.checked) this.selectedIds.add(item.subjectId);
        else this.selectedIds.delete(item.subjectId);
        const countInfo = this.contentEl.querySelector<HTMLElement>(".al-bangumi-diff-toolbar .al-bangumi-diff-meta");
        if (countInfo) countInfo.textContent = this.formatCountText();
        const syncBtn = this.contentEl.querySelector<HTMLButtonElement>(".mod-cta");
        if (syncBtn && !this.isExecuting) syncBtn.disabled = this.selectedIds.size === 0;
      });

      const badge = row.createDiv({
        cls: `al-bangumi-diff-badge badge-${item.action}`,
        text: this.badgeLabel(item.action),
      });
      badge.setAttribute("aria-label", item.action);

      const info = row.createDiv({ cls: "al-bangumi-diff-info" });
      info.createDiv({ cls: "al-bangumi-diff-title", text: item.title });

      const meta = info.createDiv({ cls: "al-bangumi-diff-meta" });
      meta.textContent = this.diffDescription(item);
    }
  }

  private badgeLabel(action: BangumiSyncItem["action"]): string {
    switch (action) {
      case "new": return bangumiSyncText("diff.badgeNew");
      case "updated": return bangumiSyncText("diff.badgeUpdated");
      case "push": return bangumiSyncText("diff.badgePush");
      case "conflict": return bangumiSyncText("diff.badgeConflict");
      case "synced": return bangumiSyncText("diff.badgeSynced");
    }
  }

  private diffDescription(item: BangumiSyncItem): string {
    if (item.action === "push") {
      const totalStr = item.totalEps ? ` / ${item.totalEps}` : "";
      const scoreStr = item.localScore ? ` · Score: ${item.localScore}` : "";
      return `Push to Bangumi · Ep ${item.localProgress ?? 0}${totalStr} · Status: ${item.localStatus || "ongoing"}${scoreStr}`;
    }
    if (item.action === "new") {
      const totalStr = item.totalEps ? ` / ${item.totalEps}` : "";
      return `New anime · Ep ${item.remoteEpStatus}${totalStr} · Status: ${item.remoteStatus}`;
    }
    if (item.action === "updated") {
      const progressChange = item.localProgress !== item.remoteEpStatus
        ? `Ep ${item.localProgress} -> ${item.remoteEpStatus}`
        : `Ep ${item.remoteEpStatus}`;
      const statusChange = item.localStatus !== item.remoteStatus
        ? `Status: ${item.localStatus} -> ${item.remoteStatus}`
        : "";
      return [progressChange, statusChange].filter(Boolean).join(" · ");
    }
    if (item.action === "conflict") {
      return item.conflictReason || "Rating conflict";
    }
    return "Up to date with Bangumi";
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
