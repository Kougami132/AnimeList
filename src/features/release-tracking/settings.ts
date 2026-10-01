import type { Setting } from "obsidian";
import type { AnimeListFeatureHost, FeatureSettingsSection } from "../../app/feature-types";
import { ReleaseTrackingManagerModal } from "../../ui/release-tracking-manager-modal";
import { openReleaseDashboard, runAutomaticReleaseCheck, serviceFor } from "./controller";

export function createReleaseTrackingSettingsSection(host: AnimeListFeatureHost): FeatureSettingsSection {
  return {
    heading: "连载追更",
    definitions: [{
      name: "获取最新连载与出版信息",
      desc: "在官方来源可用时自动检查漫画话数（以 MangaDex 作为备用），并通过 NDL Search / JPRO 检查小说最新卷。绝不修改既有阅读进度。",
      render: (setting: Setting) => {
        setting.addToggle((toggle) => {
          toggle.setValue(host.settings.releaseTracking.enabled);
          toggle.onChange(async (enabled) => {
            host.settings.releaseTracking.enabled = enabled;
            if (!enabled) host.settings.releaseTracking.automatic = false;
            await host.saveSettings();
            host.refreshViews();
          });
        });
      },
    }, {
      name: "每日自动检查更新",
      desc: "在 Obsidian 打开期间，每 24 小时最多检查一次。Obsidian 关闭时不运行。",
      render: (setting: Setting) => {
        setting.addToggle((toggle) => {
          toggle.setValue(host.settings.releaseTracking.automatic);
          toggle.onChange(async (automatic) => {
            host.settings.releaseTracking.automatic = automatic;
            if (automatic) host.settings.releaseTracking.lastAutomaticCheckAt = "";
            await host.saveSettings();
            if (automatic) void runAutomaticReleaseCheck(host);
          });
        });
      },
    }, {
      name: "管理追踪作品",
      desc: "选择检查更新时包含哪些漫画与小说。已停用的作品将保留选择，不会自动重新加入。",
      render: (setting: Setting) => {
        setting.addButton((button) => {
          button.setButtonText("管理作品");
          button.onClick(() => {
            new ReleaseTrackingManagerModal(host.app, serviceFor(host), host.collectMediaItems(), {
              onApplied() { host.refreshViews(); },
            }).open();
          });
        });
      },
    }, {
      name: "立即检查",
      desc: "立即检查已追踪漫画与小说的最新更新。",
      render: (setting: Setting) => {
        setting.addButton((button) => {
          button.setButtonText("检查更新");
          button.onClick(() => { openReleaseDashboard(host); });
        });
      },
    }],
  };
}
