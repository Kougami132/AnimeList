import type { App } from "obsidian";
import { Modal, Notice, setIcon } from "obsidian";
import { scoreDashboardText as text } from "../../features/score-dashboard/text";
import { copyPngBlobToClipboard } from "../image-clipboard";
import { bindImageFallback } from "../image-fallback";
import { downloadPngBlobWithPicker } from "./screenshot-download";

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export class ScoreDashboardScreenshotModal extends Modal {
  private readonly objectUrl: string;
  private copyTimer = 0;

  constructor(
    app: App,
    private readonly blob: Blob,
    private readonly dimensions: { width: number; height: number },
    private readonly defaultFilename: string,
  ) {
    super(app);
    this.objectUrl = URL.createObjectURL(blob);
  }

  onOpen(): void {
    this.modalEl.classList.add("animelist-modal", "al-score-screenshot-modal");
    this.titleEl.textContent = text.screenshotTitle;

    const sizeFormatted = formatByteSize(this.blob.size);
    const metaText = text.screenshotDimensions(this.dimensions.width, this.dimensions.height, sizeFormatted);

    const meta = createDiv({ cls: "al-score-screenshot-meta", text: metaText });

    const previewContainer = createDiv("al-score-screenshot-preview");
    const previewImage = createEl("img", "al-score-screenshot-image");
    previewImage.src = this.objectUrl;
    previewImage.alt = text.screenshotTitle;
    bindImageFallback(previewImage, () => null);
    previewContainer.appendChild(previewImage);

    const actions = createDiv("al-modal-actions al-score-screenshot-actions");

    const closeBtn = createEl("button", { text: text.screenshotClose });
    closeBtn.type = "button";
    closeBtn.addEventListener("click", () => this.close());

    const copyBtn = createEl("button", "al-secondary-button al-score-screenshot-copy-btn");
    copyBtn.type = "button";
    const copyIcon = createSpan("al-score-tool-icon");
    setIcon(copyIcon, "copy");
    const copyLabel = createSpan({ text: text.screenshotCopy });
    copyBtn.append(copyIcon, copyLabel);

    copyBtn.addEventListener("click", () => {
      void (async () => {
        try {
          await copyPngBlobToClipboard(this.blob);
          new Notice(text.screenshotCopied);
          copyLabel.textContent = text.screenshotCopySuccess;
          setIcon(copyIcon, "check");
          window.clearTimeout(this.copyTimer);
          this.copyTimer = window.setTimeout(() => {
            copyLabel.textContent = text.screenshotCopy;
            setIcon(copyIcon, "copy");
          }, 2000);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          new Notice(`${text.moveFailed(msg)}。请使用下载按钮保存`);
        }
      })();
    });

    const downloadBtn = createEl("button", "mod-cta al-score-screenshot-download-btn");
    downloadBtn.type = "button";
    const downloadIcon = createSpan("al-score-tool-icon");
    setIcon(downloadIcon, "download");
    const downloadLabel = createSpan({ text: text.screenshotDownload });
    downloadBtn.append(downloadIcon, downloadLabel);

    downloadBtn.addEventListener("click", () => {
      void (async () => {
        try {
          await downloadPngBlobWithPicker(this.blob, this.defaultFilename);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          new Notice(text.moveFailed(msg));
        }
      })();
    });

    actions.append(closeBtn, copyBtn, downloadBtn);
    this.contentEl.append(meta, previewContainer, actions);
  }

  onClose(): void {
    window.clearTimeout(this.copyTimer);
    URL.revokeObjectURL(this.objectUrl);
    this.contentEl.empty();
  }
}
