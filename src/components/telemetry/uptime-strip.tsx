"use client";

import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useState } from "react";
import { EASE } from "@/lib/motion";
import type { HeartbeatWindow } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLOR = { UP: "color-mix(in srgb, var(--ink) 80%, transparent)", DEGRADED: "var(--warn)", DOWN: "var(--down)" } as const;
const COLOR_LIGHT = { UP: "#0A0A0A", DEGRADED: "#C07A12", DOWN: "#E0301F" } as const;

function windowLabel(index: number, total: number) {
  const hoursAgoEnd = (total - 1 - index) * 8;
  if (hoursAgoEnd === 0) return "Current 8h window";
  const d = Math.floor(hoursAgoEnd / 24);
  const h = hoursAgoEnd % 24;
  return `${d ? `${d}d ` : ""}${h ? `${h}h ` : ""}ago · 8h window`;
}

/** 90 bars × 8h = 30-day availability barcode with hover / keyboard scrubbing. */
export function UptimeStrip({
  bars,
  height = 28,
  className,
  compact = false,
  tone = "dark",
}: {
  bars: HeartbeatWindow[];
  height?: number;
  className?: string;
  compact?: boolean;
  tone?: "dark" | "light";
}) {
  const [active, setActive] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const palette = tone === "light" ? COLOR_LIGHT : COLOR;
  const a = active !== null ? bars[active] : null;
  return (
    <div className={cn("relative", className)}>
      <div className="flex items-end gap-[2px]" style={{ height }} role="list" aria-label="30-day availability, 90 eight-hour windows" onMouseLeave={() => setActive(null)}>
        {bars.map((b, i) => {
          const avail = (480 - b.downtimeMinutes) / 480;
          const h = b.status === "UP" ? 1 : Math.max(0.35, avail);
          return (
            <motion.button
              key={i}
              type="button"
              role="listitem"
              aria-label={`${windowLabel(i, bars.length)}: ${b.status}, ${b.downtimeMinutes} minutes down`}
              className="relative min-w-0 flex-1 origin-bottom outline-none focus-visible:ring-1 focus-visible:ring-ink-ink"
              style={{ height: `${h * 100}%`, opacity: active === null || active === i ? 1 : 0.4, backgroundColor: palette[b.status], transition: "background-color 700ms var(--ease), height 700ms var(--ease), opacity 350ms var(--ease)" }}
              initial={false}
              animate={{ scaleY: active === i && !reduce ? 1.18 : 1 }}
              transition={{ duration: reduce ? 0 : 0.3, ease: EASE }}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              tabIndex={compact ? -1 : 0}
            />
          );
        })}
      </div>
      {!compact && (
        <div className={cn("mt-1.5 flex justify-between font-mono text-[10px]", tone === "light" ? "text-[#6b6f76]" : "text-dim")}>
          <span>30d ago</span>
          <span>Now</span>
        </div>
      )}
      {a && (
        <div
          className="pointer-events-none absolute -top-2 z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-[8px] border border-line-strong bg-canvas px-2.5 py-1.5 font-mono text-[10px] leading-relaxed text-ink"
          style={{ left: `${((active! + 0.5) / bars.length) * 100}%` }}
        >
          <div className="text-dim">{windowLabel(active!, bars.length)}</div>
          <div>
            <span style={{ color: COLOR[a.status] }}>{a.status}</span> · {a.status === "DOWN" ? "503 Service Unavailable" : `200 OK · ${a.latencyMs}ms`}
          </div>
          <div className="text-slate">{a.downtimeMinutes > 0 ? `${a.downtimeMinutes}m down · counts toward SLA` : "No SLA impact"}</div>
        </div>
      )}
    </div>
  );
}
