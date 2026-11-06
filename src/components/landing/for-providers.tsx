"use client";

import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, BadgeCheck, Bot, Coins, Moon, Network, Receipt, Server, ShieldCheck, UserCheck } from "lucide-react";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { EASE } from "@/lib/motion";
import { DEFAULT_TIERS } from "@/lib/seed";
import { calculateSubscriberRefundUsdc, formatBps, formatUsdc, usdc } from "@/lib/sla-engine";
import { cn } from "@/lib/utils";
import { buttonVariants } from "../ui/button";

/** Fade-up on first view; static under prefers-reduced-motion. */
function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.8, ease: EASE, delay: reduce ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Trust model teaser                                                  */
/* ------------------------------------------------------------------ */

const TRUST = [
  {
    Icon: UserCheck,
    k: "Who records outages",
    body: "An approved attestor: a monitor address that can submit outage records (minutes down and a one-time hash) to the contract. Providers and subscribers cannot submit records.",
    note: "In this build the attestor is trusted. It is the sandbox monitor, or your wallet if you deploy your own copy.",
  },
  {
    Icon: ShieldCheck,
    k: "What the contract guarantees",
    body: "Each subscription locks its worst-case refund from the provider's reserve at checkout. Refunds use the worst tier reached, are paid only once, and are claimed by the subscriber.",
    note: "A plan shows Sold out when the reserve cannot cover another subscription.",
  },
  {
    Icon: Network,
    k: "Planned for production",
    body: "An attestor quorum, where several independent monitors in different locations must agree before an outage is recorded.",
    note: "Not yet built. It is the first item on the provider roadmap.",
  },
];

