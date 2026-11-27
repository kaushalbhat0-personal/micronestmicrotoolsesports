import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BGMI_OWNERSHIP_SIGNED_URL_TTL_SECONDS,
  BgmiOwnershipValidationError,
} from "../domain/bgmi-ownership";
import { PUBLIC_PROJECTION_COLUMNS } from "../domain/public-projection";
import { PLAYER_SHARE_FIELD_KEYS } from "../share/player-card-model";

const ensureAppUser = vi.fn();
const sanitizeBgmiOwnershipImage = vi.fn();

vi.mock("../server/ensure-app-user", () => ({
  ensureAppUser: (...args: unknown[]) => ensureAppUser(...args),
}));

vi.mock("../server/bgmi-ownership/sanitize-image", () => ({
  sanitizeBgmiOwnershipImage: (...args: unknown[]) =>
    sanitizeBgmiOwnershipImage(...args),
}));

import {
  createBgmiOwnershipDraftCase,
  mintBgmiOwnershipEvidenceSignedUrl,
  submitBgmiOwnershipCase,
  uploadBgmiOwnershipEvidence,
  withdrawBgmiOwnershipCase,
} from "../server/bgmi-ownership/service";

const CASE_ID = "a1000000-0000-4000-8000-000000000001";
const EVIDENCE_ID = "a2000000-0000-4000-8000-000000000002";

function createMockClient(handlers: {
  rpc?: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  fromHandlers?: Record<string, unknown>;
  storageUpload?: () => Promise<{ error: unknown }>;
  storageRemove?: () => Promise<{ error: unknown }>;
  storageSigned?: () => Promise<{ data: { signedUrl: string } | null; error: unknown }>;
}) {
  const auth = {
    getUser: vi.fn(async () => ({
      data: { user: { id: "user-a" } },
      error: null,
    })),
  };

  const storage = {
    from: vi.fn(() => ({
      upload: vi.fn(async () => handlers.storageUpload?.() ?? { error: null }),
      remove: vi.fn(async () => handlers.storageRemove?.() ?? { error: null }),
      createSignedUrl: vi.fn(
        async () =>
          handlers.storageSigned?.() ?? {
            data: { signedUrl: "https://example.test/signed?token=redacted" },
            error: null,
          },
      ),
      getPublicUrl: vi.fn(() => {
        throw new Error("public URL must not be used for evidence");
      }),
    })),
  };

  const from = vi.fn((table: string) => {
    const custom = handlers.fromHandlers?.[table];
    if (typeof custom === "function") {
      return (custom as (t: string) => unknown)(table);
    }
    return chainable({});
  });

  return {
    auth,
    storage,
    from,
    rpc: vi.fn(
      async (name: string, args: Record<string, unknown>) =>
        handlers.rpc?.(name, args) ?? { data: null, error: null },
    ),
  };
}

function chainable(result: {
  data?: unknown;
  error?: unknown;
  singleData?: unknown;
}) {
  const api: Record<string, unknown> = {};
  const self = () => api;
  api.select = vi.fn(self);
  api.insert = vi.fn(self);
  api.eq = vi.fn(self);
  api.in = vi.fn(self);
  api.order = vi.fn(self);
  api.limit = vi.fn(self);
  api.maybeSingle = vi.fn(async () => ({
    data: result.data ?? null,
    error: result.error ?? null,
  }));
  api.single = vi.fn(async () => ({
    data: result.singleData ?? result.data ?? null,
    error: result.error ?? null,
  }));
  return api;
}

