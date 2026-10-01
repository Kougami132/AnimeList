import { defineTextCatalog } from "../../i18n/catalog";
import { BANGUMI_SYNC_MESSAGES } from "../../i18n/locales/zh-TW/bangumi-sync";

export const BANGUMI_SYNC_TEXT = BANGUMI_SYNC_MESSAGES;

const CATALOG = defineTextCatalog("bangumi-sync", BANGUMI_SYNC_TEXT);

export function bangumiSyncText(
  key: keyof typeof BANGUMI_SYNC_TEXT,
  variables: Record<string, string | number> = {},
): string {
  return CATALOG.text(key, variables);
}
