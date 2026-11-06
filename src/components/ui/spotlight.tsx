"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Card with cursor-tracked border illumination (CSS .spotlight, compositor-only). */
export const Spotlight = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { as?: "div" | "article" | "section" | "li" }>(
  ({ className, as: Tag = "div", onPointerMove, ...props }, ref) => {
    const handle = (e: React.PointerEvent<HTMLDivElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
      e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
      onPointerMove?.(e);
    };
    const Comp = Tag as "div";
    return <Comp ref={ref} onPointerMove={handle} className={cn("spotlight", className)} {...props} />;
  },
);
Spotlight.displayName = "Spotlight";
