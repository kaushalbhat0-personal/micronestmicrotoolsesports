"use server";

import { revalidatePath } from "next/cache";
import {
  addMemberByEmail,
  changeMemberRole,
  leaveOrganization,
  removeMember,
  transferOwnership,
  type MemberRole,
} from "@/server/organizations/members";

/**
 * Organization member actions — thin wrappers. Organization, caller
 * identity, and caller role are server-derived; authorization lives in the
 * membership RPCs. Client passes target + intent only.
 */

export async function addMemberAction(orgSlug: string, email: string, role: MemberRole) {
  const outcome = await addMemberByEmail(orgSlug, email, role);
  if (outcome.ok) revalidatePath(`/dashboard/${orgSlug}/settings/members`);
  return outcome;
}

export async function removeMemberAction(orgSlug: string, targetUserId: string) {
  const outcome = await removeMember(orgSlug, targetUserId);
  if (outcome.ok) revalidatePath(`/dashboard/${orgSlug}/settings/members`);
  return outcome;
}

export async function changeMemberRoleAction(orgSlug: string, targetUserId: string, role: MemberRole) {
  const outcome = await changeMemberRole(orgSlug, targetUserId, role);
  if (outcome.ok) revalidatePath(`/dashboard/${orgSlug}/settings/members`);
  return outcome;
}

export async function transferOwnershipAction(orgSlug: string, targetUserId: string) {
  const outcome = await transferOwnership(orgSlug, targetUserId);
  if (outcome.ok) revalidatePath(`/dashboard/${orgSlug}/settings/members`);
  return outcome;
}

export async function leaveOrganizationAction(orgSlug: string) {
  const outcome = await leaveOrganization(orgSlug);
  if (outcome.ok) revalidatePath(`/dashboard/${orgSlug}`);
  return outcome;
}
