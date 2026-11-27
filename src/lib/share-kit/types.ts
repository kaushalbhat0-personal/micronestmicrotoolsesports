// Share Kit v1 — shared card contracts (client-side PNG only).

export const SHARE_CARD_SIZE = 1080 as const;

export type ShareCardTone = "tool" | "player" | "team";

export interface ShareCardRow {
  readonly label: string;
  readonly value: string;
}

export interface ShareCardSpec {
  readonly tone: ShareCardTone;
  /** Uppercase eyebrow, e.g. "PRIZE POOL" */
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly rows: ReadonlyArray<ShareCardRow>;
  /** Optional multi-line body blocks (standings, slots). */
  readonly blocks?: ReadonlyArray<string> | undefined;
  readonly disclaimer: string;
  /** Path or absolute URL shown in watermark / CTA. */
  readonly destinationLabel: string;
  readonly filenameBase: string;
}

export class ShareRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShareRenderError";
  }
}

export interface ShareCanvas {
  width: number;
  height: number;
  getContext(contextId: "2d"): CanvasRenderingContext2D | null;
  toBlob(
    callback: (blob: Blob | null) => void,
    type?: string,
    quality?: number,
  ): void;
}

export type CreateShareCanvas = (width: number, height: number) => ShareCanvas;
