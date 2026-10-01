import { type Setting } from "obsidian";
import { defineFeature, type AnimeListFeatureHost, type FeatureSettingsSection } from "../../app/feature-types";
import { SerialCoverMigrationModal } from "../../ui/serial-covers/migration-modal";
import { configureSerialCoverProvider } from "../../data/serial-covers/provider";
import type { SerialCoverPlugin } from "../../app/serial-covers/serial-cover-service";

export function createSerialCoverSettingsSections(
  plugin: SerialCoverPlugin,
): FeatureSettingsSection[] {
  const apiKey: FeatureSettingsSection = {
    page: "features",
    heading: "连载封面搜索",
    definitions: [{
      name: "Google Books 备用 API 密钥",
      desc: "选填。默认优先使用 Bangumi 且无需密钥。仅在 Bangumi 无匹配封面时作为二级备用启用。",
      render: (setting: Setting) => {
        setting.addText((input) => {
          input.setPlaceholder("粘贴 API 密钥");
          input.setValue(plugin.settings.googleBooksApiKey ?? "");
          input.onChange(async (value) => {
            plugin.settings.googleBooksApiKey = value.trim();
            configureSerialCoverProvider({ apiKey: plugin.settings.googleBooksApiKey });
            await plugin.saveSettings();
          });
        });
      },
    }],
  };
  const recovery: FeatureSettingsSection = {
    page: "maintenance",
    heading: "连载封面修复",
    definitions: [{
      name: "补全缺失连载封面",
      desc: "为尚无封面的漫画与小说进度条目获取封面。绝不替换已有封面。",
      render: (setting: Setting) => {
        setting.addButton((button) => {
          button.setButtonText("补全缺失封面");
          button.setCta();
          button.onClick(() => {
            new SerialCoverMigrationModal(plugin).open();
          });
        });
      },
    }],
  };
  return [apiKey, recovery];
}

export const serialCoverSettingsFeature = defineFeature<AnimeListFeatureHost>({
  id: "serial-cover-settings",
  dependsOn: ["serial-entry-covers"],
  contributions: [{
    kind: "settings",
    sections(host) {
      return createSerialCoverSettingsSections(host);
    },
  }],
});
