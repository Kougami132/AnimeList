import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { App } from "obsidian";
import type { SettingDefinitionItem, SettingDefinitionPage } from "obsidian";
import { AnimeListSettingTab, DEFAULT_SETTINGS } from "../src/ui/settings";
import "../src/ui-text";
import "../src/features/search/text";
import {
  SETTINGS_PAGES,
  getSettingsPageDefinition,
  settingsPageForKey,
} from "../src/app/settings-layout";
import { registerLocaleMessages, resetLocaleForTests, setActiveLocale } from "../src/i18n/catalog";
import { EN_CORE_MESSAGES } from "../src/i18n/locales/en/core";
import { EN_SEARCH_MESSAGES } from "../src/i18n/locales/en/search";
import { JA_CORE_MESSAGES } from "../src/i18n/locales/ja/core";
import { JA_SEARCH_MESSAGES } from "../src/i18n/locales/ja/search";


function searchableSettingNames(items: readonly SettingDefinitionItem[]): string[] {
  const names: string[] = [];
  for (const item of items) {
    if ("type" in item) {
      if (item.type === "page") {
        names.push(...searchableSettingNames(item.items ?? []));
        continue;
      }
      if (item.type === "group" || item.type === "list") {
        names.push(...searchableSettingNames(item.items ?? []));
        continue;
      }
    }
    if (item.searchable !== false) names.push(item.name);
  }
  return names;
}

function createHost() {
  return {
    app: new App(),
    settings: structuredClone(DEFAULT_SETTINGS),
    async loadData(): Promise<unknown> { return {}; },
    async saveSettings(): Promise<void> {},
    async initializeLibrary(): Promise<void> {},
    async cleanupGarbageFiles() { return { removedManagedFiles: 0, removedJournalFiles: 0, removedCacheFiles: 0 }; },
    refreshViews(): void {},
  };
}

