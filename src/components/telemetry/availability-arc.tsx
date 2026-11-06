"use client";

import { motion, useReducedMotion } from "framer-motion";

/** Decorative companion to the exact, accessible basis-point readout. */
export function AvailabilityArc({ uptimeBps, slaBps, breached }: { uptimeBps: number; slaBps: number; breached: boolean }) {
  const reduce = useReducedMotion();
  const fraction = Math.max(0, Math.min(1, (uptimeBps - 9600) / 400));
  const threshold = Math.max(0, Math.min(1, (slaBps - 9600) / 400));
  const color = breached ? "#ef4444" : "#10b981";
  const theta = Math.PI * (1 - threshold);
  return (
    <svg viewBox="0 0 200 114" className="availability-arc" fill="none" aria-hidden="true">
      <path d="M18 100 A82 82 0 0 1 182 100" stroke="#283635" strokeWidth="12" />
      <path d="M18 100 A82 82 0 0 1 182 100" stroke="#0b1213" strokeWidth="12" strokeDasharray="1 8" />
      <motion.path
        d="M18 100 A82 82 0 0 1 182 100" stroke={color} strokeWidth="12"
        pathLength={1} strokeDasharray="1 1" initial={false}
        animate={{ strokeDashoffset: 1 - fraction, stroke: color }}
        transition={{ duration: reduce ? 0 : 0.7, ease: [0.16, 1, 0.3, 1] }}
        opacity="0.8"
      />
      <path d="M35 100 A65 65 0 0 1 165 100" stroke="#34433e" strokeDasharray="1 5" />
      <line x1={100 + 72 * Math.cos(theta)} y1={100 - 72 * Math.sin(theta)} x2={100 + 94 * Math.cos(theta)} y2={100 - 94 * Math.sin(theta)} stroke="#f7f8f5" strokeWidth="2" />
      <motion.g initial={false} animate={{ rotate: fraction * 180 }} style={{ originX: "100px", originY: "100px" }} transition={{ duration: reduce ? 0 : 0.7, ease: [0.16, 1, 0.3, 1] }}>
        <path d="M100 96 L43 100 L100 104 Z" fill={color} />
      </motion.g>
      <circle cx="100" cy="100" r="6" fill="#0c1314" stroke={color} strokeWidth="2" />
      <g fill="#85939b" fontFamily="var(--font-mono)" fontSize="7">
        <text x="18" y="113">96%</text>
        <text x="182" y="113" textAnchor="end">100%</text>
      </g>
    </svg>
  );
}
