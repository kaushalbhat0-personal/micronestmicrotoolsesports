import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-user";
import { createOrganizationForUser } from "@/server/services/organization-service";
import { slugify } from "@/lib/utils/format";
import { CreateOrgForm } from "./create-org-form";

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
  return <CreateOrgForm action={createOrgAction} />;
}
