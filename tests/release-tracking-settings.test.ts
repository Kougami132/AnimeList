import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Setting } from "obsidian";
import type { AnimeListFeatureHost } from "../src/app/feature-types";
import { createReleaseTrackingSettingsSection } from "../src/features/release-tracking/settings";
import { createDefaultSettings } from "../src/app/settings-model";

describe("release tracking settings", () => {
  it("exposes an explicit opt-in toggle, daily check toggle, and manual check action", () => {
    const settings = createDefaultSettings();
    const host = {
      settings,
      saveSettings: async () => undefined,
      refreshViews: () => undefined,
    } as unknown as AnimeListFeatureHost;
    const section = createReleaseTrackingSettingsSection(host);

    assert.equal(section.heading, "连载追更");
    assert.equal(settings.releaseTracking.enabled, false);
    assert.equal(settings.releaseTracking.automatic, false);
    assert.deepEqual(section.definitions.map((definition) => definition.name), [
      "获取最新连载与出版信息",
      "每日自动检查更新",
      "管理追踪作品",
      "立即检查",
    ]);
    for (const definition of section.definitions) {
      assert.equal(definition.visible?.() ?? true, true);
      definition.render?.(new Setting({} as HTMLElement));
    }
  });
});
