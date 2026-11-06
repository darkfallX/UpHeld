import { describe, expect, it } from "vitest";
import { calculateUptimeBps, evaluateSlaBreach, calculateSubscriberRefundUsdc, initialCreditUsdc, seatCoverRequiredUsdc, settleSubscribers, simulateOutage, usdc } from "../src/lib/sla-engine";

const tiers = { minorBreachRefundBps: 1000, moderateBreachRefundBps: 2500, severeBreachRefundBps: 5000 };

describe("calculateUptimeBps", () => {
  it("matches contract integer math", () => {
    expect(calculateUptimeBps(0)).toBe(10000);
    expect(calculateUptimeBps(35)).toBe(9991);
    expect(calculateUptimeBps(480)).toBe(9888);
    expect(calculateUptimeBps(1200)).toBe(9722);
    expect(calculateUptimeBps(43200)).toBe(0);
    expect(calculateUptimeBps(99999)).toBe(0);
  });
});

describe("CloudBox golden path ($10, 99.95%)", () => {
  const cases: Array<[number, string, number]> = [
    [35, "MINOR", usdc(1)],
    [480, "MODERATE", usdc(2.5)],
    [1200, "SEVERE", usdc(5)],
  ];
  for (const [mins, sev, refund] of cases) {
    it(`${mins}m → ${sev}`, () => {
      const e = evaluateSlaBreach(calculateUptimeBps(mins), 9995, tiers);
      expect(e.severity).toBe(sev);
      expect(calculateSubscriberRefundUsdc(usdc(10), e.refundBps)).toBe(refund);
    });
  }
  it("deducts from reserve only for covered subscribers", () => {
    const sim = simulateOutage({ totalDowntimeMinutes: 0, additionalDowntimeMinutes: 480, monthlyPriceUsdc: usdc(10), slaTargetBps: 9995, tiers, reserveBalanceUsdc: usdc(5000), subscriberCount: 1 });
    expect(sim.reserveAfterUsdc).toBe(usdc(4997.5));
    const dry = simulateOutage({ totalDowntimeMinutes: 0, additionalDowntimeMinutes: 480, monthlyPriceUsdc: usdc(10), slaTargetBps: 9995, tiers, reserveBalanceUsdc: usdc(4), subscriberCount: 2 });
    expect(dry.paidSubscribers).toBe(1);
    expect(dry.reserveAfterUsdc).toBe(usdc(1.5));
  });
  it("no refund within SLA", () => {
    expect(evaluateSlaBreach(calculateUptimeBps(20), 9995, tiers).breached).toBe(false);
  });
});

/**
 * Expected state for UpHealthSLA.sol (tier top-up rule): register CloudBox → fund 5,000 → subscribe →
 * recordOutage 35 / 480 / 1200 → claim. Each attestation tops the subscriber up to the tier reached,
 * so the three outages pay $1.00 + $1.50 + $2.50 = $5.00 (the severe tier), not $8.50.
 */
describe("TS mirror matches UpHealthSLA execution", () => {
  const expected = [
    { addMins: 35, uptimeBps: 9991, downtime: 35, reserve: 4_999_000_000, claimable: 1_000_000 },
    { addMins: 480, uptimeBps: 9880, downtime: 515, reserve: 4_997_500_000, claimable: 2_500_000 },
    { addMins: 1200, uptimeBps: 9603, downtime: 1715, reserve: 4_995_000_000, claimable: 5_000_000 },
  ];
  it("cumulative outages produce identical state", () => {
    let downtime = 0;
    let reserve = usdc(5000);
    let claimable = 0;
    let credited = [0];
    for (const step of expected) {
      const sim = simulateOutage({ totalDowntimeMinutes: downtime, additionalDowntimeMinutes: step.addMins, monthlyPriceUsdc: usdc(10), slaTargetBps: 9995, tiers, reserveBalanceUsdc: reserve, creditedUsdc: credited });
      downtime = sim.newTotalDowntimeMinutes;
      reserve = sim.reserveAfterUsdc;
      claimable += sim.totalCompensationUsdc;
      credited = sim.creditedAfterUsdc;
      expect({ uptimeBps: sim.newUptimeBps, downtime, reserve, claimable }).toEqual({ uptimeBps: step.uptimeBps, downtime: step.downtime, reserve: step.reserve, claimable: step.claimable });
    }
  });
});

