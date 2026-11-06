"use client";

import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useMemo } from "react";
import type { ServiceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const W = 600;
const P = 100; // px per beat

const COLORS: Record<ServiceStatus, string> = { OPERATIONAL: "var(--ink)", DEGRADED: "var(--warn)", OUTAGE: "var(--down)" };

function buildPath(status: ServiceStatus, h: number, seed: number) {
  const y0 = Math.round(h * 0.6);
  const amp = h * 0.38;
  const parts: string[] = [`M 0 ${y0}`];
  const beats = (W * 2) / P;
  for (let b = 0; b < beats; b++) {
    const x = b * P;
    const r = ((b * 9301 + seed * 49297) % 233280) / 233280;
    if (status === "OUTAGE") {
      const n = (r - 0.5) * 3;
      parts.push(`L ${x + 40} ${y0 + n}`, `L ${x + 44} ${y0 - n}`, `L ${x + 70} ${y0 + n * 0.5}`);
      if (b % 6 === 3) parts.push(`L ${x + 74} ${y0 - amp * 0.18}`, `L ${x + 77} ${y0 + 4}`, `L ${x + 80} ${y0}`);
      parts.push(`L ${x + P} ${y0}`);
      continue;
    }
    const a = status === "DEGRADED" ? amp * (0.35 + r * 0.55) : amp;
    const off = status === "DEGRADED" ? Math.round((r - 0.5) * 18) : 0;
    parts.push(
      `L ${x + 28 + off} ${y0}`,
      `Q ${x + 34 + off} ${y0 - a * 0.14} ${x + 40 + off} ${y0}`,
      `L ${x + 47 + off} ${y0}`,
      `L ${x + 51 + off} ${y0 + a * 0.16}`,
      `L ${x + 55 + off} ${y0 - a}`,
      `L ${x + 60 + off} ${y0 + a * 0.38}`,
      `L ${x + 64 + off} ${y0}`,
      `L ${x + 73 + off} ${y0}`,
      `Q ${x + 81 + off} ${y0 - a * 0.24} ${x + 89 + off} ${y0}`,
      `L ${x + P} ${y0}`,
    );
  }
  return parts.join(" ");
}

/** Oscilloscope: crisp 1.5px trace over a dot-matrix graticule. No glow. */
export function HeartbeatScope({
  status,
  height = 150,
  seed = 1,
  label,
  className,
  thresholdLabel,
}: {
  status: ServiceStatus;
  height?: number;
  seed?: number;
  label?: string;
  className?: string;
  thresholdLabel?: string;
}) {
  const reduce = useReducedMotion();
  // all three traces are pre-built and cross-faded, so a status change dissolves
  // smoothly instead of snapping; the sweep speed stays constant (no restart jolt)
  const paths = useMemo(
    () => (["OPERATIONAL", "DEGRADED", "OUTAGE"] as const).map((s) => [s, buildPath(s, height, seed)] as const),
    [height, seed],
  );
  const speed = 3.6;

  return (
    <div className={cn("relative overflow-hidden rounded-[8px] border border-line bg-canvas", className)} style={{ height }}>
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.5]"
        style={{ backgroundImage: "radial-gradient(color-mix(in srgb, var(--ink) 16%, transparent) 0.8px, transparent 0.8px)", backgroundSize: "12px 12px" }}
      />
      <div aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-line" />
      <svg
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full [mask-image:linear-gradient(to_right,transparent,black_12%,black_92%,transparent)]"
        aria-hidden
      >
        {thresholdLabel && <line x1={0} x2={W} y1={height * 0.22} y2={height * 0.22} style={{ stroke: "color-mix(in srgb, var(--ink) 28%, transparent)" }} strokeDasharray="2 4" />}
        <motion.g
          initial={false}
          animate={reduce ? { x: 0 } : { x: [0, -W] }}
          transition={reduce ? { duration: 0 } : { duration: speed, ease: "linear", repeat: Infinity }}
        >
          {paths.map(([s, d]) => (
            <path
              key={s}
              d={d}
              fill="none"
              strokeWidth={1.5}
              strokeLinejoin="round"
              style={{ stroke: COLORS[s], opacity: s === status ? 1 : 0, transition: "opacity 800ms var(--ease)" }}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </motion.g>
      </svg>
      {!reduce && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          animate={{ x: ["0%", "100%"] }}
          transition={{ duration: 4.5, ease: "linear", repeat: Infinity }}
        >
          <div className="absolute inset-y-0 left-0 w-px bg-ink/25" />
        </motion.div>
      )}
      {label && <div className="label absolute left-3 top-2.5">{label}</div>}
      {thresholdLabel && (
        <div className="absolute right-3 font-mono text-[10px] text-slate" style={{ top: height * 0.22 - 16 }}>
          {thresholdLabel}
        </div>
      )}
    </div>
  );
}
