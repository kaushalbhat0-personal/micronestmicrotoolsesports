import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getUserOrganizations } from "@/lib/auth/require-membership";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TOOLS } from "@/config/app/tools";
import { getAccessibleToolSlugs } from "@/lib/auth/require-entitlement";
import { toWorkspaceTools } from "@/server/services/workspace-tools";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

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

  // Entitlement-aware view model per org — server-authoritative, registry-driven
  // Build a map orgSlug -> { entitled, available } for shell without hardcoding sponsor-sentinel
  const workspaceToolsBySlug = new Map<string, ReturnType<typeof toWorkspaceTools>>();
  await Promise.all(
    organizations.map(async (org) => {
      try {
        const slugs = await getAccessibleToolSlugs(org.id).catch(() => []);
        workspaceToolsBySlug.set(org.slug, toWorkspaceTools(TOOLS, slugs, org.slug));
      } catch {
        workspaceToolsBySlug.set(org.slug, toWorkspaceTools(TOOLS, [], org.slug));
      }
    })
  );

  // Serialize for client shell (plain JSON)
  const serialized = Object.fromEntries(workspaceToolsBySlug.entries());

  return (
    <DashboardShell organizations={organizations} workspaceToolsBySlug={serialized}>
      {children}
    </DashboardShell>
  );
}
