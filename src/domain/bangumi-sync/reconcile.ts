import { bangumiStatusToMediaStatus, bangumiTypeNumberToStatus } from "./types";
import { mapScoreToBangumiRate } from "./writeback";

export interface LocalMediaState {
  status: string;
  progress: number;
  score: number | null;
  completedAt: string;
}

export interface RemoteBangumiState {
  type: number;
  epStatus: number;
  rate: number;
  updatedAt: string;
}

export type ReconciliationResult =
  | { kind: "conflict"; reason: string; localScore: number; remoteRate: number }
  | {
      kind: "update";
      status: string;
      progress: number;
      score: number | null;
      completedAt: string;
      scoreToPush: number | null;
      changed: boolean;
    };

export function reconcileSingleItem(
  local: LocalMediaState,
  remote: RemoteBangumiState,
): ReconciliationResult {
  const remoteCollectionStatus = bangumiTypeNumberToStatus(remote.type) ?? "watching";
  const targetStatus = bangumiStatusToMediaStatus(remoteCollectionStatus);
  const targetProgress = Math.max(0, remote.epStatus);

  const remoteRate = remote.rate > 0 ? remote.rate : null;
  const localScore = local.score != null && local.score > 0 ? local.score : null;

  // Conflict detection: both sides have scores and they differ after flooring.
  // Bangumi only supports integer ratings (1-10), so a local score (e.g. 9.5)
  // maps to its floored integer rating on Bangumi (e.g. 9).
  // A local 9.5 vs Bangumi 9 is consistent and not a conflict, but local 9.5 vs Bangumi 10 is a conflict.
  if (
    remoteRate !== null
    && localScore !== null
    && remoteRate !== mapScoreToBangumiRate(localScore)
  ) {
    return {
      kind: "conflict",
      reason: `Score conflict: local score is ${localScore} but Bangumi score is ${remoteRate}`,
      localScore,
      remoteRate,
    };
  }

  let scoreToPush: number | null = null;
  let targetScore: number | null = localScore;

  if (remoteRate === null && localScore !== null) {
    // Score Push
    scoreToPush = mapScoreToBangumiRate(localScore);
    targetScore = localScore;
  } else if (remoteRate !== null && localScore === null) {
    targetScore = remoteRate;
  }

  let targetCompletedAt = local.completedAt.trim();
  if (!targetCompletedAt && targetStatus === "completed" && remote.updatedAt) {
    targetCompletedAt = remote.updatedAt.slice(0, 10);
  }

  const changed =
    targetStatus !== local.status
    || targetProgress !== local.progress
    || targetCompletedAt !== local.completedAt.trim()
    || targetScore !== localScore
    || scoreToPush !== null;

  return {
    kind: "update",
    status: targetStatus,
    progress: targetProgress,
    score: targetScore,
    completedAt: targetCompletedAt,
    scoreToPush,
    changed,
  };
}
