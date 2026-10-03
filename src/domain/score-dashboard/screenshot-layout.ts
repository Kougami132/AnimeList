import type { ScoreDashboardData } from "./model";
import type { MediaItem } from "../../types";

export interface ScoreDashboardScreenshotPosterPosition {
  item: MediaItem;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScoreDashboardScreenshotLanePlan {
  score: number | null;
  label: string;
  laneBox: { x: number; y: number; width: number; height: number };
  labelBox: { x: number; y: number; width: number; height: number };
  postersBox: { x: number; y: number; width: number; height: number };
  posters: ScoreDashboardScreenshotPosterPosition[];
  empty: boolean;
}

export interface ScoreDashboardScreenshotGroupPlan {
  major: number | null;
  majorBox: { x: number; y: number; width: number; height: number };
  lanes: ScoreDashboardScreenshotLanePlan[];
  itemCount: number;
}

export interface ScoreDashboardScreenshotPlan {
  width: number;
  height: number;
  headerBox: { x: number; y: number; width: number; height: number };
  boardBox: { x: number; y: number; width: number; height: number };
  groups: ScoreDashboardScreenshotGroupPlan[];
  stats: {
    total: number;
    rated: number;
    averageScore: string | null;
  };
}

export interface ScoreDashboardScreenshotLayoutOptions {
  width?: number;
  showUnrated?: boolean;
}

export const SCREENSHOT_DEFAULT_WIDTH = 1080;
export const SCREENSHOT_HEADER_HEIGHT = 120;
export const SCREENSHOT_BOARD_MARGIN_X = 24;
export const SCREENSHOT_BOARD_MARGIN_Y = 20;
export const SCREENSHOT_MAJOR_WIDTH = 84;
export const SCREENSHOT_LABEL_WIDTH = 56;
export const SCREENSHOT_POSTER_WIDTH = 72.5;
export const SCREENSHOT_POSTER_HEIGHT = 108.75;
export const SCREENSHOT_POSTER_GAP = 6;
export const SCREENSHOT_LANE_PADDING_X = 12;
export const SCREENSHOT_LANE_PADDING_Y = 8;
export const SCREENSHOT_LANE_MIN_HEIGHT = SCREENSHOT_POSTER_HEIGHT + SCREENSHOT_LANE_PADDING_Y * 2;

export function planScoreDashboardScreenshot(
  data: ScoreDashboardData,
  options: ScoreDashboardScreenshotLayoutOptions = {},
): ScoreDashboardScreenshotPlan {
  const width = options.width ?? SCREENSHOT_DEFAULT_WIDTH;
  const showUnrated = options.showUnrated === true;

  const headerBox = {
    x: 0,
    y: 0,
    width,
    height: SCREENSHOT_HEADER_HEIGHT,
  };

  const boardX = SCREENSHOT_BOARD_MARGIN_X;
  const boardY = SCREENSHOT_HEADER_HEIGHT + SCREENSHOT_BOARD_MARGIN_Y;
  const boardWidth = width - SCREENSHOT_BOARD_MARGIN_X * 2;
  const postersBoxWidth = boardWidth - SCREENSHOT_MAJOR_WIDTH - SCREENSHOT_LABEL_WIDTH;
  const usablePostersWidth = postersBoxWidth - SCREENSHOT_LANE_PADDING_X * 2;
  const postersPerRow = Math.max(1, Math.floor((usablePostersWidth + SCREENSHOT_POSTER_GAP) / (SCREENSHOT_POSTER_WIDTH + SCREENSHOT_POSTER_GAP)));

  let currentGroupY = boardY;
  const groupPlans: ScoreDashboardScreenshotGroupPlan[] = [];

  const layoutLanes = (
    rawLanes: Array<{ score: number | null; label: string; items: MediaItem[] }>,
    groupStartY: number,
  ): { lanes: ScoreDashboardScreenshotLanePlan[]; groupHeight: number } => {
    let currentLaneY = groupStartY;
    const lanePlans: ScoreDashboardScreenshotLanePlan[] = [];

    for (const rawLane of rawLanes) {
      const items = rawLane.items;
      const empty = items.length === 0;
      const rows = empty ? 1 : Math.ceil(items.length / postersPerRow);
      const laneHeight = Math.max(
        SCREENSHOT_LANE_MIN_HEIGHT,
        rows * SCREENSHOT_POSTER_HEIGHT + (rows - 1) * SCREENSHOT_POSTER_GAP + SCREENSHOT_LANE_PADDING_Y * 2,
      );

      const posters: ScoreDashboardScreenshotPosterPosition[] = [];
      const postersAreaX = boardX + SCREENSHOT_MAJOR_WIDTH + SCREENSHOT_LABEL_WIDTH;

      for (let index = 0; index < items.length; index += 1) {
        const row = Math.floor(index / postersPerRow);
        const col = index % postersPerRow;
        const posterX = postersAreaX + SCREENSHOT_LANE_PADDING_X + col * (SCREENSHOT_POSTER_WIDTH + SCREENSHOT_POSTER_GAP);
        const posterY = currentLaneY + SCREENSHOT_LANE_PADDING_Y + row * (SCREENSHOT_POSTER_HEIGHT + SCREENSHOT_POSTER_GAP);
        posters.push({
          item: items[index],
          x: posterX,
          y: posterY,
          width: SCREENSHOT_POSTER_WIDTH,
          height: SCREENSHOT_POSTER_HEIGHT,
        });
      }

      lanePlans.push({
        score: rawLane.score,
        label: rawLane.label,
        laneBox: {
          x: boardX + SCREENSHOT_MAJOR_WIDTH,
          y: currentLaneY,
          width: boardWidth - SCREENSHOT_MAJOR_WIDTH,
          height: laneHeight,
        },
        labelBox: {
          x: boardX + SCREENSHOT_MAJOR_WIDTH,
          y: currentLaneY,
          width: SCREENSHOT_LABEL_WIDTH,
          height: laneHeight,
        },
        postersBox: {
          x: postersAreaX,
          y: currentLaneY,
          width: postersBoxWidth,
          height: laneHeight,
        },
        posters,
        empty,
      });

      currentLaneY += laneHeight;
    }

    return {
      lanes: lanePlans,
      groupHeight: currentLaneY - groupStartY,
    };
  };

  for (const group of data.groups) {
    const { lanes, groupHeight } = layoutLanes(group.lanes, currentGroupY);
    groupPlans.push({
      major: group.major,
      majorBox: {
        x: boardX,
        y: currentGroupY,
        width: SCREENSHOT_MAJOR_WIDTH,
        height: groupHeight,
      },
      lanes,
      itemCount: group.itemCount,
    });
    currentGroupY += groupHeight;
  }

  if (showUnrated) {
    const unratedLane = {
      score: null,
      label: "—",
      items: data.unrated,
    };
    const { lanes, groupHeight } = layoutLanes([unratedLane], currentGroupY);
    groupPlans.push({
      major: null,
      majorBox: {
        x: boardX,
        y: currentGroupY,
        width: SCREENSHOT_MAJOR_WIDTH,
        height: groupHeight,
      },
      lanes,
      itemCount: data.unrated.length,
    });
    currentGroupY += groupHeight;
  }

  const boardHeight = currentGroupY - boardY;
  const boardBox = {
    x: boardX,
    y: boardY,
    width: boardWidth,
    height: boardHeight,
  };

  const totalHeight = boardY + boardHeight + SCREENSHOT_BOARD_MARGIN_Y;

  let totalScoreSum = 0;
  let ratedCount = 0;
  for (const group of data.groups) {
    for (const lane of group.lanes) {
      if (lane.score != null) {
        totalScoreSum += lane.score * lane.items.length;
        ratedCount += lane.items.length;
      }
    }
  }

  const averageScore = ratedCount > 0 ? (totalScoreSum / ratedCount).toFixed(1) : null;

  return {
    width,
    height: totalHeight,
    headerBox,
    boardBox,
    groups: groupPlans,
    stats: {
      total: data.total,
      rated: data.rated,
      averageScore,
    },
  };
}
