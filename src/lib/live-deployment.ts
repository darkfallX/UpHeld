"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { isAddress } from "viem";
import type { Address, Hex } from "./types";

// Literal process.env.NEXT_PUBLIC_* reads so Next.js inlines them at build time.
const envSla = process.env.NEXT_PUBLIC_UPHELD_SLA_ADDRESS?.trim();
const envUsdc = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS?.trim();
const envClaimTx = process.env.NEXT_PUBLIC_PROOF_CLAIM_TX?.trim();
const envOutageTx = process.env.NEXT_PUBLIC_PROOF_OUTAGE_TX?.trim();

const validAddress = (v: string | undefined): Address | null => (v && isAddress(v) ? (v as Address) : null);
/** A transaction hash is 0x + 64 hex characters. Anything else is ignored. */
export const isTxHash = (v: string | undefined | null): v is Hex => !!v && /^0x[0-9a-fA-F]{64}$/.test(v);

const slaAddr = validAddress(envSla);
const usdcAddr = validAddress(envUsdc);

/** A public deployment configured via env. Both addresses must be valid, or neither is used. */
export const ENV_DEPLOYMENT = slaAddr && usdcAddr ? { sla: slaAddr, usdc: usdcAddr } : null;

/** Public deployment proof for /contracts: each value is shown only if it is well-formed (invalid values are dropped). */
export const ENV_PROOF = {
  sla: slaAddr,
  usdc: usdcAddr,
  claimTx: isTxHash(envClaimTx) ? envClaimTx : null,
  outageTx: isTxHash(envOutageTx) ? envOutageTx : null,
};

const same = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** True when the active deployment is the one configured via env (not one this browser deployed). */
export function isEnvDeployment(d: { sla: Address | null; usdc: Address | null }) {
  return !!ENV_DEPLOYMENT && same(d.sla, ENV_DEPLOYMENT.sla) && same(d.usdc, ENV_DEPLOYMENT.usdc);
}

export interface LiveTx {
  hash: Hex;
  label: string;
  at: string;
  status: "pending" | "success" | "reverted";
  /** UpHealthSLA address that was active when the transaction was sent (absent on older saves). */
  sla?: Address | null;
}

/** True when a saved transaction belongs to the given UpHealthSLA deployment (older entries without one always match). */
export function txOnDeployment(t: LiveTx, sla: Address | null) {
  return !t.sla || same(t.sla, sla);
}

interface LiveDeploymentState {
  sla: Address | null;
  usdc: Address | null;
  deployer: Address | null;
  /** MockUSDC deployed from this browser that is still waiting for its UpHealthSLA (deploy resumes from here). */
  pendingUsdc: Address | null;
  txs: LiveTx[];
  setDeployment: (d: { sla: Address; usdc: Address; deployer: Address }) => void;
  setPendingUsdc: (usdc: Address | null) => void;
  pushTx: (tx: LiveTx) => void;
  updateTx: (hash: Hex, status: LiveTx["status"]) => void;
  forget: () => void;
}

export const useLiveDeployment = create<LiveDeploymentState>()(
  persist(
    (set) => ({
      sla: ENV_DEPLOYMENT?.sla ?? null,
      usdc: ENV_DEPLOYMENT?.usdc ?? null,
      deployer: null,
      pendingUsdc: null,
      txs: [],
      setDeployment: (d) => set({ sla: d.sla, usdc: d.usdc, deployer: d.deployer, pendingUsdc: null }),
      setPendingUsdc: (pendingUsdc) => set({ pendingUsdc }),
      pushTx: (tx) => set((s) => ({ txs: [tx, ...s.txs].slice(0, 40) })),
      updateTx: (hash, status) => set((s) => ({ txs: s.txs.map((t) => (t.hash === hash ? { ...t, status } : t)) })),
      forget: () => set({ sla: ENV_DEPLOYMENT?.sla ?? null, usdc: ENV_DEPLOYMENT?.usdc ?? null, deployer: null, pendingUsdc: null, txs: [] }),
    }),
    {
      name: "upheld-live-deployment",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ sla: s.sla, usdc: s.usdc, deployer: s.deployer, pendingUsdc: s.pendingUsdc, txs: s.txs }),
      // Only a pair this browser deployed (setDeployment always records a deployer) is kept. Anything else falls back
      // to the current env deployment, so a browser that saved "no deployment" or an older env pair picks up the new one.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<LiveDeploymentState>;
        const hasOwn = !!(p.sla && p.usdc && p.deployer);
        // older saves kept a half-finished deploy as a bare usdc ({ usdc, sla: null } or env sla + new usdc)
        const legacyPending =
          !hasOwn && p.usdc && !same(p.usdc, ENV_DEPLOYMENT?.usdc) && (!p.sla || same(p.sla, ENV_DEPLOYMENT?.sla)) ? p.usdc : null;
        return {
          ...current,
          ...p,
          sla: hasOwn ? p.sla! : current.sla,
          usdc: hasOwn ? p.usdc! : current.usdc,
          deployer: hasOwn ? p.deployer! : null,
          pendingUsdc: p.pendingUsdc ?? legacyPending,
          txs: Array.isArray(p.txs) ? p.txs : [],
        };
      },
    },
  ),
);
