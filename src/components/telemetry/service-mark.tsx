import { Cloud, Cpu, Layers, PlaySquare } from "lucide-react";
import type { ServiceCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<ServiceCategory, typeof Cloud> = {
  Streaming: PlaySquare,
  "Cloud Storage": Cloud,
  "Developer Infrastructure": Cpu,
  SaaS: Layers,
};

/** Monochrome category glyph. Brand hue is intentionally not rendered (single-accent system). */
export function ServiceMark({ category, size = "md", className }: { category: ServiceCategory; accent?: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const Icon = ICONS[category] ?? Layers;
  const dim = size === "sm" ? "size-7" : size === "lg" ? "size-10" : "size-8";
  const icon = size === "sm" ? "size-3.5" : size === "lg" ? "size-[18px]" : "size-4";
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-[8px] bg-raised text-ink shadow-card", dim, className)} aria-hidden>
      <Icon className={icon} strokeWidth={1.6} />
    </span>
  );
}
