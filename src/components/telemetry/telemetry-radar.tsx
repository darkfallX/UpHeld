"use client";

import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TelemetryRadarProps {
  size?: number;
  className?: string;
  activeCount?: number;
  status?: "OPERATIONAL" | "DEGRADED" | "OUTAGE";
}

export function TelemetryRadar({
  size = 180,
  className,
  activeCount = 3,
  status = "OPERATIONAL",
}: TelemetryRadarProps) {
  const reduceMotion = useReducedMotion();
  const strokeColor =
    status === "OUTAGE" ? "#EF4444" : status === "DEGRADED" ? "#F59E0B" : "#10B981";

  return (
    <div
      className={cn("relative flex items-center justify-center overflow-hidden rounded-full border border-line/60 bg-ob/80", className)}
      style={{ width: size, height: size }}
    >
      {/* Concentric distance rings */}
      <div className="absolute inset-2 rounded-full border border-line/40" />
      <div className="absolute inset-8 rounded-full border border-line/30" />
      <div className="absolute inset-14 rounded-full border border-line/20" />

      {/* Crosshairs */}
      <div className="absolute h-full w-px bg-line/40" />
      <div className="absolute h-px w-full bg-line/40" />

      {/* Radar sweep beam */}
      {!reduceMotion && (
        <div
          className="animate-radar absolute inset-0 origin-center"
          style={{
            background: `conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 270deg, ${strokeColor}22 330deg, ${strokeColor}66 360deg)`,
          }}
        />
      )}

      {/* Center blip */}
      <div
        className="relative z-10 size-2.5 rounded-full "
        style={{
          backgroundColor: strokeColor,
          boxShadow: `0 0 12px ${strokeColor}`,
        }}
      />

      {/* Target ping dots around the radar */}
      <div
        className="absolute size-2 rounded-full animate-ping-slow"
        style={{
          top: "28%",
          left: "65%",
          backgroundColor: status === "OUTAGE" ? "#EF4444" : "#0052FF",
        }}
      />
      <div
        className="absolute size-1.5 rounded-full"
        style={{
          bottom: "32%",
          left: "24%",
          backgroundColor: "#10B981",
        }}
      />
      <div
        className="absolute size-2 rounded-full"
        style={{
          top: "62%",
          right: "26%",
          backgroundColor: status === "DEGRADED" ? "#F59E0B" : "#06B6D4",
        }}
      />

      {/* Overlay label */}
      <span className="absolute bottom-2 font-mono text-[9px] uppercase tracking-widest text-ink-3">
        {activeCount} TARGETS
      </span>
    </div>
  );
}
