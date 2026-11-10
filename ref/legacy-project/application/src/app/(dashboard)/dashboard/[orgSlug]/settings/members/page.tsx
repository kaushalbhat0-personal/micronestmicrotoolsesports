import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireUser } from "@/lib/auth/get-user";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listMembers, getMemberAudit } from "@/server/organizations/members";
import {
  addMemberAction,
  changeMemberRoleAction,
  leaveOrganizationAction,
  removeMemberAction,
  transferOwnershipAction,
} from "./actions";
import {
  AddMemberForm,
  LeaveOrganizationButton,
  RemoveMemberButton,
  RoleChangeButtons,
  TransferOwnershipForm,
} from "@/components/org/MemberForms";

export const dynamic = "force-dynamic";

const ROLE_BADGE: Record<string, "default" | "secondary" | "outline"> = {
  owner: "default",
  admin: "secondary",
  member: "outline",
};

export default async function MembersPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  const user = await requireUser();
  const { members, callerRole } = await listMembers(orgSlug);
  const isOwner = callerRole === "owner";
  const isManager = isOwner || callerRole === "admin";
  const ownerCount = members.filter((m) => m.role === "owner").length;
  const soleOwner = ownerCount <= 1;
  let history: Array<Record<string, unknown>> = [];
  try {
    history = await getMemberAudit(orgSlug);
  } catch {
    history = [];
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Members" description={`People in ${ctx.organization.name} — Owner, Admin, Member.`} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Current members ({members.length})
          </CardTitle>
          <CardDescription>Only the actions your role allows are shown.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Organization members</caption>
              <thead>
                <tr className="border-y border-border bg-surface-muted/40 text-left">
                  <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Person</th>
                  <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Role</th>
                  <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((m) => {
                  const isSelf = m.userId === user.id;
                  const canChangeRole = isOwner && !isSelf && m.role !== "owner";
                  const canRemove = !isSelf && (isOwner ? m.role !== "owner" : callerRole === "admin" && m.role === "member");
                  return (
                    <tr key={m.userId} className="hover:bg-surface-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-medium">{m.email ?? "Unknown email"}{isSelf ? " (you)" : ""}</p>
                        {m.displayName && <p className="text-xs text-muted-foreground">{m.displayName}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={ROLE_BADGE[m.role] ?? "outline"}>{m.role}</Badge>
                        {m.role === "owner" && soleOwner && (
                          <p className="mt-1 text-[11px] text-muted-foreground">Sole owner — protected</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex flex-wrap justify-end gap-2">
                          {canChangeRole && (
                            <RoleChangeButtons
                              orgSlug={orgSlug}
                              targetUserId={m.userId}
                              targetEmail={m.email}
                              currentRole={m.role}
                              action={changeMemberRoleAction}
                            />
                          )}
                          {canRemove && (
                            <RemoveMemberButton orgSlug={orgSlug} targetUserId={m.userId} targetEmail={m.email} action={removeMemberAction} />
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {isManager && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Add member</CardTitle>
            <CardDescription>
              {isOwner ? "Owners may add members and admins." : "Admins may add members."} The account must already exist.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddMemberForm orgSlug={orgSlug} canAssignAdmin={isOwner} action={addMemberAction} />
          </CardContent>
        </Card>
      )}

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Transfer ownership</CardTitle>
            <CardDescription>Move ownership to another member. You become an admin. This is audited.</CardDescription>
          </CardHeader>
          <CardContent>
            <TransferOwnershipForm
              orgSlug={orgSlug}
              candidates={members.filter((m) => m.userId !== user.id).map((m) => ({ userId: m.userId, email: m.email }))}
              action={transferOwnershipAction}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Leave organization</CardTitle>
          <CardDescription>
            {soleOwner && callerRole === "owner"
              ? "You are the sole owner — transfer ownership before leaving."
              : "Leaving removes your access immediately."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {soleOwner && callerRole === "owner" ? (
            <p className="text-xs text-muted-foreground">Leaving is blocked while you are the final owner.</p>
          ) : (
            <LeaveOrganizationButton orgSlug={orgSlug} action={leaveOrganizationAction} />
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent member history</CardTitle>
            <CardDescription>Latest membership changes in this workspace.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {history.slice(0, 20).map((h) => (
                <li key={String(h.id)} className="px-4 py-2.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{String(h.action)}</span>
                  {h.before_role || h.after_role ? (
                    <> — {h.before_role ? String(h.before_role) : "—"} → {h.after_role ? String(h.after_role) : "—"}</>
                  ) : null}
                  <span className="ml-2">{new Date(String(h.created_at)).toLocaleString("en-IN")}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
