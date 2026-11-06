"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BadgeDollarSign, Coins, FileCheck2, Lock, OctagonX, PlusSquare, UserPlus } from "lucide-react";
import { shortHex } from "@/lib/chain";
import { EASE } from "@/lib/motion";
import { useUpHeld } from "@/lib/store";
import type { ChainEventType } from "@/lib/types";
import { cn } from "@/lib/utils";

const META: Record<ChainEventType, { icon: typeof Coins; cls: string }> = {
  FaucetMint: { icon: Coins, cls: "text-slate" },
  ServiceRegistered: { icon: PlusSquare, cls: "text-slate" },
  ReserveFunded: { icon: Lock, cls: "text-ink" },
  Subscribed: { icon: UserPlus, cls: "text-ink" },
  OutageRecorded: { icon: OctagonX, cls: "text-down" },
  CompensationUnlocked: { icon: FileCheck2, cls: "text-ink" },
  CompensationClaimed: { icon: BadgeDollarSign, cls: "text-ink" },
};

/** Append-only event log: hairline rows, newest first, each new row prints in with a brief raised fill. */
export function EventFeed({ limit = 40, serviceId, className }: { limit?: number; serviceId?: string; className?: string }) {
  const events = useUpHeld((s) => s.events);
  const list = (serviceId ? events.filter((e) => !e.serviceId || e.serviceId === serviceId) : events).slice(0, limit);
  return (
    <ol className={cn("scroll-thin overflow-y-auto", className)} aria-label="Event log">
      <AnimatePresence initial={false}>
        {list.map((e) => {
          const m = META[e.type];
          const Icon = m.icon;
          return (
            <motion.li
              key={e.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
              className="relative border-b border-line px-5 py-3.5 last:border-0 sm:px-6"
            >
              <motion.span aria-hidden className="pointer-events-none absolute inset-0 bg-ink/[0.06]" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 1.4, ease: EASE }} />
              <div className="flex items-center gap-2.5">
                <Icon className={cn("size-4 shrink-0", m.cls)} strokeWidth={1.75} aria-hidden />
                <span className={cn("min-w-0 truncate font-mono text-[12px]", m.cls)}>{e.type}</span>
                <span className="ml-auto shrink-0 font-mono text-[11.5px] text-dim">#{e.blockNumber.toLocaleString("en-US")}</span>
              </div>
              <div className="mt-1.5 text-[13.5px] leading-[1.5] text-slate">{e.detail}</div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[11.5px] text-dim">
                <span>tx {shortHex(e.txHash, 8, 6)}</span>
                {e.attestationHash && <span className="text-slate">attest {shortHex(e.attestationHash, 8, 6)}</span>}
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}
