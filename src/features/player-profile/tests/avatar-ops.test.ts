// G1-5 avatar operation unit tests (mocked Supabase client, no network).
// Lane: pure unit. Live storage/RLS semantics are proven in the integration
// lane; these tests prove session-derived identity, MIME/size validation,
// canonical paths, ownership, storage-first ordering intent and safe errors.
//
// Authoritative: 06 sections 2-5, 07 sections 1/3/5, 08 T2/T4/T6,
// D-G1-06 Option A.

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  SuspendedError,
  UnauthenticatedError,
} from "../domain/app-user";
import {
  AvatarOperationError,
  AvatarValidationError,
} from "../domain/avatar";
import { DirectoryOperationError } from "../domain/directory";
import { ProfileNotFoundError } from "../domain/player-profile";
import { removeAvatar, uploadAvatar } from "../server/avatar";
import { getPlayerByHandle, searchDirectory } from "../server/directory-reader";

const SESSION_USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";

const PROFILE_ROW = {
  user_id: SESSION_USER_ID,
  handle: "nova_01",
  display_name: "Nova",
  avatar_path: null,
  bio: null,
  country_code: null,
  is_discoverable: false,
  handle_changed_at: null,
  created_at: "2026-11-10T00:00:00.000Z",
  updated_at: "2026-11-10T00:00:00.000Z",
};

const RPC_ROW = {
  handle: "nova_01",
  display_name: "Nova",
  avatar_url: null,
  bio: null,
  country_code: null,
  game_key: "bgmi",
  game_name: "Battlegrounds Mobile India",
  ign: "NovaScout",
  primary_role: null,
  play_modes: [],
  region_code: null,
  availability: [],
};

function pngBytes(size = 64): Uint8Array {
  return new Uint8Array(size).fill(7);
}

interface AvatarFakeOpts {
  sessionUserId?: string | null;
  sessionError?: boolean;
  ensureStatus?: string;
  profileRows?: unknown[] | null;
  updateRows?: unknown[] | null;
  updateError?: unknown;
  uploadError?: unknown;
  removeError?: unknown;
  onUpload?: (path: string, bytes: unknown, opts: unknown) => void;
  onRemove?: (paths: string[]) => void;
  onUpdatePayload?: (payload: unknown) => void;
  callOrder?: string[];
}

function fakeAvatarClient(opts: AvatarFakeOpts = {}): {
  client: SupabaseClient;
} {
  const sessionUserId =
    opts.sessionUserId === undefined ? SESSION_USER_ID : opts.sessionUserId;

  const rpc = vi.fn(async (fn: string) => {
    if (fn === "ensure_app_user") {
      return {
        data: [{ id: sessionUserId, status: opts.ensureStatus ?? "active" }],
        error: null,
      };
    }
    return { data: null, error: { message: "unknown", code: "42883" } };
  });

  const selectEq = vi.fn(async (_col: string, _val: unknown) => {
    if (opts.profileRows !== undefined && opts.profileRows !== null) {
      return { data: opts.profileRows, error: null };
    }
    return { data: [{ ...PROFILE_ROW }], error: null };
  });

  const from = vi.fn((_table: string) => ({
    select: vi.fn((_cols?: string) => ({ eq: selectEq })),
    update: vi.fn((payload: unknown) => {
      opts.onUpdatePayload?.(payload);
      opts.callOrder?.push("db-update");
      return {
        eq: vi.fn((_c: string, _v: unknown) => ({
          select: vi.fn(async (_cols?: string) => {
            if (opts.updateError !== undefined) {
              return { data: null, error: opts.updateError };
            }
            if (opts.updateRows !== undefined && opts.updateRows !== null) {
              return { data: opts.updateRows, error: null };
            }
            const patch = payload as { avatar_path?: string | null };
            return {
              data: [{ ...PROFILE_ROW, ...patch }],
              error: null,
            };
          }),
        })),
      };
    }),
  }));

  const storage = {
    from: vi.fn((_bucket: string) => ({
      upload: vi.fn(async (path: string, bytes: unknown, upOpts: unknown) => {
        opts.onUpload?.(path, bytes, upOpts);
        opts.callOrder?.push("storage-upload");
        if (opts.uploadError !== undefined) {
          return { data: null, error: opts.uploadError };
        }
        return { data: { path }, error: null };
      }),
      remove: vi.fn(async (paths: string[]) => {
        opts.onRemove?.(paths);
        opts.callOrder?.push("storage-remove");
        if (opts.removeError !== undefined) {
          return { data: null, error: opts.removeError };
        }
        return { data: [], error: null };
      }),
      getPublicUrl: vi.fn((path: string) => ({
        data: {
          publicUrl: `https://cdn.example/storage/v1/object/public/public-avatars/${path}`,
        },
      })),
    })),
  };

  const client = {
    auth: {
      getUser: vi.fn(async () => {
        if (opts.sessionError || sessionUserId === null) {
          return {
            data: { user: null },
            error: { message: "Auth session missing" },
          };
        }
        return {
          data: { user: { id: sessionUserId } },
          error: null,
        };
      }),
    },
    rpc,
    from,
    storage,
  };
  return { client: client as unknown as SupabaseClient };
}

