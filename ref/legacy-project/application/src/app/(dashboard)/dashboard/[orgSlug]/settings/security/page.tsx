import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ChangeForm } from "./change-form";

export const metadata = {
  title: "Security — MicroNest",
  robots: { index: false, follow: false },
};

export default async function SecurityPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);

  return (
    <div className="space-y-8">
      <PageHeader title="Security" description={`Change your password — ${ctx.organization.name}.`} />
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Change password</CardTitle>
          <CardDescription>At least 8 characters. Confirmation must match.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangeForm />
        </CardContent>
      </Card>
    </div>
  );
}
