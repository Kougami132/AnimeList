export const SETTINGS_PAGE_IDS = [
  "general",
  "search-metadata",
  "features",
  "maintenance",
  "updates-cleanup",
] as const;

export type SettingsPageId = typeof SETTINGS_PAGE_IDS[number];

export interface SettingsPageDefinition {
  id: SettingsPageId;
  label: string;
  description: string;
}

export const SETTINGS_PAGES: readonly SettingsPageDefinition[] = [
  {
    id: "general",
    label: "常规",
    description: "界面语言、媒体存储模式、文件存储路径与时间线默认布局配置。",
  },
  {
    id: "search-metadata",
    label: "搜索与元数据",
    description: "作品标题搜索语言偏好以及元数据抓取提供商开关。",
  },
  {
    id: "features",
    label: "功能特性",
    description: "连载追更、Bangumi 同步、标签管理、神作分级与封面搜索等特性配置。",
  },
  {
    id: "maintenance",
    label: "维护",
    description: "目录结构初始化、内置模板复制及无引用文件清理。",
  },
  {
    id: "updates-cleanup",
    label: "更新与清理",
    description: "适配新版本的数据迁移工具、文件名校准与旧版元数据清理。",
  },
];

export function getSettingsPageDefinition(page: SettingsPageId): SettingsPageDefinition {
  return SETTINGS_PAGES.find((definition) => definition.id === page) ?? SETTINGS_PAGES[0];
}

const FEATURE_SETTINGS_PAGES: Readonly<Record<string, SettingsPageId>> = Object.freeze({
  "release-tracking": "features",
  "serial-cover-settings": "features",
  "user-tag-catalog": "features",
  masterpiece: "features",
  "bangumi-sync": "features",
  "legacy-metadata-cleanup-settings": "updates-cleanup",
  "version-cleanup-settings": "updates-cleanup",
});

export function normalizeSettingsPage(value: unknown): SettingsPageId {
  return typeof value === "string" && SETTINGS_PAGE_IDS.includes(value as SettingsPageId)
    ? value as SettingsPageId
    : "general";
}

export function settingsPageForFeature(featureId: string): SettingsPageId {
  return FEATURE_SETTINGS_PAGES[featureId] ?? "features";
}

export function settingsPageForKey(
  current: SettingsPageId,
  key: string,
): SettingsPageId | null {
  const index = SETTINGS_PAGE_IDS.indexOf(current);
  if (key === "Home") return SETTINGS_PAGE_IDS[0];
  if (key === "End") return SETTINGS_PAGE_IDS[SETTINGS_PAGE_IDS.length - 1];
  if (key === "ArrowRight" || key === "ArrowDown") {
    return SETTINGS_PAGE_IDS[(index + 1) % SETTINGS_PAGE_IDS.length];
  }
  if (key === "ArrowLeft" || key === "ArrowUp") {
    return SETTINGS_PAGE_IDS[(index - 1 + SETTINGS_PAGE_IDS.length) % SETTINGS_PAGE_IDS.length];
  }
  return null;
}