function fakeReaderClient(rows: unknown[]): { client: SupabaseClient } {
  const rpc = vi.fn(async () => ({ data: rows, error: null }));
  const client = {
    rpc,
    storage: {
      from: vi.fn((_bucket: string) => ({
        getPublicUrl: vi.fn((path: string) => ({
          data: {
            publicUrl: `https://cdn.example/storage/v1/object/public/public-avatars/${path}`,
          },
        })),
      })),
    },
  };
  return { client: client as unknown as SupabaseClient };
}

describe("uploadAvatar — session-derived identity (08 T2)", () => {
  it("accepts no caller-supplied user ID or path (session wins by construction)", () => {
    expect(uploadAvatar.length).toBe(2);
    expect(removeAvatar.length).toBe(1);
  });

  it("rejects callers without a verified session", async () => {
    const { client } = fakeAvatarClient({ sessionUserId: null });
    await expect(
      uploadAvatar(client, { bytes: pngBytes(), mimeType: "image/png" }),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("blocks suspended accounts with the generic account error", async () => {
    const { client } = fakeAvatarClient({ ensureStatus: "suspended" });
    const failure = await uploadAvatar(client, {
      bytes: pngBytes(),
      mimeType: "image/png",
    }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(SuspendedError);
    expect((failure as Error).message).not.toContain(SESSION_USER_ID);
  });

  it("requires an existing canonical profile (never auto-creates)", async () => {
    const { client } = fakeAvatarClient({ profileRows: [] });
    await expect(
      uploadAvatar(client, { bytes: pngBytes(), mimeType: "image/png" }),
    ).rejects.toBeInstanceOf(ProfileNotFoundError);
  });
});

describe("uploadAvatar — validation (06 section 4, 08 T6)", () => {
  it("uploads a valid PNG to the caller's canonical path with upsert", async () => {
    let seenPath = "";
    let seenOpts: unknown = null;
    const { client } = fakeAvatarClient({
      onUpload: (path, _b, o) => {
        seenPath = path;
        seenOpts = o;
      },
    });
    const profile = await uploadAvatar(client, {
      bytes: pngBytes(),
      mimeType: "image/png",
    });
    expect(seenPath).toBe(`${SESSION_USER_ID}/avatar.png`);
    expect(seenOpts).toMatchObject({
      upsert: true,
      contentType: "image/png",
    });
    expect(profile.avatar_path).toBe(`${SESSION_USER_ID}/avatar.png`);
  });

  it("canonicalizes image/jpeg to avatar.jpg (D-G1-06 Option A)", async () => {
    let seenPath = "";
    const { client } = fakeAvatarClient({
      onUpload: (path) => {
        seenPath = path;
      },
    });
    const profile = await uploadAvatar(client, {
      bytes: pngBytes(),
      mimeType: "image/jpeg",
    });
    expect(seenPath).toBe(`${SESSION_USER_ID}/avatar.jpg`);
    expect(profile.avatar_path).toBe(`${SESSION_USER_ID}/avatar.jpg`);
  });

  it("rejects invalid MIME types before any storage call", async () => {
    for (const mimeType of [
      "image/svg+xml",
      "image/gif",
      "application/pdf",
      "text/plain",
      "",
    ]) {
      let uploaded = false;
      const { client } = fakeAvatarClient({
        onUpload: () => {
          uploaded = true;
        },
      });
      await expect(
        uploadAvatar(client, { bytes: pngBytes(), mimeType }),
      ).rejects.toBeInstanceOf(AvatarValidationError);
      expect(uploaded).toBe(false);
    }
  });

  it("rejects oversized and empty files", async () => {
    const { client: c1 } = fakeAvatarClient({});
    await expect(
      uploadAvatar(c1, {
        bytes: new Uint8Array(524289),
        mimeType: "image/png",
      }),
    ).rejects.toBeInstanceOf(AvatarValidationError);
    const { client: c2 } = fakeAvatarClient({});
    await expect(
      uploadAvatar(c2, { bytes: new Uint8Array(0), mimeType: "image/png" }),
    ).rejects.toBeInstanceOf(AvatarValidationError);
  });

  it("derives the path from the session, never from caller input", async () => {
    let seenPath = "";
    const { client } = fakeAvatarClient({
      sessionUserId: OTHER_USER_ID,
      profileRows: [{ ...PROFILE_ROW, user_id: OTHER_USER_ID }],
      updateRows: [
        { ...PROFILE_ROW, user_id: OTHER_USER_ID, avatar_path: `${OTHER_USER_ID}/avatar.png` },
      ],
      onUpload: (path) => {
        seenPath = path;
      },
    });
    // Even when the caller smuggles another UID/path alongside the file, the
    // function signature has no such parameter — the path is session-derived.
    const profile = await uploadAvatar(client, {
      bytes: pngBytes(),
      mimeType: "image/png",
      user_id: SESSION_USER_ID,
      avatar_path: `${SESSION_USER_ID}/avatar.png`,
    } as unknown);
    expect(seenPath).toBe(`${OTHER_USER_ID}/avatar.png`);
    expect(profile.avatar_path).toBe(`${OTHER_USER_ID}/avatar.png`);
    expect(seenPath).not.toContain(SESSION_USER_ID);
  });
});

describe("uploadAvatar — replacement and failure mapping", () => {
  it("deletes the stale extension object on extension change (single file)", async () => {
    const removed: string[][] = [];
    const { client } = fakeAvatarClient({
      profileRows: [
        { ...PROFILE_ROW, avatar_path: `${SESSION_USER_ID}/avatar.png` },
      ],
      onRemove: (paths) => {
        removed.push(paths);
      },
    });
    const profile = await uploadAvatar(client, {
      bytes: pngBytes(),
      mimeType: "image/webp",
    });
    expect(profile.avatar_path).toBe(`${SESSION_USER_ID}/avatar.webp`);
    expect(removed.flat()).toContain(`${SESSION_USER_ID}/avatar.png`);
  });

  it("keeps the same path without a delete on same-extension replace", async () => {
    const removed: string[][] = [];
    const { client } = fakeAvatarClient({
      profileRows: [
        { ...PROFILE_ROW, avatar_path: `${SESSION_USER_ID}/avatar.png` },
      ],
      onRemove: (paths) => {
        removed.push(paths);
      },
    });
    const profile = await uploadAvatar(client, {
      bytes: pngBytes(),
      mimeType: "image/png",
    });
    expect(profile.avatar_path).toBe(`${SESSION_USER_ID}/avatar.png`);
    expect(removed).toEqual([]);
  });

  it("maps storage failures to safe generic errors (no detail leak)", async () => {
    const { client } = fakeAvatarClient({
      uploadError: { message: "storage boom", code: "XX000" },
    });
    const failure = await uploadAvatar(client, {
      bytes: pngBytes(),
      mimeType: "image/png",
    }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(AvatarOperationError);
    expect((failure as Error).message).not.toContain("boom");
  });
});

describe("removeAvatar — no stale URL (06 section 5)", () => {
  it("is idempotent when no avatar is set", async () => {
    let removed = 0;
    const { client } = fakeAvatarClient({
      onRemove: () => {
        removed += 1;
      },
    });
    const profile = await removeAvatar(client);
    expect(profile.avatar_path).toBeNull();
    expect(removed).toBe(0);
  });

  it("deletes exact object paths then nulls the column", async () => {
    const order: string[] = [];
    let removedPaths: string[] = [];
    let payload: unknown = null;
    const { client } = fakeAvatarClient({
      profileRows: [
        { ...PROFILE_ROW, avatar_path: `${SESSION_USER_ID}/avatar.png` },
      ],
      updateRows: [{ ...PROFILE_ROW, avatar_path: null }],
      callOrder: order,
      onRemove: (paths) => {
        removedPaths = paths;
      },
      onUpdatePayload: (p) => {
        payload = p;
      },
    });
    const profile = await removeAvatar(client);
    expect(profile.avatar_path).toBeNull();
    expect(removedPaths).toContain(`${SESSION_USER_ID}/avatar.png`);
    expect(payload).toEqual({ avatar_path: null });
    // Storage-first ordering: the object delete precedes the DB NULL write.
    expect(order[0]).toBe("storage-remove");
    expect(order[order.length - 1]).toBe("db-update");
  });

  it("aborts the NULL write when the storage delete fails", async () => {
    let updated = false;
    const { client } = fakeAvatarClient({
      profileRows: [
        { ...PROFILE_ROW, avatar_path: `${SESSION_USER_ID}/avatar.png` },
      ],
      removeError: { message: "delete boom" },
      onUpdatePayload: () => {
        updated = true;
      },
    });
    await expect(removeAvatar(client)).rejects.toBeInstanceOf(
      AvatarOperationError,
    );
    expect(updated).toBe(false);
  });
});

describe("DirectoryReader avatar resolution — fail closed (G1-5)", () => {
  it("resolves a valid canonical path and keeps NULL as NULL", async () => {
    const { client } = fakeReaderClient([
      { ...RPC_ROW, avatar_url: `${SESSION_USER_ID}/avatar.png` },
      { ...RPC_ROW, handle: "nova_02", avatar_url: null },
    ]);
    const cards = await searchDirectory(client, {});
    expect(cards[0]?.avatar_url).toContain(`${SESSION_USER_ID}/avatar.png`);
    expect(cards[1]?.avatar_url).toBeNull();
  });

  it("rejects absolute URLs and malformed paths instead of passing them through", async () => {
    for (const bad of [
      "https://evil.example/avatar.png",
      "http://evil.example/x.jpg",
      `${SESSION_USER_ID}/avatar.svg`,
      `${SESSION_USER_ID}/other.png`,
      "../admin.png",
      "avatar.png",
    ]) {
      const { client } = fakeReaderClient([{ ...RPC_ROW, avatar_url: bad }]);
      await expect(searchDirectory(client, {})).rejects.toBeInstanceOf(
        DirectoryOperationError,
      );
      const { client: c2 } = fakeReaderClient([
        { ...RPC_ROW, avatar_url: bad },
      ]);
      await expect(getPlayerByHandle(c2, "nova_01")).rejects.toBeInstanceOf(
        DirectoryOperationError,
      );
    }
  });
});
