"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { EASE } from "@/lib/motion";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** Dark / light switch. The glyph rotates out as the next one rotates in. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, sync, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    sync();
    setMounted(true);
  }, [sync]);
  const isDark = !mounted || theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light theme" : "Dark theme"}
      className={cn(
        "relative inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line-strong text-ink transition-colors hover:border-ink/45",
        className,
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={isDark ? "moon" : "sun"}
          initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
          transition={{ duration: 0.55, ease: EASE }}
          className="inline-flex"
        >
          {isDark ? <Moon className="size-[15px]" strokeWidth={1.7} /> : <Sun className="size-[15px]" strokeWidth={1.7} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
