import type { Setting } from "obsidian";
import type { AnimeListFeatureHost, FeatureSettingsSection } from "../../app/feature-types";
import { BangumiSyncClient } from "../../data/bangumi-sync/bangumi-sync-client";
import {
  BANGUMI_COLLECTION_STATUSES,
  type BangumiCollectionStatus,
  normalizeBangumiCollectionTypes,
} from "../../domain/bangumi-sync/types";
import { bindImageFallback } from "../../ui/image-fallback";

export function createBangumiSyncSettingsSection(
  host: AnimeListFeatureHost,
  onBatchSync?: () => void,
): FeatureSettingsSection {
  return {
    page: "features",
    heading: "Bangumi 同步",
    description: "与 Bangumi (bgm.tv) 同步动画在看进度、观看状态与评分。",
    definitions: [
      {
        name: "个人访问令牌 (PAT)",
        desc: "输入您的 Bangumi 个人访问令牌 (Personal Access Token)。用于读取和更新您的私有收藏。",
        render: (setting: Setting) => {
          setting.addText((input) => {
            input.inputEl.type = "password";
            input.setPlaceholder("输入个人访问令牌");
            input.setValue(host.settings.bangumiAccessToken);
            input.onChange(async (val) => {
              host.settings.bangumiAccessToken = val.trim();
              await host.saveSettings();
            });
          });
        },
      },
      {
        name: "测试连接",
        desc: "使用 Bangumi API 验证您的个人访问令牌有效性。",
        render: (setting: Setting) => {
          const feedbackContainer = setting.settingEl.createDiv({ cls: "al-bangumi-feedback" });

          setting.addButton((button) => {
            button.setButtonText("测试连接");
            button.onClick(async () => {
              const token = host.settings.bangumiAccessToken.trim();
              if (!token) {
                feedbackContainer.empty();
                const errEl = feedbackContainer.createDiv({ cls: "al-bangumi-error" });
                errEl.textContent = "请先输入个人访问令牌。";
                return;
              }

              button.buttonEl.disabled = true;
              button.setButtonText("正在测试…");
              feedbackContainer.empty();

              try {
                const client = new BangumiSyncClient();
                const profile = await client.verifyToken(token);
                feedbackContainer.empty();
                feedbackContainer.className = "al-bangumi-feedback al-bangumi-profile-card";

                const avatarUrl = profile.avatar?.medium || profile.avatar?.large || profile.avatar?.small;
                if (avatarUrl) {
                  const avatar = feedbackContainer.createEl("img", { cls: "al-bangumi-avatar" });
                  avatar.src = avatarUrl;
                  avatar.alt = profile.nickname;
                  bindImageFallback(avatar, () => null);
                }

                const info = feedbackContainer.createDiv({ cls: "al-bangumi-profile-info" });
                const nameLine = info.createDiv({ cls: "al-bangumi-profile-name" });
                nameLine.textContent = profile.nickname;
                const userLine = info.createDiv({ cls: "al-bangumi-profile-user" });
                userLine.textContent = `@${profile.username} (ID: ${profile.id})`;

                const successBadge = feedbackContainer.createDiv({ cls: "al-bangumi-status-badge is-success" });
                successBadge.textContent = "已连接";
              } catch (error) {
                feedbackContainer.empty();
                feedbackContainer.className = "al-bangumi-feedback";
                const errEl = feedbackContainer.createDiv({ cls: "al-bangumi-error" });
                errEl.textContent = error instanceof Error ? error.message : "连接 Bangumi 失败。";
              } finally {
                button.buttonEl.disabled = false;
                button.setButtonText("测试连接");
              }
            });
          });
        },
      },
      {
        name: "编辑时自动回写",
        desc: "在 AnimeList 编辑弹窗中修改动画的在看进度、观看状态或评分并保存后，自动推送更新至 Bangumi。",
        render: (setting: Setting) => {
          setting.addToggle((toggle) => {
            toggle.setValue(host.settings.bangumiPushOnEdit);
            toggle.onChange(async (val) => {
              host.settings.bangumiPushOnEdit = val;
              await host.saveSettings();
            });
          });
        },
      },
      {
        name: "同步时间窗口 (天)",
        desc: "获取近期更新收藏的滚动时间范围天数（默认 30 天）。",
        render: (setting: Setting) => {
          setting.addText((input) => {
            input.setPlaceholder("30");
            input.setValue(String(host.settings.syncRecentDays));
            input.onChange(async (val) => {
              const parsed = Number(val);
              host.settings.syncRecentDays = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 30;
              await host.saveSettings();
            });
          });
        },
      },
      {
        name: "同步收藏状态",
        desc: "选择参与同步的 Bangumi 收藏状态分类。",
        render: (setting: Setting) => {
          const container = setting.settingEl.createDiv({ cls: "al-bangumi-status-toggles" });
          const statusLabels: Record<BangumiCollectionStatus, string> = {
            watching: "在看 (Watching)",
            completed: "看过 (Completed)",
            wishlist: "想看 (Wishlist)",
            on_hold: "搁置 (On Hold)",
            dropped: "抛弃 (Dropped)",
          };

          for (const status of BANGUMI_COLLECTION_STATUSES) {
            const row = container.createDiv({ cls: "al-bangumi-status-row" });
            const label = row.createEl("label", { cls: "al-bangumi-status-label" });
            const checkbox = label.createEl("input", { type: "checkbox" });
            checkbox.checked = host.settings.syncCollectionTypes.includes(status);
            label.createSpan({ text: ` ${statusLabels[status]}` });

            checkbox.addEventListener("change", () => {
              void (async () => {
                const current = new Set(host.settings.syncCollectionTypes);
                if (checkbox.checked) current.add(status);
                else current.delete(status);
                host.settings.syncCollectionTypes = normalizeBangumiCollectionTypes([...current]);
                await host.saveSettings();
              })();
            });
          }
        },
      },
      {
        name: "启动时自动同步",
        desc: "当 Obsidian 启动时，自动在后台静默同步仓库中已存在的动画笔记。",
        render: (setting: Setting) => {
          setting.addToggle((toggle) => {
            toggle.setValue(host.settings.autoSyncOnStartup);
            toggle.onChange(async (val) => {
              host.settings.autoSyncOnStartup = val;
              await host.saveSettings();
            });
          });
        },
      },
      {
        name: "自动同步冷却时间 (分钟)",
        desc: "启动后台自动同步的最短间隔分钟数（默认 30 分钟）。",
        render: (setting: Setting) => {
          setting.addText((input) => {
            input.setPlaceholder("30");
            input.setValue(String(host.settings.autoSyncCooldownMinutes));
            input.onChange(async (val) => {
              const parsed = Number(val);
              host.settings.autoSyncCooldownMinutes = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 30;
              await host.saveSettings();
            });
          });
        },
      },
      {
        name: "批量同步近期动画",
        desc: "从 Bangumi 获取近期更新的收藏，并在差异预览窗口中检视后同步。",
        render: (setting: Setting) => {
          setting.addButton((button) => {
            button.setButtonText("立即批量同步");
            button.onClick(() => {
              onBatchSync?.();
            });
          });
        },
      },
    ],
  };
}
