"use client";

import React, { useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

interface MousePosition {
  x: number;
  y: number;
}

function useMousePosition(): MousePosition {
  const [mousePosition, setMousePosition] = useState<MousePosition>({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setMousePosition({ x: event.clientX, y: event.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return mousePosition;
}

interface ParticlesProps extends ComponentPropsWithoutRef<"div"> {
  className?: string;
  quantity?: number;
  staticity?: number;
  ease?: number;
  size?: number;
  refresh?: boolean;
  color?: string;
  vx?: number;
  vy?: number;
}

function hexToRgb(hex: string): number[] {
  let cleanHex = hex.replace("#", "");

  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split("")
      .map((char) => char + char)
      .join("");
  }

  const hexInt = parseInt(cleanHex, 16);
  const red = (hexInt >> 16) & 255;
  const green = (hexInt >> 8) & 255;
  const blue = hexInt & 255;
  return [red, green, blue];
}

type Circle = {
  x: number;
  y: number;
  translateX: number;
  translateY: number;
  size: number;
  alpha: number;
  targetAlpha: number;
  dx: number;
  dy: number;
  magnetism: number;
};

export const Particles: React.FC<ParticlesProps> = ({
  className = "",
  quantity = 40,
  staticity = 50,
  ease = 50,
  size = 0.5,
  refresh = false,
  color = "#0052FF",
  vx = 0,
  vy = 0,
  ...props
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const context = useRef<CanvasRenderingContext2D | null>(null);
  const circles = useRef<Circle[]>([]);
  const mousePosition = useMousePosition();
  const mouse = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;
  const rafID = useRef<number | null>(null);
  const resizeTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      context.current = canvasRef.current.getContext("2d");
    }

    const initCanvas = () => {
      if (canvasContainerRef.current && canvasRef.current && context.current) {
        canvasSize.current.w = canvasContainerRef.current.offsetWidth;
        canvasSize.current.h = canvasContainerRef.current.offsetHeight;

        canvasRef.current.width = canvasSize.current.w * dpr;
        canvasRef.current.height = canvasSize.current.h * dpr;
        canvasRef.current.style.width = `${canvasSize.current.w}px`;
        canvasRef.current.style.height = `${canvasSize.current.h}px`;
        context.current.scale(dpr, dpr);

        circles.current = [];
        for (let i = 0; i < quantity; i++) {
          const x = Math.floor(Math.random() * canvasSize.current.w);
          const y = Math.floor(Math.random() * canvasSize.current.h);
          const pSize = Math.floor(Math.random() * 2) + size;
          const alpha = 0;
          const targetAlpha = parseFloat((Math.random() * 0.5 + 0.1).toFixed(1));
          const dx = (Math.random() - 0.5) * 0.12;
          const dy = (Math.random() - 0.5) * 0.12;
          const magnetism = 0.1 + Math.random() * 3;
          circles.current.push({
            x,
            y,
            translateX: 0,
            translateY: 0,
            size: pSize,
            alpha,
            targetAlpha,
            dx,
            dy,
            magnetism,
          });
        }
      }
    };

    const rgb = hexToRgb(color);

    const drawCircle = (circle: Circle) => {
      if (context.current) {
        const { x, y, translateX, translateY, size: circleSize, alpha } = circle;
        context.current.translate(translateX, translateY);
        context.current.beginPath();
        context.current.arc(x, y, circleSize, 0, 2 * Math.PI);
        context.current.fillStyle = `rgba(${rgb.join(", ")}, ${alpha})`;
        context.current.fill();
        context.current.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    const animate = () => {
      if (context.current) {
        context.current.clearRect(0, 0, canvasSize.current.w, canvasSize.current.h);
      }
      circles.current.forEach((circle, i) => {
        const edge = [
          circle.x + circle.translateX - circle.size,
          canvasSize.current.w - circle.x - circle.translateX - circle.size,
          circle.y + circle.translateY - circle.size,
          canvasSize.current.h - circle.y - circle.translateY - circle.size,
        ];
        const closestEdge = edge.reduce((a, b) => Math.min(a, b));
        const remapClosestEdge = Math.max(0, Math.min(1, closestEdge / 20));
        if (remapClosestEdge > 1) {
          circle.alpha += 0.02;
          if (circle.alpha > circle.targetAlpha) circle.alpha = circle.targetAlpha;
        } else {
          circle.alpha = circle.targetAlpha * remapClosestEdge;
        }

        circle.x += circle.dx + vx;
        circle.y += circle.dy + vy;
        circle.translateX +=
          (mouse.current.x / (staticity / circle.magnetism) - circle.translateX) / ease;
        circle.translateY +=
          (mouse.current.y / (staticity / circle.magnetism) - circle.translateY) / ease;

        drawCircle(circle);

        if (
          circle.x < -circle.size ||
          circle.x > canvasSize.current.w + circle.size ||
          circle.y < -circle.size ||
          circle.y > canvasSize.current.h + circle.size
        ) {
          circles.current.splice(i, 1);
          circles.current.push({
            x: Math.floor(Math.random() * canvasSize.current.w),
            y: Math.floor(Math.random() * canvasSize.current.h),
            translateX: 0,
            translateY: 0,
            size: Math.floor(Math.random() * 2) + size,
            alpha: 0,
            targetAlpha: parseFloat((Math.random() * 0.5 + 0.1).toFixed(1)),
            dx: (Math.random() - 0.5) * 0.12,
            dy: (Math.random() - 0.5) * 0.12,
            magnetism: 0.1 + Math.random() * 3,
          });
        }
      });
      rafID.current = window.requestAnimationFrame(animate);
    };

    initCanvas();
    animate();

    const handleResize = () => {
      if (resizeTimeout.current) clearTimeout(resizeTimeout.current);
      resizeTimeout.current = setTimeout(() => {
        initCanvas();
      }, 200);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      if (rafID.current != null) window.cancelAnimationFrame(rafID.current);
      if (resizeTimeout.current) clearTimeout(resizeTimeout.current);
      window.removeEventListener("resize", handleResize);
    };
  }, [color, dpr, ease, quantity, refresh, size, staticity, vx, vy]);

  useEffect(() => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const { w, h } = canvasSize.current;
      const x = mousePosition.x - rect.left - w / 2;
      const y = mousePosition.y - rect.top - h / 2;
      const inside = x < w / 2 && x > -w / 2 && y < h / 2 && y > -h / 2;
      if (inside) {
        mouse.current.x = x;
        mouse.current.y = y;
      }
    }
  }, [mousePosition.x, mousePosition.y]);

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      ref={canvasContainerRef}
      aria-hidden="true"
      {...props}
    >
      <canvas ref={canvasRef} className="size-full" />
    </div>
  );
};
