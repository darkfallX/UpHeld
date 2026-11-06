"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Copy, ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { explorerTx } from "@/lib/chain";
import { EASE } from "@/lib/motion";
import { formatUsdc } from "@/lib/sla-engine";
import { useToasts } from "@/lib/toast";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-3 border-b border-line py-2 last:border-0">
      <div className="font-mono text-[11px] text-dim">{k}</div>
      <div className="break-all font-mono text-[11.5px] text-ink">{v}</div>
    </div>
  );
}

/** Transaction receipt dialog. */
export function ReceiptModal() {
  const { receiptOpen: r, openReceipt } = useToasts();
  useEffect(() => {
    if (!r) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && openReceipt(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [r, openReceipt]);

  return (
    <AnimatePresence>
      {r && (
        <motion.div
          data-lenis-prevent
          className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-canvas/70 p-4 pt-[10vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          onClick={() => openReceipt(null)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Transaction receipt"
            className="w-full max-w-[460px] overflow-hidden rounded-[12px] bg-panel text-ink shadow-raised"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.5, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-12 items-center justify-between border-b border-line px-5">
              <span className="label">UpHealthSLA · {r.mode === "sandbox" ? "sandbox mirror" : "Base Sepolia"}</span>
              <button type="button" onClick={() => openReceipt(null)} aria-label="Close receipt" className="grid size-7 place-items-center rounded-full text-slate transition-colors hover:bg-subtle hover:text-ink">
                <X className="size-4" />
              </button>
            </div>
            <div className="px-5 pb-5 pt-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[20px] font-semibold tracking-[-0.04em]">Confirmed</span>
                  <span className="font-mono text-[11px] text-dim">#{r.blockNumber.toLocaleString("en-US")}</span>
                </div>
                {r.amountUsdc !== undefined && (
                  <div className="mt-3 border-y border-line py-3">
                    <div className="label">USDC moved</div>
                    <div className="mt-1 font-mono text-[34px] font-medium leading-none tracking-[-0.04em] tabular">
                      {formatUsdc(r.amountUsdc)}
                    </div>
                    <div className="mt-1 font-mono text-[10.5px] text-dim">{r.amountUsdc.toLocaleString("en-US")} minor units · 6 decimals</div>
                  </div>
                )}
                <div className="mt-2">
                  <Row k="Method" v={`${r.method}()`} />
                  <Row
                    k="Tx hash"
                    v={
                      <span className="inline-flex items-start gap-2">
                        {r.txHash}
                        <button type="button" aria-label="Copy hash" onClick={() => navigator.clipboard?.writeText(r.txHash)} className="text-dim hover:text-ink">
                          <Copy className="size-3.5" />
                        </button>
                      </span>
                    }
                  />
                  <Row k="From" v={r.from} />
                  <Row k="To" v={r.to} />
                  <Row k="Events" v={r.events.join(", ") || "None"} />
                  {Object.keys(r.args).length > 0 && <Row k="Args" v={Object.entries(r.args).map(([k, v]) => `${k}=${v}`).join(" · ")} />}
                  <Row k="Gas used" v={r.gasUsed.toLocaleString("en-US")} />
                </div>
                <div className="mt-3 border-t border-line pt-3 text-[12px] leading-relaxed text-slate">
                  {r.mode === "sandbox" ? (
                    <>
                      Judge Sandbox receipt. This call ran in the in-browser copy of <span className="font-mono">UpHealthSLA.sol</span> and was not broadcast. To run it on
                      Base Sepolia, use{" "}
                      <Link href="/contracts#live" className="underline underline-offset-2 hover:text-ink" onClick={() => openReceipt(null)}>
                        /contracts
                      </Link>
                      .
                    </>
                  ) : (
                    <a href={explorerTx(r.txHash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 underline underline-offset-2">
                      View on BaseScan (Sepolia) <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
