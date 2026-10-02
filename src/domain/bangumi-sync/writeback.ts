import { canonicalMediaStatus } from "../media-status";

export interface WritebackMediaState {
  status: string;
  progress: number;
  score: number | null;
}

export function mediaStatusToBangumiTypeNumber(status: unknown): number | null {
  const canonical = canonicalMediaStatus(status);
  switch (canonical) {
    case "ongoing": return 3;
    case "completed": return 2;
    case "planned": return 1;
    case "dropped": return 5;
    default: return null;
  }
}

export function mapProgressToEpStatus(progress: unknown): number {
  const num = typeof progress === "number" ? progress : Number(progress);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
}

export function mapScoreToBangumiRate(score: unknown): number {
  if (score === null || score === undefined || score === "") return 0;
  const num = typeof score === "number" ? score : Number(score);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.max(1, Math.min(10, Math.floor(num)));
}

export function isMediaWritebackDirty(
  previous: Partial<WritebackMediaState>,
  next: WritebackMediaState,
): boolean {
  const prevStatus = typeof previous.status === "string" ? previous.status.trim() : "";
  const nextStatus = typeof next.status === "string" ? next.status.trim() : "";
  if (prevStatus !== nextStatus) return true;

  const prevProgress = typeof previous.progress === "number" && Number.isFinite(previous.progress)
    ? previous.progress
    : (Number(previous.progress) || 0);
  const nextProgress = typeof next.progress === "number" && Number.isFinite(next.progress)
    ? next.progress
    : (Number(next.progress) || 0);
  if (prevProgress !== nextProgress) return true;

  const prevScore = typeof previous.score === "number" && Number.isFinite(previous.score) && previous.score > 0
    ? previous.score
    : null;
  const nextScore = typeof next.score === "number" && Number.isFinite(next.score) && next.score > 0
    ? next.score
    : null;

  if (prevScore === null && nextScore === null) return false;
  if (prevScore === null || nextScore === null) return true;
  return Math.abs(prevScore - nextScore) >= 0.01;
}
