import { type Setting, type SettingDefinition } from "obsidian";
import { defineFeature, type AnimeListFeatureHost, type FeatureSettingsSection } from "../../app/feature-types";
import { LegacyMetadataCleanupModal } from "../../ui/legacy-metadata-cleanup-modal";

export function createLegacyMetadataSettingDefinition(
  host: AnimeListFeatureHost,
  openCleanup: () => void = () => new LegacyMetadataCleanupModal(host).open(),
): SettingDefinition {
  return {
    name: "升级旧版元数据",
    desc: "扫描配置的媒体文件夹，清理旧版混杂的标签与工作室字段，在有高置信度匹配项时获取 AniList 分类元数据，并按现行规范写入类型、AniList 标签、制作公司、季度、原作与来源。不相关的 Frontmatter 与笔记正文将完整保留。",
    render: (setting: Setting) => {
      setting.addButton((button) => {
        button.setButtonText("扫描并升级");
        button.setCta();
        button.onClick(openCleanup);
      });
    },
  };
}

export function createLegacyMetadataSettingsSection(
  host: AnimeListFeatureHost,
  openCleanup: () => void = () => new LegacyMetadataCleanupModal(host).open(),
): FeatureSettingsSection {
  return {
    page: "updates-cleanup",
    heading: "旧版元数据清理",
    description: "将既有 AnimeList 笔记升级至最新元数据规范，并从 AniList 重新获取分类元数据。",
    definitions: [createLegacyMetadataSettingDefinition(host, openCleanup)],
  };
}

export const legacyMetadataSettingsFeature = defineFeature<AnimeListFeatureHost>({
  id: "legacy-metadata-cleanup-settings",
  contributions: [{
    kind: "settings",
    sections(host) {
      return createLegacyMetadataSettingsSection(host);
    },
  }],
});
