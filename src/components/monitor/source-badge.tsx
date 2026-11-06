import { Radar, Zap } from "lucide-react";
import type { IncidentSource } from "@/lib/types";
import { cn } from "@/lib/utils";

/** "Auto" for incidents recorded by the watchdog, "Manual" for Chaos Theater outages (older state has no source). */
export function SourceBadge({ source, className }: { source?: IncidentSource; className?: string }) {
  const auto = source === "watchdog";
  const Icon = auto ? Radar : Zap;
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-full px-2 text-[11px] font-medium leading-none",
        auto ? "bg-accent/10 text-accent-ink" : "bg-raised text-slate shadow-card",
        className,
      )}
      title={auto ? "Recorded automatically by the watchdog after consecutive failed checks" : "Recorded manually in the Chaos Theater"}
    >
      <Icon className="size-3" aria-hidden />
      {auto ? "Auto · watchdog" : "Manual · chaos"}
    </span>
  );
}
