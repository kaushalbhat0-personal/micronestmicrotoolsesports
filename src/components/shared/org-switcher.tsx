"use client";

import Link from "next/link";
import type { Route } from "next";
import { Building2, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";

interface Org {
  id: string;
  name: string;
  slug: string;
}

export function OrgSwitcher({
  organizations,
  activeOrgId,
  variant = "default",
}: {
  organizations: Org[];
  activeOrgId?: string | undefined;
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
          <DropdownItem key={org.id}>
            <Link href={`/dashboard/${org.slug}` as Route} className="w-full">
              {org.name}
            </Link>
          </DropdownItem>
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
        <DropdownItem key={org.id}>
          <Link href={`/dashboard/${org.slug}` as Route} className="w-full">
            {org.name}
          </Link>
        </DropdownItem>
      ))}
      <DropdownItem>
        <Link href="/dashboard/organizations/new" className="w-full text-primary">
          + Create workspace
        </Link>
      </DropdownItem>
    </Dropdown>
  );
}
