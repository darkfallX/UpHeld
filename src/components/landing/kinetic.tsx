"use client";

import { animate, motion, useInView, useMotionValue, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useEffect, useRef, useState } from "react";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Progressive headline illumination: words scrub 0.2 → 1 on scroll   */
/* ------------------------------------------------------------------ */

function Word({ children, progress, range, still }: { children: string; progress: MotionValue<number>; range: [number, number]; still: boolean }) {
  const opacity = useTransform(progress, range, [0.2, 1]);
  return (
    <motion.span style={{ opacity: still ? 1 : opacity }} className="inline-block">
      {children}
      {" "}
    </motion.span>
  );
}

export function ScrubText({ text, className, as: Tag = "h2" }: { text: string; className?: string; as?: "h2" | "p" | "h3" }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.92", "start 0.38"] });
  const words = text.split(" ");
  const Comp = motion[Tag];
  // same markup on server and client (no hydration mismatch); reduced motion pins opacity to 1
  return (
    <Comp ref={ref as React.RefObject<HTMLHeadingElement>} className={cn("flex flex-wrap", className)}>
      {words.map((w, i) => (
        <Word key={i} still={!!reduce} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
          {w}
        </Word>
      ))}
    </Comp>
  );
}

/* ------------------------------------------------------------------ */
/* Count-up on viewport entry (tabular, no jitter)                     */
/* ------------------------------------------------------------------ */

export function CountUp({ to, format, className, duration = 1.1 }: { to: number; format: (n: number) => string; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const [text, setText] = useState(() => format(0));
  useEffect(() => {
    if (!inView) return;
    if (reduce) return setText(format(to));
    const c = animate(mv, to, { duration, ease: EASE });
    const u = mv.on("change", (v) => setText(format(v)));
    return () => {
      c.stop();
      u();
    };
  }, [inView, reduce, to, duration, format, mv]);
  return (
    <span ref={ref} className={cn("tabular", className)}>
      {text}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Typewriter for hashes                                               */
/* ------------------------------------------------------------------ */

export function TypeOut({ text, start, className, speed = 22 }: { text: string; start: boolean; className?: string; speed?: number }) {
  const [n, setN] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!start) return;
    if (reduce) return setN(text.length);
    setN(0);
    const t = setInterval(() => setN((x) => (x >= text.length ? (clearInterval(t), x) : x + 1)), speed);
    return () => clearInterval(t);
  }, [start, text, reduce, speed]);
  return <span className={cn(className, n < text.length && "caret")}>{text.slice(0, n)}</span>;
}

/* ------------------------------------------------------------------ */
/* Self-drawing path                                                   */
/* ------------------------------------------------------------------ */

export function DrawPath({ d, active, delay = 0, duration = 1.4, stroke = "var(--ink)", width = 1.25, dash }: { d: string; active: boolean; delay?: number; duration?: number; stroke?: string; width?: number; dash?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.path
      d={d}
      fill="none"
      style={{ stroke }}
      strokeWidth={width}
      strokeDasharray={dash}
      initial={{ pathLength: reduce ? 1 : 0 }}
      animate={{ pathLength: active || reduce ? 1 : 0 }}
      transition={{ duration: reduce ? 0 : duration, delay: reduce ? 0 : delay, ease: EASE }}
      vectorEffect="non-scaling-stroke"
    />
  );
}
