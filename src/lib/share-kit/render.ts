import { siteConfig } from "@/config/site";
import { SHARE_COLORS } from "./colors";
import {
  ensureShareFonts,
  resolveShareFontBody,
  resolveShareFontDisplay,
} from "./fonts";
import { fitText, wrapText } from "./text";
import {
  SHARE_CARD_SIZE,
  ShareRenderError,
  type CreateShareCanvas,
  type ShareCardSpec,
  type ShareCanvas,
} from "./types";

function defaultCreateCanvas(width: number, height: number): ShareCanvas {
  if (typeof document === "undefined") {
    throw new ShareRenderError("Canvas is only available in the browser.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  // Interim geometric F mark — matches src/app/icon.svg (final logo TBD).
  const r = Math.max(2, size * 0.08);
  ctx.fillStyle = SHARE_COLORS.arena950;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + size - r, y);
  ctx.quadraticCurveTo(x + size, y, x + size, y + r);
  ctx.lineTo(x + size, y + size - r);
  ctx.quadraticCurveTo(x + size, y + size, x + size - r, y + size);
  ctx.lineTo(x + r, y + size);
  ctx.quadraticCurveTo(x, y + size, x, y + size - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();

  const padX = size * 0.28;
  const padY = size * 0.25;
  const bar = Math.max(2, size * 0.11);
  ctx.fillStyle = SHARE_COLORS.paper;
  // Vertical stem
  ctx.fillRect(x + padX, y + padY, bar, size - padY * 2 - size * 0.12);
  // Top arm
  ctx.fillRect(x + padX, y + padY, size - padX * 2, bar);
  // Mid arm
  ctx.fillRect(x + padX, y + size * 0.48, size * 0.42, bar);

  ctx.fillStyle = SHARE_COLORS.accent600;
  ctx.fillRect(x + padX, y + size - padY * 0.85, size - padX * 2, size * 0.09);
}

function canvasToBlob(canvas: ShareCanvas): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob === null || blob.size <= 0) {
            reject(new ShareRenderError("Could not encode the share image."));
            return;
          }
          resolve(blob);
        },
        "image/png",
      );
    } catch (error) {
      reject(
        error instanceof ShareRenderError
          ? error
          : new ShareRenderError("Could not encode the share image."),
      );
    }
  });
}

/**
 * Render a branded 1080×1080 PNG blob from a declarative ShareCardSpec.
 * Pure presentation — callers supply only already-authorized public/local data.
 */
