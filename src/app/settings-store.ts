import type { AnimeListSettings } from "../domain/settings-types";
import { normalizeAnimeListSettings } from "./settings-model";

export interface SettingsStorage {
  loadData(): Promise<unknown>;
  saveData(data: unknown): Promise<void>;
}

export type FallbackSettingsLoader = () => Promise<unknown>;

export class AnimeListSettingsStore {
  constructor(
    private readonly storage: SettingsStorage,
    private readonly fallbackLoader?: FallbackSettingsLoader,
  ) {}

  async load(): Promise<AnimeListSettings> {
    let raw = await this.storage.loadData();
    if ((raw === null || raw === undefined || (typeof raw === "object" && Object.keys(raw).length === 0)) && this.fallbackLoader) {
      const fallback = await this.fallbackLoader();
      if (fallback !== null && fallback !== undefined) {
        raw = fallback;
      }
    }
    return normalizeAnimeListSettings(raw);
  }

  async save(settings: AnimeListSettings): Promise<AnimeListSettings> {
    const normalized = normalizeAnimeListSettings(settings);
    await this.storage.saveData(normalized);
    return normalized;
  }
}
