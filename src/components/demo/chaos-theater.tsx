"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { Check, Coins, Database, type LucideIcon, MoonStar, Radio, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useActions } from "@/hooks/use-actions";
import { useHydrated } from "@/hooks/use-hydrated";
import { JUDGE_WALLET, SANDBOX_SLA_ADDRESS, shortHex } from "@/lib/chain";
import { EASE, motionTokens } from "@/lib/motion";
import { formatBps, formatMinutes, formatUsdc, initialCreditUsdc, SEVERITY_LABEL, simulateOutage } from "@/lib/sla-engine";
import { contractUsdcHoldings, seatCapacity, useUpHeld, walletClaimable } from "@/lib/store";
import type { OutageIncident, ServicePlan } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ClaimCard, PaidWhileYouSlept, useUnlockEvent } from "../app/claim-card";
import { EventFeed } from "../app/event-feed";
import { UptimeGauge } from "../app/uptime-gauge";
import { ResetDemoButton } from "../layout/wallet-controls";
import { AnimatedBeam } from "../magicui/animated-beam";
import { NumberTicker } from "../magicui/number-ticker";
import { HeartbeatScope } from "../telemetry/heartbeat-scope";
import { ServiceMark } from "../telemetry/service-mark";
import { StatusBadge } from "../telemetry/status-badge";
import { UptimeStrip } from "../telemetry/uptime-strip";
import { Button } from "../ui/button";
import { PageShell, Panel, PanelBody, PanelFooter, PanelHeader, Section } from "../ui/card";

export interface ChaosPreset {
  minutes: number;
  /** recorded as the incident title; a leading "HH:MM UTC" is read back as the time it went down */
  title: string;
  short: string;
  icon: LucideIcon;
  /** small chip shown after the label */
  tag?: string;
}

/**
 * The first preset models a primary database failover from 03:12 UTC to 06:00 UTC,
 * which is 168 minutes (2h 48m).
 */
export const CHAOS_PRESETS: readonly ChaosPreset[] = [
  { minutes: 168, title: "03:12 UTC · Primary database failover", short: "2h 48m DB failover", icon: MoonStar, tag: "03:12 UTC" },
  { minutes: 35, title: "Regional CDN glitch", short: "35m CDN glitch", icon: Radio },
  { minutes: 480, title: "Storage cluster failover", short: "8h storage outage", icon: Database },
  { minutes: 1200, title: "Multi-region outage", short: "20h regional outage", icon: Zap },
];

/**
 * Preview of what the judge wallet would newly unlock. Uses the wallet's creditedCompensation
 * (or the joining credit if not subscribed yet), so a tier that was already paid previews as $0.
 */
function usePreview(svc: ServicePlan | undefined, minutes: number) {
  const sub = useUpHeld((s) => s.subscriptions.find((x) => x.serviceId === svc?.id && x.subscriberAddress === JUDGE_WALLET));
  const allSubs = useUpHeld((s) => s.subscriptions);
  return useMemo(() => {
    if (!svc) return null;
    const credited = sub
      ? sub.creditedCompensationUsdc ?? sub.accruedCompensationUsdc + sub.claimedCompensationUsdc
      : initialCreditUsdc(svc.monthlyPriceUsdc, svc.currentUptimeBps, svc.slaTargetBps, svc.compensationTiers);
    const sim = simulateOutage({
      totalDowntimeMinutes: svc.totalDowntimeMinutes,
      additionalDowntimeMinutes: minutes,
      monthlyPriceUsdc: svc.monthlyPriceUsdc,
      slaTargetBps: svc.slaTargetBps,
      tiers: svc.compensationTiers,
      reserveBalanceUsdc: svc.reserveBalanceUsdc,
      creditedUsdc: [credited],
    });
    // why a breach would unlock nothing for this wallet
    const soldOut = !sub && seatCapacity(svc, allSubs).seatsLeft === 0;
    const zeroReason: "soldout" | "unsubscribed" | "reserve" | "paid" | null = !sim.evaluation.breached
      ? null
      : soldOut
        ? "soldout"
        : !sub
          ? "unsubscribed"
        : sim.refundPerSubscriberUsdc > 0
          ? null
          : sim.tierRefundUsdc > credited
            ? "reserve"
            : "paid";
    return { ...sim, subscribed: !!sub, zeroReason };
  }, [svc, minutes, sub, allSubs]);
}

