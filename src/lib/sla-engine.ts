/**
 * Deterministic SLA math. Mirrors UpHealthSLA.sol line for line.
 * USDC: 6-decimal integer minor units (1 USDC = 1_000_000).
 * Percentages: basis points (100.00% = 10_000 bps).
 */

export const BILLING_WINDOW_MINUTES = 43_200; // 30 days
export const BPS = 10_000;
export const USDC_DECIMALS = 6;
export const USDC_UNIT = 1_000_000;
export const MODERATE_FLOOR_BPS = 9_900; // below this → Tier 2
export const SEVERE_FLOOR_BPS = 9_800; // below this → Tier 3

export type Severity = "NONE" | "MINOR" | "MODERATE" | "SEVERE";

export interface CompensationTiers {
  minorBreachRefundBps: number;
  moderateBreachRefundBps: number;
  severeBreachRefundBps: number;
}

export interface BreachEvaluation {
  breached: boolean;
  severity: Severity;
  refundBps: number;
}

/** floor((window - downtime) * 10000 / window), clamped at 0. Same as recordOutage(). */
export function calculateUptimeBps(totalDowntimeMinutes: number, windowMinutes = BILLING_WINDOW_MINUTES): number {
  const down = Math.max(0, Math.floor(totalDowntimeMinutes));
  if (down >= windowMinutes) return 0;
  return Math.floor(((windowMinutes - down) * BPS) / windowMinutes);
}

export function evaluateSlaBreach(currentUptimeBps: number, slaTargetBps: number, tiers: CompensationTiers): BreachEvaluation {
  if (currentUptimeBps >= slaTargetBps) return { breached: false, severity: "NONE", refundBps: 0 };
  if (currentUptimeBps < SEVERE_FLOOR_BPS) return { breached: true, severity: "SEVERE", refundBps: tiers.severeBreachRefundBps };
  if (currentUptimeBps < MODERATE_FLOOR_BPS) return { breached: true, severity: "MODERATE", refundBps: tiers.moderateBreachRefundBps };
  return { breached: true, severity: "MINOR", refundBps: tiers.minorBreachRefundBps };
}

/** (monthlyPrice * refundBps) / 10000, integer division like Solidity. */
export function calculateSubscriberRefundUsdc(monthlyPriceUsdc: number, refundBps: number): number {
  return Math.floor((monthlyPriceUsdc * refundBps) / BPS);
}

/** Max downtime minutes allowed before the SLA target is breached. */
export function allowedDowntimeMinutes(slaTargetBps: number, windowMinutes = BILLING_WINDOW_MINUTES): number {
  return (windowMinutes * (BPS - slaTargetBps)) / BPS;
}

/**
 * Refund already credited to a subscriber when they join: the current tier's refund.
 * Mirrors subscribe(): a subscriber who joins mid-breach is not paid for downtime before they joined.
 */
export function initialCreditUsdc(monthlyPriceUsdc: number, currentUptimeBps: number, slaTargetBps: number, tiers: CompensationTiers): number {
  return calculateSubscriberRefundUsdc(monthlyPriceUsdc, evaluateSlaBreach(currentUptimeBps, slaTargetBps, tiers).refundBps);
}

/**
 * Reserve a new seat locks when subscribing (mirrors seatCoverRequired()): the severe-tier refund
 * minus the credit the subscriber starts with.
 */
export function seatCoverRequiredUsdc(monthlyPriceUsdc: number, currentUptimeBps: number, slaTargetBps: number, tiers: CompensationTiers): number {
  return calculateSubscriberRefundUsdc(monthlyPriceUsdc, tiers.severeBreachRefundBps) - initialCreditUsdc(monthlyPriceUsdc, currentUptimeBps, slaTargetBps, tiers);
}

/**
 * Mirrors _settle(): tops each subscriber (in order) up to `tierRefundUsdc`, paid from that
 * subscriber's own locked seat cover. Never pays the same tier twice.
 * Without `seatCoverUsdc` (unbacked seats), the shared reserve must cover each top-up instead.
 */
