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

export function OrgSwitcher({ organizations, activeOrgId }: { organizations: Org[]; activeOrgId?: string | undefined }) {
  const active = organizations.find((o) => o.id === activeOrgId) ?? organizations[0];

  return (
    <Dropdown
      trigger={
        <Button variant="outline" size="sm" className="w-full justify-between">
          <span className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {active ? active.name : "Select organization"}
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
          + Create organization
        </Link>
      </DropdownItem>
    </Dropdown>
  );
}