export async function renderShareCardBlob(
  spec: ShareCardSpec,
  createCanvas: CreateShareCanvas = defaultCreateCanvas,
): Promise<Blob> {
  await ensureShareFonts();
  const fontDisplay = resolveShareFontDisplay();
  const fontBody = resolveShareFontBody();

  const size = SHARE_CARD_SIZE;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    throw new ShareRenderError("2D canvas context is unavailable.");
  }

  // Background
  ctx.fillStyle = SHARE_COLORS.arena950;
  ctx.fillRect(0, 0, size, size);

  // Accent keyline
  ctx.fillStyle = SHARE_COLORS.accent600;
  ctx.fillRect(0, 0, size, 8);

  const margin = 64;
  const contentWidth = size - margin * 2;
  let y = margin;

  // Brand row
  drawMark(ctx, margin, y, 56);
  ctx.fillStyle = SHARE_COLORS.paper;
  ctx.font = `700 28px ${fontDisplay}`;
  ctx.textBaseline = "middle";
  ctx.fillText(
    fitText(ctx, siteConfig.name.toUpperCase(), contentWidth - 72),
    margin + 72,
    y + 20,
  );
  ctx.fillStyle = SHARE_COLORS.accent300;
  ctx.font = `600 18px ${fontBody}`;
  ctx.fillText(
    fitText(ctx, siteConfig.tagline.toUpperCase(), contentWidth - 72),
    margin + 72,
    y + 44,
  );
  y += 96;

  // Eyebrow — leave enough room under alphabetic baseline so a 56px title
  // does not collide with the eyebrow ascent (Oswald metrics were overlapping).
  ctx.fillStyle = SHARE_COLORS.accent300;
  ctx.font = `600 22px ${fontDisplay}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(fitText(ctx, spec.eyebrow.toUpperCase(), contentWidth), margin, y);
  y += 58;

  // Title
  ctx.fillStyle = SHARE_COLORS.paper;
  ctx.font = `700 56px ${fontDisplay}`;
  const titleLines = wrapText(ctx, spec.title, contentWidth, 2);
  for (const line of titleLines) {
    ctx.fillText(line, margin, y);
    y += 64;
  }

  if (spec.subtitle !== undefined && spec.subtitle.trim() !== "") {
    y += 8;
    ctx.fillStyle = SHARE_COLORS.inkMuted;
    ctx.font = `400 26px ${fontBody}`;
    const subLines = wrapText(ctx, spec.subtitle, contentWidth, 2);
    for (const line of subLines) {
      ctx.fillText(line, margin, y);
      y += 34;
    }
  }

  y += 28;
  ctx.strokeStyle = SHARE_COLORS.arenaLine;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(margin, y);
  ctx.lineTo(size - margin, y);
  ctx.stroke();
  y += 36;

  // Rows
  for (const row of spec.rows) {
    if (y > size - 220) {
      break;
    }
    ctx.fillStyle = SHARE_COLORS.slateLight;
    ctx.font = `500 20px ${fontBody}`;
    ctx.fillText(fitText(ctx, row.label.toUpperCase(), contentWidth), margin, y);
    y += 28;
    ctx.fillStyle = SHARE_COLORS.paper;
    ctx.font = `600 30px ${fontBody}`;
    ctx.fillText(fitText(ctx, row.value, contentWidth), margin, y);
    y += 44;
  }

  // Blocks
  if (spec.blocks !== undefined && spec.blocks.length > 0) {
    y += 8;
    ctx.fillStyle = SHARE_COLORS.arena800;
    const blockTop = y - 16;
    const blockHeight = Math.min(size - y - 160, 28 + spec.blocks.length * 34);
    ctx.fillRect(margin - 8, blockTop, contentWidth + 16, blockHeight);
    ctx.fillStyle = SHARE_COLORS.inkMuted;
    ctx.font = `400 24px ${fontBody}`;
    let by = y + 8;
    for (const line of spec.blocks) {
      if (by > blockTop + blockHeight - 20) {
        break;
      }
      ctx.fillText(fitText(ctx, line, contentWidth - 16), margin, by);
      by += 34;
    }
    y = blockTop + blockHeight + 28;
  }

  // Disclaimer (near footer)
  const footerTop = size - 150;
  if (y < footerTop - 20) {
    y = Math.max(y, footerTop - 80);
  } else {
    y = footerTop - 80;
  }
  ctx.fillStyle = SHARE_COLORS.slateMid;
  ctx.font = `400 18px ${fontBody}`;
  const discLines = wrapText(ctx, spec.disclaimer, contentWidth, 3);
  for (const line of discLines) {
    ctx.fillText(line, margin, y);
    y += 24;
  }

  // Watermark bar
  ctx.fillStyle = SHARE_COLORS.arena900;
  ctx.fillRect(0, size - 96, size, 96);
  ctx.fillStyle = SHARE_COLORS.accent600;
  ctx.fillRect(0, size - 96, 8, 96);
  drawMark(ctx, margin, size - 72, 40);
  ctx.fillStyle = SHARE_COLORS.paper;
  ctx.font = `700 22px ${fontDisplay}`;
  ctx.textBaseline = "middle";
  ctx.fillText(
    fitText(ctx, `${siteConfig.name} · ${siteConfig.tagline}`, contentWidth - 56),
    margin + 56,
    size - 58,
  );
  ctx.fillStyle = SHARE_COLORS.accent300;
  ctx.font = `500 18px ${fontBody}`;
  ctx.fillText(
    fitText(ctx, spec.destinationLabel, contentWidth - 56),
    margin + 56,
    size - 30,
  );

  return canvasToBlob(canvas);
}
