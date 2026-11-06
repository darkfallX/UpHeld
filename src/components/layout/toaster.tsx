"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, X } from "lucide-react";
import { shortHex } from "@/lib/chain";
import { EASE } from "@/lib/motion";
import { useToasts } from "@/lib/toast";
import { cn } from "@/lib/utils";

const MARK = { success: "bg-ink", error: "bg-down", info: "bg-ink" } as const;

export function Toaster() {
  const { toasts, dismiss, openReceipt } = useToasts();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.65, ease: EASE }}
            className="pointer-events-auto relative overflow-hidden rounded-[8px] bg-panel shadow-raised"
          >
            <span className={cn("absolute inset-y-0 left-0 w-[3px]", MARK[t.tone])} aria-hidden />
            {/* life bar */}
            <motion.span
              className="absolute bottom-0 left-0 h-px w-full origin-left bg-ink/30"
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: t.tone === "error" ? 6 : 4.5, ease: "linear" }}
              aria-hidden
            />
            <div className="flex items-start gap-3 py-3 pl-4 pr-3">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-ink">{t.title}</div>
                {t.body && <div className="mt-0.5 text-xs text-slate">{t.body}</div>}
                {t.receipt && (
                  <button
                    type="button"
                    onClick={() => openReceipt(t.receipt!)}
                    className="group mt-2 inline-flex items-center gap-1 font-mono text-[11px] text-slate transition-colors hover:text-ink"
                  >
                    tx {shortHex(t.receipt.txHash, 10, 6)} · receipt
                    <ArrowUpRight className="size-3 transition-transform group-hover:translate-x-[2px] group-hover:-translate-y-[2px]" />
                  </button>
                )}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-dim transition-colors hover:text-ink">
                <X className="size-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
