import * as React from "react";
import { LogoMark } from "@/components/shared/logo";

export function AdminHeader() {
  return (
    <div className="flex items-center gap-3">
      <LogoMark size={28} href="/" priority />
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-none tracking-tight">MicroNest MicroTools</p>
        <p className="mt-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">Platform Admin</p>
      </div>
    </div>
  );
}