describe("reserve drain exploit is closed", () => {
  const base = { monthlyPriceUsdc: usdc(10), slaTargetBps: 9995, tiers };
  it("re-attesting the same tier pays nothing", () => {
    const first = simulateOutage({ ...base, totalDowntimeMinutes: 0, additionalDowntimeMinutes: 480, reserveBalanceUsdc: usdc(5000), creditedUsdc: [0] });
    expect(first.totalCompensationUsdc).toBe(usdc(2.5));
    let reserve = first.reserveAfterUsdc;
    let credited = first.creditedAfterUsdc;
    let downtime = first.newTotalDowntimeMinutes;
    for (let i = 0; i < 100; i++) {
      const again = simulateOutage({ ...base, totalDowntimeMinutes: downtime, additionalDowntimeMinutes: 1, reserveBalanceUsdc: reserve, creditedUsdc: credited });
      expect(again.evaluation.severity).toBe("MODERATE");
      expect(again.totalCompensationUsdc).toBe(0);
      reserve = again.reserveAfterUsdc;
      credited = again.creditedAfterUsdc;
      downtime = again.newTotalDowntimeMinutes;
    }
    expect(reserve).toBe(usdc(4997.5));
  });
  it("a subscriber can never be paid more than the worst tier", () => {
    let reserve = usdc(5000);
    let credited = [0];
    let downtime = 0;
    let total = 0;
    for (const mins of [35, 35, 480, 480, 1200, 1200, 5000, 40000]) {
      const sim = simulateOutage({ ...base, totalDowntimeMinutes: downtime, additionalDowntimeMinutes: mins, reserveBalanceUsdc: reserve, creditedUsdc: credited });
      total += sim.totalCompensationUsdc;
      reserve = sim.reserveAfterUsdc;
      credited = sim.creditedAfterUsdc;
      downtime = sim.newTotalDowntimeMinutes;
    }
    expect(total).toBe(calculateSubscriberRefundUsdc(usdc(10), tiers.severeBreachRefundBps));
    expect(reserve + total).toBe(usdc(5000));
  });
  it("joining mid-breach starts at the current tier", () => {
    const startCredit = initialCreditUsdc(usdc(10), calculateUptimeBps(480), 9995, tiers);
    expect(startCredit).toBe(usdc(2.5));
    const same = simulateOutage({ ...base, totalDowntimeMinutes: 480, additionalDowntimeMinutes: 10, reserveBalanceUsdc: usdc(100), creditedUsdc: [startCredit] });
    expect(same.totalCompensationUsdc).toBe(0);
    const worse = simulateOutage({ ...base, totalDowntimeMinutes: 480, additionalDowntimeMinutes: 1200, reserveBalanceUsdc: usdc(100), creditedUsdc: [startCredit] });
    expect(worse.totalCompensationUsdc).toBe(usdc(2.5));
  });
  it("a short reserve skips the subscriber without marking them paid", () => {
    const short = simulateOutage({ ...base, totalDowntimeMinutes: 0, additionalDowntimeMinutes: 480, reserveBalanceUsdc: usdc(1), creditedUsdc: [0] });
    expect(short.totalCompensationUsdc).toBe(0);
    expect(short.creditedAfterUsdc).toEqual([0]);
    const toppedUp = simulateOutage({ ...base, totalDowntimeMinutes: 480, additionalDowntimeMinutes: 1, reserveBalanceUsdc: usdc(50), creditedUsdc: short.creditedAfterUsdc });
    expect(toppedUp.totalCompensationUsdc).toBe(usdc(2.5));
  });
});

describe("every seat is fully backed", () => {
  const price = usdc(10);
  const severe = calculateSubscriberRefundUsdc(price, tiers.severeBreachRefundBps); // $5.00
  it("a new seat locks the severe refund, minus any starting credit", () => {
    expect(seatCoverRequiredUsdc(price, 10000, 9995, tiers)).toBe(severe);
    // joining mid-moderate-breach starts with $2.50 credit, so only $2.50 more can ever be owed
    expect(seatCoverRequiredUsdc(price, calculateUptimeBps(480), 9995, tiers)).toBe(usdc(2.5));
    // already at the severe tier: nothing more can be owed, nothing to lock
    expect(seatCoverRequiredUsdc(price, calculateUptimeBps(1200), 9995, tiers)).toBe(0);
  });
  it("provider sybil seats can't take a real customer's coverage", () => {
    // provider sells 10 self-owned seats + Alice; each sale had to lock $5, so the reserve is >= $55
    const seats = 11;
    const reserve = severe * seats;
    const sim = simulateOutage({
      totalDowntimeMinutes: 0,
      additionalDowntimeMinutes: 1200,
      monthlyPriceUsdc: price,
      slaTargetBps: 9995,
      tiers,
      reserveBalanceUsdc: reserve,
      creditedUsdc: Array(seats).fill(0),
      seatCoverUsdc: Array(seats).fill(severe),
    });
    expect(sim.payoutsUsdc[seats - 1]).toBe(severe); // Alice, last in line, is paid in full
    expect(sim.paidSubscribers).toBe(seats);
    expect(sim.reserveAfterUsdc).toBe(0);
    expect(sim.seatCoverAfterUsdc).toEqual(Array(seats).fill(0));
  });
  it("payouts never exceed a seat's locked cover across escalating outages", () => {
    let credited = [0];
    let cover = [severe];
    let reserve = severe;
    let downtime = 0;
    let total = 0;
    for (const mins of [35, 480, 1200, 40000]) {
      const sim = simulateOutage({ totalDowntimeMinutes: downtime, additionalDowntimeMinutes: mins, monthlyPriceUsdc: price, slaTargetBps: 9995, tiers, reserveBalanceUsdc: reserve, creditedUsdc: credited, seatCoverUsdc: cover });
      total += sim.totalCompensationUsdc;
      credited = sim.creditedAfterUsdc;
      cover = sim.seatCoverAfterUsdc;
      reserve = sim.reserveAfterUsdc;
      downtime = sim.newTotalDowntimeMinutes;
    }
    expect(total).toBe(severe);
    expect(cover).toEqual([0]);
    expect(reserve).toBe(0);
  });
  it("settleSubscribers pays from each seat's cover, not first-come from a shared pool", () => {
    const tier = calculateSubscriberRefundUsdc(price, tiers.moderateBreachRefundBps);
    const out = settleSubscribers(tier, severe * 3, [0, 0, 0], [severe, severe, severe]);
    expect(out.payoutsUsdc).toEqual([tier, tier, tier]);
    expect(out.seatCoverAfterUsdc).toEqual([severe - tier, severe - tier, severe - tier]);
  });
});
