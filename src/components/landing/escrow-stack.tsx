"use client";

import { motion, useInView, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useRef, useState } from "react";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { CountUp, DrawPath, TypeOut } from "./kinetic";

/* ---------------- vignettes: small diagrams drawn when they enter the viewport ---------------- */

function useActive() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.45 });
  return { ref, inView };
}

function NodeBox({ x, y, w = 92, label, value, accent = false }: { x: number; y: number; w?: number; label: string; value: string; accent?: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={52} rx={4} style={{ fill: "var(--canvas)", stroke: accent ? "var(--ink)" : "color-mix(in srgb, var(--ink) 24%, transparent)" }} />
      <text x={x + 10} y={y + 19} style={{ fill: "var(--dim)" }} fontSize="8.5" letterSpacing="1">
        {label}
      </text>
      <text x={x + 10} y={y + 38} style={{ fill: "var(--ink)" }} fontSize="13">
        {value}
      </text>
    </g>
  );
}

function SubscribeVignette() {
  const { ref, inView } = useActive();
  const reduce = useReducedMotion();
  const path = "M 112 76 L 248 76";
  return (
    <div ref={ref} className="relative">
      <svg viewBox="0 0 360 152" className="w-full font-mono">
        <NodeBox x={20} y={50} label="SUBSCRIBER" value="$100.00" />
        <NodeBox x={248} y={50} label="PROVIDER" value="+$10.00" />
        <path d={path} style={{ stroke: "color-mix(in srgb, var(--ink) 16%, transparent)" }} strokeDasharray="2 4" />
        <DrawPath d={path} active={inView} stroke="var(--ink)" width={1.5} duration={1.0} />
        <motion.g
          initial={{ x: 0, opacity: 0 }}
          animate={inView ? { x: reduce ? 136 : [0, 136], opacity: [0, 1, 1, 0] } : { x: 0, opacity: 0 }}
          transition={{ duration: 1.4, ease: EASE, repeat: inView && !reduce ? Infinity : 0, repeatDelay: 0.8 }}
        >
          <rect x={112} y={66} width={50} height={20} rx={10} style={{ fill: "var(--ink)" }} />
          <text x={137} y={80} textAnchor="middle" fill="#fff" fontSize="9">
            10 USDC
          </text>
        </motion.g>
        <text x={180} y={130} textAnchor="middle" style={{ fill: "var(--dim)" }} fontSize="9" letterSpacing="1">
          subscribe(2) · transferFrom
        </text>
      </svg>
    </div>
  );
}

function ReserveVignette() {
  const { ref, inView } = useActive();
  const reduce = useReducedMotion();
  return (
    <div ref={ref} className="flex items-end gap-6 px-2">
      <div className="flex h-[120px] w-24 flex-col-reverse gap-[3px] rounded-[8px] border border-ink/20 p-[5px]" aria-hidden>
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.span
            key={i}
            className="h-[6px] origin-left bg-ink"
            initial={{ scaleX: reduce ? 1 : 0 }}
            animate={{ scaleX: inView || reduce ? 1 : 0 }}
            transition={{ duration: 0.55, delay: reduce ? 0 : i * 0.06, ease: EASE }}
          />
        ))}
      </div>
      <div className="pb-1">
        <div className="label">reserveBalanceUsdc</div>
        <div className="mt-2 font-mono text-[30px] font-medium leading-none tracking-[-0.04em]">
          <CountUp to={5000} format={(v) => `$${Math.round(v).toLocaleString("en-US")}`} />
        </div>
        <div className="mt-2 font-mono text-[11px] text-slate">fundReserve(2, 5_000_000_000)</div>
      </div>
    </div>
  );
}

function AttestVignette() {
  const { ref, inView } = useActive();
  const healthy = "M 0 60 L 40 60 L 46 60 L 50 66 L 54 22 L 59 74 L 63 60 L 110 60 L 116 66 L 120 22 L 125 74 L 129 60 L 176 60";
  const flat = "M 176 60 L 330 60";
  return (
    <div ref={ref}>
      <svg viewBox="0 0 330 100" className="w-full font-mono">
        <line x1="0" x2="330" y1="30" y2="30" style={{ stroke: "color-mix(in srgb, var(--ink) 28%, transparent)" }} strokeDasharray="2 4" />
        <text x="330" y="24" textAnchor="end" style={{ fill: "var(--slate)" }} fontSize="8.5">
          SLA 99.95%
        </text>
        <DrawPath d={healthy} active={inView} duration={1.1} />
        <DrawPath d={flat} active={inView} delay={0.85} duration={0.9} stroke="var(--down)" width={1.5} />
        <motion.text
          x="260"
          y="84"
          textAnchor="middle"
          style={{ fill: "var(--down)" }}
          fontSize="9"
         
          initial={{ opacity: 0 }}
          animate={{ opacity: inView ? 1 : 0 }}
          transition={{ delay: 1.3, duration: 0.5 }}
        >
          480 MIN · 503
        </motion.text>
      </svg>
      <div className="mt-3 rounded-[8px] border border-line-strong px-3 py-2 font-mono text-[11px]">
        <div className="text-dim">attestationHash = keccak256(2, 1, 480, 9888)</div>
        <TypeOut start={inView} className="mt-1 block break-all text-ink" text="0x8f3ac2e94b1d07a6f15c0e2b9d4478e1a3c6f09d2b5e7a81c4d3f60e9b2a1c75" />
      </div>
    </div>
  );
}

