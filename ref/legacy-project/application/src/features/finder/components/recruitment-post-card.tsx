import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FinderRecruitmentPostRow } from "../repositories/finder";

/**
 * Finder — recruitment post summary card (Phase C).
 * Pure display: role needed, level window, region, availability,
 * tryout, status, expiry. No percentages, no match claims.
 */
export function RecruitmentPostCard({
  post,
  teamName,
}: {
  post: FinderRecruitmentPostRow;
  teamName?: string | undefined;
}) {
  const statusVariant =
    post.status === "open" ? "info" : post.status === "filled" ? "success" : "secondary";
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {post.role_needed}
          {teamName ? <span className="font-normal text-muted-foreground"> · {teamName}</span> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={statusVariant}>{post.status}</Badge>
          <Badge variant="outline">
            {post.current_level_min} → {post.target_level} (self-reported)
          </Badge>
          <Badge variant="outline">{post.region}</Badge>
          <Badge variant="outline">{post.slots} slot{post.slots === 1 ? "" : "s"}</Badge>
          {post.tryout_required && <Badge variant="outline">Tryout required</Badge>}
        </div>
        {post.availability_required.length > 0 && (
          <p className="text-muted-foreground">
            Availability: <span className="font-medium text-foreground">{post.availability_required.join(", ")}</span>
          </p>
        )}
        {post.experience_min && (
          <p className="text-muted-foreground">
            Experience: <span className="font-medium text-foreground">{post.experience_min}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
