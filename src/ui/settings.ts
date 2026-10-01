import { App, Notice, PluginSettingTab, Setting, normalizePath, requireApiVersion } from "obsidian";
import type { SettingDefinition, SettingDefinitionItem } from "obsidian";
import { DEFAULT_SEARCH_LANGUAGES } from "../app/search/multilingual-search";
import {
  SETTINGS_PAGES,
  getSettingsPageDefinition,
  normalizeSettingsPage,
  settingsPageForKey,
  type SettingsPageId,
} from "../app/settings-layout";
import {
  MAX_TIMELINE_MAX_STACK_DEPTH,
  MIN_TIMELINE_MAX_STACK_DEPTH,
  normalizeTimelineMaxStackDepth,
} from "../domain/timeline/scale";
import type {
  AnimeListSettings,
  LanguagePreference,
  SearchLanguage,
  SearchLanguageSettings,
  StorageMode,
} from "../types";
export { DEFAULT_SETTINGS } from "../app/settings-model";
import { buildDeclarativeSettingsPage } from "./settings-declarative";
import { isolateHorizontalSwipeSurface } from "./mobile-swipe-isolation";

const DEFAULT_LIBRARY_FOLDER = "AnimeList";
const ADDITIONAL_FOLDER_EXAMPLE = "Media\nArchive/Anime";
const DEFAULT_COVER_FOLDER = "AnimeList/Covers";
const DEFAULT_TEMPLATE_FOLDER = "AnimeList/Templates";

export interface AnimeListSettingsHost {
  app: App;
  settings: AnimeListSettings;
  saveSettings(): Promise<void>;
  initializeLibrary(copyTemplates?: boolean): Promise<void>;
  refreshViews(): void;
  cleanupGarbageFiles(): Promise<{ removedManagedFiles: number; removedJournalFiles: number; removedCacheFiles: number }>;
  setInterfaceLanguage?(preference: LanguagePreference): Promise<void>;
  getFeatureSettingsSections?(): SettingsSection[];
}

export interface SettingsSection {
  page?: SettingsPageId;
  heading?: string;
  description?: string;
  definitions: SettingDefinition[];
}

function splitFolders(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((folder) => normalizePath(folder.trim()).replace(/^\/+|\/+$/g, ""))
    .filter(Boolean);
}

// Obsidian 1.13+ renders/searches the declarative tree; older versions still call display().
// Both paths are generated from getSettingSections() so settings behavior cannot drift.
export class AnimeListSettingTab extends PluginSettingTab {
  plugin: AnimeListSettingsHost;
  private activePage: SettingsPageId = "general";

  constructor(app: App, plugin: AnimeListSettingsHost) {
    super(app, plugin as never);
    this.plugin = plugin;
  }

  getInterfaceLanguageDefinition(): SettingDefinition {
    return {
      name: "显示语言",
      desc: "选择 AnimeList 视图、弹窗与通知的界面语言（设置页面固定保持中文）。此操作不会修改笔记正文、标签或元数据。",
      render: (setting) => this.renderInterfaceLanguage(setting),
    };
  }

  private getCoreSettingDefinitions(): SettingDefinition[] {
    return [
      {
        name: "存储模式",
        desc: "分类托管模式会自动创建 Anime、Manga 和 Novel 子文件夹。单文件夹模式将所有媒体笔记直接保存在同一目录下。",
        render: (setting) => this.renderStorageLayout(setting),
      },
      {
        name: "媒体库根目录",
        desc: "AnimeList 将在此目录下创建 Anime、Manga、Novel、Covers 与 Templates 子文件夹。默认为 AnimeList。",
        visible: () => this.plugin.settings.storageMode === "managed",
        render: (setting) => this.renderLibraryRoot(setting),
      },
      {
        name: "单文件夹保存路径",
        desc: "媒体笔记将直接保存在此文件夹中，不创建 Anime、Manga、Novel 子文件夹。留空则保存在仓库根目录。",
        visible: () => this.plugin.settings.storageMode === "flat",
        render: (setting) => this.renderFlatMediaFolder(setting),
      },
      {
        name: "附加扫描文件夹",
        desc: "仅读取而不移动文件的既有文件夹路径（相对于仓库根目录）。每行输入一个路径，或使用逗号分隔。",
        render: (setting) => this.renderAdditionalScanFolders(setting),
      },
      {
        name: "封面保存目录",
        desc: "下载的封面图片将保存在此目录下，按媒体类型分组存放。",
        render: (setting) => this.renderCoverFolder(setting),
      },
      {
        name: "自定义模板目录",
        desc: "自定义模板将从该目录下的 Anime、Manga、Novel 和 Common 子文件夹中读取。",
        render: (setting) => this.renderTemplateFolder(setting),
      },
      {
        name: "时间线单侧最大堆叠深度",
        desc: "计算默认时间线间距时，单侧允许堆叠的最大卡片层数（默认为 3 层）。",
        render: (setting) => this.renderTimelineMaxStackDepth(setting),
      },
      {
        name: "Bangumi",
        desc: "搜索动画、漫画与轻小说。对中文和日文作品匹配效果极佳。",
        render: (setting) => this.renderProvider(setting, "bangumi"),
      },
      {
        name: "AniList",
        desc: "以结构化元数据搜索动画、漫画与轻小说。",
        render: (setting) => this.renderProvider(setting, "anilist"),
      },
      {
        name: "Open Library",
        desc: "搜索常规小说与图书作品。",
        render: (setting) => this.renderProvider(setting, "openlibrary"),
      },
      {
        name: "创建预设文件夹",
        desc: "创建缺失的笔记、封面与模板文件夹。绝不会移动或覆盖已有文件。",
        render: (setting) => this.renderCreateFolders(setting),
      },
      {
        name: "复制内置模板",
        desc: "将内置中文模板写入配置的模板文件夹。不会覆盖已有文件。",
        render: (setting) => this.renderCopyTemplates(setting),
      },
    ];
  }

