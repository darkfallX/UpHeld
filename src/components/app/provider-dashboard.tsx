"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useActions } from "@/hooks/use-actions";
import { PROVIDER_TREASURY, shortHex } from "@/lib/chain";
import { EASE } from "@/lib/motion";
import { allowedDowntimeMinutes, calculateSubscriberRefundUsdc, formatBps, formatMinutes, formatUsdc, usdc } from "@/lib/sla-engine";
import { fleetUptimeBps, seatCapacity, useUpHeld } from "@/lib/store";
import { SERVICE_CATEGORIES, type ServiceCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { NumberTicker } from "../magicui/number-ticker";
import { ServiceMark } from "../telemetry/service-mark";
import { SeverityBadge, StatusBadge } from "../telemetry/status-badge";
import { Button, buttonVariants } from "../ui/button";
import { PageShell, Panel, PanelBody, PanelFooter, PanelHeader, Section, Stat, StatGrid, fieldClass } from "../ui/card";

/** monochrome system: provider brand hue is stored but not rendered */
const DEFAULT_ACCENT = "#FFFFFF";

const inkField = fieldClass;
const fieldLabel = "mb-2 block text-[13px] font-medium text-ink";
const fieldHint = "mt-2 text-[12px] leading-[1.5] text-dim";

/** One settings group inside the form card: title + helper on the left, fields on the right. */
function FormGroup({ title, hint, children, first }: { title: string; hint: string; children: React.ReactNode; first?: boolean }) {
  return (
    <div className={cn("grid gap-5 px-5 py-6 sm:px-6 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] lg:gap-10", !first && "border-t border-line")}>
      <div className="min-w-0">
        <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
        <p className="mt-1.5 text-[13px] leading-[1.55] text-slate">{hint}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Registration form for a new SLA-backed service. */
function RegisterForm() {
  const { register } = useActions();
  const treasury = useUpHeld((s) => s.balances[PROVIDER_TREASURY] ?? 0);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ServiceCategory>("SaaS");
  const [endpoint, setEndpoint] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("15");
  const [sla, setSla] = useState(9990);
  const [tiers, setTiers] = useState({ minor: "10", moderate: "25", severe: "50" });
  const [reserve, setReserve] = useState("1500");
  const [created, setCreated] = useState<string | null>(null);

  const priceMinor = usdc(Number(price) || 0);
  const severeMinor = calculateSubscriberRefundUsdc(priceMinor, Math.round(Number(tiers.severe) * 100) || 0);
  const coverage = severeMinor > 0 ? Math.floor(usdc(Number(reserve) || 0) / severeMinor) : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const svc = register({
      name,
      category,
      description,
      endpointUrl: endpoint.trim(),
      accent: DEFAULT_ACCENT,
      monthlyPriceUsdc: priceMinor,
      slaTargetBps: sla,
      minorBreachRefundBps: Math.round(Number(tiers.minor) * 100),
      moderateBreachRefundBps: Math.round(Number(tiers.moderate) * 100),
      severeBreachRefundBps: Math.round(Number(tiers.severe) * 100),
      initialReserveUsdc: usdc(Number(reserve) || 0),
    });
    if (svc) {
      setCreated(svc.name);
      setName("");
      setDescription("");
      setEndpoint("");
    }
  };

  return (
    <Panel className="text-ink">
      <form onSubmit={submit} aria-labelledby="reg-h">
        <PanelHeader
          kicker="registerService() + fundReserve()"
          title={<h3 id="reg-h">New service</h3>}
          description="Registered services are listed in the marketplace and the Chaos Theater."
        />

        <FormGroup first title="Service" hint="Shown to subscribers. The health endpoint is probed to measure uptime.">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="f-name" className={fieldLabel}>
                Service name
              </label>
              <input id="f-name" required minLength={2} maxLength={40} className={inkField} placeholder="e.g. NightOwl Transcribe" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="f-cat" className={fieldLabel}>
                Category
              </label>
              <select id="f-cat" className={inkField} value={category} onChange={(e) => setCategory(e.target.value as ServiceCategory)}>
                {SERVICE_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="f-ep" className={fieldLabel}>
                Health endpoint <span className="font-normal text-dim">(optional)</span>
              </label>
              <input id="f-ep" type="url" className={cn(inkField, "font-mono text-[13px]")} placeholder="https://your-service.com/health" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="f-desc" className={fieldLabel}>
                One-line description
              </label>
              <input id="f-desc" maxLength={90} className={inkField} placeholder="What subscribers get" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
        </FormGroup>

        <FormGroup title="Pricing & reserve" hint="Subscribers pay monthly in USDC. SLA refunds are paid from the reserve, which is held on-chain.">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="f-price" className={fieldLabel}>
                Monthly price (USDC)
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-dim">$</span>
                <input id="f-price" type="number" min="0.01" step="0.01" required className={cn(inkField, "pl-6 font-mono")} value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div className={cn(fieldHint, "font-mono")}>{priceMinor.toLocaleString("en-US")} minor units</div>
            </div>
            <div>
              <label htmlFor="f-res" className={fieldLabel}>
                Initial reserve (USDC)
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-dim">$</span>
                <input id="f-res" type="number" min="0" step="1" className={cn(inkField, "pl-6 font-mono")} value={reserve} onChange={(e) => setReserve(e.target.value)} />
              </div>
              <div className={cn(fieldHint, "font-mono")}>
                treasury {formatUsdc(treasury)} · covers {coverage.toLocaleString("en-US")} tier-3 payouts
              </div>
            </div>
          </div>
        </FormGroup>

        <FormGroup title="Uptime guarantee" hint="Rolling 30-day availability target, stored in basis points.">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <label htmlFor="f-sla" className={cn(fieldLabel, "mb-0")}>
              Guaranteed uptime
            </label>
            <span className="font-mono text-[22px] font-medium tracking-[-0.03em]">
              {formatBps(sla)} <span className="text-[12px] text-dim">{sla} bps</span>
            </span>
          </div>
          <input
            id="f-sla"
            type="range"
            min={9900}
            max={9999}
            step={1}
            value={sla}
            onChange={(e) => setSla(Number(e.target.value))}
            className="range mt-4 w-full"
            style={{ ["--range-pct" as string]: `${((sla - 9900) / 99) * 100}%`, ["--range-fill" as string]: "var(--ink)" }}
          />
          <div className="mt-3 flex justify-between gap-3 font-mono text-[12px] text-dim">
            <span>99.00%</span>
            <span>99.99%</span>
          </div>
          <div className={cn(fieldHint, "font-mono")}>
            budget {formatMinutes(Math.floor(allowedDowntimeMinutes(sla)))} ({allowedDowntimeMinutes(sla).toFixed(1)} min) / 30d
          </div>
        </FormGroup>

        <FormGroup title="Compensation tiers" hint="Share of the monthly price refunded to each subscriber when uptime falls into a band.">
          <fieldset className="min-w-0">
            <legend className={fieldLabel}>Refund · % of monthly price</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  ["minor", "Tier 1", `< ${formatBps(sla)}`],
                  ["moderate", "Tier 2", "< 99.00%"],
                  ["severe", "Tier 3", "< 98.00%"],
                ] as const
              ).map(([k, t, cond]) => (
                <div key={k} className="min-w-0 rounded-[10px] bg-subtle p-4 shadow-card">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-[12px]">
                    <span className="font-medium text-ink">{t}</span>
                    <span className="font-mono text-dim">{cond}</span>
                  </div>
                  <div className="relative mt-3">
                    <input
                      aria-label={`${t} refund percent`}
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      className="h-9 w-full border-0 border-b border-line-strong bg-transparent pr-6 font-mono text-[20px] tracking-[-0.03em] text-ink focus:border-accent focus:outline-none"
                      value={tiers[k]}
                      onChange={(e) => setTiers((x) => ({ ...x, [k]: e.target.value }))}
                    />
                    <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 font-mono text-xs text-dim">%</span>
                  </div>
                  <div className="mt-2.5 font-mono text-[12px] text-slate">= {formatUsdc(calculateSubscriberRefundUsdc(priceMinor, Math.round(Number(tiers[k]) * 100) || 0))}/sub</div>
                </div>
              ))}
            </div>
          </fieldset>
        </FormGroup>

        <PanelFooter
          hint={
            <div className="min-w-0">
              <div className="truncate text-[14px] font-medium text-ink">{name || "Your service"}</div>
              <div className="mt-0.5 font-mono text-[12px] text-dim">
                {formatUsdc(priceMinor)}/mo · SLA {formatBps(sla)} · reserve {formatUsdc(usdc(Number(reserve) || 0), { decimals: 0 })}
              </div>
            </div>
          }
        >
          <Button type="submit" variant="primary">
            Register & lock reserve <ArrowRight />
          </Button>
        </PanelFooter>

        <AnimatePresence>
          {created && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.55, ease: EASE }}
              className="overflow-hidden border-t border-line"
            >
              <div className="px-5 py-4 text-[13.5px] leading-[1.55] text-slate sm:px-6">
                <span className="font-medium text-ink">{created}</span> is registered.{" "}
                <Link href="/consumer" className="underline underline-offset-2">
                  View it in the marketplace
                </Link>{" "}
                or{" "}
                <Link href="/demo" className="underline underline-offset-2">
                  test it in the Chaos Theater
                </Link>
                .
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </Panel>
  );
}

