"use client";

import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EASE } from "@/lib/motion";
import { DEFAULT_TIERS } from "@/lib/seed";
import { calculateSubscriberRefundUsdc, calculateUptimeBps, evaluateSlaBreach, formatBps, formatMinutes, formatUsdc, usdc } from "@/lib/sla-engine";
import { cn } from "@/lib/utils";
import { BaseStatusPill } from "../layout/base-status";
import { NumberTicker } from "../magicui/number-ticker";
import { buttonVariants } from "../ui/button";
import { Spotlight } from "../ui/spotlight";
import { EscrowStack } from "./escrow-stack";
import { ForProviders, TrustTeaser } from "./for-providers";
import { CountUp, ScrubText } from "./kinetic";
import { PayoutSpecimen } from "./payout-specimen";
import { Monolith } from "../monolith/monolith";

const ROUTES = [
  { href: "/demo", idx: "01", title: "Chaos Theater", body: "Subscribe to a plan, record an outage and claim the refund with a sandbox wallet." },
  { href: "/consumer", idx: "02", title: "Consumer", body: "Browse plans with an uptime guarantee and claim your refunds." },
  { href: "/provider", idx: "03", title: "Provider", body: "List a service, set its uptime guarantee and refund tiers, and fund the reserve." },
  { href: "/monitor", idx: "04", title: "Monitor", body: "HTTP checks, uptime history and the incident log." },
  { href: "/contracts", idx: "05", title: "Contracts", body: "Contract addresses, Solidity source and a test USDC faucet on Base Sepolia." },
];

const LINE_1 = ["Subscriptions", "that", "refund", "you"];
const LINE_2 = ["when", "the", "service", "goes", "down."];

/** Word-by-word entrance, staggered after the monolith begins to rise. */
function HeroWords({ words, delay, className }: { words: string[]; delay: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <span className={cn("block", className)}>
      {words.map((w, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={reduce ? false : { opacity: 0, y: 14, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.9, ease: EASE, delay: delay + i * 0.06 }}
        >
          {w}
          {i < words.length - 1 ? "\u00A0" : ""}
        </motion.span>
      ))}
    </span>
  );
}

