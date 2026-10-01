import type { Setting } from "obsidian";
import { defineFeature, type AnimeListFeatureHost, type FeatureSettingsSection } from "../../app/feature-types";
import {
  MAX_LIBRARY_LAYOUT_COLUMNS,
  MIN_LIBRARY_LAYOUT_COLUMNS,
  libraryLayoutColumnsWithView,
  normalizeLibraryLayoutColumns,
  type LibraryColumnView,
} from "../../domain/library-layout";

interface LibraryLayoutSlider {
  setLimits(min: number | null, max: number | null, step: number): this;
  setValue(value: number): this;
  setDynamicTooltip(): this;
  onChange(callback: (value: number) => void | Promise<void>): this;
}

interface SettingWithSlider {
  addSlider(callback: (slider: LibraryLayoutSlider) => void): Setting;
}

function createColumnDefinition(
  host: AnimeListFeatureHost,
  view: LibraryColumnView,
  name: string,
  desc: string,
) {
  return {
    name,
    desc,
    render: (setting: Setting) => {
      (setting as unknown as SettingWithSlider).addSlider((slider) => {
        const columns = normalizeLibraryLayoutColumns(host.settings.uiState.layoutColumns);
        slider
          .setLimits(MIN_LIBRARY_LAYOUT_COLUMNS, MAX_LIBRARY_LAYOUT_COLUMNS, 1)
          .setValue(columns[view])
          .setDynamicTooltip()
          .onChange(async (value) => {
            host.settings.uiState.layoutColumns = libraryLayoutColumnsWithView(
              normalizeLibraryLayoutColumns(host.settings.uiState.layoutColumns),
              view,
              value,
            );
            await host.saveSettings();
            host.refreshViews();
          });
      });
    },
  };
}

export function createLibraryLayoutSettingsSection(host: AnimeListFeatureHost): FeatureSettingsSection {
  return {
    page: "general",
    heading: "媒体库排版",
    description: "设置卡片与缩略图模式每行显示的作品数；媒体库内的缩放条将同步修改相同设置。",
    definitions: [
      createColumnDefinition(
        host,
        "grid",
        "卡片视图每行数量",
        "设置卡片视图每行显示的作品数量（1–6）。",
      ),
      createColumnDefinition(
        host,
        "poster",
        "缩略图视图每行数量",
        "设置缩略图视图每行显示的作品数量（1–6）。",
      ),
    ],
  };
}

export const libraryLayoutSettingsFeature = defineFeature<AnimeListFeatureHost>({
  id: "library-layout-settings",
  contributions: [{
    kind: "settings",
    sections(host) {
      return createLibraryLayoutSettingsSection(host);
    },
  }],
});