const ZERO_REASON_LABEL = { soldout: "sold out · reserve can't back a seat", unsubscribed: "not subscribed", reserve: "reserve too low", paid: "tier already paid" } as const;

/** Subscribe button that respects seat backing: a plan whose reserve can't back another seat shows Sold out. */
function SeatSubscribeButton({ svc, onSubscribe, className, ariaLabel }: { svc: ServicePlan; onSubscribe: () => void; className?: string; ariaLabel?: string }) {
  const allSubs = useUpHeld((s) => s.subscriptions);
  const cap = seatCapacity(svc, allSubs);
  const soldOut = cap.seatsLeft === 0;
  return (
    <Button
      size="sm"
      variant="primary"
      className={className}
      disabled={soldOut}
      onClick={onSubscribe}
      aria-label={soldOut ? `${svc.name} is sold out` : ariaLabel}
      title={soldOut ? "The provider's reserve cannot cover another subscriber" : `Sets aside ${formatUsdc(cap.coverPerSeatUsdc)} of the provider's reserve for this subscription`}
    >
      {soldOut ? "Sold out" : <>Subscribe {formatUsdc(svc.monthlyPriceUsdc, { decimals: 0 })}</>}
    </Button>
  );
}

/** Section title with its step number (01, 02, 03). */
function StepTitle({ idx, children }: { idx: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-2.5">
      <span className="font-pixel text-[14px] font-normal tracking-normal text-dim">{idx}</span>
      {children}
    </span>
  );
}

/* ================================================================== */
/* Progress stepper. Shows an incident report for a few seconds after */
/* each new incident, then returns to the steps.                      */
/* ================================================================== */

const STEP_HINTS = ["Choose a plan in the consumer view.", "Choose a preset in the simulator.", "The refund moves from the provider reserve to your vault.", "Transfer the refund to your wallet."];