/** Tier scrubber: set the downtime in minutes and highlight the matching refund tier. */
function TierScrubber() {
  const [mins, setMins] = useState(480);
  const uptime = calculateUptimeBps(mins);
  const ev = evaluateSlaBreach(uptime, 9995, DEFAULT_TIERS);
  const refund = calculateSubscriberRefundUsdc(usdc(10), ev.refundBps);
  const rows = useMemo(
    () => [
      { sev: "MINOR", tier: "Tier 1", cond: "< 99.95% (SLA)", pct: "10%", pay: usdc(1) },
      { sev: "MODERATE", tier: "Tier 2", cond: "< 99.00%", pct: "25%", pay: usdc(2.5) },
      { sev: "SEVERE", tier: "Tier 3", cond: "< 98.00%", pct: "50%", pay: usdc(5) },
    ],
    [],
  );
  const pct = (mins / 1500) * 100;
  return (
    <div className="grid overflow-hidden rounded-[12px] bg-panel shadow-card lg:grid-cols-[1fr_1.15fr]">
      <div className="p-6 sm:p-8">
        <div className="label">CloudBox · $10/mo · SLA 99.95%</div>
        <div className="mt-6 flex items-end justify-between gap-4">
          <div>
            <div className="label">Downtime this window</div>
            <div className="mt-2 font-mono text-[22px] tracking-[-0.03em] text-ink tabular">
              {mins.toLocaleString("en-US")} min <span className="text-dim">· {formatMinutes(mins)}</span>
            </div>
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={1500}
          value={mins}
          onChange={(e) => setMins(Number(e.target.value))}
          aria-label="Downtime minutes"
          className="range mt-5 w-full"
          style={{ ["--range-pct" as string]: `${pct}%`, ["--range-fill" as string]: ev.breached ? "var(--down)" : "var(--ink)" }}
        />
        <div className="mt-8 grid grid-cols-2 gap-6">
          <div>
            <div className="label">Uptime</div>
            <NumberTicker value={uptime} format={(v) => formatBps(Math.round(v))} className={cn("mt-2 block text-[40px] font-medium leading-none tracking-[-0.05em]", ev.breached ? "text-down" : "text-ink")} />
            <div className="mt-2 font-mono text-[11px] text-dim">{uptime} bps</div>
          </div>
          <div>
            <div className="label">Refund per subscriber</div>
            <NumberTicker value={refund} format={(v) => formatUsdc(Math.round(v))} className={cn("mt-2 block text-[40px] font-medium leading-none tracking-[-0.05em]", refund > 0 ? "text-ink" : "text-ink")} />
            <div className="mt-2 font-mono text-[11px] text-dim">{refund.toLocaleString("en-US")} minor units</div>
          </div>
        </div>
      </div>
      <div className="flex flex-col border-t border-line lg:border-l lg:border-t-0">
        <div className="grid grid-cols-[0.8fr_1.2fr_0.6fr_0.7fr] gap-3 border-b border-line px-6 py-3 label">
          <span>Tier</span>
          <span>Uptime</span>
          <span>Refund</span>
          <span className="text-right">Payout</span>
        </div>
        {[{ sev: "NONE", tier: "None", cond: "≥ 99.95%", pct: "0%", pay: 0 }, ...rows].map((r) => {
          const on = r.sev === ev.severity;
          return (
            <div key={r.sev} className="relative grid flex-1 grid-cols-[0.8fr_1.2fr_0.6fr_0.7fr] items-center gap-3 border-b border-line px-6 py-4 last:border-0">
              {on && <motion.div layoutId="tier-on" className="absolute inset-0 bg-raised" transition={{ type: "spring", stiffness: 120, damping: 22, mass: 1 }} />}
              {on && <motion.span layoutId="tier-rule" className={cn("absolute inset-y-0 left-0 w-[2px]", r.sev === "NONE" ? "bg-ink" : "bg-ink")} transition={{ type: "spring", stiffness: 120, damping: 22, mass: 1 }} />}
              <span className={cn("relative font-mono text-[12px]", on ? "text-ink" : "text-dim")}>{r.tier}</span>
              <span className={cn("relative text-[14px]", on ? "text-ink" : "text-slate")}>{r.cond}</span>
              <span className={cn("relative font-mono text-[13px]", on ? "text-ink" : "text-dim")}>{r.pct}</span>
              <span className={cn("relative text-right font-mono text-[13px]", on && r.pay > 0 ? "text-ink" : on ? "text-ink" : "text-dim")}>{formatUsdc(r.pay)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Wide page container that scales with the viewport. */
const WIDE = "mx-auto w-full max-w-[1760px] px-6 sm:px-10 lg:px-16";

export function Landing() {
  return (
    <div className="overflow-x-clip">
      {/* HERO: Monolith at centre ----------------------------------------- */}
      <section data-hero className="relative -mt-[94px] pt-[94px] lg:-mt-14 lg:pt-14">
        <div className={cn(WIDE, "relative pb-20 pt-10 lg:pb-28")}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
            className="flex flex-wrap items-center justify-center gap-2"
          >
            <BaseStatusPill />
            <span className="inline-flex h-7 items-center rounded-full px-3 font-mono text-[12px] text-slate shadow-card">Vibeathon 02 · Night shift</span>
          </motion.div>

          <Monolith className="mx-auto mt-2 h-[300px] w-full max-w-[680px] sm:h-[400px] lg:h-[460px]" />

          <h1 className="mx-auto -mt-2 max-w-[1240px] text-balance text-center text-[40px] font-semibold leading-[1.02] tracking-[-0.05em] sm:text-[60px] lg:text-[76px]">
            <HeroWords words={LINE_1} delay={0.55} />
            <HeroWords words={LINE_2} delay={0.85} className="text-slate" />
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 1.15 }}
            className="mx-auto mt-7 max-w-[720px] text-center text-[17px] leading-[1.6] text-slate sm:text-[19px]"
          >
            Providers sell monthly plans in USDC on Base and fund a reserve to back their uptime guarantee. If a service falls below that guarantee,
            subscribers can claim a USDC refund from the reserve.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 1.3 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-3"
          >
            <Link href="/demo" className={buttonVariants({ variant: "primary", size: "lg" })}>
              Launch interactive demo <ArrowRight />
            </Link>
            <Link href="/consumer" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Consumer app
            </Link>
            <Link href="/provider" className={buttonVariants({ variant: "ghost", size: "lg" })}>
              Provider console <ArrowRight />
            </Link>
          </motion.div>

          {/* flanking telemetry at the edges of the screen */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, ease: EASE, delay: 1.5 }}
            className="mt-16 hidden items-center justify-between font-mono text-[12px] text-dim sm:flex"
          >
            <span>SLA 99.95% · 43,200-minute window</span>
            <span>USDC · Base Sepolia 84532</span>
          </motion.div>
        </div>
      </section>

      {/* METRICS ----------------------------------------------------------- */}
      <section className={cn(WIDE, "py-16 lg:py-20")}>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-12 lg:grid-cols-4">
          {[
            { k: "Billing window", v: 43200, f: (n: number) => `${Math.round(n).toLocaleString("en-US")} min` },
            { k: "Uptime precision", v: 1, f: () => "1 bps" },
            { k: "USDC minor units", v: 1000000, f: (n: number) => `${Math.round(n).toLocaleString("en-US")}` },
            { k: "Refund tiers", v: 3, f: (n: number) => `${Math.round(n)} · 10/25/50%` },
          ].map((m) => (
            <div key={m.k}>
              <dt className="label">{m.k}</dt>
              <dd className="mt-3 font-mono text-[28px] font-medium tracking-[-0.04em] text-ink sm:text-[36px]">
                <CountUp to={m.v} format={m.f} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* EXAMPLE: outage refund -------------------------------------------- */}
      <section className={cn(WIDE, "grid items-center gap-12 py-24 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24 lg:py-32")}>
        <div>
          <div className="label">Example · CloudBox</div>
          <h2 className="mt-4 text-[36px] font-semibold leading-[1.04] tracking-[-0.045em] sm:text-[52px]">How an outage becomes a refund</h2>
          <p className="mt-5 max-w-lg text-[17px] leading-[1.65] text-slate">
            CloudBox costs $10 a month and guarantees 99.95% uptime. A 518-minute outage drops it to refund tier 2, so $2.50 moves from the provider&apos;s
            reserve to the subscriber&apos;s balance.
          </p>
          <ul className="mt-8 space-y-3 text-[15px] text-slate">
            {["Reserve funded on Base before the plan goes on sale", "Each outage record includes a keccak256 hash", "Subscribers claim refunds from their dashboard"].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="size-1.5 rounded-full bg-ink" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <PayoutSpecimen />
      </section>

      {/* PROBLEM / FIX ------------------------------------------------------ */}
      <section className="bg-subtle">
        <div className={cn(WIDE, "py-24 lg:py-32")}>
          <div className="label">The problem</div>
          <ScrubText
            text="Most subscriptions charge full price during an outage, and getting a service credit usually means filing a support ticket."
            className="mt-5 max-w-[1280px] text-[30px] font-semibold leading-[1.1] tracking-[-0.045em] sm:text-[48px]"
          />
          <div className="mt-16 grid gap-4 sm:grid-cols-3">
            {[
              ["SLA in a contract PDF", "SLA stored on-chain", "The uptime target, refund tiers and reserve balance are public state in the UpHealthSLA contract."],
              ["Support tickets", "Outages recorded by a monitor", "The watchdog checks each service and records an outage after consecutive failed checks. Each record is hashed with keccak256."],
              ["Store credit", "USDC refunds", "Refunds come from a prefunded reserve and can be claimed as soon as a breach is recorded."],
            ].map(([before, after, body], i) => (
              <div key={after} className="rounded-[12px] bg-panel p-7 shadow-card">
                <div className="flex items-center justify-between font-mono text-[12px]">
                  <span className="text-dim line-through decoration-[var(--faint)]">{before}</span>
                  <span className="text-faint">0{i + 1}</span>
                </div>
                <div className="mt-10 text-[22px] font-semibold tracking-[-0.03em]">{after}</div>
                <p className="mt-2 text-[15px] leading-[1.6] text-slate">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ESCROW STACK --------------------------------------------------- */}
      <section className={cn(WIDE, "pt-24 lg:pt-32")}>
        <EscrowStack />
      </section>

      {/* TIERS ---------------------------------------------------------- */}
      <section className={cn(WIDE, "pt-24 lg:pt-32")}>
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <div className="label">Refund math</div>
            <h2 className="mt-4 text-[36px] font-semibold leading-[1.04] tracking-[-0.045em] sm:text-[52px]">Refund tiers by uptime</h2>
          </div>
          <pre className="overflow-x-auto rounded-[12px] bg-subtle p-5 font-mono text-[13px] leading-relaxed text-slate shadow-card">
{`uptimeBps = floor((43200 − downtime) × 10000 / 43200)
refund    = monthlyPrice × tierBps / 10000`}
          </pre>
        </div>
        <div className="mt-12">
          <TierScrubber />
        </div>
      </section>

      {/* TRUST MODEL (teaser) ------------------------------------------- */}
      <section id="trust-model" className={cn(WIDE, "py-24 lg:py-32")}>
        <TrustTeaser />
      </section>

      {/* FOR PROVIDERS -------------------------------------------------- */}
      <section id="for-providers" className="bg-subtle">
        <div className={cn(WIDE, "py-24 lg:py-32")}>
          <ForProviders />
        </div>
      </section>

      {/* ROUTES --------------------------------------------------------- */}
      <section className={cn(WIDE, "pt-24 lg:pt-32")}>
        <ScrubText text="Try the app with the prefunded Judge Sandbox wallet or your own Base Sepolia wallet." className="max-w-[1100px] text-[30px] font-semibold leading-[1.1] tracking-[-0.045em] sm:text-[44px]" />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {ROUTES.map((r, i) => (
            <Spotlight key={r.href} className="group rounded-[12px] bg-panel shadow-card transition-shadow hover:shadow-raised">
              <Link href={r.href} className="flex h-full min-h-[220px] flex-col rounded-[12px] p-6">
                <div className="flex items-center justify-between">
                  <span className={cn("font-mono text-[12px]", i === 0 ? "text-ink" : "text-dim")}>{r.idx}</span>
                  <ArrowUpRight className="size-4 text-dim transition-[transform,color] group-hover:translate-x-[3px] group-hover:-translate-y-[3px] group-hover:text-ink" />
                </div>
                <div className="mt-auto pt-12 text-[20px] font-semibold tracking-[-0.03em]">{r.title}</div>
                <p className="mt-1.5 text-[14px] leading-[1.55] text-slate">{r.body}</p>
                <span className="mt-4 font-mono text-[12px] text-dim">{r.href}</span>
              </Link>
            </Spotlight>
          ))}
        </div>
      </section>

      {/* CLOSER --------------------------------------------------------- */}
      <section className={cn(WIDE, "py-24 lg:py-32")}>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <ScrubText
            text="Subscribe to a plan, record an outage and claim the refund in the demo."
            className="max-w-[1000px] text-[30px] font-semibold leading-[1.1] tracking-[-0.045em] sm:text-[48px]"
          />
          <Link href="/demo" className={cn(buttonVariants({ variant: "primary", size: "lg" }), "shrink-0")}>
            Open the demo <ArrowRight />
          </Link>
        </div>
      </section>
    </div>
  );
}