export function TrustTeaser() {
  return (
    <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
      <Reveal>
        <div className="label">Trust model</div>
        <h2 className="mt-4 text-[36px] font-semibold leading-[1.04] tracking-[-0.045em] sm:text-[52px]">What you need to trust</h2>
        <p className="mt-5 max-w-lg text-[17px] leading-[1.65] text-slate">
          Payments and refunds follow rules enforced by the contract. Outage reports come from an approved attestor, which is the part you still need to
          trust.
        </p>
        <Link href="/contracts#trust" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-8")}>
          Read the full trust model <ArrowRight />
        </Link>
      </Reveal>
      <ol className="grid gap-4">
        {TRUST.map(({ Icon, k, body, note }, i) => (
          <li key={k}>
            <Reveal delay={i * 0.08} className="rounded-[12px] bg-panel p-6 shadow-card sm:p-7">
              <div className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-subtle text-ink" aria-hidden>
                  <Icon className="size-4" />
                </span>
                <span className="text-[18px] font-semibold tracking-[-0.03em] text-ink">{k}</span>
                <span className="ml-auto font-mono text-[12px] text-faint">0{i + 1}</span>
              </div>
              <p className="mt-4 text-[15px] leading-[1.6] text-slate">{body}</p>
              <p className="mt-3 font-mono text-[12px] leading-[1.55] text-dim">{note}</p>
            </Reveal>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* For providers                                                       */
/* ------------------------------------------------------------------ */

const PITCH = [
  {
    Icon: Coins,
    k: "Who pays",
    body: "Subscribers pay a monthly price in USDC, which goes to the provider's wallet when they subscribe. The provider funds the reserve that backs each subscription.",
  },
  {
    Icon: Server,
    k: "First market",
    body: "Infrastructure providers such as RPC nodes, inference APIs and data feeds. Many of their customers already pay in USDC on Base and choose vendors on uptime.",
  },
  {
    Icon: Receipt,
    k: "How UpHeld makes money",
    tag: "Proposed model",
    body: "A small take rate (around 1%) on subscription volume settled through UpHeld, plus a fee for verified listings and the public SLA badge. Nothing is charged in this testnet build.",
  },
];

const ROADMAP = [
  {
    Icon: Network,
    k: "Independent attestor quorum",
    body: "Monitors run by different parties must agree before an outage is recorded, so a single monitor cannot trigger or block a payout.",
  },
  {
    Icon: BadgeCheck,
    k: "Public SLA badge and status page",
    body: "An embeddable widget that shows live uptime and reserve balance on a provider's pricing page.",
  },
  {
    Icon: Bot,
    k: "Pay-per-call SLAs for AI agents",
    body: "Endpoints that agents pay for per request in USDC (x402-style), with the reserve refunding calls that fail the SLA.",
  },
];

const SEVERE_BPS = DEFAULT_TIERS.severeBreachRefundBps;

/** Reserve calculator: monthly price and subscriber count give revenue and the reserve locked per subscriber. */
function ReserveCalculator() {
  const uid = useId();
  const [price, setPrice] = useState(25);
  const [seats, setSeats] = useState(100);
  const priceMinor = usdc(price);
  const coverPerSeat = calculateSubscriberRefundUsdc(priceMinor, SEVERE_BPS);
  const revenue = priceMinor * seats;
  const reserve = coverPerSeat * seats;
  const pricePct = ((price - 1) / 99) * 100;
  const seatPct = ((seats - 1) / 999) * 100;

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-[12px] bg-panel shadow-card">
      <div className="border-b border-line px-5 py-4 sm:px-6 sm:py-5">
        <div className="label">Reserve sizing · default tiers 10 / 25 / 50%</div>
        <div className="mt-1.5 text-[16px] font-semibold tracking-[-0.02em] text-ink">Reserve calculator</div>
      </div>
      <div className="space-y-6 px-5 py-5 sm:px-6 sm:py-6">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={`${uid}-price`} className="text-[13px] font-medium text-slate">
              Monthly price
            </label>
            <span className="font-mono text-[14px] text-ink tabular">{formatUsdc(priceMinor)}</span>
          </div>
          <input
            id={`${uid}-price`}
            type="range"
            min={1}
            max={100}
            step={1}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="range mt-3 w-full"
            style={{ ["--range-pct" as string]: `${pricePct}%` }}
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={`${uid}-seats`} className="text-[13px] font-medium text-slate">
              Subscribers
            </label>
            <span className="font-mono text-[14px] text-ink tabular">{seats.toLocaleString("en-US")}</span>
          </div>
          <input
            id={`${uid}-seats`}
            type="range"
            min={1}
            max={1000}
            step={1}
            value={seats}
            onChange={(e) => setSeats(Number(e.target.value))}
            className="range mt-3 w-full"
            style={{ ["--range-pct" as string]: `${seatPct}%` }}
          />
        </div>
        <dl className="grid grid-cols-2 gap-4" aria-live="polite">
          <div className="min-w-0 rounded-[8px] bg-subtle p-4">
            <dt className="text-[12px] text-slate">Monthly revenue</dt>
            <dd className="mt-2 truncate font-mono text-[20px] font-medium tracking-[-0.03em] text-ink tabular sm:text-[22px]">{formatUsdc(revenue, { decimals: 0 })}</dd>
          </div>
          <div className="min-w-0 rounded-[8px] bg-subtle p-4">
            <dt className="text-[12px] text-slate">Required reserve</dt>
            <dd className="mt-2 truncate font-mono text-[20px] font-medium tracking-[-0.03em] text-ink tabular sm:text-[22px]">{formatUsdc(reserve, { decimals: 0 })}</dd>
          </div>
        </dl>
        <p className="font-mono text-[12px] leading-[1.55] text-dim">
          Each subscription locks its worst-case refund: {formatUsdc(priceMinor)} × {formatBps(SEVERE_BPS, 0)} = {formatUsdc(coverPerSeat)}. The reserve is only spent
          when the SLA is breached. Reserve withdrawals are not available in this testnet build.
        </p>
      </div>
      <div className="mt-auto flex flex-col gap-3 border-t border-line bg-subtle px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span className="text-[13px] leading-[1.5] text-slate">List a test service with sandbox USDC.</span>
        <Link href="/provider" className={cn(buttonVariants({ variant: "primary", size: "md" }), "shrink-0")}>
          List a service <ArrowRight />
        </Link>
      </div>
    </div>
  );
}

export function ForProviders() {
  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end lg:gap-24">
        <Reveal>
          <div className="label flex items-center gap-2">
            <Moon className="size-3.5" aria-hidden />
            For providers
          </div>
          <h2 className="mt-4 text-[36px] font-semibold leading-[1.04] tracking-[-0.045em] sm:text-[52px]">Sell plans backed by an uptime guarantee</h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="max-w-xl text-[17px] leading-[1.65] text-slate">
            Set a monthly price and an uptime target, then fund the USDC reserve that backs them. When the monitor records an outage, subscribers are
            refunded from the reserve and the incident appears in your incident log.
          </p>
        </Reveal>
      </div>

      <div className="mt-12 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-4">
          {PITCH.map(({ Icon, k, body, tag }, i) => (
            <Reveal key={k} delay={i * 0.06} className="flex min-w-0 flex-col rounded-[12px] bg-panel p-6 shadow-card sm:p-7 lg:flex-row lg:gap-6">
              <div className="flex items-center gap-3 lg:w-[220px] lg:shrink-0 lg:items-start">
                <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-subtle text-ink" aria-hidden>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-[18px] font-semibold leading-tight tracking-[-0.03em] text-ink">{k}</div>
                  {tag && <div className="mt-1 font-mono text-[11px] text-dim">{tag}</div>}
                </div>
              </div>
              <p className="mt-4 text-[15px] leading-[1.6] text-slate lg:mt-0">{body}</p>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.12} className="flex min-w-0 [&>*]:flex-1">
          <ReserveCalculator />
        </Reveal>
      </div>

      <div className="mt-16">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="label">Roadmap</div>
          <Link href="/provider" className="inline-flex items-center gap-1.5 text-[14px] font-medium text-ink underline-offset-4 hover:underline">
            Open the provider console <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </div>
        <ol className="mt-5 grid gap-4 md:grid-cols-3">
          {ROADMAP.map(({ Icon, k, body }, i) => (
            <li key={k} className="min-w-0">
              <Reveal delay={i * 0.08} className="flex h-full flex-col rounded-[12px] bg-panel p-6 shadow-card sm:p-7">
                <div className="flex items-center justify-between">
                  <span className="font-pixel text-[13px] text-slate">0{i + 1}</span>
                  <Icon className="size-4 text-dim" aria-hidden />
                </div>
                <div className="mt-8 text-[20px] font-semibold leading-tight tracking-[-0.03em] text-ink">{k}</div>
                <p className="mt-2 text-[15px] leading-[1.6] text-slate">{body}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
