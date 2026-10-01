import { TFile } from "obsidian";
import type { AnimeListFeatureHost } from "../../app/feature-types";
import { extractBangumiSubjectId } from "../../domain/bangumi-sync/subject-matching";
import { appendIconLabel, makeEl } from "../../ui/ui-helpers";
import { bangumiSyncText } from "./text";

export function decorateBangumiDetail(
  host: AnimeListFeatureHost,
  container: HTMLElement,
  sourcePath: string,
  frontmatter: Record<string, unknown>,
): void {
  const subjectId = extractBangumiSubjectId(frontmatter);
  if (!subjectId) return;

  const buttons = container.querySelector(".al-detail-buttons");
  if (!buttons || buttons.querySelector(".al-detail-bangumi-sync")) return;

  const syncBtn = makeEl("button", "al-detail-bangumi-sync");
  syncBtn.type = "button";
  syncBtn.setAttribute("aria-label", bangumiSyncText("detail.syncButton"));
  syncBtn.title = bangumiSyncText("detail.syncButton");
  appendIconLabel(syncBtn, "refresh-cw", bangumiSyncText("detail.syncLabel"));
  syncBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const file = host.app.vault.getAbstractFileByPath(sourcePath);
    if (file instanceof TFile) {
      void host.syncBangumiNote(file);
    }
  });

  const more = buttons.querySelector(".al-detail-more");
  if (more) buttons.insertBefore(syncBtn, more);
  else buttons.appendChild(syncBtn);
}
