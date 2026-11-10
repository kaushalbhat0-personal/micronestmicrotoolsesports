import type { Platform } from "./platform";

export interface CanonicalCategory {
  readonly id: string;
  readonly name: string;
  readonly platform: Platform;
}
