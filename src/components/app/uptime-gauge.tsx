"use client";

import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { EASE } from "@/lib/motion";
import { evaluateSlaBreach, formatBps } from "@/lib/sla-engine";
import type { ServicePlan } from "@/lib/types";
import { cn } from "@/lib/utils";
import { NumberTicker } from "../magicui/number-ticker";
import { SeverityBadge } from "../telemetry/status-badge";

const MIN = 9600; // gauge floor 96.00%
const pos = (bps: number) => Math.max(0, Math.min(1, (bps - MIN) / (10000 - MIN))) * 100;

/** Oversized tabular readout + hairline gauge. The SLA marker trips (blinks) on breach. */
export function UptimeGauge({ service, size = "lg" }: { service: ServicePlan; size?: "lg" | "md" }) {
  const reduce = useReducedMotion();
  const ev = evaluateSlaBreach(service.currentUptimeBps, service.slaTargetBps, service.compensationTiers);
  const fill = ev.breached ? "var(--down)" : "var(--ink)";
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <div className="label">Rolling 30-day uptime</div>
          <NumberTicker
            value={service.currentUptimeBps}
            format={(v) => formatBps(Math.round(v))}
            className={cn(
              "mt-2 block font-medium leading-none tracking-[-0.05em] transition-colors duration-500",
              size === "lg" ? "text-[52px] sm:text-[64px]" : "text-[30px]",
              ev.breached ? "text-down" : "text-ink",
            )}
          />
          <div className="mt-3 font-mono text-[12px] text-dim">
            {service.currentUptimeBps} bps · {service.totalDowntimeMinutes.toLocaleString("en-US")} / 43,200 min down
          </div>
        </div>
        <div className="text-right">
          <div className="label">Guaranteed</div>
          <div className="mt-2 font-mono text-[20px] tracking-[-0.03em] text-ink">{formatBps(service.slaTargetBps)}</div>
          <SeverityBadge severity={ev.severity} className="mt-2.5" />
        </div>
      </div>
      <div className="relative mt-7 h-[6px] bg-ink/[0.06]">
        {/* tier floor ticks */}
        {[9800, 9900].map((b) => (
          <span key={b} className="absolute -top-1 h-[14px] w-px bg-ink/20" style={{ left: `${pos(b)}%` }} />
        ))}
        <motion.div
          className="absolute inset-y-0 left-0 origin-left"
          style={{ width: "100%", backgroundColor: fill, transition: "background-color 700ms var(--ease)" }}
          initial={false}
          animate={{ scaleX: pos(service.currentUptimeBps) / 100 }}
          transition={{ duration: reduce ? 0 : 0.8, ease: EASE, delay: reduce ? 0 : 0.1 }}
        />
        <motion.div
          key={`${service.id}-${ev.severity}`}
          className={cn("absolute -top-2.5 h-[26px] w-[2px]", ev.breached ? "bg-down" : "bg-ink")}
          style={{ left: `${pos(service.slaTargetBps)}%` }}
          initial={{ opacity: 1 }}
          animate={ev.breached && !reduce ? { opacity: [1, 0.15, 1, 0.15, 1] } : { opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.25 }}
          aria-hidden
        />
      </div>
      <div className="relative mt-3 h-4 font-mono text-[11px] text-dim">
        <span className="absolute left-0">96%</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${pos(9800)}%` }}>98 · T3</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${pos(9900)}%` }}>99 · T2</span>
        <span className="absolute right-0">100%</span>
      </div>
    </div>
  );
}
