import { encodeCanvasImage } from "../../data/image-raster";
import type { ScoreDashboardScreenshotPlan } from "../../domain/score-dashboard/screenshot-layout";
import { scoreDashboardText as text } from "../../features/score-dashboard/text";
import type { ScoreDashboardMediaType } from "../../domain/score-dashboard/model";

export interface ScreenshotThemeTokens {
  backgroundPrimary: string;
  backgroundPrimaryAlt: string;
  backgroundSecondary: string;
  backgroundBorder: string;
  textNormal: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  textOnAccent: string;
}

export function scoreColor(score: number): string {
  const hue = Math.round(8 + score * 26.2);
  return `hsl(${hue} 72% 62%)`;
}

export function sampleScreenshotTheme(container: HTMLElement): ScreenshotThemeTokens {
  const style = container.ownerDocument?.defaultView
    ? container.ownerDocument.defaultView.getComputedStyle(container)
    : null;
  const isLight = container.ownerDocument?.body?.classList.contains("theme-light") ?? false;

  const get = (prop: string, fallback: string): string => style?.getPropertyValue(prop).trim() || fallback;

  return {
    backgroundPrimary: get("--background-primary", isLight ? "#ffffff" : "#1e1e1e"),
    backgroundPrimaryAlt: get("--background-primary-alt", isLight ? "#f7f7f7" : "#181818"),
    backgroundSecondary: get("--background-secondary", isLight ? "#f0f0f0" : "#262626"),
    backgroundBorder: get("--background-modifier-border", isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.12)"),
    textNormal: get("--text-normal", isLight ? "#222222" : "#dcddde"),
    textMuted: get("--text-muted", isLight ? "#666666" : "#999999"),
    textFaint: get("--text-faint", isLight ? "#999999" : "#666666"),
    accent: get("--interactive-accent", "#7c3aed"),
    textOnAccent: get("--text-on-accent", "#ffffff"),
  };
}

export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export function loadImageSafe(url: string, timeoutMs = 3000): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const img = createEl("img");
    if (/^https?:\/\//i.test(url)) {
      img.crossOrigin = "anonymous";
    }
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, timeoutMs);

    img.onload = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = url;

    if (img.complete && img.naturalWidth > 0) {
      settled = true;
      window.clearTimeout(timer);
      resolve(img);
    }
  });
}

function drawPlaceholderCard(
  ctx: CanvasRenderingContext2D,
  mediaType: string,
  x: number,
  y: number,
  width: number,
  height: number,
  theme: ScreenshotThemeTokens,
): void {
  drawRoundedRect(ctx, x, y, width, height, 4);
  ctx.fillStyle = theme.backgroundSecondary;
  ctx.fill();
  ctx.strokeStyle = theme.backgroundBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  const cx = x + width / 2;
  const cy = y + height / 2;
  ctx.save();
  ctx.strokeStyle = theme.textFaint;
  ctx.fillStyle = theme.textFaint;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (mediaType === "anime") {
    const iw = 22;
    const ih = 17;
    const ix = cx - iw / 2;
    const iy = cy - ih / 2;
    ctx.strokeRect(ix, iy + 5, iw, ih - 5);
    ctx.strokeRect(ix, iy, iw, 5);
    ctx.beginPath();
    ctx.moveTo(ix + 6, iy);
    ctx.lineTo(ix + 4, iy + 5);
    ctx.moveTo(ix + 12, iy);
    ctx.lineTo(ix + 10, iy + 5);
    ctx.moveTo(ix + 18, iy);
    ctx.lineTo(ix + 16, iy + 5);
    ctx.stroke();
  } else {
    const iw = 22;
    const ih = 16;
    const ix = cx - iw / 2;
    const iy = cy - ih / 2;
    ctx.beginPath();
    ctx.moveTo(cx, iy + 3);
    ctx.lineTo(cx, iy + ih);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, iy + 3);
    ctx.quadraticCurveTo(cx - 5, iy, ix, iy + 1);
    ctx.lineTo(ix, iy + ih - 2);
    ctx.quadraticCurveTo(cx - 5, iy + ih - 3, cx, iy + ih);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, iy + 3);
    ctx.quadraticCurveTo(cx + 5, iy, ix + iw, iy + 1);
    ctx.lineTo(ix + iw, iy + ih - 2);
    ctx.quadraticCurveTo(cx + 5, iy + ih - 3, cx, iy + ih);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPosterCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 4,
): void {
  const destAspect = width / height;
  const srcAspect = img.naturalWidth / img.naturalHeight;
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;

  if (srcAspect > destAspect) {
    sw = img.naturalHeight * destAspect;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / destAspect;
    sy = (img.naturalHeight - sh) / 2;
  }

  ctx.save();
  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, x, y, width, height);
  ctx.restore();

  ctx.save();
  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

export interface GenerateScreenshotOptions {
  type: ScoreDashboardMediaType;
  pixelRatio?: number;
}

export interface ScreenshotResult {
  blob: Blob;
  dimensions: { width: number; height: number };
}

