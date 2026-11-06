"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const MonolithScene = dynamic(() => import("./monolith-scene"), { ssr: false });

/**
 * Static UpHeld Monolith: the same U, drawn as a lit 2.5D solid in SVG.
 * Used as the fallback when WebGL is unavailable.
 */
export function MonolithStatic({ className }: { className?: string }) {
  // U outline in a 200×240 box: outer r=100, stem thickness 56, stems rise 128 above arc centre
  const u = "M 0 0 L 0 128 A 100 100 0 0 0 200 128 L 200 0 L 144 0 L 144 128 A 44 44 0 0 1 56 128 L 56 0 Z";
  return (
    <svg viewBox="-30 -30 290 320" className={className} aria-hidden>
      <defs>
        <linearGradient id="mono-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4f4f4" />
          <stop offset="0.45" stopColor="#c9c9c9" />
          <stop offset="0.75" stopColor="#8d8d8d" />
          <stop offset="1" stopColor="#d6d6d6" />
        </linearGradient>
        <linearGradient id="mono-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3a3a3a" />
          <stop offset="1" stopColor="#151515" />
        </linearGradient>
        <radialGradient id="mono-pool" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="118" cy="268" rx="120" ry="16" fill="url(#mono-pool)" />
      {/* extrusion: back face offset, then the lit front face */}
      <path d={u} transform="translate(22 14)" fill="url(#mono-side)" />
      <path d={u} fill="url(#mono-face)" />
      <path d={u} fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.2" />
    </svg>
  );
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * The UpHeld Monolith. Lazily loads the WebGL scene, which runs its own entrance animation
 * (rise, settle, light ramp). Rendering pauses when scrolled out of view, the pose is static
 * under prefers-reduced-motion, and the SVG is shown when WebGL is unavailable.
 */
export function Monolith({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const theme = useTheme((t) => t.theme);
  const wrap = useRef<HTMLDivElement>(null);
  const scrollRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0 });
  const [gl, setGl] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(true);
  const [quality, setQuality] = useState<"high" | "low">("high");

  useEffect(() => {
    setGl(hasWebGL());
    setQuality(window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768 ? "low" : "high");
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { rootMargin: "120px" });
    io.observe(el);
    const onScroll = () => {
      const hero = el.closest("section") ?? el;
      const h = hero.getBoundingClientRect().height || window.innerHeight;
      scrollRef.current = Math.max(0, Math.min(1, window.scrollY / (h * 0.9)));
    };
    const onMove = (e: PointerEvent) => {
      pointerRef.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 };
    };
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      pointerRef.current = { x: Math.max(-1, Math.min(1, e.gamma / 30)), y: Math.max(-1, Math.min(1, (e.beta - 45) / 30)) };
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("deviceorientation", onOrient, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("deviceorientation", onOrient);
    };
  }, []);

  return (
    <div ref={wrap} className={cn("relative", className)} role="img" aria-label="UpHeld logo: a silver letter U">
      <div
        className="absolute inset-0 flex items-center justify-center transition-opacity duration-[1400ms] ease-[cubic-bezier(0.39,0.18,0.17,0.99)]"
        style={{ opacity: gl === false ? 1 : 0 }}
      >
        <MonolithStatic className="h-[78%] w-auto" />
      </div>
      {gl && (
        <div
          className="absolute inset-0 transition-opacity duration-[1400ms] ease-[cubic-bezier(0.39,0.18,0.17,0.99)]"
          style={{ opacity: ready ? 1 : 0 }}
        >
          <MonolithScene still={reduce} scrollRef={scrollRef} pointerRef={pointerRef} onReady={() => setReady(true)} quality={quality} active={active} light={theme === "light"} />
        </div>
      )}
    </div>
  );
}
