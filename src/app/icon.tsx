import { readFile } from "node:fs/promises";
import path from "node:path";

export const size = { width: 32, height: 32 };
export const contentType = "image/svg+xml";

// Serve the exact final logo as favicon — no rasterization, no modification
export default async function Icon() {
  const file = await readFile(path.join(process.cwd(), "public", "Final_MicroNest_Logo.svg"), "utf-8");
  return new Response(file, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
  });
}
