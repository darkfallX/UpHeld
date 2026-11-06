"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { ArrowRight, Check, Coins, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useActions } from "@/hooks/use-actions";
import { JUDGE_WALLET, shortHex } from "@/lib/chain";
import { EASE, motionTokens } from "@/lib/motion";
import { allowedDowntimeMinutes, calculateSubscriberRefundUsdc, evaluateSlaBreach, formatBps, formatUsdc } from "@/lib/sla-engine";
import { seatCapacity, useUpHeld, walletClaimable } from "@/lib/store";
import { SERVICE_CATEGORIES, type ServiceCategory, type ServicePlan } from "@/lib/types";
import { cn } from "@/lib/utils";
import { NumberTicker } from "../magicui/number-ticker";
import { ServiceMark } from "../telemetry/service-mark";
import { SeverityBadge, StatusBadge } from "../telemetry/status-badge";
import { UptimeStrip } from "../telemetry/uptime-strip";
import { Button, buttonVariants } from "../ui/button";
import { PageShell, Panel, Section, Stat, StatGrid } from "../ui/card";
import { Spotlight } from "../ui/spotlight";
import { ClaimCard } from "./claim-card";

/** Shared footer strip for both faces of the flip card (Vercel card-footer pattern). */
const FACE_FOOTER = "mt-auto flex items-center gap-3 rounded-b-[12px] border-t border-line bg-subtle px-5 py-4 sm:px-6";

/**
 * Marketplace card. The Terms button flips the card to show the on-chain
 * SLA terms on the back. Both faces share one grid cell so they render at
 * the same height.
 */