export function ProviderDashboard() {
  const services = useUpHeld((s) => s.services);
  const subs = useUpHeld((s) => s.subscriptions);
  const incidents = useUpHeld((s) => s.incidents);
  const treasury = useUpHeld((s) => s.balances[PROVIDER_TREASURY] ?? 0);
  const { fund } = useActions();

  const stats = useMemo(() => {
    const mrr = services.reduce((a, s) => a + s.monthlyPriceUsdc * s.activeSubscribersCount, 0);
    return {
      subscribers: subs.length,
      mrr,
      reserves: services.reduce((a, s) => a + s.reserveBalanceUsdc, 0),
      paid: services.reduce((a, s) => a + s.totalPaidOutUsdc, 0),
      fleet: fleetUptimeBps(services),
    };
  }, [services, subs]);

  const cell = "px-3 py-4 align-middle";

  return (
    <PageShell
      kicker="Provider console"
      title="Services and reserves"
      description="List a service, set its uptime target and refund tiers, and fund the USDC reserve that pays refunds."
      actions={
        <>
          <div className="rounded-[12px] bg-panel px-4 py-3 shadow-card">
            <div className="text-[12px] text-dim">
              Provider treasury · <span className="font-mono">{shortHex(PROVIDER_TREASURY)}</span>
            </div>
            <NumberTicker value={treasury} format={(v) => formatUsdc(Math.round(v))} className="mt-1 block font-mono text-[24px] font-medium tracking-[-0.04em] text-ink" />
          </div>
          <Link href="#register" className={buttonVariants({ variant: "primary", size: "md" })}>
            List a service <ArrowDown />
          </Link>
        </>
      }
    >
      <StatGrid role="group" aria-label="Provider overview">
        <Stat label="Active subscribers" value={String(stats.subscribers)} sub={`${services.length} services listed`} />
        <Stat label="Monthly recurring" value={formatUsdc(stats.mrr)} sub="Paid in USDC at subscription" />
        <Stat label="Locked SLA reserves" value={formatUsdc(stats.reserves, { decimals: 0 })} sub={`${formatUsdc(stats.paid)} paid out`} />
        <Stat label="Fleet reliability" value={formatBps(stats.fleet)} sub="Average 30-day uptime" />
      </StatGrid>

      <Section id="reserves" title="Reserve management" description="USDC held against each SLA. Top up a reserve from the provider treasury.">
        <Panel>
          <div className="scroll-thin relative overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13.5px]">
              <thead className="bg-subtle">
                <tr className="border-b border-line">
                  {["Service", "Status", "Subs", "Uptime / SLA", "Reserve", "Paid out", ""].map((h, i) => (
                    <th
                      key={i}
                      scope="col"
                      className={cn(
                        "px-3 py-3 text-[12px] font-medium text-slate",
                        i >= 2 && i <= 5 && "text-right",
                        i === 0 && "pl-5 sm:pl-6",
                        i === 6 && "w-[120px] pr-5 sm:pr-6",
                      )}
                    >
                      {h || <span className="sr-only">Actions</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id} className="group border-b border-line transition-colors last:border-b-0 hover:bg-subtle/60">
                    <td className={cn(cell, "pl-5 sm:pl-6")}>
                      <div className="flex items-center gap-3">
                        <ServiceMark category={s.category} size="sm" />
                        <div className="min-w-0">
                          <div className="font-medium tracking-[-0.02em]">{s.name}</div>
                          <div className="mt-0.5 font-mono text-[12px] text-dim">
                            #{s.onChainId} · {formatUsdc(s.monthlyPriceUsdc)}/mo
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={cell}>
                      <StatusBadge status={s.status} />
                    </td>
                    <td className={cn(cell, "text-right font-mono")}>{s.activeSubscribersCount}</td>
                    <td className={cn(cell, "text-right font-mono text-[13px]")}>
                      <span className={s.currentUptimeBps < s.slaTargetBps ? "text-down" : "text-ink"}>{formatBps(s.currentUptimeBps)}</span>
                      <span className="text-dim"> / {formatBps(s.slaTargetBps)}</span>
                    </td>
                    <td className={cn(cell, "text-right font-mono")}>
                      <NumberTicker value={s.reserveBalanceUsdc} format={(v) => formatUsdc(Math.round(v))} />
                      {(() => {
                        const cap = seatCapacity(s, subs);
                        return (
                          <div className="mt-1 text-[12px] text-dim" title={`${formatUsdc(cap.committedUsdc)} committed to current seats · each new seat commits ${formatUsdc(cap.coverPerSeatUsdc)}`}>
                            {formatUsdc(cap.committedUsdc, { decimals: 0 })} locked ·{" "}
                            <span className={cap.seatsLeft === 0 ? "text-warn" : undefined}>{Number.isFinite(cap.seatsLeft) ? `${cap.seatsLeft.toLocaleString()} seats left` : "unlimited seats"}</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className={cn(cell, "text-right font-mono text-slate")}>{formatUsdc(s.totalPaidOutUsdc)}</td>
                    <td className={cn(cell, "pr-5 text-right sm:pr-6")}>
                      <Button size="sm" variant="outline" onClick={() => fund(s.id, usdc(500))} aria-label={`Top up ${s.name} reserve by 500 USDC`}>
                        <Plus /> $500
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PanelFooter
            hint={
              <>
                Each subscription reserves its tier 3 refund, so the number of seats is limited by the reserve balance. Top-ups call{" "}
                <span className="font-mono text-ink">fundReserve(serviceId, amount)</span>.
              </>
            }
          />
        </Panel>
      </Section>

      <Section id="register" className="scroll-mt-24" title="List a new service" description="Each service needs a monthly price, an uptime target and a funded reserve.">
        <RegisterForm />
      </Section>

      <Section id="payouts" title="Outage payouts" description="Recorded incidents and the USDC paid to subscribers.">
        <Panel>
          {incidents.length === 0 ? (
            <PanelBody>
              <p className="text-[14px] leading-[1.55] text-slate">
                No incidents recorded. Record an outage in the{" "}
                <Link href="/demo" className="text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-white">
                  Chaos Theater
                </Link>
                .
              </p>
            </PanelBody>
          ) : (
            <ul className="divide-y divide-line">
              {incidents.slice(0, 12).map((i) => {
                const s = services.find((x) => x.id === i.serviceId);
                return (
                  <li key={i.id} className="flex flex-col gap-2 px-5 py-4 text-[13.5px] sm:flex-row sm:items-center sm:gap-4 sm:px-6">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="font-pixel text-[12px] text-dim">{String(i.seq).padStart(2, "0")}</span>
                      <span className="font-medium text-ink">{s?.name}</span>
                      <span className="min-w-0 text-slate">{i.title}</span>
                      <SeverityBadge severity={i.severity} />
                    </div>
                    <span className="shrink-0 font-mono text-[13px] text-slate sm:text-right">
                      {formatBps(i.previousUptimeBps)} → {formatBps(i.newUptimeBps)} · <span className="text-ink">−{formatUsdc(i.totalCompensationTriggeredUsdc)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </Section>
    </PageShell>
  );
}