export async function generateScoreDashboardScreenshot(
  container: HTMLElement,
  plan: ScoreDashboardScreenshotPlan,
  options: GenerateScreenshotOptions,
): Promise<ScreenshotResult> {
  const pixelRatio = options.pixelRatio ?? 2;
  const theme = sampleScreenshotTheme(container);

  // Collect unique image sources from plan
  const items = plan.groups.flatMap((group) => group.lanes.flatMap((lane) => lane.posters.map((p) => p.item)));
  const uniqueUrls = new Set<string>();
  for (const item of items) {
    const src = item.coverSources?.src || item.cover;
    if (src) uniqueUrls.add(src);
  }

  // Preload images concurrently with safe timeout
  const imageMap = new Map<string, HTMLImageElement | null>();
  await Promise.all(
    Array.from(uniqueUrls).map(async (url) => {
      const img = await loadImageSafe(url);
      imageMap.set(url, img);
    }),
  );

  const canvas = createEl("canvas");
  canvas.width = Math.round(plan.width * pixelRatio);
  canvas.height = Math.round(plan.height * pixelRatio);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create 2D canvas context");

  ctx.scale(pixelRatio, pixelRatio);

  // 1. Draw solid background
  ctx.fillStyle = theme.backgroundPrimary;
  ctx.fillRect(0, 0, plan.width, plan.height);

  // 2. Draw Header
  const header = plan.headerBox;
  ctx.save();
  // Kicker
  ctx.fillStyle = theme.accent;
  ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
  ctx.fillText(text.kicker, 32, 38);

  // Title
  const typeLabel = options.type === "anime" ? text.anime : options.type === "manga" ? text.manga : options.type === "novel" ? text.novel : "";
  const titleText = typeLabel ? `${text.title} · ${typeLabel}` : text.title;
  ctx.fillStyle = theme.textNormal;
  ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
  ctx.fillText(titleText, 32, 72);

  // Subtitle / Stats
  const summaryPart = text.ratedSummary(plan.stats.rated, plan.stats.total);
  const avgPart = plan.stats.averageScore != null ? ` · ${text.screenshotAverage(plan.stats.averageScore)}` : "";
  ctx.fillStyle = theme.textMuted;
  ctx.font = "13px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${summaryPart}${avgPart}`, 32, 98);

  // Right side: Branding & Timestamp
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const exportLabel = text.screenshotGeneratedAt(dateStr);
  ctx.textAlign = "right";
  ctx.fillStyle = theme.textNormal;
  ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
  ctx.fillText("AnimeList", plan.width - 32, 68);

  ctx.fillStyle = theme.textFaint;
  ctx.font = "12px system-ui, -apple-system, sans-serif";
  ctx.fillText(exportLabel, plan.width - 32, 92);

  // Header bottom border
  ctx.strokeStyle = theme.backgroundBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(32, header.height);
  ctx.lineTo(plan.width - 32, header.height);
  ctx.stroke();
  ctx.restore();

  // 3. Draw Board Container
  const board = plan.boardBox;
  ctx.save();
  drawRoundedRect(ctx, board.x, board.y, board.width, board.height, 14);
  ctx.fillStyle = theme.backgroundPrimaryAlt;
  ctx.fill();
  ctx.strokeStyle = theme.backgroundBorder;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // Clip board content to rounded rect
  ctx.save();
  drawRoundedRect(ctx, board.x, board.y, board.width, board.height, 14);
  ctx.clip();

  for (const group of plan.groups) {
    const isUnrated = group.major === null;
    const majorColor = isUnrated ? theme.backgroundSecondary : scoreColor(group.major);

    // Draw Major Column
    const mb = group.majorBox;
    ctx.fillStyle = majorColor;
    ctx.fillRect(mb.x, mb.y, mb.width, mb.height);

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = isUnrated ? theme.textNormal : "#ffffff";

    const majorNum = isUnrated ? "—" : String(group.major);
    ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
    ctx.fillText(majorNum, mb.x + mb.width / 2, mb.y + mb.height / 2 - 8);

    ctx.font = "bold 10px system-ui, -apple-system, sans-serif";
    ctx.fillText(`${group.itemCount} ${text.works}`, mb.x + mb.width / 2, mb.y + mb.height / 2 + 12);
    ctx.restore();

    // Draw Lanes
    for (const lane of group.lanes) {
      const lb = lane.laneBox;
      const labelb = lane.labelBox;
      const pb = lane.postersBox;

      // Divider line on bottom of lane
      ctx.strokeStyle = theme.backgroundBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lb.x, lb.y + lb.height);
      ctx.lineTo(lb.x + lb.width, lb.y + lb.height);
      ctx.stroke();

      // Divider between label column and posters
      ctx.beginPath();
      ctx.moveTo(labelb.x + labelb.width, labelb.y);
      ctx.lineTo(labelb.x + labelb.width, labelb.y + labelb.height);
      ctx.stroke();

      // Lane score label
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = lane.score != null ? scoreColor(lane.score) : theme.textMuted;
      ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
      ctx.fillText(lane.label, labelb.x + labelb.width / 2, labelb.y + labelb.height / 2);
      ctx.restore();

      // Empty lane text or Posters
      if (lane.empty) {
        ctx.save();
        ctx.fillStyle = theme.textFaint;
        ctx.font = "12px system-ui, -apple-system, sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillText(text.emptyLane, pb.x + 16, pb.y + pb.height / 2);
        ctx.restore();
      } else {
        for (const poster of lane.posters) {
          const src = poster.item.coverSources?.src || poster.item.cover;
          const img = src ? imageMap.get(src) ?? null : null;
          if (img) {
            drawPosterCover(ctx, img, poster.x, poster.y, poster.width, poster.height, 4);
          } else {
            drawPlaceholderCard(ctx, poster.item.mediaType, poster.x, poster.y, poster.width, poster.height, theme);
          }
        }
      }
    }

    // Divider line below group
    ctx.strokeStyle = theme.backgroundBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(group.majorBox.x, group.majorBox.y + group.majorBox.height);
    ctx.lineTo(board.x + board.width, group.majorBox.y + group.majorBox.height);
    ctx.stroke();
  }

  ctx.restore(); // restore clipping

  const blob = await encodeCanvasImage(canvas, "image/png");
  return {
    blob,
    dimensions: {
      width: canvas.width,
      height: canvas.height,
    },
  };
}