  getSearchLanguageDefinitions(): SettingDefinition[] {
    return [
      {
        name: "中文标题",
        desc: "使用简体中文与繁体中文别名检索匹配作品。",
        render: (setting) => this.renderSearchLanguage(setting, "chinese"),
      },
      {
        name: "英文标题",
        desc: "使用英文标题与提供商同义词扩展搜索范围。",
        render: (setting) => this.renderSearchLanguage(setting, "english"),
      },
      {
        name: "原语言标题",
        desc: "使用原生标题与罗马字标题（日文、韩文或其他原文）。",
        render: (setting) => this.renderSearchLanguage(setting, "original"),
      },
    ];
  }

  getSettingSections(): SettingsSection[] {
    const base = this.getCoreSettingDefinitions();
    const sections: SettingsSection[] = [
      {
        page: "general",
        definitions: [this.getInterfaceLanguageDefinition(), ...base.slice(0, 6)],
      },
      {
        page: "general",
        heading: "时间线",
        description: "控制时间线首次打开或重置为默认视图时的初始布局。",
        definitions: base.slice(6, 7),
      },
      {
        page: "search-metadata",
        heading: "标题搜索语言",
        definitions: this.getSearchLanguageDefinitions(),
      },
      {
        page: "search-metadata",
        heading: "元数据提供商",
        definitions: base.slice(7, 10),
      },
      {
        page: "maintenance",
        heading: "媒体库初始化",
        definitions: base.slice(10),
      },
      {
        page: "maintenance",
        heading: "存储清理",
        description: "清理媒体库中不再被任何笔记引用的本地文件。",
        definitions: [{
          name: "清理无引用文件",
          desc: "安全将未被引用的 AnimeList 本地封面和媒体图片移至 Obsidian 回收站，并清理失效的插件缓存与状态文件。",
          render: (setting) => this.renderGarbageCleanup(setting),
        }],
      },
    ];
    const featureSections = (this.plugin.getFeatureSettingsSections?.() ?? []).map((section) => ({
      ...section,
      page: section.page ?? "features" as const,
    }));
    sections.splice(1, 0, ...featureSections);
    return sections;
  }

  private pageSectionsFrom(
    allSections: readonly SettingsSection[],
    page: SettingsPageId,
  ): SettingsSection[] {
    const sections = allSections.filter((section) => section.page === page);
    if (page !== "general") return sections;
    const core = sections.find((section) => !section.heading);
    if (!core) return sections;
    return [
      { page: "general", heading: "界面", definitions: core.definitions.slice(0, 1) },
      { page: "general", heading: "媒体库与存储模式", definitions: core.definitions.slice(1, 5) },
      { page: "general", heading: "文件存储路径", definitions: core.definitions.slice(5) },
      ...sections.filter((section) => section !== core),
    ];
  }

  getSettingsPageSections(page: SettingsPageId): SettingsSection[] {
    return this.pageSectionsFrom(this.getSettingSections(), page);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const allSections = this.getSettingSections();
    return SETTINGS_PAGES.map((page) => buildDeclarativeSettingsPage(
      page,
      this.pageSectionsFrom(allSections, page.id),
    ));
  }

  display(): void {
    this.plugin.settings.timelineMaxStackDepth = normalizeTimelineMaxStackDepth(
      this.plugin.settings.timelineMaxStackDepth,
    );
    this.renderImperativeSettings();
  }

