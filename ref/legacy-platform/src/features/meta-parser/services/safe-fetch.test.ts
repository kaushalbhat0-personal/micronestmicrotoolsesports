import { describe, expect, it, vi, afterEach } from "vitest";
import { safeFetchText } from "./safe-fetch";

const HOSTS = ["raw.githubusercontent.com"] as const;

function textStream(parts: string[]): ReadableStream<Uint8Array> {
  const encoded = parts.map((part) => new TextEncoder().encode(part));
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of encoded) controller.enqueue(chunk);
      controller.close();
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("safeFetchText", () => {
  it("rejects non-https URLs", async () => {
    await expect(safeFetchText("http://raw.githubusercontent.com/a", { allowedHosts: HOSTS })).rejects.toMatchObject({
      code: "INTEGRATION_ERROR",
    });
  });

  it("rejects hosts outside the allowlist", async () => {
    await expect(safeFetchText("https://evil.example.com/x", { allowedHosts: HOSTS })).rejects.toMatchObject({
      code: "INTEGRATION_ERROR",
    });
  });

  it("rejects redirects landing off-allowlist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        url: "https://evil.example.com/x",
        headers: new Headers(),
        body: textStream(["hi"]),
      }))
    );
    await expect(
      safeFetchText("https://raw.githubusercontent.com/a", { allowedHosts: HOSTS })
    ).rejects.toMatchObject({ code: "INTEGRATION_ERROR" });
  });

  it("aborts oversized responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        url: "https://raw.githubusercontent.com/a",
        headers: new Headers(),
        body: textStream(["x".repeat(100)]),
      }))
    );
    await expect(
      safeFetchText("https://raw.githubusercontent.com/a", { allowedHosts: HOSTS, maxBytes: 10 })
    ).rejects.toMatchObject({ code: "INTEGRATION_ERROR" });
  });

  it("returns body plus etag on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        url: "https://raw.githubusercontent.com/a",
        headers: new Headers({ etag: '"abc"' }),
        body: textStream(['{"ok":true}']),
      }))
    );
    const result = await safeFetchText("https://raw.githubusercontent.com/a", { allowedHosts: HOSTS });
    expect(result.body).toBe('{"ok":true}');
    expect(result.etag).toBe('"abc"');
  });
});
