"use client";

import React, { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export type SpotlightCardProps = React.HTMLAttributes<HTMLDivElement> & {
  spotlightColor?: string;
  intensity?: number;
  spotlightSize?: number;
  borderGlow?: number;
};

export function SpotlightCard({
  children,
  className = "",
  style,
  spotlightColor = "rgba(164, 210, 196, 0.15)",
  spotlightSize = 280,
  intensity = 0.28,
  borderGlow = 0.5,
  ...rest
}: SpotlightCardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const edgeRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    const glow = glowRef.current;
    const edge = edgeRef.current;
    if (!root || !glow || !edge || reduce || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      glow.style.opacity = String(intensity);
      glow.style.background = `radial-gradient(circle ${spotlightSize}px at ${x}px ${y}px, ${spotlightColor}, transparent 70%)`;
      edge.style.opacity = String(borderGlow);
      edge.style.background = `radial-gradient(circle ${spotlightSize * 0.7}px at ${x}px ${y}px, #bdd9d0, transparent 70%)`;
    };

    const handlePointerLeave = () => {
      glow.style.opacity = "0";
      edge.style.opacity = "0";
    };

    root.addEventListener("pointermove", handlePointerMove, { passive: true });
    root.addEventListener("pointerleave", handlePointerLeave, { passive: true });

    return () => {
      root.removeEventListener("pointermove", handlePointerMove);
      root.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [spotlightColor, spotlightSize, intensity, borderGlow, reduce]);

  return (
    <div
      ref={rootRef}
      className={cn(
        "instrument-panel group relative isolate overflow-hidden rounded-xl border border-line bg-surface transition-all duration-300",
        className
      )}
      style={style}
      {...rest}
    >
      {/* Dynamic Cursor Spotlight Layer */}
      <div
        ref={glowRef}
        aria-hidden="true"
        className="instrument-light pointer-events-none absolute -inset-px -z-10 rounded-[inherit] opacity-0 transition-opacity duration-300"
      />
      <div ref={edgeRef} aria-hidden="true" className="instrument-light instrument-edge pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300" />
      {children}
    </div>
  );
}

export default SpotlightCard;