  private renderPageTabs(containerEl: HTMLElement): void {
    const tabList = isolateHorizontalSwipeSurface(containerEl.createDiv({ cls: "animelist-settings-tabs" }));
    tabList.setAttribute("role", "tablist");
    tabList.setAttribute("aria-label", "设置分页");

    for (const page of SETTINGS_PAGES) {
      const active = page.id === this.activePage;
      const button = tabList.createEl("button", {
        cls: "animelist-settings-tab",
        text: page.label,
      });
      button.type = "button";
      button.id = `animelist-settings-tab-${page.id}`;
      button.dataset.settingsPage = page.id;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(active));
      button.setAttribute("aria-controls", `animelist-settings-panel-${page.id}`);
      button.tabIndex = active ? 0 : -1;
      button.classList.toggle("is-active", active);
      button.addEventListener("click", () => {
        if (page.id !== this.activePage) this.openSettingsPage(page.id);
      });
      button.addEventListener("keydown", (event) => {
        const next = settingsPageForKey(page.id, event.key);
        if (!next) return;
        event.preventDefault();
        this.openSettingsPage(next, true);
      });
      tabList.append(" ");
    }
  }

  private openSettingsPage(page: SettingsPageId, focusTab = false): void {
    this.activePage = normalizeSettingsPage(page);
    this.renderImperativeSettings();
    if (!focusTab) return;
    this.containerEl
      .querySelector<HTMLButtonElement>(`button[data-settings-page="${this.activePage}"]`)
      ?.focus();
  }

  private renderImperativeSettings(): void {
    const { containerEl } = this;
    containerEl.empty();
    this.activePage = normalizeSettingsPage(this.activePage);
    this.renderPageTabs(containerEl);

    const panel = containerEl.createDiv({ cls: "animelist-settings-page" });
    panel.id = `animelist-settings-panel-${this.activePage}`;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", `animelist-settings-tab-${this.activePage}`);
    panel.createEl("p", {
      cls: "animelist-settings-intro",
      text: getSettingsPageDefinition(this.activePage).description,
    });

    for (const section of this.getSettingsPageSections(this.activePage)) {
      const sectionEl = panel.createEl("section", { cls: "animelist-settings-section" });
      if (section.heading) {
        const headerEl = sectionEl.createDiv({ cls: "animelist-settings-section-header" });
        const heading = new Setting(headerEl).setName(section.heading).setHeading();
        if (section.description) heading.setDesc(section.description);
      }

      const bodyEl = sectionEl.createDiv({ cls: "animelist-settings-section-body" });
      let renderedDefinitions = 0;
      for (const definition of section.definitions) {
        if (definition.visible === false
          || (typeof definition.visible === "function" && !definition.visible())) continue;
        const setting = new Setting(bodyEl).setName(definition.name);
        if (definition.desc) setting.setDesc(definition.desc);
        definition.render?.(setting);
        renderedDefinitions += 1;
      }
      if (renderedDefinitions === 0) sectionEl.remove();
    }
  }

  private refreshSettingsTab(): void {
    if (requireApiVersion("1.13.0")) {
      this.update();
      return;
    }
    this.renderImperativeSettings();
  }

  private renderInterfaceLanguage(setting: Setting): void {
    setting.addDropdown((dropdown) => {
      dropdown
        .addOption("system", "跟随系统")
        .addOption("zh-CN", "简体中文")
        .addOption("zh-TW", "繁体中文")
        .addOption("en", "English")
        .addOption("ja", "日本語")
        .addOption("ko", "한국어")
        .setValue(this.plugin.settings.interfaceLanguage)
        .onChange(async (value) => {
          const preference = value as LanguagePreference;
          if (this.plugin.setInterfaceLanguage) {
            await this.plugin.setInterfaceLanguage(preference);
          } else {
            this.plugin.settings.interfaceLanguage = preference;
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
          }
          this.refreshSettingsTab();
        });
    });
  }

  private renderStorageLayout(setting: Setting): void {
    setting.addDropdown((dropdown) => {
      dropdown
        .addOption("managed", "分类托管模式")
        .addOption("flat", "单文件夹模式")
        .setValue(this.plugin.settings.storageMode)
        .onChange(async (value) => {
          this.plugin.settings.storageMode = value as StorageMode;
          await this.plugin.saveSettings();
          this.refreshSettingsTab();
          this.plugin.refreshViews();
        });
    });
  }

  private renderLibraryRoot(setting: Setting): void {
    setting.addText((text) => {
      text
        .setPlaceholder(DEFAULT_LIBRARY_FOLDER)
        .setValue(this.plugin.settings.libraryRoot)
        .onChange(async (value) => {
          this.plugin.settings.libraryRoot = normalizePath(value.trim())
            .replace(/^\/+|\/+$/g, "") || "AnimeList";
          await this.plugin.saveSettings();
        });
    });
  }

  private renderFlatMediaFolder(setting: Setting): void {
    setting.addText((text) => {
      text
        .setPlaceholder("Media")
        .setValue(this.plugin.settings.flatMediaFolder)
        .onChange(async (value) => {
          this.plugin.settings.flatMediaFolder = normalizePath(value.trim())
            .replace(/^\/+|\/+$/g, "");
          await this.plugin.saveSettings();
        });
    });
  }

  private renderAdditionalScanFolders(setting: Setting): void {
    setting.addTextArea((text) => {
      text
        .setPlaceholder(ADDITIONAL_FOLDER_EXAMPLE)
        .setValue(this.plugin.settings.additionalScanFolders.join("\n"))
        .onChange(async (value) => {
          this.plugin.settings.additionalScanFolders = splitFolders(value);
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        });
    });
  }

  private renderCoverFolder(setting: Setting): void {
    setting.addText((text) => {
      text
        .setPlaceholder(DEFAULT_COVER_FOLDER)
        .setValue(this.plugin.settings.coverFolder)
        .onChange(async (value) => {
          this.plugin.settings.coverFolder = normalizePath(value.trim())
            .replace(/^\/+|\/+$/g, "") || "AnimeList/Covers";
          await this.plugin.saveSettings();
        });
    });
  }

  private renderTemplateFolder(setting: Setting): void {
    setting.addText((text) => {
      text
        .setPlaceholder(DEFAULT_TEMPLATE_FOLDER)
        .setValue(this.plugin.settings.templateFolder)
        .onChange(async (value) => {
          this.plugin.settings.templateFolder = normalizePath(value.trim())
            .replace(/^\/+|\/+$/g, "") || "AnimeList/Templates";
          await this.plugin.saveSettings();
        });
    });
  }

  private searchLanguages(): SearchLanguageSettings {
    if (!this.plugin.settings.searchLanguages) {
      this.plugin.settings.searchLanguages = { ...DEFAULT_SEARCH_LANGUAGES };
    }
    return this.plugin.settings.searchLanguages;
  }

  private renderSearchLanguage(setting: Setting, language: SearchLanguage): void {
    setting.addToggle((toggle) => {
      toggle.setValue(this.searchLanguages()[language]).onChange(async (value) => {
        this.searchLanguages()[language] = value;
        await this.plugin.saveSettings();
      });
    });
  }

  private renderTimelineMaxStackDepth(setting: Setting): void {
    setting.addDropdown((dropdown) => {
      for (
        let depth = MIN_TIMELINE_MAX_STACK_DEPTH;
        depth <= MAX_TIMELINE_MAX_STACK_DEPTH;
        depth += 1
      ) {
        dropdown.addOption(String(depth), String(depth));
      }
      dropdown
        .setValue(String(normalizeTimelineMaxStackDepth(
          this.plugin.settings.timelineMaxStackDepth,
        )))
        .onChange(async (value) => {
          this.plugin.settings.timelineMaxStackDepth =
            normalizeTimelineMaxStackDepth(value);
          await this.plugin.saveSettings();
        });
    });
  }

  private renderProvider(setting: Setting, key: keyof AnimeListSettings["providers"]): void {
    setting.addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.providers[key]).onChange(async (value) => {
        this.plugin.settings.providers[key] = value;
        await this.plugin.saveSettings();
      });
    });
  }

  private renderGarbageCleanup(setting: Setting): void {
    setting.addButton((button) => {
      button.setButtonText("清理无引用文件").onClick(async () => {
        button.buttonEl.disabled = true;
        try {
          const result = await this.plugin.cleanupGarbageFiles();
          const removed = result.removedManagedFiles + result.removedJournalFiles + result.removedCacheFiles;
          new Notice(`已清理 ${removed} 个无引用文件。`);
        } catch (error) {
          console.error("AnimeList garbage-file cleanup failed", error);
          new Notice("清理无引用文件失败，详情请查看控制台。");
        } finally {
          button.buttonEl.disabled = false;
        }
      });
    });
  }

  private renderCreateFolders(setting: Setting): void {
    setting.addButton((button) => {
      button.setButtonText("创建文件夹").onClick(async () => {
        await this.plugin.initializeLibrary(false);
        new Notice("预设文件夹已就绪。");
      });
    });
  }

  private renderCopyTemplates(setting: Setting): void {
    setting.addButton((button) => {
      button.setButtonText("复制模板").onClick(async () => {
        await this.plugin.initializeLibrary(true);
        new Notice("默认模板已复制就绪。");
      });
    });
  }
}
