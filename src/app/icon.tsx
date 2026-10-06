import { readFile } from "node:fs/promises";
import path from "node:path";

export const size = { width: 32, height: 32 };
export const contentType = "image/svg+xml";

// Favicon uses mark-only — full lockup tagline is unreadable at 16-32px
export default async function Icon() {
  const file = await readFile(path.join(process.cwd(), "public", "micronest-mark.svg"), "utf-8");
  return new Response(file, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
  });
}
