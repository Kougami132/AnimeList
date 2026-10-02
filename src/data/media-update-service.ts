import type { App, TFile } from "obsidian";
import type { MediaNoteForm, MediaType } from "../domain/media-types";
import { mediaNoteFolder, mediaTitleChanged } from "../domain/media-note-filename";
import { applyEditableMediaForm, completedProgress, validateMediaNoteFormForType } from "./media-note-codec";
import { uniqueVaultFilePath } from "./vault-file-path";
import { extractBangumiSubjectId } from "../domain/bangumi-sync/subject-matching";
import { isMediaWritebackDirty } from "../domain/bangumi-sync/writeback";
import { defaultProgressUnit } from "../domain/progress-units";
import { numeric } from "../domain/value-normalization";

export interface MediaUpdateCallbacks {
  refreshViews(): void;
}

export interface MediaWritebackTarget {
  pushAnimeData(
    subjectId: number,
    title: string,
    data: { status: string; progress: number; score: number | null },
  ): Promise<unknown>;
}

function validatedTitle(mediaType: MediaType, form: MediaNoteForm): string {
  const probe: Record<string, unknown> = {};
  applyEditableMediaForm(probe, mediaType, form);
  if (typeof probe.title !== "string") throw new Error("Validated media title is missing");
  return probe.title;
}

export class MediaUpdateService {
  constructor(
    private readonly app: App,
    private readonly callbacks: MediaUpdateCallbacks,
    private readonly writeback?: MediaWritebackTarget,
    private readonly isPushOnEditEnabled?: () => boolean,
  ) {}

  async update(file: TFile, mediaType: MediaType, form: MediaNoteForm): Promise<void> {
    const nextTitle = validatedTitle(mediaType, form);
    const previousFrontmatter = this.app.metadataCache?.getFileCache(file)?.frontmatter;
    const previousTitle = previousFrontmatter?.title;
    const previousSubjectId = extractBangumiSubjectId(previousFrontmatter);
    const prevStatus = previousFrontmatter?.status as string | undefined;
    const prevProgress = previousFrontmatter?.progress as number | undefined;
    const prevScore = previousFrontmatter?.score as number | null | undefined;
    const originalPath = file.path;
    let renamed = false;

    if (mediaTitleChanged(previousTitle, nextTitle)) {
      const targetPath = uniqueVaultFilePath(
        this.app.vault,
        mediaNoteFolder(originalPath),
        nextTitle,
        "md",
        { ignorePath: originalPath },
      );
      if (targetPath !== originalPath) {
        await this.app.fileManager.renameFile(file, targetPath);
        renamed = true;
      }
    }

    try {
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        applyEditableMediaForm(frontmatter, mediaType, form);
      });
    } catch (error) {
      if (renamed) {
        try {
          await this.app.fileManager.renameFile(file, originalPath);
        } catch (rollbackError) {
          throw new AggregateError(
            [error, rollbackError],
            `AnimeList could not save the edited note or restore its original filename: ${originalPath}`,
          );
        }
      }
      throw error;
    }

    if (
      mediaType === "anime"
      && this.writeback
      && (this.isPushOnEditEnabled ? this.isPushOnEditEnabled() : true)
    ) {
      const subjectId = previousSubjectId
        ?? extractBangumiSubjectId(this.app.metadataCache?.getFileCache(file)?.frontmatter);
      if (subjectId) {
        const validated = validateMediaNoteFormForType(mediaType, form);
        const unit = defaultProgressUnit(mediaType, form.unit);
        const total = Math.max(0, numeric(form.total));
        const progress = completedProgress(validated.status, total, form.progress, mediaType, unit);
        const numericProgress = typeof progress === "number" ? progress : numeric(progress);
        const nextScore = validated.score ?? null;

        const isDirty = isMediaWritebackDirty(
          {
            status: prevStatus,
            progress: prevProgress,
            score: prevScore,
          },
          {
            status: validated.status,
            progress: numericProgress,
            score: nextScore,
          },
        );

        if (isDirty) {
          try {
            await this.writeback.pushAnimeData(subjectId, nextTitle, {
              status: validated.status,
              progress: numericProgress,
              score: nextScore,
            });
          } catch (pushError) {
            console.warn("AnimeList Bangumi push failed after note update:", pushError);
          }
        }
      }
    }

    this.callbacks.refreshViews();
  }
}
