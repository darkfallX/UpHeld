/**
 * Contract ABIs, bytecode and helpers for UpHealthSLA.sol + MockUSDC.sol on Base Sepolia.
 * Artifacts are compiled from /contracts by `npm run compile:contracts` (solc-js).
 */
export { mockUsdcAbi, mockUsdcBytecode, upHealthSlaAbi, upHealthSlaBytecode, SOLC_VERSION, contractSources } from "./contract-artifacts";
export {
  calculateUptimeBps,
  evaluateSlaBreach,
  calculateSubscriberRefundUsdc,
  simulateOutage,
  BILLING_WINDOW_MINUTES,
} from "./sla-engine";

/** Tuple order returned by the public `services(uint256)` getter. */
export interface OnChainService {
  id: bigint;
  provider: `0x${string}`;
  name: string;
  monthlyPriceUsdc: bigint;
  slaTargetBps: number;
  currentUptimeBps: number;
  downtimeMinutes: bigint;
  reserveBalanceUsdc: bigint;
  minorRefundBps: number;
  moderateRefundBps: number;
  severeRefundBps: number;
  active: boolean;
}

export function decodeServiceTuple(
  t: readonly [bigint, `0x${string}`, string, bigint, number, number, bigint, bigint, number, number, number, boolean],
): OnChainService {
  return {
    id: t[0],
    provider: t[1],
    name: t[2],
    monthlyPriceUsdc: t[3],
    slaTargetBps: t[4],
    currentUptimeBps: t[5],
    downtimeMinutes: t[6],
    reserveBalanceUsdc: t[7],
    minorRefundBps: t[8],
    moderateRefundBps: t[9],
    severeRefundBps: t[10],
    active: t[11],
  };
}
