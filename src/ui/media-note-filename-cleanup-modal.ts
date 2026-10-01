import { Modal, Notice } from "obsidian";
import type { AnimeListFeatureHost } from "../app/feature-types";
import {
  applyMediaNoteFilenameCleanup,
  planMediaNoteFilenameCleanup,
  type MediaNoteFilenameCleanupPlan,
} from "../data/media-note-filename-cleanup";

function appendRule(parent: HTMLElement, text: string): void {
  parent.createEl("li", { text });
}

export class MediaNoteFilenameCleanupModal extends Modal {
  constructor(private readonly host: AnimeListFeatureHost) {
    super(host.app);
  }

  onOpen(): void {
    this.modalEl.addClass("animelist-modal", "al-version-cleanup-modal");
    this.titleEl.setText("同步笔记文件名与作品标题");
    this.contentEl.empty();

    this.contentEl.createEl("p", {
      cls: "al-modal-hint",
      text: "即使 Markdown 文件名与作品标题不同，笔记在媒体库中依然可以正常索引与使用。仅在您希望旧笔记或手动重命名的文件重新与标题 frontmatter 保持一致时使用此预览与校准工具。",
    });
    const rules = this.contentEl.createEl("ul", { cls: "al-version-cleanup-rules" });
    appendRule(rules, "手动更改文件名是被 AnimeList 认可的，日常媒体库刷新或无关于标题的编辑绝不会自动更改文件名。");
    appendRule(rules, "仅扫描配置的媒体库文件夹中的 AnimeList 媒体笔记。");
    appendRule(rules, "每篇笔记保留在当前文件夹中；仅修改 Markdown 文件名。");
    appendRule(rules, "文件名根据笔记中现有的 title frontmatter 生成，遵循与新建笔记完全一致的安全命名规则。");
    appendRule(rules, "若目标名称已被其他文件占用，AnimeList 会同时保留两者并添加诸如「 (2)」后缀。");
    appendRule(rules, "笔记内容与 frontmatter 不会被重写。调用 Obsidian 官方文件重命名 API，因此双链更新遵循您的 Obsidian 设置。");
    appendRule(rules, "每个待重命名项目在执行前会再次实时校验；已变更或冲突的项目将被安全跳过。");

    const status = this.contentEl.createEl("p", { cls: "al-version-cleanup-status", text: "正在扫描媒体笔记…" });
    const list = this.contentEl.createDiv({ cls: "al-version-cleanup-list" });
    const footer = this.contentEl.createDiv({ cls: "al-modal-actions" });
    const cancel = footer.createEl("button", { text: "取消" });
    cancel.type = "button";
    cancel.addEventListener("click", () => this.close());
    const confirm = footer.createEl("button", { cls: "mod-cta", text: "确认重命名" });
    confirm.type = "button";
    confirm.disabled = true;

    let plan: MediaNoteFilenameCleanupPlan | null = null;
    try {
      plan = planMediaNoteFilenameCleanup(this.host.app, this.host.getScanFolders());
      status.setText(`已扫描 ${plan.scanned} 篇 AnimeList 媒体笔记，发现 ${plan.items.length} 篇可重命名。`);
      if (!plan.items.length) {
        list.createDiv({ cls: "al-search-empty", text: "所有已扫描笔记的文件名均已与标题一致或属于安全防冲突命名。" });
      } else {
        for (const item of plan.items) {
          const row = list.createDiv({ cls: "al-version-cleanup-item" });
          row.createEl("strong", { text: item.title });
          row.createDiv({ cls: "al-result-meta", text: item.path });
          row.createEl("code", { text: `→ ${item.targetPath}` });
        }
        confirm.disabled = false;
      }
    } catch (error) {
      console.error("AnimeList note filename scan failed", error);
      status.setText(`扫描失败：${error instanceof Error ? error.message : String(error)}`);
    }

    confirm.addEventListener("click", () => {
      if (!plan || !plan.items.length) return;
      confirm.disabled = true;
      cancel.disabled = true;
      status.setText("正在执行重命名…");
      void applyMediaNoteFilenameCleanup(this.host.app, plan).then((result) => {
        status.setText(`重命名完成：已重命名 ${result.renamed} 篇；跳过 ${result.skipped} 篇；失败 ${result.failed} 篇。`);
        list.empty();
        for (const detail of result.details) {
          const row = list.createDiv({ cls: `al-version-cleanup-item is-${detail.status}` });
          row.createEl("strong", { text: detail.title });
          row.createDiv({ cls: "al-result-meta", text: `${detail.path} → ${detail.targetPath} · ${detail.status}` });
          row.createEl("p", { text: detail.message });
        }
        cancel.setText("关闭");
        cancel.disabled = false;
        if (result.renamed > 0) this.host.refreshViews();
        new Notice(`AnimeList 已完成 ${result.renamed} 篇笔记的重命名。`);
      }).catch((error) => {
        console.error("AnimeList note filename cleanup failed", error);
        status.setText(`重命名失败：${error instanceof Error ? error.message : String(error)}`);
        cancel.disabled = false;
        confirm.disabled = false;
      });
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