describe("bgmi ownership lifecycle (mocked)", () => {
  beforeEach(() => {
    ensureAppUser.mockReset();
    sanitizeBgmiOwnershipImage.mockReset();
    ensureAppUser.mockResolvedValue({ id: "user-a", status: "active" });
    sanitizeBgmiOwnershipImage.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3, 4]),
      contentType: "image/jpeg",
      width: 128,
      height: 128,
      sha256: "a".repeat(64),
    });
  });

  it("blocks draft creation without live BGMI ID", async () => {
    const client = createMockClient({
      rpc: async () => ({ data: null, error: null }),
    });
    client.from = vi.fn((table: string) => {
      if (table === "player_game_profiles") {
        return chainable({ data: { game_user_id: null } });
      }
      return chainable({});
    });

    await expect(
      createBgmiOwnershipDraftCase(client as unknown as never),
    ).rejects.toBeInstanceOf(BgmiOwnershipValidationError);
  });

  it("rejects third evidence via evidence_count gate", async () => {
    const client = createMockClient({});
    client.from = vi.fn((table: string) => {
      if (table === "player_bgmi_ownership_cases") {
        return chainable({
          data: {
            id: CASE_ID,
            player_id: "user-a",
            status: "draft",
            claimed_game_user_id: null,
            identity_mismatch: false,
            evidence_count: 2,
            submitted_at: null,
            withdrawn_at: null,
            created_at: "t",
            updated_at: "t",
          },
        });
      }
      if (table === "player_game_profiles") {
        return chainable({ data: { game_user_id: "00123456" } });
      }
      return chainable({});
    });
    client.rpc = vi.fn(async () => ({ data: null, error: null }));

    await expect(
      uploadBgmiOwnershipEvidence(client as unknown as never, {
        caseId: CASE_ID,
        bytes: new Uint8Array(64),
      }),
    ).rejects.toBeInstanceOf(BgmiOwnershipValidationError);
  });

  it("rejects upload when case is pending (no replace)", async () => {
    const client = createMockClient({});
    client.from = vi.fn((table: string) => {
      if (table === "player_bgmi_ownership_cases") {
        return chainable({
          data: {
            id: CASE_ID,
            player_id: "user-a",
            status: "pending_review",
            claimed_game_user_id: "00123456",
            identity_mismatch: false,
            evidence_count: 1,
            submitted_at: "t",
            withdrawn_at: null,
            created_at: "t",
            updated_at: "t",
          },
        });
      }
      return chainable({});
    });
    client.rpc = vi.fn(async () => ({ data: null, error: null }));

    await expect(
      uploadBgmiOwnershipEvidence(client as unknown as never, {
        caseId: CASE_ID,
        bytes: new Uint8Array(64),
      }),
    ).rejects.toBeInstanceOf(BgmiOwnershipValidationError);
  });

  it("cleans up storage when evidence metadata insert fails", async () => {
    const remove = vi.fn(async () => ({ error: null }));
    const client = createMockClient({
      storageUpload: async () => ({ error: null }),
    });
    client.storage.from = vi.fn(() => ({
      upload: vi.fn(async () => ({ error: null })),
      remove,
      createSignedUrl: vi.fn(),
      getPublicUrl: vi.fn(),
    }));
    client.rpc = vi.fn(async () => ({ data: null, error: null }));
    client.from = vi.fn((table: string) => {
      if (table === "player_bgmi_ownership_cases") {
        return chainable({
          data: {
            id: CASE_ID,
            player_id: "user-a",
            status: "draft",
            claimed_game_user_id: null,
            identity_mismatch: false,
            evidence_count: 0,
            submitted_at: null,
            withdrawn_at: null,
            created_at: "t",
            updated_at: "t",
          },
        });
      }
      if (table === "player_game_profiles") {
        return chainable({ data: { game_user_id: "00123456" } });
      }
      if (table === "player_bgmi_ownership_evidence") {
        return chainable({ error: { message: "insert failed" }, singleData: null });
      }
      return chainable({});
    });

    await expect(
      uploadBgmiOwnershipEvidence(client as unknown as never, {
        caseId: CASE_ID,
        bytes: new Uint8Array(64),
      }),
    ).rejects.toThrow();
    expect(remove).toHaveBeenCalled();
  });

  it("submit uses RPC and cannot be set by client table update", async () => {
    const client = createMockClient({
      rpc: async (name) => {
        if (name === "assert_bgmi_ownership_rate_limit") {
          return { data: null, error: null };
        }
        if (name === "submit_player_bgmi_ownership_case") {
          return {
            data: {
              id: CASE_ID,
              player_id: "user-a",
              status: "pending_review",
              claimed_game_user_id: "00123456",
              identity_mismatch: false,
              evidence_count: 1,
              submitted_at: "t",
              withdrawn_at: null,
              created_at: "t",
              updated_at: "t",
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    client.from = vi.fn((table: string) => {
      if (table === "player_bgmi_ownership_cases") {
        return chainable({
          data: {
            id: CASE_ID,
            player_id: "user-a",
            status: "draft",
            claimed_game_user_id: null,
            identity_mismatch: false,
            evidence_count: 1,
            submitted_at: null,
            withdrawn_at: null,
            created_at: "t",
            updated_at: "t",
          },
        });
      }
      if (table === "player_game_profiles") {
        return chainable({ data: { game_user_id: "00123456" } });
      }
      return chainable({});
    });

    const result = await submitBgmiOwnershipCase(
      client as unknown as never,
      CASE_ID,
    );
    expect(result.status).toBe("pending_review");
    expect(result.claimed_game_user_id).toBe("00123456");
    expect(client.rpc).toHaveBeenCalledWith(
      "submit_player_bgmi_ownership_case",
      expect.anything(),
    );
  });

  it("withdraw is idempotent when RPC returns empty", async () => {
    const client = createMockClient({
      rpc: async (name) => {
        if (name === "assert_bgmi_ownership_rate_limit") {
          return { data: null, error: null };
        }
        return { data: [], error: null };
      },
    });
    client.from = vi.fn(() =>
      chainable({
        data: {
          id: CASE_ID,
          player_id: "user-a",
          status: "withdrawn",
          claimed_game_user_id: null,
          identity_mismatch: false,
          evidence_count: 0,
          submitted_at: "t",
          withdrawn_at: "t",
          created_at: "t",
          updated_at: "t",
        },
      }),
    );

    const result = await withdrawBgmiOwnershipCase(
      client as unknown as never,
      CASE_ID,
    );
    expect(result.alreadyWithdrawn).toBe(true);
  });

  it("signed URL requires owner evidence and uses 60s TTL", async () => {
    const createSignedUrl = vi.fn(async () => ({
      data: { signedUrl: "https://example.test/signed?token=secret" },
      error: null,
    }));
    const client = createMockClient({});
    client.rpc = vi.fn(async () => ({ data: null, error: null }));
    client.storage.from = vi.fn(() => ({
      upload: vi.fn(),
      remove: vi.fn(),
      createSignedUrl,
      getPublicUrl: vi.fn(() => {
        throw new Error("no public url");
      }),
    }));
    client.from = vi.fn((table: string) => {
      if (table === "player_bgmi_ownership_cases") {
        return chainable({
          data: {
            id: CASE_ID,
            player_id: "user-a",
            status: "draft",
            claimed_game_user_id: null,
            identity_mismatch: false,
            evidence_count: 1,
            submitted_at: null,
            withdrawn_at: null,
            created_at: "t",
            updated_at: "t",
          },
        });
      }
      if (table === "player_bgmi_ownership_evidence") {
        return chainable({
          data: {
            id: EVIDENCE_ID,
            case_id: CASE_ID,
            player_id: "user-a",
            storage_bucket: "private-verification",
            storage_path: `user-a/bgmi-ownership/${CASE_ID}/${EVIDENCE_ID}.jpg`,
            content_type: "image/jpeg",
            byte_size: 100,
            width: 128,
            height: 128,
            sha256: "b".repeat(64),
            sort_order: 1,
            created_at: "t",
          },
        });
      }
      return chainable({});
    });

    const out = await mintBgmiOwnershipEvidenceSignedUrl(client as unknown as never, {
      caseId: CASE_ID,
      evidenceId: EVIDENCE_ID,
    });
    expect(out.expiresIn).toBe(BGMI_OWNERSHIP_SIGNED_URL_TTL_SECONDS);
    expect(createSignedUrl).toHaveBeenCalledWith(expect.any(String), 60);
  });
});

describe("privacy freezes", () => {
  it("does not expose ownership evidence fields on public projection or share kit", () => {
    expect(PUBLIC_PROJECTION_COLUMNS).not.toContain("claimed_game_user_id");
    expect(PUBLIC_PROJECTION_COLUMNS).not.toContain("storage_path");
    expect(PUBLIC_PROJECTION_COLUMNS).not.toContain("player_bgmi_ownership_cases");
    expect(PLAYER_SHARE_FIELD_KEYS).not.toContain("claimed_game_user_id");
    expect(PLAYER_SHARE_FIELD_KEYS).not.toContain("storage_path");
  });
});
