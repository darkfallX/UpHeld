"use client";

import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

/**
 * Ambient background ("Merkle weave").
 *
 * The 90 hairline columns are the 90 eight-hour windows of a 30-day SLA. They are never
 * static and never "rain": attestation packets glide along them with an ease-in-out
 * motion, slow to a stop on a block row and *commit*: a node stamps in, a short hex
 * digest types itself out, and some commits reach across to a neighbouring column,
 * drawing a Merkle-style bracket with a parent stub. Every element fades in and out on
 * the same curve, so nothing flickers.
 *
 *  • Columns drift in a slow harmonic wave and brighten softly around the cursor.
 *  • Scroll velocity gently speeds the weave up; it eases back when you stop.
 *  • Canvas, DPR-aware, paused when the tab is hidden; static lines under reduced motion.
 */

const COLS = 90;
const ROW = 72; // px between block rows
const HEX = "0123456789abcdef";

type Packet = { col: number; from: number; to: number; t0: number; dur: number; len: number; accent: boolean };
type Commit = { col: number; y: number; t0: number; hex: string; accent: boolean; link: null | { toCol: number; up: boolean } };

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
/** 0 → 1 → 0 envelope with smooth shoulders */
const envelope = (t: number, fadeIn: number, fadeOut: number) => {
  if (t <= 0 || t >= 1) return 0;
  if (t < fadeIn) return easeInOut(t / fadeIn);
  if (t > 1 - fadeOut) return easeInOut((1 - t) / fadeOut);
  return 1;
};

function readRgb(el: Element, name: string, fallback: string) {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return (v || fallback).split(/\s+/).join(",");
}

