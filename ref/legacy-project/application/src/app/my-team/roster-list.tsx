"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BGMI_ROLES } from "@/features/finder/domain/roles";
import type { FinderTeamMemberRow } from "@/features/finder/repositories/finder";
import { removeMemberAction, updateMemberRoleAction } from "./actions";

/**
 * Roster list (Phase C). Captain can change roles and remove members.
 * No invitations, no social graph — membership comes from accepted
 * applications (or the creator's captain seat).
 */
export function RosterList({
  teamId,
  members,
  currentUserId,
}: {
  teamId: string;
  members: FinderTeamMemberRow[];
  currentUserId: string;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function onRemove(memberUserId: string) {
    setPendingId(memberUserId);
    setMessage(null);
    const outcome = await removeMemberAction(teamId, memberUserId);
    setMessage({ ok: outcome.ok, text: outcome.message });
    setPendingId(null);
  }

  async function onRoleChange(memberUserId: string, role: string, gameRole: string) {
    setPendingId(memberUserId);
    setMessage(null);
    const outcome = await updateMemberRoleAction(teamId, memberUserId, {
      role,
      game_role: gameRole || undefined,
    });
    setMessage({ ok: outcome.ok, text: outcome.message });
    setPendingId(null);
  }

  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground">No members yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {members.map((member) => {
          const isSelf = member.user_id === currentUserId;
          return (
            <li
              key={`${member.team_id}-${member.user_id}`}
              className="flex flex-col gap-2 rounded-[12px] border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {member.user_id.slice(0, 8)}…
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge variant={member.role === "captain" ? "default" : "secondary"}>
                    {member.role}
                  </Badge>
                  {member.game_role && <Badge variant="outline">{member.game_role}</Badge>}
                  {isSelf && <Badge variant="outline">you</Badge>}
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="flex items-center gap-2 text-xs">
                  Role
                  <select
                    defaultValue={member.role}
                    disabled={pendingId === member.user_id || (isSelf && member.role === "captain")}
                    onChange={(e) =>
                      onRoleChange(member.user_id, e.target.value, member.game_role ?? "")
                    }
                    className="h-9 rounded-[8px] border border-input bg-card px-2 text-xs"
                    aria-label={`Role for member ${member.user_id.slice(0, 8)}`}
                  >
                    {["captain", "co-captain", "player", "sub"].map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs">
                  Game role
                  <select
                    defaultValue={member.game_role ?? ""}
                    disabled={pendingId === member.user_id}
                    onChange={(e) =>
                      onRoleChange(member.user_id, member.role, e.target.value)
                    }
                    className="h-9 rounded-[8px] border border-input bg-card px-2 text-xs"
                    aria-label={`Game role for member ${member.user_id.slice(0, 8)}`}
                  >
                    <option value="">—</option>
                    {BGMI_ROLES.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </label>
                {!isSelf && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pendingId === member.user_id}
                    onClick={() => onRemove(member.user_id)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={message.ok ? "text-sm text-green-600" : "text-sm text-red-600"}
        >
          {message.text}
        </p>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        New members join when you accept their application. There is no separate invitation
        system — the roster only ever reflects real memberships.
      </p>
    </div>
  );
}
