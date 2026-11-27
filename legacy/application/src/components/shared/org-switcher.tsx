"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Building2, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { setPrimaryWorkspaceAction } from "@/app/(dashboard)/dashboard/organizations/primary-workspace-actions";

interface Org {
  id: string;
  name: string;
  slug: string;
}

export function OrgSwitcher({
  organizations,
  activeOrgId,
  primaryOrgId,
  variant = "default",
}: {
  organizations: Org[];
  activeOrgId?: string | undefined;
  /** Current user's Primary Workspace org id — preference marker only, never authorization. */
  primaryOrgId?: string | null | undefined;
  variant?: "default" | "sidebar" | "header";
}) {
  const active = organizations.find((o) => o.id === activeOrgId) ?? organizations[0];

  if (variant === "sidebar") {
    return (
      <Dropdown
        trigger={
          <button className="flex w-full items-center justify-between rounded-[12px] border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-surface-muted border border-border">
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold uppercase tracking-widest text-muted-foreground leading-none">Workspace</span>
                <span className="block truncate text-sm font-medium text-foreground">{active ? active.name : "Select workspace"}</span>
              </span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        }
      >
        {organizations.map((org) => (
          <OrgRow key={org.id} org={org} primaryOrgId={primaryOrgId} />
        ))}
        <DropdownItem>
          <Link href="/dashboard/organizations/new" className="w-full text-primary">
            + Create workspace
          </Link>
        </DropdownItem>
      </Dropdown>
    );
  }

  return (
    <Dropdown
      trigger={
        <Button variant="outline" size="sm" className="w-full justify-between">
          <span className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {active ? active.name : "Select workspace"}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      }
    >
      {organizations.map((org) => (
        <OrgRow key={org.id} org={org} primaryOrgId={primaryOrgId} />
      ))}
      <DropdownItem>
        <Link href="/dashboard/organizations/new" className="w-full text-primary">
          + Create workspace
        </Link>
      </DropdownItem>
    </Dropdown>
  );
}

function OrgRow({ org, primaryOrgId }: { org: Org; primaryOrgId?: string | null | undefined }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const isPrimary = primaryOrgId === org.id;

  function setPrimary() {
    setError(null);
    startTransition(async () => {
      const result = await setPrimaryWorkspaceAction(org.id);
      if (!result.ok) {
        setError(result.message ?? "Could not set primary workspace.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <DropdownItem>
      <div className="flex w-full items-center gap-2">
        <Link href={`/dashboard/${org.slug}` as Route} className="min-w-0 flex-1 truncate">
          {org.name}
        </Link>
        {isPrimary ? (
          <Badge variant="secondary" className="shrink-0">
            Primary workspace
          </Badge>
        ) : (
          <button
            type="button"
            onClick={setPrimary}
            disabled={pending}
            title="Set as your primary workspace"
            className="shrink-0 rounded-full px-2 py-1 text-[11px] font-medium text-primary hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {pending ? "Setting…" : "Set as primary"}
          </button>
        )}
      </div>
      {error ? (
        <p className="w-full px-0 pt-1 text-[11px] text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </DropdownItem>
  );
}
