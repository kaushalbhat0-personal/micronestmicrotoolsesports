import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "Platform Admin — MicroNest",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();

  return <AdminShell>{children}</AdminShell>;
}
