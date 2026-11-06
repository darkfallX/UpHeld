"use client";

import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useEffect, useRef, useState } from "react";
import { motionTokens } from "@/lib/motion";
import { DEFAULT_TIERS } from "@/lib/seed";
import { calculateSubscriberRefundUsdc, calculateUptimeBps, evaluateSlaBreach, formatBps, formatUsdc, usdc } from "@/lib/sla-engine";
import { cn } from "@/lib/utils";
import { AnimatedBeam } from "../magicui/animated-beam";
import { NumberTicker } from "../magicui/number-ticker";
import { HeartbeatScope } from "../telemetry/heartbeat-scope";
import { SeverityBadge, StatusBadge } from "../telemetry/status-badge";

const PRICE = usdc(10);
const SLA = 9995;
const RESERVE = usdc(5000);

/** Landing example: toggles a CloudBox outage and shows the resulting refund. Local state only. */
export function PayoutSpecimen() {
  const [down, setDown] = useState(false);
  const reduce = useReducedMotion();
  const [pulse, setPulse] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const a = useRef<HTMLDivElement>(null);
  const b = useRef<HTMLDivElement>(null);

  const minutes = down ? 518 : 4;
  const uptime = calculateUptimeBps(minutes);
  const ev = evaluateSlaBreach(uptime, SLA, DEFAULT_TIERS);
  const refund = calculateSubscriberRefundUsdc(PRICE, ev.refundBps);

  useEffect(() => {
    if (down) setPulse((p) => p + 1);
  }, [down]);

  return (
    <div className="relative rounded-[12px] bg-panel shadow-raised">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <div className="label">Example · outage refund</div>
          <div className="mt-1 text-[15px] font-medium tracking-[-0.02em]">
            CloudBox <span className="font-mono text-[11px] font-normal text-dim">$10/mo · SLA 99.95%</span>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={down}
          aria-label="Simulate outage"
          onClick={() => setDown((d) => !d)}
          className={cn(
            "group inline-flex h-8 shrink-0 items-center gap-2.5 rounded-full border pl-1 pr-3 font-mono text-[10.5px] transition-colors",
            down ? "border-down/60 text-down" : "border-line-strong text-slate hover:border-ink/40 hover:text-ink",
          )}
        >
          <span className={cn("relative h-6 w-10 rounded-full border transition-colors", down ? "border-down bg-down/15" : "border-line-strong bg-canvas")}>
            <motion.span
              className={cn("absolute top-[3px] size-4 rounded-full", down ? "bg-down" : "bg-ink")}
              initial={false}
              animate={{ x: down ? 18 : 3 }}
              transition={motionTokens.spring}
            />
          </span>
          {down ? "Outage on" : "Simulate outage"}
        </button>
      </div>

      <div className="p-4">
        <HeartbeatScope status={down ? "OUTAGE" : "OPERATIONAL"} height={112} seed={7} thresholdLabel="SLA 99.95%" />

        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="label">Rolling uptime</div>
            <NumberTicker
              value={uptime}
              format={(v) => formatBps(Math.round(v))}
              className={cn("mt-1.5 block text-[44px] font-medium leading-none tracking-[-0.05em] transition-colors", down ? "text-down" : "text-ink")}
            />
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <StatusBadge status={down ? "OUTAGE" : "OPERATIONAL"} />
            <SeverityBadge severity={ev.severity} />
          </div>
        </div>

        <div ref={container} className="relative mt-5 grid grid-cols-2 gap-10">
          <div ref={a} className="relative z-10 rounded-[8px] border border-line-strong bg-canvas p-3">
            <div className="label">Provider reserve</div>
            <NumberTicker value={down ? RESERVE - refund : RESERVE} format={(v) => formatUsdc(Math.round(v))} className="mt-1.5 block text-[18px] font-medium tracking-[-0.03em] text-ink sm:text-[20px]" />
          </div>
          <div ref={b} className={cn("relative z-10 rounded-[8px] border p-3 transition-colors duration-500", down ? "border-ink bg-ink/[0.08]" : "border-line-strong bg-canvas")}>
            <div className={cn("label", down && "text-ink")}>Your refund</div>
            <NumberTicker value={down ? refund : 0} format={(v) => formatUsdc(Math.round(v))} className="mt-1.5 block text-[18px] font-medium tracking-[-0.03em] text-ink sm:text-[20px]" />
          </div>
          <AnimatedBeam containerRef={container} fromRef={a} toRef={b} pulseKey={down ? pulse : 0} idle={down && !reduce} duration={1.1} />
        </div>
      </div>
      <div className="border-t border-line px-4 py-3 font-mono text-[11px] leading-relaxed text-dim">
        {down
          ? `518 min down → ${uptime} bps < ${SLA} → tier 2 → (10,000,000 × 2,500) / 10,000 = ${formatUsdc(refund)} USDC`
          : "4 min down → 9999 bps ≥ 9995 → within SLA → no refund due"}
      </div>
    </div>
  );
}
