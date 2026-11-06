"use client";

import { useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";

export interface MagnetProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: number;
  disabled?: boolean;
  magnetStrength?: number;
  wrapperClassName?: string;
  innerClassName?: string;
}

export function Magnet({
  children,
  padding = 60,
  disabled = false,
  magnetStrength = 2.5,
  wrapperClassName = "",
  innerClassName = "",
  style,
  ...props
}: MagnetProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const inner = innerRef.current;
    if (!wrapper || !inner || disabled || shouldReduceMotion) return;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = wrapper.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distX = e.clientX - centerX;
      const distY = e.clientY - centerY;
      const distance = Math.hypot(distX, distY);

      if (distance < padding + Math.max(rect.width, rect.height) / 2) {
        const pullX = distX / magnetStrength;
        const pullY = distY / magnetStrength;
        inner.style.transform = `translate3d(${pullX.toFixed(2)}px, ${pullY.toFixed(2)}px, 0)`;
        inner.style.transition = "transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)";
      } else {
        inner.style.transform = "translate3d(0, 0, 0)";
        inner.style.transition = "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)";
      }
    };

    const handlePointerLeave = () => {
      inner.style.transform = "translate3d(0, 0, 0)";
      inner.style.transition = "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)";
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    wrapper.addEventListener("pointerleave", handlePointerLeave, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      wrapper.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [disabled, magnetStrength, padding, shouldReduceMotion]);

  return (
    <div
      ref={wrapperRef}
      className={wrapperClassName}
      style={{ position: "relative", display: "inline-block", ...style }}
      {...props}
    >
      <div ref={innerRef} className={innerClassName} style={{ willChange: "transform" }}>
        {children}
      </div>
    </div>
  );
}

export default Magnet;
