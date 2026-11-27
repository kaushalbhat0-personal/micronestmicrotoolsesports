/** Truncate a string so it fits within maxWidth using ctx.measureText. */
export function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }
  const ellipsis = "…";
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = `${text.slice(0, mid)}${ellipsis}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low <= 0 ? ellipsis : `${text.slice(0, low)}${ellipsis}`;
}

/** Wrap text into lines that fit maxWidth (hard cap on line count). */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [];
  }
  const lines: string[] = [];
  let current = words[0] ?? "";
  for (let i = 1; i < words.length; i += 1) {
    const word = words[i] ?? "";
    const trial = `${current} ${word}`;
    if (ctx.measureText(trial).width <= maxWidth) {
      current = trial;
    } else {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) {
        break;
      }
    }
  }
  if (lines.length < maxLines) {
    lines.push(current);
  }
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1] ?? "";
    const remaining = words.slice(lines.join(" ").split(/\s+/).filter(Boolean).length).length > 0;
    // Simpler: if we truncated early, ellipsize last line.
    if (remaining || words.join(" ") !== lines.join(" ")) {
      lines[maxLines - 1] = fitText(ctx, last, maxWidth);
    }
  }
  return lines;
}