export function AmbientField({ contained = false, intensity = 1 }: { contained?: boolean; intensity?: number } = {}) {
  const reduce = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // halftone matrix drifts with (smoothed) scroll, compositor-only
  const { scrollY } = useScroll();
  const smoothY = useSpring(scrollY, { stiffness: 40, damping: 18, mass: 1 });
  const dotY = useTransform(smoothY, (v) => -((v * 0.06) % 18));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    const themed = () => (canvas.closest("[data-theme]") as HTMLElement | null) ?? document.documentElement;
    let ink = readRgb(themed(), "--ink-rgb", "23 23 23");
    let accent = readRgb(themed(), "--accent-rgb", "0 112 243");
    let light = themed().getAttribute("data-theme") !== "dark";
    let mono = getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono").trim() || "ui-monospace, monospace";

    const host = canvas.parentElement as HTMLElement;
    let origin = { x: 0, y: 0 };
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = host.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const themeObserver = new MutationObserver(() => {
      ink = readRgb(themed(), "--ink-rgb", "23 23 23");
      accent = readRgb(themed(), "--accent-rgb", "0 112 243");
      light = themed().getAttribute("data-theme") !== "dark";
      mono = getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono").trim() || mono;
      if (reduce) drawStatic();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const colX = (c: number) => Math.round((c * w) / COLS) + 0.5;
    // light paper needs a touch more ink to read at the same perceived weight
    const k = () => (light ? 0.6 : 1) * intensity;

    function drawLines(time: number, cx: number, cy: number, cursorOn: number) {
      for (let c = 0; c < COLS; c++) {
        const x = colX(c);
        const wave = 0.5 + 0.5 * Math.sin(time * 0.00035 + c * 0.32); // slow harmonic drift
        const a = (0.032 + 0.026 * wave) * k();
        ctx!.strokeStyle = `rgba(${ink},${a})`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(x, 0);
        ctx!.lineTo(x, h);
        ctx!.stroke();
        if (cursorOn > 0.01) {
          const dx = x - cx;
          const near = Math.exp(-(dx * dx) / (2 * 90 * 90)) * cursorOn;
          if (near > 0.02) {
            const g = ctx!.createLinearGradient(0, cy - 260, 0, cy + 260);
            g.addColorStop(0, `rgba(${ink},0)`);
            g.addColorStop(0.5, `rgba(${ink},${0.2 * near * k()})`);
            g.addColorStop(1, `rgba(${ink},0)`);
            ctx!.strokeStyle = g;
            ctx!.beginPath();
            ctx!.moveTo(x, cy - 260);
            ctx!.lineTo(x, cy + 260);
            ctx!.stroke();
          }
        }
      }
    }

    function drawStatic() {
      ctx!.clearRect(0, 0, w, h);
      drawLines(0, -9999, -9999, 0);
    }

    if (reduce) {
      drawStatic();
      const onResize = () => {
        resize();
        drawStatic();
      };
      window.addEventListener("resize", onResize);
      return () => {
        window.removeEventListener("resize", onResize);
        themeObserver.disconnect();
      };
    }

    // ---------------- animated weave ----------------
    const packets: Packet[] = [];
    const commits: Commit[] = [];
    let raf = 0;
    let last = performance.now();
    let spawnAcc = 0;
    let speed = 1; // eased multiplier from scroll velocity
    let targetSpeed = 1;
    let lastScroll = window.scrollY;
    const cursor = { x: -9999, y: -9999, tx: -9999, ty: -9999, on: 0, target: 0 };

    const rows = () => Math.max(4, Math.floor(h / ROW));
    const randHex = (n: number) => Array.from({ length: n }, () => HEX[(Math.random() * 16) | 0]).join("");

    const spawn = (now: number) => {
      const r = rows();
      const col = (Math.random() * COLS) | 0;
      const from = (Math.random() * (r + 2) - 1) | 0;
      const span = 2 + ((Math.random() * 4) | 0);
      const down = Math.random() < 0.62;
      const to = Math.max(0, Math.min(r, down ? from + span : from - span));
      if (to === from) return;
      packets.push({
        col,
        from,
        to,
        t0: now,
        dur: 2600 + Math.abs(to - from) * 520 + Math.random() * 900,
        len: 46 + Math.random() * 70,
        accent: false,
      });
    };

    const commit = (p: Packet, now: number) => {
      let link: Commit["link"] = null;
      if (Math.random() < 0.42) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        const toCol = Math.max(0, Math.min(COLS - 1, p.col + dir * (1 + ((Math.random() * 3) | 0))));
        if (toCol !== p.col) link = { toCol, up: Math.random() < 0.7 };
      }
      commits.push({ col: p.col, y: p.to * ROW + ROW / 2, t0: now, hex: `0x${randHex(4)}`, accent: p.accent, link });
      if (commits.length > 40) commits.shift();
    };

    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      origin = { x: r.left, y: r.top };
      cursor.tx = e.clientX - origin.x;
      cursor.ty = e.clientY - origin.y;
      cursor.target = 1;
      if (cursor.x < -9000) {
        cursor.x = cursor.tx;
        cursor.y = cursor.ty;
      }
    };
    const onLeave = () => (cursor.target = 0);
    const onResize = () => resize();
    const ro = new ResizeObserver(() => resize());
    ro.observe(host);
    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    function frame(now: number) {
      const dt = Math.min(64, now - last);
      last = now;

      // scroll velocity → gentle speed-up, eased both ways
      const sy = window.scrollY;
      const v = Math.abs(sy - lastScroll) / Math.max(1, dt); // px/ms
      lastScroll = sy;
      targetSpeed = 1 + Math.min(0.9, v * 0.35);
      speed += (targetSpeed - speed) * (1 - Math.exp(-dt / 420));

      // cursor follows with exponential smoothing (no jitter)
      const follow = 1 - Math.exp(-dt / 140);
      cursor.x += (cursor.tx - cursor.x) * follow;
      cursor.y += (cursor.ty - cursor.y) * follow;
      cursor.on += (cursor.target - cursor.on) * (1 - Math.exp(-dt / 380));

      // spawn rate scales with viewport area
      const perSec = 0.9 + (w * h) / 900_000;
      spawnAcc += (dt / 1000) * perSec * speed;
      while (spawnAcc >= 1 && packets.length < 34) {
        spawn(now);
        spawnAcc -= 1;
      }

      ctx!.clearRect(0, 0, w, h);
      drawLines(now, cursor.x, cursor.y, cursor.on);

      // packets
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i];
        const raw = ((now - p.t0) * speed) / p.dur;
        if (raw >= 1) {
          commit(p, now);
          packets.splice(i, 1);
          continue;
        }
        const t = easeInOut(clamp01(raw));
        const y0 = p.from * ROW + ROW / 2;
        const y1 = p.to * ROW + ROW / 2;
        const y = y0 + (y1 - y0) * t;
        const dir = Math.sign(y1 - y0);
        // tail stretches with velocity (derivative of the ease), so motion reads as momentum
        const vel = raw < 0.5 ? 12 * raw * raw : 12 * (1 - raw) * (1 - raw);
        const len = p.len * (0.35 + 0.65 * Math.min(1, vel / 3));
        const fade = envelope(raw, 0.12, 0.08);
        const x = colX(p.col);
        const rgb = p.accent ? accent : ink;
        const peak = (p.accent ? 0.75 : 0.42) * k() * fade;
        const g = ctx!.createLinearGradient(x, y - dir * len, x, y);
        g.addColorStop(0, `rgba(${rgb},0)`);
        g.addColorStop(1, `rgba(${rgb},${peak})`);
        ctx!.strokeStyle = g;
        ctx!.lineWidth = p.accent ? 1.5 : 1;
        ctx!.beginPath();
        ctx!.moveTo(x, y - dir * len);
        ctx!.lineTo(x, y);
        ctx!.stroke();
        ctx!.fillStyle = `rgba(${rgb},${Math.min(1, peak * 1.4)})`;
        ctx!.fillRect(x - 1, y - 1, 2, 2);
      }

      // commits: node stamp → hex digest types out → optional Merkle bracket → fade
      ctx!.font = `10px ${mono}`;
      ctx!.textBaseline = "middle";
      for (let i = commits.length - 1; i >= 0; i--) {
        const c = commits[i];
        const life = 3600;
        const age = now - c.t0;
        if (age >= life) {
          commits.splice(i, 1);
          continue;
        }
        const u = age / life;
        const env = envelope(u, 0.1, 0.35);
        const x = colX(c.col);
        const rgb = c.accent ? accent : ink;
        const a = env * k();

        // node: square that eases in from 0 → 5px
        const s = 5 * easeInOut(clamp01(age / 520));
        ctx!.strokeStyle = `rgba(${rgb},${0.55 * a})`;
        ctx!.lineWidth = 1;
        ctx!.strokeRect(x - s / 2, c.y - s / 2, s, s);
        ctx!.fillStyle = `rgba(${rgb},${0.22 * a})`;
        ctx!.fillRect(x - s / 2, c.y - s / 2, s, s);

        // digest types out one char every 70ms
        const chars = Math.min(c.hex.length, Math.floor(Math.max(0, age - 260) / 70));
        if (chars > 0) {
          ctx!.fillStyle = `rgba(${rgb},${0.42 * a})`;
          ctx!.fillText(c.hex.slice(0, chars), x + 7, c.y);
        }

        // Merkle bracket to a sibling column + parent stub
        if (c.link) {
          const tx = colX(c.link.toCol);
          const p = easeInOut(clamp01((age - 380) / 900));
          if (p > 0) {
            const yy = c.y + (c.link.up ? -10 : 10);
            ctx!.strokeStyle = `rgba(${rgb},${0.34 * a})`;
            ctx!.beginPath();
            ctx!.moveTo(x, c.y);
            ctx!.lineTo(x, yy);
            ctx!.lineTo(x + (tx - x) * p, yy);
            if (p >= 1) ctx!.lineTo(tx, c.y);
            ctx!.stroke();
            const ps = easeInOut(clamp01((age - 1280) / 600));
            if (ps > 0) {
              const mx = (x + tx) / 2;
              ctx!.beginPath();
              ctx!.moveTo(mx, yy);
              ctx!.lineTo(mx, yy + (c.link.up ? -16 : 16) * ps);
              ctx!.stroke();
              ctx!.fillStyle = `rgba(${rgb},${0.5 * a * ps})`;
              ctx!.fillRect(mx - 1.5, yy + (c.link.up ? -16 : 16) * ps - 1.5, 3, 3);
            }
          }
        }
      }

      raf = requestAnimationFrame(frame);
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      ro.disconnect();
      themeObserver.disconnect();
    };
  }, [reduce, intensity]);

  return (
    <div aria-hidden className={contained ? "pointer-events-none absolute inset-0 overflow-hidden" : "pointer-events-none fixed inset-0 -z-10 overflow-hidden"}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 [mask-image:radial-gradient(ellipse_75%_65%_at_50%_42%,rgba(0,0,0,0.45)_0%,rgba(0,0,0,0.8)_55%,black_100%)]"
      />
      {/* halftone dot matrix, drifting with smoothed scroll */}
      {!contained && <motion.div
        className="absolute -inset-y-6 inset-x-0 opacity-[0.06] [mask-image:radial-gradient(ellipse_70%_55%_at_70%_15%,black_10%,transparent_75%)]"
        style={{ backgroundImage: "radial-gradient(var(--ink) 0.7px, transparent 0.9px)", backgroundSize: "18px 18px", y: reduce ? 0 : dotY }}
      />}
    </div>
  );
}
