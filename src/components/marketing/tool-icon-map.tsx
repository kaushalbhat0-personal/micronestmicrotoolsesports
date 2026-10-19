import {
  ArrowRight,
  CalendarSearch,
  ClipboardList,
  Crosshair,
  FileCheck,
  Gauge,
  Newspaper,
  ReceiptText,
  Scale,
  Scissors,
  ShieldCheck,
  Split,
  Swords,
  Target,
  Trophy,
} from "lucide-react";
import type { ComponentType } from "react";

/**
 * Shared marketing tool icon map (Phase 0.4).
 *
 * One authoritative mapping for public marketing slugs + BGMI Lab slugs.
 * Presentation-only: no billing, entitlement, or workspace semantics.
 * Unknown slugs fall back to ShieldCheck so surfaces never crash.
 */

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  ShieldCheck,
  CalendarSearch,
  Split,
  Scissors,
  FileCheck,
  Swords,
  Scale,
  ReceiptText,
  ClipboardList,
  Newspaper,
  Target,
  Trophy,
  Crosshair,
  Gauge,
  ArrowRight,
};

export function toolIcon(name: string): ComponentType<{ className?: string }> {
  return ICONS[name] ?? ShieldCheck;
}

export const TOOL_ICON_NAMES = Object.keys(ICONS);