describe("search language settings", () => {
  it("groups all language toggles in one Chinese section", () => {
    const tab = new AnimeListSettingTab(new App(), createHost());
    const sections = tab.getSettingSections();
    const languageSection = sections.find((section) => section.heading === "标题搜索语言");

    assert.ok(languageSection);
    assert.equal(languageSection.page, "search-metadata");
    assert.deepEqual(
      languageSection.definitions.map((definition) => definition.name),
      ["中文标题", "英文标题", "原语言标题"],
    );
    assert.equal(
      languageSection.definitions.every((definition) => (
        typeof definition.desc === "string" && /[\u3400-\u9fff]/u.test(definition.desc)
      )),
      true,
    );
  });

  it("keeps the whole settings model in Simplified Chinese regardless of interface language", () => {
    registerLocaleMessages("core", "en", EN_CORE_MESSAGES);
    registerLocaleMessages("search", "en", EN_SEARCH_MESSAGES);
    registerLocaleMessages("core", "ja", JA_CORE_MESSAGES);
    registerLocaleMessages("search", "ja", JA_SEARCH_MESSAGES);
    setActiveLocale("ja");
    try {
      const host = createHost();
      Object.assign(host, {
        getFeatureSettingsSections: () => [{
          heading: "特性设置",
          description: "特性设置描述",
          definitions: [{ name: "特性选项", desc: "特性选项描述" }],
        }],
      });
      const tab = new AnimeListSettingTab(new App(), host);
      const sections = tab.getSettingSections();
      assert.equal(tab.getInterfaceLanguageDefinition().name, "显示语言");
      assert.equal(tab.getInterfaceLanguageDefinition().desc,
        "选择 AnimeList 视图、弹窗与通知的界面语言（设置页面固定保持中文）。此操作不会修改笔记正文、标签或元数据。");
      assert.equal(sections.some((section) => section.heading === "検索言語"), false);
      assert.ok(sections.some((section) => section.heading === "标题搜索语言"));
      assert.ok(sections.some((section) => section.heading === "元数据提供商"));
      assert.deepEqual(
        tab.getSettingsPageSections("features").map((section) => section.heading),
        ["特性设置"],
      );
    } finally {
      resetLocaleForTests();
    }
  });

  it("exposes the complete settings model through Obsidian 1.13 declarative pages", () => {
    const host = createHost();
    Object.assign(host, {
      getFeatureSettingsSections: () => [{
        page: "features" as const,
        heading: "特性设置",
        definitions: [{ name: "特性选项", desc: "特性选项描述" }],
      }],
    });
    const tab = new AnimeListSettingTab(new App(), host);
    const definitions = tab.getSettingDefinitions();
    const pages = definitions as SettingDefinitionPage[];

    assert.deepEqual(pages.map((page) => page.type), ["page", "page", "page", "page", "page"]);
    assert.deepEqual(pages.map((page) => page.name), SETTINGS_PAGES.map((page) => page.label));
    assert.deepEqual(pages.map((page) => page.desc), SETTINGS_PAGES.map((page) => page.description));

    const searchableNames = searchableSettingNames(definitions);
    assert.ok(searchableNames.includes("显示语言"));
    assert.ok(searchableNames.includes("存储模式"));
    assert.ok(searchableNames.includes("中文标题"));
    assert.ok(searchableNames.includes("AniList"));
    assert.ok(searchableNames.includes("特性选项"));

    const expectedDefinitionCount = tab.getSettingSections()
      .reduce((count, section) => count + section.definitions.length, 0);
    assert.equal(searchableNames.length, expectedDefinitionCount);
  });

  it("organizes core settings into five top-level pages with titled sections", () => {
    const tab = new AnimeListSettingTab(new App(), createHost());

    assert.deepEqual(SETTINGS_PAGES.map((page) => page.label), [
      "常规",
      "搜索与元数据",
      "功能特性",
      "维护",
      "更新与清理",
    ]);
    assert.deepEqual(SETTINGS_PAGES.map((page) => page.description), [
      "界面语言、媒体存储模式、文件存储路径与时间线默认布局配置。",
      "作品标题搜索语言偏好以及元数据抓取提供商开关。",
      "连载追更、Bangumi 同步、标签管理、神作分级与封面搜索等特性配置。",
      "目录结构初始化、内置模板复制及无引用文件清理。",
      "适配新版本的数据迁移工具、文件名校准与旧版元数据清理。",
    ]);
    assert.equal(
      getSettingsPageDefinition("features").description,
      "连载追更、Bangumi 同步、标签管理、神作分级与封面搜索等特性配置。",
    );
    assert.deepEqual(tab.getSettingsPageSections("general").map((section) => section.heading), [
      "界面",
      "媒体库与存储模式",
      "文件存储路径",
      "时间线",
    ]);
    assert.deepEqual(tab.getSettingsPageSections("search-metadata").map((section) => section.heading), [
      "标题搜索语言",
      "元数据提供商",
    ]);
    assert.deepEqual(tab.getSettingsPageSections("updates-cleanup").map((section) => section.heading), []);
    assert.deepEqual(tab.getSettingsPageSections("maintenance").map((section) => section.heading), [
      "媒体库初始化",
      "存储清理",
    ]);
  });

  it("supports standard keyboard navigation across the top-level pages", () => {
    assert.equal(settingsPageForKey("general", "ArrowRight"), "search-metadata");
    assert.equal(settingsPageForKey("general", "ArrowLeft"), "updates-cleanup");
    assert.equal(settingsPageForKey("features", "Home"), "general");
    assert.equal(settingsPageForKey("features", "End"), "updates-cleanup");
    assert.equal(settingsPageForKey("features", "Enter"), null);
  });
  it("runs the garbage-file cleanup action from Maintenance", async () => {
    let cleanupCalls = 0;
    const host = createHost();
    host.cleanupGarbageFiles = async () => {
      cleanupCalls += 1;
      return { removedManagedFiles: 2, removedJournalFiles: 1, removedCacheFiles: 3 };
    };
    const tab = new AnimeListSettingTab(new App(), host);
    const section = tab.getSettingsPageSections("maintenance").find((value) => value.heading === "存储清理");
    const definition = section?.definitions.find((value) => value.name === "清理无引用文件");
    assert.ok(definition?.render);

    let label = "";
    let click: (() => Promise<void>) | null = null;
    const buttonEl = { disabled: false };
    const setting = {
      addButton(callback: (button: {
        buttonEl: { disabled: boolean };
        setButtonText(value: string): unknown;
        onClick(handler: () => Promise<void>): unknown;
      }) => void) {
        const button = {
          buttonEl,
          setButtonText(value: string) { label = value; return this; },
          onClick(handler: () => Promise<void>) { click = handler; return this; },
        };
        callback(button);
        return this;
      },
    };
    definition.render(setting as never);
    assert.equal(label, "清理无引用文件");
    assert.ok(click);
    await click();
    assert.equal(cleanupCalls, 1);
    assert.equal(buttonEl.disabled, false);
  });

});
