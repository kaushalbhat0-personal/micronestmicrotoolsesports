import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-user";
import { createOrganizationForUser } from "@/server/services/organization-service";
import { slugify } from "@/lib/utils/format";

async function createOrgAction(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();

  const user = await requireUser();
  const supabase = await createClient();

  const rawSlug = slugInput ? slugInput : slugify(name);
  const result = await createOrganizationForUser(supabase, user.id, { name, slug: rawSlug });

  redirect(`/dashboard/${result.slug}`);
}

export default function NewOrganizationPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Create organization" description="Create a new organization. You will be the owner. Slug is URL-friendly and must be unique." />
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Organization details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createOrgAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required minLength={2} maxLength={80} placeholder="Acme Esports" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (optional, auto-generated from name if empty)</Label>
              <Input id="slug" name="slug" pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$" placeholder="acme-esports" />
              <p className="text-xs text-muted-foreground">Lowercase letters, numbers, hyphens. 2–40 chars.</p>
            </div>
            <Button type="submit">Create organization</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
