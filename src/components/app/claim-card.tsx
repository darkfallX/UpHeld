"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { ArrowRight, Check, MoonStar } from "lucide-react";
import { useActions } from "@/hooks/use-actions";
import { shortHex } from "@/lib/chain";
import { EASE, motionTokens } from "@/lib/motion";
import { formatBps, formatMinutes, formatUsdc } from "@/lib/sla-engine";
import { useUpHeld } from "@/lib/store";
import type { Address, ChainEvent, Hex, OutageIncident, Subscription } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

/** "03:12" when an incident title starts with a UTC clock time (the night-shift preset), else null. */
export function incidentClock(title: string): string | null {
  const m = /^(\d{2}:\d{2}) UTC\b/.exec(title);
  return m ? m[1] : null;
}

/** The CompensationUnlocked event a given outage tx paid to one subscriber (newest events come first). */
export function useUnlockEvent(txHash: Hex | undefined, subscriber: Address): ChainEvent | undefined {
  return useUpHeld((s) => (txHash ? s.events.find((e) => e.type === "CompensationUnlocked" && e.txHash === txHash && e.actor === subscriber) : undefined));
}

/**
 * Payout notice: the service, the incident that paid and the exact amount moved into the vault.
 * For an incident titled "03:12 UTC · ..." it shows the time the service went down.
 */
export function PaidWhileYouSlept({
  serviceName,
  incident,
  amountUsdc,
  className,
}: {
  serviceName: string;
  incident?: OutageIncident;
  amountUsdc: number;
  className?: string;
}) {
  const clock = incident ? incidentClock(incident.title) : null;
  return (
    <div className={cn("flex min-w-0 items-start gap-3", className)}>
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[8px] border border-line-strong text-ink">
        <MoonStar className="size-4" strokeWidth={1.6} aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="text-[14.5px] font-medium tracking-[-0.02em] text-ink">Paid while you slept</div>
        <p className="mt-0.5 text-[13px] leading-[1.55] text-slate">
          {clock ? (
            <>
              {serviceName} was down from <span className="font-mono text-ink">{clock} UTC</span>.{" "}
            </>
          ) : incident ? (
            <>
              {serviceName} was down for <span className="font-mono text-ink">{formatMinutes(incident.downtimeMinutes)}</span>.{" "}
            </>
          ) : null}
          <span className="font-mono text-ink">{formatUsdc(amountUsdc)}</span> is ready to claim.
        </p>
      </div>
    </div>
  );
}

/**
 * Claim card with the breach breakdown. After a claim it collapses into a "claimed" row.
 */
export function ClaimCard({ sub }: { sub: Subscription }) {
  const svc = useUpHeld((s) => s.services.find((x) => x.id === sub.serviceId));
  const incident = useUpHeld((s) => s.incidents.find((i) => i.serviceId === sub.serviceId && i.slaBreached));
  // the most recent outage that actually paid this seat (a later breach at an already-paid tier pays nothing)
  const lastUnlock = useUpHeld((s) => s.events.find((e) => e.type === "CompensationUnlocked" && e.serviceId === sub.serviceId && e.actor === sub.subscriberAddress));
  const paidIncident = useUpHeld((s) => (lastUnlock ? s.incidents.find((i) => i.txHash === lastUnlock.txHash) : undefined));
  const { claim } = useActions();
  const reduce = useReducedMotion();
  if (!svc) return null;
  const ready = sub.accruedCompensationUsdc > 0;
  if (!ready && sub.claimedCompensationUsdc <= 0) return null;
  const sleptAmount = Math.min(lastUnlock?.amountUsdc ?? sub.accruedCompensationUsdc, sub.accruedCompensationUsdc);

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {ready ? (
        <motion.div
          key="ready"
          layout
          initial={{ opacity: 0, y: reduce ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scaleY: reduce ? 1 : 0.4, transition: { duration: 0.5, ease: EASE } }}
          transition={motionTokens.spring}
          whileTap={{ scale: 0.98 }}
          className="relative origin-top overflow-hidden rounded-[10px] border border-ink/60 bg-ink/[0.06]"
        >
          <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-ink" />
          <div className="space-y-4 p-5 pl-6">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="label text-ink">Compensation unlocked</span>
              <span className="font-mono text-[11px] text-dim">tx {shortHex(sub.lastTxHash, 6, 4)}</span>
            </div>
            <div className="font-mono text-[30px] font-medium leading-none tracking-[-0.04em] text-ink">{formatUsdc(sub.accruedCompensationUsdc)}</div>
            {sleptAmount > 0 && <PaidWhileYouSlept serviceName={svc.name} incident={paidIncident} amountUsdc={sleptAmount} />}
            {incident && (
              <p className="text-[13px] leading-[1.6] text-slate">
                {svc.name} uptime <span className="font-mono text-ink">{formatBps(svc.currentUptimeBps)}</span> against a{" "}
                <span className="font-mono text-ink">{formatBps(svc.slaTargetBps)}</span> guarantee. Refund tier:{" "}
                <span className="font-mono text-ink">{incident.refundPercentageBps / 100}%</span> of {formatUsdc(svc.monthlyPriceUsdc)}.
              </p>
            )}
            <Button variant="primary" size="md" className="w-full" onClick={() => claim(sub.serviceId)}>
              Claim {formatUsdc(sub.accruedCompensationUsdc)} USDC <ArrowRight />
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="claimed"
          layout
          initial={{ opacity: 0, y: reduce ? 0 : -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: EASE, delay: reduce ? 0 : 0.15 }}
          className="flex items-center gap-2.5 rounded-[10px] border border-dashed border-line-strong px-4 py-3 font-mono text-[12px] text-slate"
        >
          <Check className="size-3.5 shrink-0 text-ink" />
          <span className="min-w-0 truncate text-ink">{svc.name}</span>
          <span className="ml-auto shrink-0">{formatUsdc(sub.claimedCompensationUsdc)} claimed</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
