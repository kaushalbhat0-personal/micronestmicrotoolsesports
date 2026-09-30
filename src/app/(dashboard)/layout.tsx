import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getUserOrganizations } from "@/lib/auth/require-membership";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let organizations: { id: string; name: string; slug: string }[] = [];
  try {
    const memberships = await getUserOrganizations();
    organizations = memberships
      .map((m) => {
        const raw = m.organization as unknown as { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
        const org = Array.isArray(raw) ? raw[0] : raw;
        return org ? { id: org.id, name: org.name, slug: org.slug } : null;
      })
      .filter((o): o is { id: string; name: string; slug: string } => Boolean(o));
  } catch {
    organizations = [];
  }

  return <DashboardShell organizations={organizations}>{children}</DashboardShell>;
}
