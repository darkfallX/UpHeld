"use client";

import { useMemo } from "react";
import { JUDGE_WALLET } from "@/lib/chain";
import { formatBps, formatUsdc } from "@/lib/sla-engine";
import { type NewServiceInput, useUpHeld } from "@/lib/store";
import { toast, useToasts } from "@/lib/toast";

/** Store actions wrapped with user feedback (toasts + receipts). */
export function useActions() {
  return useMemo(
    () => ({
      mint: (amount = 100_000_000) => {
        const r = useUpHeld.getState().mint(JUDGE_WALLET, amount);
        if (r.ok) toast.success(`+${formatUsdc(amount)} testnet USDC minted`, "MockUSDC.faucet() → Judge Sandbox wallet", r.receipt);
        else toast.error("Faucet failed", r.error);
        return r.ok;
      },
      subscribe: (serviceId: string) => {
        const st = useUpHeld.getState();
        const svc = st.services.find((s) => s.id === serviceId);
        const r = st.subscribe(serviceId);
        if (r.ok) toast.success(`Subscribed to ${svc?.name}`, `${formatUsdc(svc?.monthlyPriceUsdc ?? 0)} USDC paid · ${formatBps(svc?.slaTargetBps ?? 0)} uptime SLA`, r.receipt);
        else toast.error("Subscription failed", r.error);
        return r.ok;
      },
      claim: (serviceId: string) => {
        const st = useUpHeld.getState();
        const svc = st.services.find((s) => s.id === serviceId);
        const r = st.claim(serviceId);
        if (r.ok) {
          toast.success(`+${formatUsdc(r.receipt.amountUsdc ?? 0)} USDC claimed`, `${svc?.name} refund sent to your wallet`, r.receipt);
          useToasts.getState().openReceipt(r.receipt);
        } else toast.error("Claim failed", r.error);
        return r.ok;
      },
      inject: (serviceId: string, minutes: number, title: string) => {
        const st = useUpHeld.getState();
        const svc = st.services.find((s) => s.id === serviceId);
        const r = st.injectOutage(serviceId, minutes, title);
        if (!r.ok) {
          toast.error("Could not record outage", r.error);
          return null;
        }
        const inc = r.receipt.incident;
        if (inc.slaBreached) {
          const paid = inc.totalCompensationTriggeredUsdc;
          toast.success(
            `${svc?.name} SLA breached · ${inc.refundPercentageBps / 100}% refund`,
            paid > 0
              ? `${formatBps(inc.previousUptimeBps)} → ${formatBps(inc.newUptimeBps)} · ${formatUsdc(paid)} USDC unlocked for ${inc.subscribersCompensated} subscriber${inc.subscribersCompensated === 1 ? "" : "s"}`
              : `${formatBps(inc.previousUptimeBps)} → ${formatBps(inc.newUptimeBps)} · no active subscribers`,
            r.receipt.receipt,
          );
        } else {
          toast.info(`${svc?.name} incident recorded`, `Uptime ${formatBps(inc.newUptimeBps)} is within the ${formatBps(svc?.slaTargetBps ?? 0)} SLA. No refund is due.`);
        }
        return inc;
      },
      fund: (serviceId: string, amount: number) => {
        const st = useUpHeld.getState();
        const svc = st.services.find((s) => s.id === serviceId);
        const r = st.fundReserve(serviceId, amount);
        if (r.ok) toast.success(`${svc?.name} reserve +${formatUsdc(amount)}`, "USDC locked in escrow by UpHealthSLA.fundReserve()", r.receipt);
        else toast.error("Top-up failed", r.error);
        return r.ok;
      },
      register: (input: NewServiceInput) => {
        const r = useUpHeld.getState().registerService(input);
        if (r.ok) toast.success(`${r.receipt.service.name} is live`, "Listed in the marketplace and the Chaos Theater", r.receipt.receipt);
        else toast.error("Registration failed", r.error);
        return r.ok ? r.receipt.service : null;
      },
    }),
    [],
  );
}
