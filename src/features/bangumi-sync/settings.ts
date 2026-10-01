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
    heading: "Bangumi synchronization",
    description: "Synchronize anime watching progress, status, and ratings with Bangumi (bgm.tv).",
    definitions: [
      {
        name: "Personal Access Token",
        desc: "Enter your Bangumi Personal Access Token (PAT). Required for reading and updating your private collections.",
        render: (setting: Setting) => {
          setting.addText((input) => {
            input.inputEl.type = "password";
            input.setPlaceholder("Enter personal access token");
            input.setValue(host.settings.bangumiAccessToken);
            input.onChange(async (val) => {
              host.settings.bangumiAccessToken = val.trim();
              await host.saveSettings();
            });
          });
        },
      },
      {
        name: "Test connection",
        desc: "Validate your Personal Access Token with the Bangumi API.",
        render: (setting: Setting) => {
          const feedbackContainer = setting.settingEl.createDiv({ cls: "al-bangumi-feedback" });

          setting.addButton((button) => {
            button.setButtonText("Test connection");
            button.onClick(async () => {
              const token = host.settings.bangumiAccessToken.trim();
              if (!token) {
                feedbackContainer.empty();
                const errEl = feedbackContainer.createDiv({ cls: "al-bangumi-error" });
                errEl.textContent = "Please enter a personal access token first.";
                return;
              }

              button.buttonEl.disabled = true;
              button.setButtonText("Testing...");
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
                successBadge.textContent = "Connected";
              } catch (error) {
                feedbackContainer.empty();
                feedbackContainer.className = "al-bangumi-feedback";
                const errEl = feedbackContainer.createDiv({ cls: "al-bangumi-error" });
                errEl.textContent = error instanceof Error ? error.message : "Failed to connect to Bangumi.";
              } finally {
                button.buttonEl.disabled = false;
                button.setButtonText("Test connection");
              }
            });
          });
        },
      },
      {
        name: "Sync window (days)",
        desc: "Rolling interval in days for fetching recently updated collections (default 30).",
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
        name: "Collection statuses",
        desc: "Select which Bangumi collection statuses to include in synchronization.",
        render: (setting: Setting) => {
          const container = setting.settingEl.createDiv({ cls: "al-bangumi-status-toggles" });
          const statusLabels: Record<BangumiCollectionStatus, string> = {
            watching: "Watching (在看)",
            completed: "Completed (看过)",
            wishlist: "Wishlist (想看)",
            on_hold: "On Hold (搁置)",
            dropped: "Dropped (抛弃)",
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
        name: "Auto-sync on startup",
        desc: "Automatically sync existing anime notes with Bangumi in the background when Obsidian starts.",
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
        name: "Auto-sync cooldown (minutes)",
        desc: "Minimum minutes between startup background sync runs (default 30).",
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
        name: "Batch sync recent anime",
        desc: "Fetch recent collection updates from Bangumi and preview changes.",
        render: (setting: Setting) => {
          setting.addButton((button) => {
            button.setButtonText("Batch sync now");
            button.onClick(() => {
              onBatchSync?.();
            });
          });
        },
      },
    ],
  };
}
