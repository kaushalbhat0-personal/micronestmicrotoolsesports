/**
 * Central Meta-Parser adapter registration.
 *
 * Adding a game = new adapter module + one import + one entry below +
 * games catalog row. The ingestion route calls `registerAllAdapters()` and
 * never grows per-game imports.
 */

import { dota2Adapter } from "./dota-2/adapter";
import { valorantAdapter } from "./valorant/adapter";
import { registerAdapter } from "./registry";

/** Register every shipped adapter exactly once per runtime. Idempotent. */
export function registerAllAdapters(): void {
  registerAdapter(dota2Adapter);
  registerAdapter(valorantAdapter);
}
