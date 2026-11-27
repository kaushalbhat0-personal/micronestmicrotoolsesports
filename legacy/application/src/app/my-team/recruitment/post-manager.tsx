"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  FinderApplicationRow,
  FinderRecruitmentPostRow,
} from "@/features/finder/repositories/finder";
import {
  decideApplicationAction,
  deletePostAction,
  setPostStatusAction,
} from "./actions";
import { PostForm } from "./post-form";

/**
 * Captain post manager: edit, status transitions (pause/close/fill/
 * reopen), delete, and per-post application review (Phase C).
 * Applications show the applicant note + status only — no private
 * account data is ever exposed here.
 */
export function PostManager({
  post,
  teamName,
  applications,
}: {
  post: FinderRecruitmentPostRow;
  teamName: string;
  applications: FinderApplicationRow[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(key: string, fn: () => Promise<{ ok: boolean; message: string }>) {
    setPending(key);
    setMessage(null);
    const outcome = await fn();
    setMessage({ ok: outcome.ok, text: outcome.message });
    setPending(null);
  }

  const active = applications.filter(
    (a) => a.status === "applied" || a.status === "shortlisted",
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {post.role_needed} · {post.slots} slot{post.slots === 1 ? "" : "s"}
          <span className="font-normal text-muted-foreground"> · {teamName}</span>
        </CardTitle>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Badge
            variant={post.status === "open" ? "info" : post.status === "filled" ? "success" : "secondary"}
          >
            {post.status}
          </Badge>
          <Badge variant="outline">{post.current_level_min} → {post.target_level}</Badge>
          <Badge variant="outline">{post.region}</Badge>
          {post.tryout_required && <Badge variant="outline">Tryout required</Badge>}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Close editor" : "Edit"}
          </Button>
          {post.status === "open" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending !== null}
              onClick={() => run(`pause-${post.id}`, () => setPostStatusAction(post.id, "paused"))}
            >
              Pause
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending !== null}
              onClick={() => run(`open-${post.id}`, () => setPostStatusAction(post.id, "open"))}
            >
              Reopen
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending !== null}
            onClick={() => run(`filled-${post.id}`, () => setPostStatusAction(post.id, "filled"))}
          >
            Mark filled
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending !== null}
            onClick={() => run(`closed-${post.id}`, () => setPostStatusAction(post.id, "closed"))}
          >
            Close
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={pending !== null}
            onClick={() => run(`delete-${post.id}`, () => deletePostAction(post.id))}
          >
            Delete
          </Button>
        </div>

        {editing && <PostForm teamId={post.team_id} post={post} />}

        <div>
          <h4 className="text-sm font-semibold">
            Applications ({active.length} active, {applications.length} total)
          </h4>
          {applications.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              No applications yet. Share your team profile with players looking for a team.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {applications.map((application) => (
                <li
                  key={application.id}
                  className="rounded-[12px] border border-border p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        application.status === "accepted"
                          ? "success"
                          : application.status === "declined"
                            ? "destructive"
                            : application.status === "withdrawn"
                              ? "secondary"
                              : "info"
                      }
                    >
                      {application.status}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {application.applicant_user_id.slice(0, 8)}…
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(application.created_at).toLocaleDateString("en-IN")}
                    </span>
                  </div>
                  {application.note && (
                    <p className="mt-1 leading-relaxed">{application.note}</p>
                  )}
                  {(application.status === "applied" ||
                    application.status === "shortlisted") && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending !== null}
                        onClick={() =>
                          run(`sl-${application.id}`, () =>
                            decideApplicationAction(application.id, "shortlisted"),
                          )
                        }
                      >
                        Shortlist
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending !== null}
                        onClick={() =>
                          run(`ac-${application.id}`, () =>
                            decideApplicationAction(application.id, "accepted"),
                          )
                        }
                      >
                        Accept & add to roster
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending !== null}
                        onClick={() =>
                          run(`dc-${application.id}`, () =>
                            decideApplicationAction(application.id, "declined"),
                          )
                        }
                      >
                        Decline
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {message && (
          <p
            role={message.ok ? "status" : "alert"}
            className={message.ok ? "text-sm text-green-600" : "text-sm text-red-600"}
          >
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