function CompensateVignette() {
  const { ref, inView } = useActive();
  const p1 = "M 104 46 L 133 46";
  const p2 = "M 225 46 L 254 46";
  return (
    <div ref={ref}>
      <svg viewBox="0 0 360 120" className="w-full font-mono">
        <NodeBox x={12} y={20} label="RESERVE" value="$4,997.50" />
        <NodeBox x={133} y={20} label="VAULT" value="$2.50" accent />
        <NodeBox x={254} y={20} w={94} label="WALLET" value="+$2.50" />
        <path d={p1} style={{ stroke: "color-mix(in srgb, var(--ink) 16%, transparent)" }} strokeDasharray="2 4" />
        <path d={p2} style={{ stroke: "color-mix(in srgb, var(--ink) 16%, transparent)" }} strokeDasharray="2 4" />
        <DrawPath d={p1} active={inView} stroke="var(--ink)" width={2} duration={0.7} delay={0.2} />
        <DrawPath d={p2} active={inView} stroke="var(--ink)" width={2} duration={0.7} delay={0.8} />
        <text x={180} y={104} textAnchor="middle" style={{ fill: "var(--dim)" }} fontSize="9" letterSpacing="1">
          (10,000,000 × 2,500) / 10,000 = 2,500,000
        </text>
      </svg>
    </div>
  );
}

/* ---------------- the stack ---------------- */

const STEPS = [
  { idx: "01", title: "Subscribe in USDC", fn: "subscribe(serviceId)", body: "The subscriber pays the monthly price in USDC on Base. The uptime guarantee applies from that block.", V: SubscribeVignette },
  { idx: "02", title: "Provider funds the reserve", fn: "fundReserve(serviceId, amount)", body: "The provider deposits USDC into the UpHealthSLA contract. Each subscription locks its worst-case refund from this reserve, and the balance is public.", V: ReserveVignette },
  { idx: "03", title: "Monitor records the outage", fn: "recordOutage(id, minutes, hash)", body: "The watchdog checks each service and records downtime after 3 failed checks in a row. Each record is hashed with keccak256 and submitted to the contract.", V: AttestVignette },
  { idx: "04", title: "Subscriber claims the refund", fn: "claimCompensation(serviceId)", body: "If uptime falls below the guarantee, the subscriber claims the refund for the matching tier. The USDC comes out of the provider’s reserve.", V: CompensateVignette },
];

function StackCard({ i, n, progress, step }: { i: number; n: number; progress: MotionValue<number>; step: (typeof STEPS)[number] }) {
  const reduce = useReducedMotion();
  const target = 1 - (n - 1 - i) * 0.035; // earlier cards sink further back
  const start = i / n;
  const scale = useTransform(progress, [start, 1], [1, i === n - 1 ? 1 : Math.max(0.93, target)]);
  const dim = useTransform(progress, [start + 1 / n - 0.05, 1], [0, i === n - 1 ? 0 : 0.55]);
  const V = step.V;
  return (
    <div className={cn("sticky", i === n - 1 ? "pb-4" : "h-[72vh] min-h-[460px]")} style={{ top: 96 + i * 16 }}>
      <motion.article
        style={reduce ? undefined : { scale, transformOrigin: "50% 0%" }}
        className="relative overflow-hidden rounded-[12px] bg-panel shadow-raised"
      >
        <div className="grid gap-px bg-line md:grid-cols-[1fr_1.1fr]">
          <div className="flex flex-col bg-panel p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="font-pixel text-[13px] text-slate">{step.idx}</span>
              <span className="h-px flex-1 bg-line" />
              <span className="label">step {i + 1} / {n}</span>
            </div>
            <h3 className="mt-8 text-[28px] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-[34px]">{step.title}</h3>
            <p className="mt-3 max-w-sm text-[14.5px] text-slate">{step.body}</p>
            <code className="mt-auto pt-8 font-mono text-[12px] text-ink">
              <span className="text-dim">UpHealthSLA.</span>
              {step.fn}
            </code>
          </div>
          <div className="flex min-h-[260px] items-center bg-canvas p-6 sm:p-8">
            <div className="w-full">
              <V />
            </div>
          </div>
        </div>
        {!reduce && <motion.div aria-hidden className="pointer-events-none absolute inset-0 bg-canvas" style={{ opacity: dim }} />}
      </motion.article>
    </div>
  );
}

/**
 * Scroll-pinned card stack: the left column stays pinned while each step card slides up
 * and the previous card scales from 1 to 0.93 and dims.
 */
export function EscrowStack() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setActive(Math.min(STEPS.length - 1, Math.floor(v * STEPS.length))));
  const bar = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <div ref={ref} className="relative grid gap-10 lg:grid-cols-[0.75fr_1.25fr]">
      <div className="lg:sticky lg:top-28 lg:h-[70vh] lg:self-start">
        <div className="label">How it works · UpHealthSLA.sol</div>
        <h2 className="mt-3 text-[36px] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[48px]">Four contract calls from subscription to refund</h2>
        <ol className="relative mt-10 hidden border-l border-line lg:block">
          <motion.span aria-hidden className="absolute -left-px top-0 h-full w-px origin-top bg-ink" style={{ scaleY: bar }} />
          {STEPS.map((s, i) => (
            <li key={s.idx} className="relative py-2.5 pl-5">
              <span
                aria-hidden
                className={cn("absolute -left-[3.5px] top-[17px] size-[6px] transition-colors duration-700", i <= active ? "bg-ink" : "bg-raised")}
                style={{ outline: "1px solid color-mix(in srgb, var(--ink) 30%, transparent)" }}
              />
              <div className={cn("flex items-baseline gap-3 transition-colors", i === active ? "text-ink" : "text-dim")}>
                <span className="font-pixel text-[11px]">{s.idx}</span>
                <span className="text-[15px] tracking-[-0.02em]">{s.title}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="relative">
        {STEPS.map((s, i) => (
          <StackCard key={s.idx} i={i} n={STEPS.length} progress={scrollYProgress} step={s} />
        ))}
      </div>
    </div>
  );
}
