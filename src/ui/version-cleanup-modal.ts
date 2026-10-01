import { Modal, Notice } from "obsidian";
import type { AnimeListFeatureHost } from "../app/feature-types";
import {
  applyDuplicateDefaultCoverCleanup,
  planDuplicateDefaultCoverCleanup,
  type VersionCleanupPlan,
} from "../data/version-cleanup-service";

function appendRule(parent: HTMLElement, text: string): void {
  parent.createEl("li", { text });
}

export class DuplicateCoverCleanupModal extends Modal {
  constructor(private readonly host: AnimeListFeatureHost) {
    super(host.app);
  }

  onOpen(): void {
    this.modalEl.addClass("animelist-modal", "al-version-cleanup-modal");
    this.titleEl.setText("清理笔记内重复嵌入封面");
    this.contentEl.empty();

    this.contentEl.createEl("p", {
      cls: "al-modal-hint",
      text: "查看所有可安全更新的笔记。在您点击确认之前，不会对任何文件进行修改。",
    });
    const rules = this.contentEl.createEl("ul", { cls: "al-version-cleanup-rules" });
    appendRule(rules, "仅扫描受 AnimeList 管理的媒体笔记。");
    appendRule(rules, "仅移除紧随 animelist-detail 区块之后的旧版独立 ![[cover|260]] 封面行。");
    appendRule(rules, "嵌入的图片路径必须与该笔记当前 Frontmatter 中的 cover 路径完全一致。");
    appendRule(rules, "使用了自定义模板 (note_template) 的笔记将被跳过。");
    appendRule(rules, "Frontmatter、图片区块、其他图片、标题以及笔记正文均不会发生改变。");

    const status = this.contentEl.createEl("p", { cls: "al-version-cleanup-status", text: "正在扫描媒体笔记…" });
    const list = this.contentEl.createDiv({ cls: "al-version-cleanup-list" });
    const footer = this.contentEl.createDiv({ cls: "al-modal-actions" });
    const cancel = footer.createEl("button", { text: "取消" });
    cancel.type = "button";
    cancel.addEventListener("click", () => this.close());
    const confirm = footer.createEl("button", { cls: "mod-cta", text: "确认清理" });
    confirm.type = "button";
    confirm.disabled = true;

    let plan: VersionCleanupPlan | null = null;
    void planDuplicateDefaultCoverCleanup(this.host.app, this.host.getScanFolders()).then((value) => {
      plan = value;
      list.empty();
      status.setText(`已扫描 ${value.scanned} 篇媒体笔记，发现 ${value.items.length} 篇可更新。`);
      if (!value.items.length) {
        list.createDiv({ cls: "al-search-empty", text: "未发现可安全清理的旧版重复默认封面。" });
        confirm.disabled = true;
        return;
      }
      for (const item of value.items) {
        const row = list.createDiv({ cls: "al-version-cleanup-item" });
        row.createEl("strong", { text: item.title });
        row.createDiv({ cls: "al-result-meta", text: item.path });
        row.createEl("code", { text: `第 ${item.lineNumber} 行：${item.lineText.trim()}` });
      }
      confirm.disabled = false;
    }).catch((error) => {
      console.error("AnimeList version cleanup scan failed", error);
      status.setText(`扫描失败：${error instanceof Error ? error.message : String(error)}`);
    });

    confirm.addEventListener("click", () => {
      if (!plan || !plan.items.length) return;
      confirm.disabled = true;
      cancel.disabled = true;
      status.setText("正在执行清理…");
      void applyDuplicateDefaultCoverCleanup(this.host.app, plan).then((result) => {
        status.setText(`清理完成：已更新 ${result.updated} 篇；跳过 ${result.skipped} 篇；失败 ${result.failed} 篇。`);
        list.empty();
        for (const detail of result.details) {
          const row = list.createDiv({ cls: `al-version-cleanup-item is-${detail.status}` });
          row.createEl("strong", { text: detail.title });
          row.createDiv({ cls: "al-result-meta", text: `${detail.path} · ${detail.status}` });
          row.createEl("p", { text: detail.message });
        }
        cancel.setText("关闭");
        cancel.disabled = false;
        if (result.updated > 0) this.host.refreshViews();
        new Notice(`AnimeList 清理已完成，共更新 ${result.updated} 篇笔记。`);
      }).catch((error) => {
        console.error("AnimeList version cleanup failed", error);
        status.setText(`清理失败：${error instanceof Error ? error.message : String(error)}`);
        cancel.disabled = false;
        confirm.disabled = false;
      });
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
