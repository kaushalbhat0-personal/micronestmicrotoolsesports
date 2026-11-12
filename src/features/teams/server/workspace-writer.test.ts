// P14-D6 workspace writer tests (no network, no Supabase project).
// With WORKSPACE_WRITES_ENABLED=true, validated creates/settings call
// mutation RPCs (never direct table writes). Protected-key rejection and
// unauthenticated handling remain covered.

import { describe, expect, it } from "vitest";
import { UnauthenticatedError } from "@/features/player-profile/domain/app-user";
import { WorkspaceValidationError } from "@/features/teams/domain/workspace";
import {
  WORKSPACE_WRITES_ENABLED,
  createTeamOp,
  parseCreateTeamInput,
  parseUpdateTeamSettingsInput,
  updateTeamSettingsOp,
} from "./workspace-writer";

interface TableCall {
  table: string;
  operation: string;
}

function fakeClient(options?: { signedIn?: boolean; active?: boolean }) {
  const { signedIn = true, active = true } = options ?? {};
  const tableCalls: TableCall[] = [];
  const rpcCalls: string[] = [];
  const userId = "11111111-1111-4111-8111-111111111111";
  const client = {
    tableCalls,
    rpcCalls,
    auth: {
      getUser: async () =>
        signedIn
          ? { data: { user: { id: userId } }, error: null }
          : { data: { user: null }, error: { message: "signed out" } },
    },
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      rpcCalls.push(fn);
      if (fn === "ensure_app_user") {
        return {
          data: [{ id: userId, status: active ? "active" : "suspended" }],
          error: null,
        };
      }
      if (fn === "create_team") {
        return {
          data: [{ id: TEAM_ID, slug: String(args?.p_slug ?? "nova-esports") }],
          error: null,
        };
      }
      if (fn === "update_team_settings") {
        return {
          data: [{ id: String(args?.p_team_id ?? TEAM_ID) }],
          error: null,
        };
      }
      return { data: null, error: { message: "unknown function" } };
    },
    from: (table: string) => {
      const chain: Record<string, (...args: unknown[]) => unknown> = {};
      const terminal = (operation: string) => (..._args: unknown[]) => {
        tableCalls.push({ table, operation });
        return Promise.resolve({ data: null, error: { message: "unreachable" } });
      };
      for (const method of ["select", "insert", "update", "delete", "eq", "order", "limit", "single"]) {
        chain[method] = (...args: unknown[]) => {
          if (method === "insert" || method === "update" || method === "delete" || method === "single") {
            return terminal(method)(...args);
          }
          return chainProxy();
        };
      }
      const chainProxy = () => chain;
      // select/insert/update entry points record nothing until a terminal.
      return {
        select: (..._args: unknown[]) => chain,
        insert: (...args: unknown[]) => terminal("insert")(...args),
        update: (...args: unknown[]) => terminal("update")(...args),
        delete: (...args: unknown[]) => terminal("delete")(...args),
      };
    },
  };
  return { client: client as never, tableCalls, rpcCalls, userId };
}

const CREATE_BASE = {
  slug: "nova-esports",
  name: "Nova Esports",
  gameKey: "bgmi",
  regionCode: "india",
  currentLevel: "competitive",
  targetLevel: "semi-pro",
  description: "A competitive BGMI squad.",
  recruiting: true,
  isPublic: true,
} as const;

const TEAM_ID = "22222222-2222-4222-8222-222222222222";

describe("kill switch", () => {
  it("is ON for Teams create/settings only (P14-D6)", () => {
    expect(WORKSPACE_WRITES_ENABLED).toBe(true);
  });
});

describe("creation contract", () => {
  it("accepts a complete valid team draft", () => {
    expect(parseCreateTeamInput({ ...CREATE_BASE }).slug).toBe("nova-esports");
  });

  it("rejects protected keys (owner, creator, org) instead of dropping them", () => {
    for (const extra of [
      { owner_user_id: "33333333-3333-4333-8333-333333333333" },
      { created_by: "33333333-3333-4333-8333-333333333333" },
      { organization_id: "org-1" },
    ]) {
      expect(() => parseCreateTeamInput({ ...CREATE_BASE, ...extra })).toThrow(
        WorkspaceValidationError,
      );
    }
  });

  it("rejects malformed slugs, other games and bad regions", () => {
    expect(() => parseCreateTeamInput({ ...CREATE_BASE, slug: "BAD SLUG!" })).toThrow(
      WorkspaceValidationError,
    );
    expect(() => parseCreateTeamInput({ ...CREATE_BASE, gameKey: "valorant" })).toThrow(
      WorkspaceValidationError,
    );
    expect(() => parseCreateTeamInput({ ...CREATE_BASE, regionCode: "atlantis" })).toThrow(
      WorkspaceValidationError,
    );
  });

  it("runs validation + session, then calls create_team RPC with no direct table writes", async () => {
    const { client, tableCalls, rpcCalls } = fakeClient();
    const created = await createTeamOp(client, { ...CREATE_BASE });
    expect(created.slug).toBe("nova-esports");
    expect(tableCalls).toEqual([]);
    expect(rpcCalls.filter((fn) => fn !== "ensure_app_user")).toEqual(["create_team"]);
  });

  it("rejects unauthenticated callers without touching tables", async () => {
    const { client, tableCalls, rpcCalls } = fakeClient({ signedIn: false });
    await expect(createTeamOp(client, { ...CREATE_BASE })).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    expect(tableCalls).toEqual([]);
    expect(rpcCalls).toEqual([]);
  });
});

describe("settings contract", () => {
  const PATCH_BASE = {
    name: "Nova Esports",
    regionCode: "india",
    currentLevel: "competitive",
    targetLevel: "semi-pro",
    description: "Updated.",
    recruiting: true,
    isPublic: true,
  } as const;

  it("accepts an editable-columns-only patch", () => {
    const parsed = parseUpdateTeamSettingsInput({ teamId: TEAM_ID, patch: { ...PATCH_BASE } });
    expect(parsed.teamId).toBe(TEAM_ID);
  });

  it("rejects protected keys in the patch (slug, game, owner, org)", () => {
    for (const extra of [
      { slug: "other-slug" },
      { gameKey: "bgmi" },
      { owner_user_id: "33333333-3333-4333-8333-333333333333" },
      { created_by: "33333333-3333-4333-8333-333333333333" },
      { organization_id: "org-1" },
    ]) {
      expect(() =>
        parseUpdateTeamSettingsInput({ teamId: TEAM_ID, patch: { ...PATCH_BASE, ...extra } }),
      ).toThrow(WorkspaceValidationError);
    }
  });

  it("rejects malformed ids and empty patches", () => {
    expect(() =>
      parseUpdateTeamSettingsInput({ teamId: "not-a-uuid", patch: { ...PATCH_BASE } }),
    ).toThrow(WorkspaceValidationError);
    expect(() => parseUpdateTeamSettingsInput({ teamId: TEAM_ID, patch: {} })).toThrow(
      WorkspaceValidationError,
    );
  });

  it("runs validation + session, then calls update_team_settings RPC with no direct table writes", async () => {
    const { client, tableCalls, rpcCalls } = fakeClient();
    const updated = await updateTeamSettingsOp(client, {
      teamId: TEAM_ID,
      patch: { ...PATCH_BASE },
    });
    expect(updated.id).toBe(TEAM_ID);
    expect(tableCalls).toEqual([]);
    expect(rpcCalls.filter((fn) => fn !== "ensure_app_user")).toEqual(["update_team_settings"]);
  });
});
