"use client";

/**
 * NumberTicker: local implementation of the free Magic UI `number-ticker` pattern
 * (https://magicui.design/r/number-ticker.json), driven by framer-motion springs.
 * Always tabular-nums so digits never jitter. Honors prefers-reduced-motion.
 */
import { useMotionValue, useSpring } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function NumberTicker({
  value,
  format,
  className,
  stiffness = 55,
  damping = 17,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
  stiffness?: number;
  damping?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const mv = useMotionValue(value);
  const spring = useSpring(mv, { stiffness, damping, mass: 1 });
  const formatRef = useRef(format);
  formatRef.current = format;

  useEffect(() => {
    if (reduce) {
      spring.jump(value);
    } else {
      mv.set(value);
    }
  }, [value, reduce, mv, spring]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => {
      if (ref.current) ref.current.textContent = formatRef.current(v);
    });
    return () => unsub();
  }, [spring]);

  return (
    <span ref={ref} className={cn("tabular font-mono", className)}>
      {format(value)}
    </span>
  );
}