function ServiceCard({ svc, subscribed }: { svc: ServicePlan; subscribed: boolean }) {
  const { subscribe } = useActions();
  const reduce = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const ev = evaluateSlaBreach(svc.currentUptimeBps, svc.slaTargetBps, svc.compensationTiers);
  const t = svc.compensationTiers;
  const severe = calculateSubscriberRefundUsdc(svc.monthlyPriceUsdc, t.severeBreachRefundBps);
  const allSubs = useUpHeld((s) => s.subscriptions);
  const cap = seatCapacity(svc, allSubs);
  const soldOut = cap.seatsLeft === 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.65, ease: EASE }}
      className="flip-scene min-w-0"
    >
      <motion.div
        className="relative grid h-full [transform-style:preserve-3d]"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={reduce ? { duration: 0 } : motionTokens.spring}
      >
        {/* FRONT */}
        <Spotlight
          as="article"
          className="flip-face col-start-1 row-start-1 flex min-w-0 flex-col rounded-[12px] bg-panel text-ink shadow-card transition-shadow hover:shadow-raised"
          aria-hidden={flipped}
        >
          <div className="space-y-5 px-5 pb-6 pt-5 sm:px-6 sm:pt-6">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <ServiceMark category={svc.category} />
                <div className="min-w-0 flex-1">
                  <div className="label">{svc.category}</div>
                  <h3 className="mt-1 truncate text-[20px] font-semibold leading-tight tracking-[-0.035em]">{svc.name}</h3>
                </div>
                <StatusBadge status={svc.status} />
              </div>
              <p className="line-clamp-2 text-[13.5px] leading-[1.55] text-slate">{svc.description}</p>
            </div>

            <dl className="grid grid-cols-3 divide-x divide-line rounded-[10px] bg-subtle">
              {[
                ["Price / mo", formatUsdc(svc.monthlyPriceUsdc)],
                ["SLA", formatBps(svc.slaTargetBps)],
                ["Backed seats", soldOut ? "Sold out" : Number.isFinite(cap.seatsLeft) ? `${cap.seatsLeft.toLocaleString()} left` : "Open"],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0 px-3 py-3.5 sm:px-4">
                  <dt className="label">{k}</dt>
                  <dd className="mt-1.5 truncate font-mono text-[15px] font-medium tracking-[-0.02em]">{v}</dd>
                </div>
              ))}
            </dl>

            <div>
              <div className="mb-2.5 flex items-center justify-between text-[12.5px]">
                <span className="text-slate">30-day availability</span>
                <span className={cn("font-mono", ev.breached ? "text-down" : "text-ink")}>{formatBps(svc.currentUptimeBps)}</span>
              </div>
              <UptimeStrip bars={svc.heartbeatHistory} height={26} />
            </div>
          </div>

          <div className={FACE_FOOTER}>
            <button
              type="button"
              onClick={() => setFlipped(true)}
              tabIndex={flipped ? -1 : 0}
              className="group inline-flex h-9 items-center gap-1.5 rounded-full bg-panel px-3.5 text-[13px] text-ink shadow-[0_0_0_1px_var(--line-strong)] transition-colors hover:bg-raised"
            >
              Terms <RotateCcw className="size-3.5 transition-transform group-hover:-rotate-45" />
            </button>
            {subscribed ? (
              <span className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full bg-raised px-4 text-[13px] text-ink shadow-card">
                <Check className="size-3.5" /> Subscribed
              </span>
            ) : (
              <Button
                variant="primary"
                className="ml-auto"
                tabIndex={flipped ? -1 : 0}
                disabled={soldOut}
                title={soldOut ? "The provider's reserve is fully committed" : `Commits ${formatUsdc(cap.coverPerSeatUsdc)} of the provider's reserve to your seat`}
                onClick={() => subscribe(svc.id)}
              >
                {soldOut ? "Sold out" : <>Subscribe · {formatUsdc(svc.monthlyPriceUsdc)}</>} <ArrowRight />
              </Button>
            )}
          </div>
        </Spotlight>

        {/* BACK: SLA terms as stored on-chain */}
        <div
          className="flip-face col-start-1 row-start-1 flex min-w-0 flex-col rounded-[12px] bg-panel text-ink shadow-raised [transform:rotateY(180deg)]"
          aria-hidden={!flipped}
        >
          <div className="space-y-4 px-5 pb-6 pt-5 sm:px-6 sm:pt-6">
            <div>
              <div className="label">services({svc.onChainId}) · terms</div>
              <div className="mt-1.5 text-[18px] font-semibold leading-tight tracking-[-0.03em]">{svc.name}</div>
            </div>

            <table className="w-full font-mono text-[12px]">
              <thead>
                <tr className="border-b border-line text-left text-dim">
                  <th scope="col" className="pb-2 font-normal">Tier</th>
                  <th scope="col" className="pb-2 font-normal">Uptime</th>
                  <th scope="col" className="pb-2 font-normal">Refund</th>
                  <th scope="col" className="pb-2 text-right font-normal">Payout</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Tier 1", `< ${formatBps(svc.slaTargetBps)}`, t.minorBreachRefundBps, calculateSubscriberRefundUsdc(svc.monthlyPriceUsdc, t.minorBreachRefundBps)],
                  ["Tier 2", "< 99.00%", t.moderateBreachRefundBps, calculateSubscriberRefundUsdc(svc.monthlyPriceUsdc, t.moderateBreachRefundBps)],
                  ["Tier 3", "< 98.00%", t.severeBreachRefundBps, severe],
                ].map(([k, c, bps, pay]) => (
                  <tr key={k as string} className="border-b border-line last:border-0">
                    <td className="py-2 text-dim">{k}</td>
                    <td className="py-2 text-slate">{c}</td>
                    <td className="py-2 text-ink">{(bps as number) / 100}%</td>
                    <td className="py-2 text-right text-ink">{formatUsdc(pay as number)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 pt-1 text-[12px]">
              <div className="min-w-0">
                <dt className="text-dim">Downtime budget</dt>
                <dd className="mt-1 font-mono text-ink">{allowedDowntimeMinutes(svc.slaTargetBps).toFixed(1)} min / 30d</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-dim">Reserve covers</dt>
                <dd className="mt-1 font-mono text-ink">{severe > 0 ? Math.floor(svc.reserveBalanceUsdc / severe).toLocaleString("en-US") : "∞"} tier-3 payouts</dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="text-dim">Endpoint</dt>
                <dd className="mt-1 truncate font-mono text-ink">{svc.endpointUrl || "Not set"}</dd>
              </div>
            </dl>
          </div>

          <div className={FACE_FOOTER}>
            <span className="min-w-0 truncate text-[13px] text-slate">Enforced by the UpHealthSLA contract</span>
            <button
              type="button"
              onClick={() => setFlipped(false)}
              tabIndex={flipped ? 0 : -1}
              className="group ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-panel px-3.5 text-[13px] text-ink shadow-[0_0_0_1px_var(--line-strong)] transition-colors hover:bg-raised"
            >
              <RotateCcw className="size-3.5 transition-transform group-hover:rotate-45" /> Back
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function ConsumerDashboard() {
  const services = useUpHeld((s) => s.services);
  const allSubs = useUpHeld((s) => s.subscriptions);
  const balance = useUpHeld((s) => s.balances[JUDGE_WALLET] ?? 0);
  const claimable = useUpHeld((s) => walletClaimable(s));
  const { mint, claim } = useActions();
  const [cat, setCat] = useState<ServiceCategory | "All">("All");

  const subs = useMemo(() => allSubs.filter((s) => s.subscriberAddress === JUDGE_WALLET), [allSubs]);
  const claimedTotal = subs.reduce((a, s) => a + s.claimedCompensationUsdc, 0);
  const filtered = cat === "All" ? services : services.filter((s) => s.category === cat);
  const cats = SERVICE_CATEGORIES.filter((c) => services.some((s) => s.category === c));

  return (
    <PageShell
      kicker="Consumer dashboard"
      title="Subscriptions"
      description="Each plan is backed by a USDC reserve the provider holds on Base. If a service misses its uptime target, you can claim a USDC refund from that reserve."
      actions={
        <Link href="/demo" className={buttonVariants({ variant: "outline", size: "md" })}>
          Open Chaos Theater <ArrowRight />
        </Link>
      }
    >
      {/* Wallet: four metric cards */}
      <Section id="wallet" title="Wallet" description="Prefunded Judge Sandbox wallet. Transactions run in your browser and are not sent to Base Sepolia.">
        <StatGrid className="lg:grid-cols-2 xl:grid-cols-4">
          <Stat
            label={
              <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span>Balance</span>
                <span className="font-mono text-[11px] font-normal text-dim">Sandbox mirror</span>
              </span>
            }
            value={
              <>
                <NumberTicker value={balance} format={(v) => formatUsdc(Math.round(v))} />
                <span className="ml-1.5 text-[12px] text-dim">USDC</span>
              </>
            }
            sub={<span className="font-mono text-[12px]">{shortHex(JUDGE_WALLET, 8, 6)} · Judge Sandbox</span>}
          />

          <div className="flex min-w-0 flex-col rounded-[12px] bg-panel p-5 shadow-card sm:p-6">
            <div className="text-[13px] font-medium text-slate">Sandbox faucet</div>
            <p className="mt-3 text-[13px] leading-[1.5] text-dim">
              <span className="font-mono text-ink">MockUSDC.faucet()</span>: up to 1,000 USDC per call.
            </p>
            <div className="mt-auto pt-4">
              <Button variant="outline" onClick={() => mint()}>
                <Coins /> Mint 100 USDC
              </Button>
            </div>
          </div>

          <Stat
            className={cn("transition-[background-color,box-shadow] duration-500", claimable > 0 && "bg-ink/[0.05] shadow-[0_0_0_1.5px_var(--ink)]")}
            label={<span className={cn(claimable > 0 && "text-ink")}>Unlocked compensation</span>}
            value={<NumberTicker value={claimable} format={(v) => formatUsdc(Math.round(v))} />}
            sub={
              claimable > 0 ? (
                <Button variant="primary" size="sm" onClick={() => subs.filter((s) => s.accruedCompensationUsdc > 0).forEach((s) => claim(s.serviceId))}>
                  Claim all <ArrowRight />
                </Button>
              ) : (
                "Credited when a plan misses its SLA"
              )
            }
          />

          <Stat label="Lifetime claimed" value={formatUsdc(claimedTotal)} sub={`${subs.length} active plan${subs.length === 1 ? "" : "s"}`} />
        </StatGrid>
      </Section>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
        {/* marketplace */}
        <Section
          id="mkt"
          title="Performance-backed plans"
          description="Monthly plans paid in USDC, each with an uptime target and refund tiers."
        >
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div className="scroll-thin relative flex min-w-0 max-w-full items-center gap-1 overflow-x-auto rounded-full bg-panel p-1 shadow-card" role="radiogroup" aria-label="Filter by category">
                {(["All", ...cats] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={cat === c}
                    onClick={() => setCat(c)}
                    className={cn("relative shrink-0 rounded-full px-3.5 py-1.5 text-[13px] transition-colors", cat === c ? "text-ink" : "text-slate hover:text-ink")}
                  >
                    {cat === c && <motion.span layoutId="cat-pill" className="absolute inset-0 rounded-full border border-line-strong bg-raised" transition={motionTokens.spring} />}
                    <span className="relative">{c}</span>
                  </button>
                ))}
              </div>
              <span className="hidden shrink-0 text-[13px] text-dim sm:block">
                {filtered.length} plan{filtered.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {filtered.map((svc) => (
                  <ServiceCard key={svc.id} svc={svc} subscribed={subs.some((s) => s.serviceId === svc.id)} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        </Section>

        {/* Subscriptions: keeps the complementary landmark */}
        <aside aria-labelledby="subs-h" className="min-w-0">
        <Section id="subs" title="Active plans" description="Your subscriptions and any refunds ready to claim.">
          <div className="space-y-4">
            {subs.length === 0 && (
              <div className="rounded-[12px] border border-dashed border-line-strong px-5 py-6 text-[14px] leading-[1.6] text-slate sm:px-6">
                No active plans. Subscribe to a service, then record an outage in the{" "}
                <Link href="/demo" className="text-ink underline decoration-ink/30 underline-offset-4 transition-colors hover:decoration-white">
                  Chaos Theater
                </Link>{" "}
                to see the refund.
              </div>
            )}
            {subs.map((sub) => {
              const svc = services.find((s) => s.id === sub.serviceId);
              if (!svc) return null;
              const ev = evaluateSlaBreach(svc.currentUptimeBps, svc.slaTargetBps, svc.compensationTiers);
              return (
                <Panel key={sub.id} className="overflow-visible">
                  <div className="flex items-center gap-3 border-b border-line px-5 py-4 sm:px-6">
                    <ServiceMark category={svc.category} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-semibold tracking-[-0.02em]">{svc.name}</div>
                      <div className="mt-0.5 truncate font-mono text-[11.5px] text-dim">
                        paid {formatUsdc(sub.paidAmountUsdc)} · since {new Date(sub.startedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <StatusBadge status={svc.status} />
                  </div>
                  <dl className="grid grid-cols-3 divide-x divide-line border-b border-line">
                    {[
                      ["Uptime", formatBps(svc.currentUptimeBps), ev.breached ? "text-down" : "text-ink"],
                      ["Target", formatBps(svc.slaTargetBps), "text-ink"],
                      ["Down", `${svc.totalDowntimeMinutes}m`, "text-ink"],
                    ].map(([k, v, c]) => (
                      <div key={k} className="min-w-0 px-5 py-3.5 sm:px-6">
                        <dt className="text-[12px] text-dim">{k}</dt>
                        <dd className={cn("mt-1 truncate font-mono text-[13.5px]", c)}>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="space-y-4 px-5 py-5 sm:px-6">
                    <UptimeStrip bars={svc.heartbeatHistory} height={16} compact />
                    <div className="flex items-center justify-between gap-3">
                      <SeverityBadge severity={ev.severity} />
                      {sub.claimedCompensationUsdc > 0 && <span className="font-mono text-[12px] text-dim">claimed {formatUsdc(sub.claimedCompensationUsdc)}</span>}
                    </div>
                    {sub.accruedCompensationUsdc > 0 && <ClaimCard sub={sub} />}
                  </div>
                </Panel>
              );
            })}
            <p className="pt-2 text-[13px] leading-[1.6] text-dim">
              Refunds are paid in USDC from the provider&apos;s reserve in the UpHealthSLA contract.
            </p>
          </div>
        </Section>
        </aside>
      </div>
    </PageShell>
  );
}
