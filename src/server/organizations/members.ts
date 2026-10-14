import { requireUser } from "@/lib/auth/get-user";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { forbiddenError, notFoundError } from "@/lib/errors";

/**
 * Organization member management — thin server layer over the
 * §5 membership RPCs (20251109000001_org_members_hardening).
 *
 * Authorization (canonical, never duplicated here):
 * - org + caller role come from requireOrganizationContext (server-derived)
 * - the RPC re-checks actor role authoritatively inside its transaction
 * - organization IDs are never client-supplied (slug → context → id)
 * - target users resolve server-side (UUID validated; email exactly matched)
 *
 * Role matrix (enforced in RPC, mirrored for fast failure here):
 *   add:      owner → member|admin;  admin → member
 *   remove:   owner → admin|member (not self/owners); admin → member (not self)
 *   change:   owner → member↔admin only; admin/member → deny
 *   leave:    any member except the sole owner
 *   transfer: current owner → same-org member|admin (atomic)
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUuid(id: string, label: string): void {
  if (!UUID_RE.test(id)) throw new Error(`Invalid ${label}`);
}

function normalizeEmail(email: string): string {
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 320) throw new Error("Invalid email address");
  return e;
}

export type MemberRole = "owner" | "admin" | "member";

export interface OrgMemberItem {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: MemberRole;
  createdAt: string;
}

export type MemberResult =
  | { ok: true; role?: MemberRole; idempotent?: boolean }
  | { ok: false; error: string };

function mapRpcError(code: string | undefined, fallback: string): string {
  switch (code) {
    case "not_member":
      return "You are not a member of this organization";
    case "forbidden":
      return "Your role cannot perform this action";
    case "not_found":
      return "User or organization not found";
    case "duplicate":
      return "User is already a member of this organization";
    case "invalid_role":
      return "Invalid role assignment";
    case "self":
      return "Use the leave or transfer flow for your own membership";
    case "last_owner":
      return "The final owner cannot leave — transfer ownership first";
    default:
      return fallback;
  }
}

export async function listMembers(orgSlug: string): Promise<{ members: OrgMemberItem[]; callerRole: MemberRole }> {
  const ctx = await requireOrganizationContext(orgSlug);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organization_members")
    .select("user_id, role, created_at")
    .eq("organization_id", ctx.organization.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Unable to load members");
  const rows = (data ?? []) as Array<{ user_id: string; role: MemberRole; created_at: string }>;
  const profileMap = new Map<string, { email: string | null; display_name: string | null }>();
  if (rows.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email, display_name")
      .in("id", rows.map((r) => r.user_id));
    for (const p of (profiles ?? []) as Array<{ id: string; email: string | null; display_name: string | null }>) {
      profileMap.set(p.id, p);
    }
  }
  return {
    callerRole: ctx.membership.role,
    members: rows.map((r) => ({
      userId: r.user_id,
      email: profileMap.get(r.user_id)?.email ?? null,
      displayName: profileMap.get(r.user_id)?.display_name ?? null,
      role: r.role,
      createdAt: r.created_at,
    })),
  };
}

export async function addMemberByEmail(orgSlug: string, email: string, role: MemberRole): Promise<MemberResult> {
  try {
    const ctx = await requireOrganizationContext(orgSlug);
    const callerRole = ctx.membership.role;
    if (callerRole !== "owner" && callerRole !== "admin") throw forbiddenError("Your role cannot perform this action");
    if (role !== "member" && role !== "admin") throw forbiddenError("Invalid role assignment");
    if (callerRole === "admin" && role !== "member") throw forbiddenError("Admins may only add members");
    const cleanEmail = normalizeEmail(email);
    const admin = createAdminClient();
    const { data: candidates } = await admin.from("profiles").select("id, email").ilike("email", cleanEmail);
    const target = ((candidates ?? []) as Array<{ id: string; email: string }>).find((p) => p.email.trim().toLowerCase() === cleanEmail);
    if (!target) return { ok: false, error: "No account exists for this email — ask them to sign up first" };
    const user = await requireUser();
    if (target.id === user.id) return { ok: false, error: "You are already a member of this organization" };
    const { data, error: rpcError } = await admin.rpc("add_organization_member", {
      p_org: ctx.organization.id,
      p_target: target.id,
      p_role: role,
      p_actor: user.id,
    });
    if (rpcError) return { ok: false, error: "Failed to add member" };
    const result = data as { ok: boolean; error?: string; role?: MemberRole } | null;
    if (!result?.ok) return { ok: false, error: mapRpcError(result?.error, "Failed to add member") };
    if (result.role === "member" || result.role === "admin") return { ok: true, role: result.role };
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && /Invalid email|already a member|No account|cannot perform|Invalid role/.test(e.message)) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Failed to add member" };
  }
}

export async function removeMember(orgSlug: string, targetUserId: string): Promise<MemberResult> {
  try {
    const ctx = await requireOrganizationContext(orgSlug);
    requireUuid(targetUserId, "user ID");
    const user = await requireUser();
    const admin = createAdminClient();
    const { data, error: rpcError } = await admin.rpc("remove_organization_member", {
      p_org: ctx.organization.id,
      p_target: targetUserId,
      p_actor: user.id,
    });
    if (rpcError) return { ok: false, error: "Failed to remove member" };
    const result = data as { ok: boolean; error?: string } | null;
    if (!result?.ok) return { ok: false, error: mapRpcError(result?.error, "Failed to remove member") };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to remove member" };
  }
}

export async function changeMemberRole(orgSlug: string, targetUserId: string, role: MemberRole): Promise<MemberResult> {
  try {
    const ctx = await requireOrganizationContext(orgSlug);
    requireUuid(targetUserId, "user ID");
    if (role !== "member" && role !== "admin") return { ok: false, error: "Invalid role assignment" };
    const user = await requireUser();
    const admin = createAdminClient();
    const { data, error: rpcError } = await admin.rpc("change_member_role", {
      p_org: ctx.organization.id,
      p_target: targetUserId,
      p_role: role,
      p_actor: user.id,
    });
    if (rpcError) return { ok: false, error: "Failed to change role" };
    const result = data as { ok: boolean; error?: string; idempotent?: boolean } | null;
    if (!result?.ok) return { ok: false, error: mapRpcError(result?.error, "Failed to change role") };
    if (result.idempotent === true) return { ok: true, idempotent: true };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to change role" };
  }
}

export async function transferOwnership(orgSlug: string, targetUserId: string): Promise<MemberResult> {
  try {
    const ctx = await requireOrganizationContext(orgSlug);
    requireUuid(targetUserId, "user ID");
    if (ctx.membership.role !== "owner") throw forbiddenError("Only the owner can transfer ownership");
    const user = await requireUser();
    const admin = createAdminClient();
    const { data, error: rpcError } = await admin.rpc("transfer_organization_ownership", {
      p_org: ctx.organization.id,
      p_target: targetUserId,
      p_actor: user.id,
    });
    if (rpcError) return { ok: false, error: "Failed to transfer ownership" };
    const result = data as { ok: boolean; error?: string; idempotent?: boolean } | null;
    if (!result?.ok) return { ok: false, error: mapRpcError(result?.error, "Failed to transfer ownership") };
    if (result.idempotent === true) return { ok: true, idempotent: true };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to transfer ownership" };
  }
}

export async function leaveOrganization(orgSlug: string): Promise<MemberResult> {
  try {
    const ctx = await requireOrganizationContext(orgSlug);
    const user = await requireUser();
    const admin = createAdminClient();
    const { data, error: rpcError } = await admin.rpc("leave_organization", {
      p_org: ctx.organization.id,
      p_actor: user.id,
    });
    if (rpcError) return { ok: false, error: "Failed to leave organization" };
    const result = data as { ok: boolean; error?: string } | null;
    if (!result?.ok) return { ok: false, error: mapRpcError(result?.error, "Failed to leave organization") };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to leave organization" };
  }
}

export async function getMemberAudit(orgSlug: string): Promise<Array<Record<string, unknown>>> {
  const ctx = await requireOrganizationContext(orgSlug);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organization_audit_logs")
    .select("id, actor_user_id, action, target_user_id, before_role, after_role, reason, created_at")
    .eq("organization_id", ctx.organization.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw notFoundError("Unable to load member history");
  return (data ?? []) as Array<Record<string, unknown>>;
}
