import { type Setting } from "obsidian";
import { defineFeature, type AnimeListFeatureHost, type FeatureSettingsSection } from "../../app/feature-types";
import { MediaNoteFilenameCleanupModal } from "../../ui/media-note-filename-cleanup-modal";
import { DuplicateCoverCleanupModal } from "../../ui/version-cleanup-modal";
import { createLegacyMetadataSettingDefinition } from "../legacy-metadata-cleanup/settings";

export function createVersionCleanupSettingsSection(
  host: AnimeListFeatureHost,
  openCleanup: () => void = () => new DuplicateCoverCleanupModal(host).open(),
  openFilenameCleanup: () => void = () => new MediaNoteFilenameCleanupModal(host).open(),
): FeatureSettingsSection {
  return {
    page: "updates-cleanup",
    heading: "版本更新兼容维护",
    description: "查看并应用新版本 AnimeList 所需的单次兼容性数据维护工具。",
    definitions: [{
      name: "同步笔记文件名与作品标题",
      desc: "通过 AnimeList 编辑标题时会自动保持文件名一致，但旧笔记或手动重命名的文件可能存在差异。手动文件名在媒体库中依然有效；仅在您希望预览并将文件名与标题 Frontmatter 重新对齐时使用此功能。笔记保留在原文件夹中，笔记内容与 Frontmatter 不会被重写，文件名冲突时将自动添加诸如「 (2)」后缀。",
      render: (setting: Setting) => {
        setting.addButton((button) => {
          button.setButtonText("查看重命名预览");
          button.setCta();
          button.onClick(openFilenameCleanup);
        });
      },
    }, {
      name: "清理笔记内重复嵌入封面",
      desc: "预览在 animelist-detail 下方仍嵌入了相同封面的旧版默认笔记，经确认后 AnimeList 仅会清理这些自动生成的重复封面行。",
      render: (setting: Setting) => {
        setting.addButton((button) => {
          button.setButtonText("查看清理预览");
          button.setCta();
          button.onClick(openCleanup);
        });
      },
    }, createLegacyMetadataSettingDefinition(host)],
  };
}

export const versionCleanupSettingsFeature = defineFeature<AnimeListFeatureHost>({
  id: "version-cleanup-settings",
  contributions: [{
    kind: "settings",
    sections(host) {
      return createVersionCleanupSettingsSection(host);
    },
  }],
});