function StatusIsland() {
  const subs = useUpHeld((s) => s.subscriptions);
  const incidents = useUpHeld((s) => s.incidents);
  const services = useUpHeld((s) => s.services);
  const [banner, setBanner] = useState<OutageIncident | null>(null);
  const lastId = useRef<string | null | undefined>(undefined);
  const hydrated = useHydrated();

  useEffect(() => {
    if (!hydrated) return;
    const top = incidents[0];
    // first run (including after rehydration): record the latest incident without showing it
    if (lastId.current === undefined) {
      lastId.current = top?.id ?? null;
      return;
    }
    if (!top) {
      lastId.current = null;
      setBanner(null);
      return;
    }
    if (top.id === lastId.current) return;
    lastId.current = top.id;
    setBanner(top);
  }, [incidents, hydrated]);

  const steps = [
    { label: "Subscribe", done: subs.length > 0 },
    { label: "Record outage", done: incidents.length > 0 },
    { label: "Refund unlocked", done: incidents.some((i) => i.totalCompensationTriggeredUsdc > 0) },
    { label: "Claim USDC", done: subs.some((s) => s.claimedCompensationUsdc > 0) },
  ];
  const current = steps.findIndex((s) => !s.done);
  const svc = banner ? services.find((s) => s.id === banner.serviceId) : undefined;
  const judgeUnlock = useUnlockEvent(banner?.txHash, JUDGE_WALLET);
  const judgePaid = judgeUnlock?.amountUsdc ?? 0;

  // banner timer, keyed on the incident shown so an unrelated store update cannot cancel it;
  // longer when the payout notice is showing
  const bannerMs = judgePaid > 0 ? 9000 : 6500;
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), bannerMs);
    return () => clearTimeout(t);
  }, [banner, bannerMs]);

  return (
    <LayoutGroup>
      <motion.div
        layout
        transition={motionTokens.spring}
        style={{ borderRadius: 12 }}
        className={cn("overflow-hidden bg-panel shadow-card", banner && svc && banner.slaBreached && "ring-1 ring-down/50")}
        role="status"
        aria-live="polite"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {banner && svc ? (
            <motion.div
              key={`b-${banner.id}`}
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
              className="px-5 py-5 sm:px-6 sm:py-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className={cn("label", banner.slaBreached ? "text-down" : "text-slate")}>
                  {banner.slaBreached ? `SLA breached · ${SEVERITY_LABEL[banner.severity]}` : "Incident recorded · within SLA"}
                </span>
                <span className="font-mono text-[12px] text-dim">Block #{banner.blockNumber.toLocaleString("en-US")}</span>
              </div>
              {judgePaid > 0 && <PaidWhileYouSlept serviceName={svc.name} incident={banner} amountUsdc={judgePaid} className="mt-4" />}
              <div className="mt-5 grid grid-cols-3 gap-4 sm:gap-8">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-slate">{svc.name}</div>
                  <NumberTicker
                    value={banner.newUptimeBps}
                    format={(v) => formatBps(Math.round(v))}
                    className={cn("mt-2 block truncate text-[18px] font-medium leading-none tracking-[-0.04em] sm:text-[26px]", banner.slaBreached ? "text-down" : "text-ink")}
                  />
                  <div className="mt-2 truncate font-mono text-[12px] text-dim">from {formatBps(banner.previousUptimeBps)}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-slate">Downtime</div>
                  <div className="mt-2 truncate font-mono text-[18px] font-medium leading-none tracking-[-0.04em] text-ink sm:text-[26px]">{formatMinutes(banner.downtimeMinutes)}</div>
                  <div className="mt-2 truncate font-mono text-[12px] text-dim">Σ {banner.totalDowntimeAfter} min</div>
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-slate">Unlocked</div>
                  <div className={cn("mt-2 truncate font-mono text-[18px] font-medium leading-none tracking-[-0.04em] sm:text-[26px]", banner.totalCompensationTriggeredUsdc > 0 ? "text-ink" : "text-dim")}>
                    {formatUsdc(banner.totalCompensationTriggeredUsdc)}
                  </div>
                  <div className="mt-2 truncate font-mono text-[12px] text-dim">
                    {banner.subscribersCompensated} subscriber{banner.subscribersCompensated === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
              {/* timeline for the four animation stages */}
              <div className="mt-6 grid grid-cols-4 gap-2 sm:gap-3">
                {["Service down", "SLA breached", "Reserve debited", "Claimable"].map((s, i) => (
                  <div key={s} className="min-w-0">
                    <div className="h-[3px] rounded-full bg-ink/10">
                      <motion.div
                        className={cn("h-full origin-left rounded-full", i < 2 ? "bg-down" : "bg-ink")}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: i >= 2 && banner.totalCompensationTriggeredUsdc === 0 ? 0 : 1 }}
                        transition={{ duration: 0.5, delay: [0, 0.25, 0.55, 0.95][i], ease: EASE }}
                      />
                    </div>
                    <div className="mt-2 truncate font-mono text-[11px] text-dim sm:text-[12px]">{s}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.ol
              key="steps"
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-2 gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-4"
              aria-label="Demo progress"
            >
              {steps.map((s, i) => {
                const isCurrent = i === current;
                return (
                  <li
                    key={s.label}
                    aria-current={isCurrent ? "step" : undefined}
                    className={cn(
                      "min-w-0 rounded-[10px] px-3 py-4 transition-colors sm:px-5",
                      isCurrent ? "bg-raised ring-1 ring-line-strong" : s.done ? "bg-subtle" : "",
                    )}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <span
                        className={cn(
                          "inline-flex size-7 shrink-0 items-center justify-center rounded-full border font-pixel text-[12px] transition-colors",
                          s.done ? "border-ink bg-ink text-ink-inverse" : isCurrent ? "border-ink text-ink" : "border-line-strong text-dim",
                        )}
                      >
                        {s.done ? <Check className="size-3.5" strokeWidth={2.25} aria-hidden /> : i + 1}
                      </span>
                      <span className={cn("min-w-0 truncate text-[14.5px] font-medium tracking-[-0.02em]", s.done || isCurrent ? "text-ink" : "text-dim")}>
                        {s.label}
                        {s.done && <span className="sr-only"> (done)</span>}
                      </span>
                    </div>
                    <p className={cn("mt-2.5 hidden text-[13px] leading-[1.5] sm:block", isCurrent ? "text-slate" : "text-dim")}>{STEP_HINTS[i]}</p>
                  </li>
                );
              })}
            </motion.ol>
          )}
        </AnimatePresence>
      </motion.div>
    </LayoutGroup>
  );
}

/* ================================================================== */
/* 01 · Consumer                                                       */
/* ================================================================== */

function ConsumerColumn() {
  const services = useUpHeld((s) => s.services);
  const allSubs = useUpHeld((s) => s.subscriptions);
  const subs = useMemo(() => allSubs.filter((x) => x.subscriberAddress === JUDGE_WALLET), [allSubs]);
  const balance = useUpHeld((s) => s.balances[JUDGE_WALLET] ?? 0);
  const claimable = useUpHeld((s) => walletClaimable(s));
  const { mint, subscribe } = useActions();
  const anyClaimActivity = subs.some((s) => s.accruedCompensationUsdc > 0 || s.claimedCompensationUsdc > 0);

  return (
    <Section id="demo-consumer" title={<StepTitle idx="01">Consumer view</StepTitle>} description="Sandbox wallet, plans and refunds.">
      <div className="flex flex-col gap-6">
        <Panel>
          <PanelHeader title="Judge Sandbox wallet" right={<span className="font-mono text-[12px] text-dim">{shortHex(JUDGE_WALLET)}</span>} />
          <PanelBody className="space-y-5">
            <div className="flex items-baseline gap-2">
              <NumberTicker value={balance} format={(v) => formatUsdc(Math.round(v))} className="text-[40px] font-medium leading-none tracking-[-0.05em] text-ink" />
              <span className="font-mono text-[12px] text-dim">USDC</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-[8px] bg-subtle px-4 py-3">
              <span className="text-[13px] font-medium text-slate">Unlocked compensation</span>
              <NumberTicker value={claimable} format={(v) => formatUsdc(Math.round(v))} className={cn("text-[15px]", claimable > 0 ? "text-ink" : "text-slate")} />
            </div>
          </PanelBody>
          <PanelFooter hint="Mints testnet USDC to the sandbox wallet.">
            <Button size="sm" variant="outline" onClick={() => mint()}>
              <Coins /> Mint +100
            </Button>
          </PanelFooter>
        </Panel>

        <Panel>
          <PanelHeader title="Plans" description="Only active subscribers receive refunds." />
          <ul>
            {services.map((svc) => {
              const sub = subs.find((s) => s.serviceId === svc.id);
              return (
                <li key={svc.id} className="flex items-center gap-3.5 border-t border-line px-5 py-4 first:border-t-0 sm:px-6">
                  <ServiceMark category={svc.category} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] font-medium tracking-[-0.02em] text-ink">{svc.name}</div>
                    <div className="mt-0.5 truncate font-mono text-[12px] text-dim">
                      {formatUsdc(svc.monthlyPriceUsdc)}/mo · SLA {formatBps(svc.slaTargetBps)}
                    </div>
                  </div>
                  {sub ? (
                    <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-3 font-mono text-[12px] text-ink">
                      <Check className="size-3.5" /> Active
                    </span>
                  ) : (
                    <SeatSubscribeButton
                      svc={svc}
                      className="shrink-0"
                      onSubscribe={() => subscribe(svc.id)}
                      ariaLabel={`Subscribe to ${svc.name} for ${formatUsdc(svc.monthlyPriceUsdc)} USDC`}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel>
          <PanelHeader title="Compensation" description="Refunds from SLA breaches appear here." />
          <PanelBody className="space-y-3">
            {subs.map((s) => (
              <ClaimCard key={s.id} sub={s} />
            ))}
            {!anyClaimActivity && (
              <p className="rounded-[8px] border border-dashed border-line-strong px-4 py-4 text-[13.5px] leading-[1.55] text-slate">
                {subs.length === 0
                  ? "No subscriptions yet. Subscribe to a plan to be eligible for refunds."
                  : "No refunds yet. Record an outage in the simulator to take a service below its SLA."}
              </p>
            )}
          </PanelBody>
        </Panel>
      </div>
    </Section>
  );
}

/* ================================================================== */
/* 02 · Chaos                                                          */
/* ================================================================== */

function PresetRow({ svc, preset, onInject }: { svc: ServicePlan; preset: (typeof CHAOS_PRESETS)[number]; onInject: () => void }) {
  const p = usePreview(svc, preset.minutes);
  const Icon = preset.icon;
  const breached = p?.evaluation.breached;
  return (
    <button
      type="button"
      onClick={onInject}
      title={preset.title}
      className="group flex w-full items-center gap-4 border-t border-line px-5 py-4 text-left transition-colors first:border-t-0 hover:bg-hover active:scale-[0.995] sm:px-6"
    >
      <span
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-[8px] border transition-colors",
          breached ? "border-down/40 text-down group-hover:border-down" : "border-line-strong text-slate group-hover:border-ink/40",
        )}
      >
        <Icon className="size-[16px]" strokeWidth={1.6} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-[14.5px] font-medium tracking-[-0.02em] text-ink">
            {/* "Record" is hidden on phones to leave room for the label and its chip */}
            <span className="sr-only sm:not-sr-only">Record </span>
            {preset.short}
          </span>
          {preset.tag && (
            <span className="shrink-0 rounded-full border border-line-strong px-2 py-px font-mono text-[11px] leading-[1.5] text-slate">{preset.tag}</span>
          )}
        </span>
        {p && (
          <span className="mt-0.5 block truncate font-mono text-[12px] text-dim">
            → {formatBps(p.newUptimeBps)} ·{" "}
            {!breached
              ? "within SLA · no refund"
              : p.zeroReason === "unsubscribed"
                ? `${SEVERITY_LABEL[p.evaluation.severity]} · +${formatUsdc(p.refundPerSubscriberUsdc)} if subscribed`
                : p.zeroReason
                  ? `${SEVERITY_LABEL[p.evaluation.severity]} · ${ZERO_REASON_LABEL[p.zeroReason]}`
                  : `${SEVERITY_LABEL[p.evaluation.severity]} → +${formatUsdc(p.refundPerSubscriberUsdc)}`}
          </span>
        )}
      </span>
      <Zap className="size-4 shrink-0 text-dim transition-[transform,color] group-hover:translate-x-[3px] group-hover:text-ink" />
    </button>
  );
}

function ChaosColumn({ selectedId, setSelectedId }: { selectedId: string; setSelectedId: (id: string) => void }) {
  const services = useUpHeld((s) => s.services);
  const svc = services.find((s) => s.id === selectedId) ?? services[0];
  const subCount = useUpHeld((s) => s.subscriptions.filter((x) => x.serviceId === svc?.id).length);
  const judgeSubscribed = useUpHeld((s) => s.subscriptions.some((x) => x.serviceId === svc?.id && x.subscriberAddress === JUDGE_WALLET));
  const [custom, setCustom] = useState(240);
  const preview = usePreview(svc, custom);
  const { inject, subscribe } = useActions();
  if (!svc) return null;

  return (
    <Section id="demo-chaos" title={<StepTitle idx="02">Outage simulator</StepTitle>} description="Choose a service and record an outage against it.">
      <div className="flex flex-col gap-6">
        <Panel>
          <div className="scroll-thin relative flex gap-1.5 overflow-x-auto border-b border-line px-5 py-3 sm:px-6" role="tablist" aria-label="Select service">
            {services.map((s) => (
              <button
                key={s.id}
                role="tab"
                type="button"
                aria-selected={s.id === svc.id}
                onClick={() => setSelectedId(s.id)}
                className={cn(
                  "relative inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] transition-colors",
                  s.id === svc.id ? "text-ink" : "text-slate hover:text-ink",
                )}
              >
                {s.id === svc.id && <motion.span layoutId="svc-tab" className="absolute inset-0 rounded-full border border-line-strong bg-raised" transition={motionTokens.spring} />}
                <span className={cn("relative size-1.5", s.status === "OPERATIONAL" ? "bg-ink" : s.status === "DEGRADED" ? "bg-warn" : "bg-down")} />
                <span className="relative">{s.name}</span>
              </button>
            ))}
          </div>
          <PanelBody className="space-y-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <ServiceMark category={svc.category} />
                <div className="min-w-0">
                  <div className="truncate text-[16px] font-semibold tracking-[-0.02em] text-ink">{svc.name}</div>
                  <div className="mt-0.5 truncate font-mono text-[12px] text-dim">{svc.endpointUrl.replace(/^https?:\/\//, "") || "no endpoint"}</div>
                </div>
              </div>
              <StatusBadge status={svc.status} />
            </div>
            <HeartbeatScope status={svc.status} seed={svc.onChainId} label="Heartbeat · 1s probe" height={140} />
            <UptimeGauge service={svc} />
            <UptimeStrip bars={svc.heartbeatHistory} height={30} />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Record an outage"
            description="Each preset shows the resulting uptime and refund."
            right={
              <span className="whitespace-nowrap font-mono text-[12px] text-dim">
                {subCount} subscriber{subCount === 1 ? "" : "s"} covered
              </span>
            }
          />
          <AnimatePresence initial={false}>
            {!judgeSubscribed && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.5, ease: EASE }} className="overflow-hidden">
                <div className="px-5 pt-5 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-dashed border-warn/40 px-4 py-3 text-[13.5px] text-slate">
                    <span className="min-w-0">Not subscribed to {svc.name}. Subscribe to receive a refund.</span>
                    <SeatSubscribeButton svc={svc} onSubscribe={() => subscribe(svc.id)} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className={cn(!judgeSubscribed && "mt-2")}>
            <div className="label px-5 pb-1 pt-4 sm:px-6">Presets</div>
            {CHAOS_PRESETS.map((p) => (
              <PresetRow key={p.minutes} svc={svc} preset={p} onInject={() => inject(svc.id, p.minutes, p.title)} />
            ))}
          </div>

          <PanelBody className="space-y-5 border-t border-line">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="custom-down" className="text-[14px] font-medium text-ink">
                Custom downtime
              </label>
              <span className="font-mono text-[13px] text-ink tabular">
                {custom.toLocaleString("en-US")} min <span className="text-dim">· {formatMinutes(custom)}</span>
              </span>
            </div>
            <input
              id="custom-down"
              type="range"
              min={1}
              max={2500}
              step={1}
              value={custom}
              onChange={(e) => setCustom(Number(e.target.value))}
              className="range w-full"
              style={{ ["--range-pct" as string]: `${((custom - 1) / 2499) * 100}%`, ["--range-fill" as string]: preview?.evaluation.breached ? "var(--down)" : "var(--ink)" }}
            />
            {preview && (
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    ["Uptime after", formatBps(preview.newUptimeBps), preview.evaluation.breached ? "text-down" : "text-ink"],
                    ["Tier", preview.evaluation.breached ? `${preview.evaluation.refundBps / 100}% refund` : "none", preview.evaluation.breached ? "text-down" : "text-ink"],
                    ["Your refund", preview.zeroReason === "unsubscribed" ? "$0.00 · not subscribed" : preview.zeroReason === "soldout" ? "sold out" : preview.zeroReason ? ZERO_REASON_LABEL[preview.zeroReason] : formatUsdc(preview.refundPerSubscriberUsdc), "text-ink"],
                  ] as const
                ).map(([k, v, c]) => (
                  <div key={k} className="min-w-0 rounded-[8px] bg-subtle px-3 py-3 sm:px-4">
                    <div className="truncate text-[12px] text-slate">{k}</div>
                    <div className={cn("mt-1 truncate font-mono text-[13.5px] tabular", c)}>{v}</div>
                  </div>
                ))}
              </div>
            )}
          </PanelBody>
          <PanelFooter hint={`Adds ${formatMinutes(custom)} to ${svc.name}'s 30-day window.`}>
            <Button variant="danger" className="w-full sm:w-auto" onClick={() => inject(svc.id, custom, `Custom incident (${formatMinutes(custom)})`)}>
              <Zap /> Record {formatMinutes(custom)} outage on {svc.name}
            </Button>
          </PanelFooter>
        </Panel>
      </div>
    </Section>
  );
}

/* ================================================================== */
/* 03 · Ledger                                                         */
/* ================================================================== */

function LedgerNode({
  refEl,
  label,
  sub,
  value,
  state,
}: {
  refEl: React.RefObject<HTMLDivElement | null>;
  label: string;
  sub?: string;
  value: number;
  state: "idle" | "lit" | "drain";
}) {
  return (
    <div
      ref={refEl}
      className={cn(
        "relative z-10 rounded-[10px] border bg-canvas px-4 py-4 transition-colors duration-500",
        state === "lit" ? "border-ink" : state === "drain" ? "border-ink/30" : "border-line-strong",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={cn("text-[13px] font-medium", state === "lit" ? "text-ink" : "text-slate")}>{label}</span>
        {sub && <span className="truncate font-mono text-[11.5px] text-dim">{sub}</span>}
      </div>
      <NumberTicker value={value} format={(v) => formatUsdc(Math.round(v))} className="mt-2.5 block text-[26px] font-medium leading-none tracking-[-0.04em] text-ink" />
    </div>
  );
}

function LedgerColumn({ selectedId }: { selectedId: string }) {
  const svc = useUpHeld((s) => s.services.find((x) => x.id === selectedId) ?? s.services[0]);
  const holdings = useUpHeld((s) => contractUsdcHoldings(s));
  const sub = useUpHeld((s) => s.subscriptions.find((x) => x.serviceId === svc?.id && x.subscriberAddress === JUDGE_WALLET));
  const claimableAll = useUpHeld((s) => walletClaimable(s));
  const balance = useUpHeld((s) => s.balances[JUDGE_WALLET] ?? 0);
  const flowPulse = useUpHeld((s) => s.flowPulse);
  const lastFlow = useUpHeld((s) => s.lastFlow);
  const reduce = useReducedMotion();
  const container = useRef<HTMLDivElement>(null);
  const reserveRef = useRef<HTMLDivElement>(null);
  const vaultRef = useRef<HTMLDivElement>(null);
  const walletRef = useRef<HTMLDivElement>(null);
  if (!svc) return null;

  const unlockKey = lastFlow?.kind === "unlock" ? flowPulse : 0;
  const claimKey = lastFlow?.kind === "claim" ? flowPulse : 0;
  const vaultHas = (sub?.accruedCompensationUsdc ?? 0) > 0;

  return (
    <Section id="demo-ledger" title={<StepTitle idx="03">Reserve ledger</StepTitle>} description="USDC held by the SLA contract.">
      <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-1">
        <Panel className="flex flex-col">
          <PanelHeader
            kicker="UpHealthSLA.sol"
            title="Reserve → vault → wallet"
            description={
              <>
                Escrowed (reserves + claimable): <NumberTicker value={holdings} format={(v) => formatUsdc(Math.round(v))} className="text-ink" />
              </>
            }
            right={
              <span className="font-mono text-[12px] text-dim" title={SANDBOX_SLA_ADDRESS}>
                {shortHex(SANDBOX_SLA_ADDRESS)}
              </span>
            }
          />
          <PanelBody className="flex-1">
            <div ref={container} className="relative flex flex-col gap-10">
              <LedgerNode refEl={reserveRef} label="Provider reserve" sub={svc.name} value={svc.reserveBalanceUsdc} state={lastFlow?.kind === "unlock" ? "drain" : "idle"} />
              <LedgerNode refEl={vaultRef} label="Claimable vault" sub="claimableCompensation[you]" value={sub?.accruedCompensationUsdc ?? 0} state={vaultHas ? "lit" : "idle"} />
              <LedgerNode refEl={walletRef} label="Subscriber wallet" value={balance} state={lastFlow?.kind === "claim" ? "lit" : "idle"} />
              <AnimatedBeam containerRef={container} fromRef={reserveRef} toRef={vaultRef} vertical pulseKey={unlockKey} duration={0.6} delay={0.55} />
              <AnimatedBeam containerRef={container} fromRef={vaultRef} toRef={walletRef} vertical pulseKey={claimKey} duration={0.6} />
            </div>
          </PanelBody>
          <PanelFooter
            hint={
              <span className="font-mono text-[12px]">
                Paid out {formatUsdc(svc.totalPaidOutUsdc)} · all vaults {formatUsdc(claimableAll)} · sandbox
              </span>
            }
          >
            <AnimatePresence mode="wait">
              {lastFlow && !reduce && (
                <motion.span
                  key={flowPulse}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.55, ease: EASE, delay: lastFlow.kind === "unlock" ? 0.55 : 0 }}
                  className="font-mono text-[12px] text-ink"
                >
                  {lastFlow.kind === "unlock" ? "reserve → vault" : "vault → wallet"} +{formatUsdc(lastFlow.amountUsdc)}
                </motion.span>
              )}
            </AnimatePresence>
          </PanelFooter>
        </Panel>

        <Panel className="flex min-h-0 flex-col">
          <PanelHeader title="Event log" description="Contract events and outage attestations, newest first." />
          <EventFeed className="max-h-[520px] min-h-0 flex-1" limit={40} />
        </Panel>
      </div>
    </Section>
  );
}

/* ================================================================== */

const TABS = [
  { key: "consumer", label: "01 Consumer" },
  { key: "chaos", label: "02 Chaos" },
  { key: "ledger", label: "03 Ledger" },
] as const;

export function ChaosTheater() {
  const [selectedId, setSelectedId] = useState("svc_cloudbox");
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("consumer");
  const claimable = useUpHeld((s) => walletClaimable(s));

  return (
    <PageShell
      wide
      kicker="Interactive demo · Judge Sandbox"
      title="Chaos Theater"
      description={
        <>
          Subscribe to a plan, record an outage, and claim the refund from the provider’s reserve. Amounts use the same integer math as the{" "}
          <span className="font-mono text-ink">UpHealthSLA</span> contract.
        </>
      }
      actions={<ResetDemoButton className="border border-line-strong" />}
    >
      <Section id="demo-steps" title="Steps">
        <StatusIsland />
      </Section>

      <div className="space-y-6">
        {/* mobile segmented tabs */}
        <div className="sticky top-[98px] z-30 -mx-4 border-y border-line bg-canvas px-4 py-2.5 sm:-mx-6 sm:px-6 md:hidden">
          <div className="grid grid-cols-3 gap-1.5" role="tablist" aria-label="Demo panels">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={cn("relative rounded-full py-2 font-mono text-[12px]", tab === t.key ? "text-ink" : "text-dim")}
              >
                {tab === t.key && <motion.span layoutId="demo-tab" className="absolute inset-0 rounded-full border border-line-strong bg-raised" transition={motionTokens.spring} />}
                <span className="relative">{t.label}</span>
                {t.key === "consumer" && claimable > 0 && <span className="absolute right-3 top-2 size-1.5 bg-ink" aria-label="Refund ready to claim" />}
              </button>
            ))}
          </div>
        </div>

        {/*
          < md: one panel at a time (tabs above) · md: stacked full width
          lg: consumer (380px) | simulator, ledger full width below
          2xl: consumer (400px) | simulator | ledger (420px)
        */}
        <div className="grid items-start gap-x-6 gap-y-12 lg:grid-cols-[380px_minmax(0,1fr)] 2xl:grid-cols-[400px_minmax(0,1fr)_420px]">
          <div className={cn("min-w-0", tab !== "consumer" && "hidden md:block")}>
            <ConsumerColumn />
          </div>
          <div className={cn("min-w-0", tab !== "chaos" && "hidden md:block")}>
            <ChaosColumn selectedId={selectedId} setSelectedId={setSelectedId} />
          </div>
          <div className={cn("min-w-0 lg:col-span-2 2xl:col-span-1", tab !== "ledger" && "hidden md:block")}>
            <LedgerColumn selectedId={selectedId} />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
