"use client";

import { ReactLenis } from "lenis/react";
import type { ReactNode } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

/**
 * Inertial smooth scrolling (Lenis). Wheel input eases into motion instead of jumping
 * in 100px steps, so every scroll-linked choreography glides. Native scroll is kept
 * for touch devices and for anyone who prefers reduced motion.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <ReactLenis root options={{ lerp: 0.09, wheelMultiplier: 0.95, smoothWheel: true, syncTouch: false, anchors: true, allowNestedScroll: true }}>
      {children}
    </ReactLenis>
  );
}
