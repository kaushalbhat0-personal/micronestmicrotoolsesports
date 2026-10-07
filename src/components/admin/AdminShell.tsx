"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, LogOut, House } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import { signOutAction } from "@/lib/auth/actions";
import type { Route } from "next";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-[240px] shrink-0 border-r border-border bg-card lg:flex lg:flex-col">
        <div className="sticky top-0 flex h-full flex-col">
          <div className="flex h-[56px] items-center border-b border-border px-4">
            <AdminHeader />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <AdminSidebar />
          </div>
          <div className="border-t border-border p-3">
            <div className="flex flex-col gap-1">
              <Link
                href={"/" as Route}
                className="flex min-h-[44px] items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <House className="h-4 w-4" aria-hidden /> Back to site
              </Link>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex min-h-[44px] w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <LogOut className="h-4 w-4" aria-hidden /> Log out
                </button>
              </form>
            </div>
            <p className="px-3 pt-3 text-xs text-muted-foreground">© {new Date().getFullYear()} MicroNest</p>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-[56px] items-center gap-3 border-b border-border bg-card px-4 lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                aria-label="Open platform navigation"
                className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] border border-border bg-card text-foreground hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Menu className="h-5 w-5" aria-hidden />
              </button>
            </SheetTrigger>
            <SheetContent className="w-[300px] p-0" aria-describedby={undefined}>
              <SheetHeader className="p-4 border-b border-border">
                <SheetTitle>
                  <AdminHeader />
                </SheetTitle>
              </SheetHeader>
              <div className="p-3 overflow-y-auto">
                <AdminSidebar />
              </div>
            </SheetContent>
          </Sheet>
          <AdminHeader />
        </header>

        <main className="flex-1 min-w-0">
          <div className="mx-auto w-full max-w-[80rem] px-5 py-6 md:px-6 md:py-8 lg:px-8">{children}</div>
        </main>

        {/* Mobile footer actions */}
        <div className="border-t border-border bg-card px-4 py-3 lg:hidden">
          <div className="flex gap-2">
            <Link
              href={"/" as Route}
              className="flex flex-1 min-h-[44px] items-center justify-center gap-2 rounded-[12px] border border-border bg-card px-3 text-sm font-medium hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <House className="h-4 w-4" aria-hidden /> Site
            </Link>
            <form action={signOutAction} className="flex-1">
              <button
                type="submit"
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[12px] border border-border bg-card px-3 text-sm font-medium hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LogOut className="h-4 w-4" aria-hidden /> Log out
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
