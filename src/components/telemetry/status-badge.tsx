import { AlertTriangle, OctagonX, ShieldAlert, ShieldCheck, Square } from "lucide-react";
import type { Severity } from "@/lib/sla-engine";
import type { ServiceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const base = "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-medium leading-none";

const STATUS = {
  OPERATIONAL: { label: "Operational", icon: Square, cls: "bg-raised text-ink shadow-card [&_svg]:fill-ink" },
  DEGRADED: { label: "Degraded", icon: AlertTriangle, cls: "bg-warn/10 text-warn" },
  OUTAGE: { label: "Major outage", icon: OctagonX, cls: "bg-down/10 text-down" },
} as const;

/** Glyph + monospace label + hue: readable without color vision. */
export function StatusBadge({ status, className }: { status: ServiceStatus; className?: string }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span className={cn(base, s.cls, className)}>
      <Icon className={status === "OPERATIONAL" ? "size-[7px] rounded-full" : "size-3"} aria-hidden />
      {s.label}
    </span>
  );
}

const SEV = {
  NONE: { label: "Within SLA", icon: ShieldCheck, cls: "bg-raised text-slate shadow-card" },
  MINOR: { label: "Tier 1 · minor", icon: ShieldAlert, cls: "bg-warn/10 text-warn" },
  MODERATE: { label: "Tier 2 · moderate", icon: ShieldAlert, cls: "bg-down/10 text-down" },
  SEVERE: { label: "Tier 3 · severe", icon: OctagonX, cls: "bg-down/15 text-down" },
} as const;

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const s = SEV[severity];
  const Icon = s.icon;
  return (
    <span className={cn(base, s.cls, className)}>
      <Icon className="size-3" aria-hidden />
      {s.label}
    </span>
  );
}

export function LiveDot({ color = "var(--ink)", className }: { color?: string; className?: string }) {
  return (
    <span className={cn("relative inline-flex size-1.5", className)} aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-ping opacity-50" style={{ background: color }} />
      <span className="relative inline-flex size-1.5" style={{ background: color }} />
    </span>
  );
}
