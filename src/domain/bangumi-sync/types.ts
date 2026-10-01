import type { MediaStatus } from "../media-status";

export const BANGUMI_COLLECTION_STATUSES = [
  "watching",
  "completed",
  "wishlist",
  "on_hold",
  "dropped",
] as const;

export type BangumiCollectionStatus = typeof BANGUMI_COLLECTION_STATUSES[number];

export const DEFAULT_BANGUMI_COLLECTION_TYPES: readonly BangumiCollectionStatus[] = [
  "watching",
  "completed",
];

export const DEFAULT_SYNC_RECENT_DAYS = 30;
export const DEFAULT_AUTO_SYNC_COOLDOWN_MINUTES = 30;

export interface BangumiUserProfile {
  id: number;
  username: string;
  nickname: string;
  avatar?: {
    large?: string;
    medium?: string;
    small?: string;
  };
  sign?: string;
}

export type BangumiSyncItemAction = "new" | "updated" | "conflict" | "synced";

export interface BangumiSyncItem {
  subjectId: number;
  title: string;
  originalTitle?: string;
  action: BangumiSyncItemAction;
  remoteStatus: BangumiCollectionStatus;
  remoteEpStatus: number;
  remoteRate: number | null;
  remoteUpdatedAt: string;
  localPath?: string;
  localStatus?: string;
  localProgress?: number;
  localScore?: number | null;
  conflictReason?: string;
  coverUrl?: string;
  totalEps?: number;
}

export interface BangumiSyncSummary {
  added: number;
  updated: number;
  synced: number;
  conflicts: Array<{ subjectId: number; title: string; filePath?: string; reason: string }>;
  errors: string[];
}

export function isBangumiCollectionStatus(value: unknown): value is BangumiCollectionStatus {
  return typeof value === "string" && (BANGUMI_COLLECTION_STATUSES as readonly string[]).includes(value);
}

export function bangumiTypeNumberToStatus(type: number): BangumiCollectionStatus | null {
  switch (type) {
    case 1: return "wishlist";
    case 2: return "completed";
    case 3: return "watching";
    case 4: return "on_hold";
    case 5: return "dropped";
    default: return null;
  }
}

export function bangumiStatusToTypeNumber(status: BangumiCollectionStatus): number {
  switch (status) {
    case "wishlist": return 1;
    case "completed": return 2;
    case "watching": return 3;
    case "on_hold": return 4;
    case "dropped": return 5;
  }
}

export function bangumiStatusToMediaStatus(status: BangumiCollectionStatus): MediaStatus {
  switch (status) {
    case "watching": return "ongoing";
    case "completed": return "completed";
    case "wishlist":
    case "on_hold": return "planned";
    case "dropped": return "dropped";
  }
}

export function normalizeBangumiCollectionTypes(value: unknown): BangumiCollectionStatus[] {
  if (!Array.isArray(value)) return [...DEFAULT_BANGUMI_COLLECTION_TYPES];
  const filtered = value.filter(isBangumiCollectionStatus);
  const unique = [...new Set(filtered)];
  return unique.length ? unique : [...DEFAULT_BANGUMI_COLLECTION_TYPES];
}
