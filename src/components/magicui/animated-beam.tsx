"use client";

/**
 * AnimatedBeam: local implementation of the free Magic UI `animated-beam` pattern.
 * Draws a hairline connector between two elements and sends a single Base Blue
 * dash along it (stroke-dashoffset only) every time `pulseKey` changes.
 */
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useEffect, useId, useState, type RefObject } from "react";

export function AnimatedBeam({
  containerRef,
  fromRef,
  toRef,
  pulseKey,
  curvature = 0,
  vertical = false,
  fromColor = "#0052FF",
  toColor = "#0052FF",
  idle = false,
  duration = 1.4,
  delay = 0,
}: {
  containerRef: RefObject<HTMLElement | null>;
  fromRef: RefObject<HTMLElement | null>;
  toRef: RefObject<HTMLElement | null>;
  pulseKey: number | string;
  curvature?: number;
  vertical?: boolean;
  fromColor?: string;
  toColor?: string;
  /** continuous slow pulse even without new events */
  idle?: boolean;
  duration?: number;
  /** seconds before a pulse launches (choreography offset) */
  delay?: number;
}) {
  const id = useId().replace(/:/g, "");
  const reduce = useReducedMotion();
  const [geo, setGeo] = useState<{ d: string; w: number; h: number; x1: number; y1: number; x2: number; y2: number } | null>(null);

  useEffect(() => {
    const update = () => {
      const c = containerRef.current;
      const a = fromRef.current;
      const b = toRef.current;
      if (!c || !a || !b) return;
      const cr = c.getBoundingClientRect();
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      let x1: number, y1: number, x2: number, y2: number;
      if (vertical) {
        x1 = ar.left - cr.left + ar.width / 2;
        y1 = ar.bottom - cr.top;
        x2 = br.left - cr.left + br.width / 2;
        y2 = br.top - cr.top;
      } else {
        x1 = ar.right - cr.left;
        y1 = ar.top - cr.top + ar.height / 2;
        x2 = br.left - cr.left;
        y2 = br.top - cr.top + br.height / 2;
      }
      const d = vertical
        ? `M ${x1},${y1} C ${x1 + curvature},${(y1 + y2) / 2} ${x2 - curvature},${(y1 + y2) / 2} ${x2},${y2}`
        : `M ${x1},${y1} C ${(x1 + x2) / 2},${y1 - curvature} ${(x1 + x2) / 2},${y2 - curvature} ${x2},${y2}`;
      setGeo({ d, w: cr.width, h: cr.height, x1, y1, x2, y2 });
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    if (fromRef.current) ro.observe(fromRef.current);
    if (toRef.current) ro.observe(toRef.current);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [containerRef, fromRef, toRef, curvature, vertical]);

  if (!geo) return null;
  return (
    <svg aria-hidden className="pointer-events-none absolute left-0 top-0" width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`} fill="none">
      <defs>
        <linearGradient id={`g-${id}`} gradientUnits="userSpaceOnUse" x1={geo.x1} y1={geo.y1} x2={geo.x2} y2={geo.y2}>
          <stop offset="0%" stopColor={fromColor} />
          <stop offset="100%" stopColor={toColor} />
        </linearGradient>
      </defs>
      <path d={geo.d} style={{ stroke: "color-mix(in srgb, var(--ink) 18%, transparent)" }} strokeWidth={1} strokeDasharray="2 4" />
      {!reduce && (
        <motion.path
          key={String(pulseKey)}
          d={geo.d}
          stroke={`url(#g-${id})`}
          strokeWidth={2}
          strokeLinecap="butt"
          pathLength={1}
          strokeDasharray="0.18 1.2"
          initial={{ strokeDashoffset: 0.18, opacity: pulseKey === 0 && !idle ? 0 : 1 }}
          animate={{ strokeDashoffset: -1.02 }}
          transition={idle ? { duration: duration * 2.2, repeat: Infinity, ease: "linear" } : { duration, delay, ease: [0.65, 0, 0.35, 1] }}
        />
      )}
    </svg>
  );
}
