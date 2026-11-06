"use client";

/**
 * BorderBeam: local implementation of the free Magic UI `border-beam` pattern.
 * A light segment that travels around a card border (used on active SLA-breach cards).
 */
import { motion, useReducedMotion } from "framer-motion";

export function BorderBeam({ color = "#10B981", duration = 4, size = 80 }: { color?: string; duration?: number; size?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1" style={{ boxShadow: `inset 0 0 0 1px ${color}` }} />;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]"
    >
      <motion.div
        className="absolute aspect-square"
        style={{
          width: size,
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          background: `linear-gradient(to left, ${color}, transparent)`,
        }}
        initial={{ offsetDistance: "0%" }}
        animate={{ offsetDistance: "100%" }}
        transition={{ repeat: Infinity, ease: "linear", duration }}
      />
    </div>
  );
}