export function settleSubscribers(tierRefundUsdc: number, reserveBalanceUsdc: number, creditedUsdc: number[], seatCoverUsdc?: number[]) {
  let reserve = reserveBalanceUsdc;
  const payoutsUsdc: number[] = [];
  const creditedAfterUsdc: number[] = [];
  const seatCoverAfterUsdc: number[] = [];
  creditedUsdc.forEach((already, i) => {
    let paid = 0;
    let after = already;
    let cover = seatCoverUsdc ? seatCoverUsdc[i] ?? 0 : 0;
    if (tierRefundUsdc > already) {
      const owed = tierRefundUsdc - already;
      const covered = seatCoverUsdc ? cover >= owed && reserve >= owed : reserve >= owed;
      if (covered) {
        reserve -= owed;
        if (seatCoverUsdc) cover -= owed;
        paid = owed;
        after = tierRefundUsdc;
      }
    }
    payoutsUsdc.push(paid);
    creditedAfterUsdc.push(after);
    seatCoverAfterUsdc.push(cover);
  });
  return { payoutsUsdc, creditedAfterUsdc, seatCoverAfterUsdc, reserveAfterUsdc: reserve, totalCompensationUsdc: payoutsUsdc.reduce((x, y) => x + y, 0) };
}

export interface OutageSimulation {
  previousUptimeBps: number;
  newUptimeBps: number;
  newTotalDowntimeMinutes: number;
  evaluation: BreachEvaluation;
  /** full refund for the tier reached (price × tier bps) */
  tierRefundUsdc: number;
  /** newly unlocked per subscriber, in subscriber order (0 = already paid at this tier, or reserve short) */
  payoutsUsdc: number[];
  /** credited total per subscriber after this outage, in subscriber order */
  creditedAfterUsdc: number[];
  /** seat cover still locked per subscriber after this outage (only when seat cover was given) */
  seatCoverAfterUsdc: number[];
  /** largest amount newly unlocked for any one subscriber */
  refundPerSubscriberUsdc: number;
  /** subscribers who received a new payout */
  paidSubscribers: number;
  totalCompensationUsdc: number;
  reserveAfterUsdc: number;
}

/**
 * Simulates recordOutage() as written in UpHealthSLA.sol:
 * each subscriber is topped up to the refund for the tier reached, never paid the same tier twice,
 * and only when the reserve covers that subscriber's whole top-up.
 * `creditedUsdc` is each subscriber's creditedCompensation (defaults to 0 for `subscriberCount` subscribers).
 */
export function simulateOutage(params: {
  totalDowntimeMinutes: number;
  additionalDowntimeMinutes: number;
  monthlyPriceUsdc: number;
  slaTargetBps: number;
  tiers: CompensationTiers;
  reserveBalanceUsdc: number;
  subscriberCount?: number;
  creditedUsdc?: number[];
  /** each subscriber's locked seatCover; when given, payouts come from it (fully backed seats) */
  seatCoverUsdc?: number[];
}): OutageSimulation {
  const credited = params.creditedUsdc ?? Array.from({ length: params.subscriberCount ?? 0 }, () => 0);
  const previousUptimeBps = calculateUptimeBps(params.totalDowntimeMinutes);
  const newTotalDowntimeMinutes = params.totalDowntimeMinutes + Math.max(0, Math.floor(params.additionalDowntimeMinutes));
  const newUptimeBps = calculateUptimeBps(newTotalDowntimeMinutes);
  const evaluation = evaluateSlaBreach(newUptimeBps, params.slaTargetBps, params.tiers);
  const tierRefundUsdc = evaluation.refundBps > 0 ? calculateSubscriberRefundUsdc(params.monthlyPriceUsdc, evaluation.refundBps) : 0;
  const { payoutsUsdc, creditedAfterUsdc, seatCoverAfterUsdc, reserveAfterUsdc, totalCompensationUsdc } = settleSubscribers(tierRefundUsdc, params.reserveBalanceUsdc, credited, params.seatCoverUsdc);
  return {
    previousUptimeBps,
    newUptimeBps,
    newTotalDowntimeMinutes,
    evaluation,
    tierRefundUsdc,
    payoutsUsdc,
    creditedAfterUsdc,
    seatCoverAfterUsdc,
    refundPerSubscriberUsdc: payoutsUsdc.reduce((m, x) => Math.max(m, x), 0),
    paidSubscribers: payoutsUsdc.filter((x) => x > 0).length,
    totalCompensationUsdc,
    reserveAfterUsdc,
  };
}

// ---------- formatting ----------

export function formatBps(bps: number, digits = 2): string {
  return `${(bps / 100).toFixed(digits)}%`;
}

export function formatUsdc(minor: number, opts: { symbol?: boolean; decimals?: number } = {}): string {
  const { symbol = true, decimals = 2 } = opts;
  const value = minor / USDC_UNIT;
  const s = value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return symbol ? `$${s}` : s;
}

export function usdc(amount: number): number {
  return Math.round(amount * USDC_UNIT);
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d}d ${rh}h` : `${d}d`;
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  NONE: "Within SLA",
  MINOR: "Tier 1 · Minor breach",
  MODERATE: "Tier 2 · Moderate breach",
  SEVERE: "Tier 3 · Severe breach",
};
