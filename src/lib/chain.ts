import { encodePacked, getAddress, keccak256, slice, toHex } from "viem";
import type { Address, Hex } from "./types";

/** Base Sepolia network constants (docs.base.org) */
export const BASE_SEPOLIA = {
  chainId: 84532,
  chainIdHex: "0x14a34",
  name: "Base Sepolia",
  rpcUrl: "https://sepolia.base.org",
  explorer: "https://sepolia.basescan.org",
  circleUsdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address,
} as const;

export const BASE_MAINNET = {
  chainId: 8453,
  rpcUrl: "https://mainnet.base.org",
  explorer: "https://basescan.org",
  circleUsdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address,
} as const;

/** Deterministic, key-less sandbox address (no private key exists for it). */
export function sandboxAddress(label: string): Address {
  return getAddress(slice(keccak256(toHex(`upheld:sandbox:${label}`)), 12));
}

export const JUDGE_WALLET = sandboxAddress("judge-wallet");
export const PROVIDER_TREASURY = sandboxAddress("provider-treasury");
/** Sandbox monitor that attests outages. Providers and subscribers are never attestors. */
export const MONITOR_ATTESTOR = sandboxAddress("monitor-attestor");
/** Addresses of the in-browser contract mirror (sandbox, NOT deployed on-chain). */
export const SANDBOX_SLA_ADDRESS = sandboxAddress("UpHealthSLA");
export const SANDBOX_USDC_ADDRESS = sandboxAddress("MockUSDC");

/** keccak256(abi.encodePacked(serviceId, incidentSeq, downtimeMinutes, resultingUptimeBps)) */
export function computeAttestationHash(onChainId: number, incidentSeq: number, downtimeMinutes: number, uptimeBps: number): Hex {
  return keccak256(
    encodePacked(
      ["uint256", "uint256", "uint256", "uint16"],
      [BigInt(onChainId), BigInt(incidentSeq), BigInt(downtimeMinutes), uptimeBps],
    ),
  );
}

/** Sandbox transaction hash: keccak256 over the call payload + nonce. Clearly labeled as sandbox in UI. */
export function sandboxTxHash(method: string, nonce: number, payload: unknown): Hex {
  return keccak256(toHex(`${method}|${nonce}|${JSON.stringify(payload)}`));
}

export function shortHex(hex: string, head = 6, tail = 4): string {
  if (!hex) return "";
  return `${hex.slice(0, head)}…${hex.slice(-tail)}`;
}

export const explorerTx = (hash: string) => `${BASE_SEPOLIA.explorer}/tx/${hash}`;
export const explorerAddress = (addr: string) => `${BASE_SEPOLIA.explorer}/address/${addr}`;
