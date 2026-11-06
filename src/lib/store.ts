"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  JUDGE_WALLET,
  MONITOR_ATTESTOR,
  PROVIDER_TREASURY,
  SANDBOX_SLA_ADDRESS,
  SANDBOX_USDC_ADDRESS,
  computeAttestationHash,
  sandboxTxHash,
} from "./chain";
import { BAR_COUNT, SEED_BLOCK, SEED_JUDGE_BALANCE, SEED_PROVIDER_BALANCE, SEED_SERVICES, WINDOW_MINUTES, buildService, generateHeartbeats } from "./seed";
import { USDC_UNIT, calculateSubscriberRefundUsdc, formatBps, formatMinutes, formatUsdc, initialCreditUsdc, seatCoverRequiredUsdc, simulateOutage, usdc } from "./sla-engine";

/** creditedCompensation for a subscription; older saved state predates the field, so fall back to what was paid. */
function creditedOf(sub: Subscription): number {
  return sub.creditedCompensationUsdc ?? sub.accruedCompensationUsdc + sub.claimedCompensationUsdc;
}

/** seatCover for a subscription; older saved state predates it, so assume the rest of the severe refund is locked. */
function seatCoverOf(sub: Subscription, svc: ServicePlan): number {
  return sub.seatCoverUsdc ?? Math.max(0, calculateSubscriberRefundUsdc(svc.monthlyPriceUsdc, svc.compensationTiers.severeBreachRefundBps) - creditedOf(sub));
}

/**
 * Seat backing for a service (mirrors committedReserve / availableReserve / seatCoverRequired):
 * every subscription locks its worst-case refund, so a plan can only be sold while the reserve backs it.
 */
export function seatCapacity(svc: ServicePlan, subscriptions: Subscription[]) {
  const committedUsdc = subscriptions.filter((x) => x.serviceId === svc.id).reduce((a, sub) => a + seatCoverOf(sub, svc), 0);
  const availableUsdc = Math.max(0, svc.reserveBalanceUsdc - committedUsdc);
  const coverPerSeatUsdc = seatCoverRequiredUsdc(svc.monthlyPriceUsdc, svc.currentUptimeBps, svc.slaTargetBps, svc.compensationTiers);
  const seatsLeft = coverPerSeatUsdc > 0 ? Math.floor(availableUsdc / coverPerSeatUsdc) : Infinity;
  return { committedUsdc, availableUsdc, coverPerSeatUsdc, seatsLeft };
}
import type {
  ActionResult,
  Address,
  ChainEvent,
  ChainEventType,
  HeartbeatWindow,
  IncidentSource,
  OutageIncident,
  ProbeResult,
  Receipt,
  ServiceCategory,
  ServicePlan,
  ServiceStatus,
  Subscription,
} from "./types";

export const FAUCET_MAX_USDC = usdc(1000);
export const INCIDENT_RECOVERY_MS = 14_000;

export interface NewServiceInput {
  name: string;
  category: ServiceCategory;
  description: string;
  endpointUrl: string;
  accent: string;
  monthlyPriceUsdc: number;
  slaTargetBps: number;
  minorBreachRefundBps: number;
  moderateBreachRefundBps: number;
  severeBreachRefundBps: number;
  initialReserveUsdc: number;
}

interface DataState {
  services: ServicePlan[];
  subscriptions: Subscription[];
  incidents: OutageIncident[];
  balances: Record<string, number>;
  events: ChainEvent[];
  probes: ProbeResult[];
  blockNumber: number;
  nonce: number;
  incidentSeq: number;
  /** increments every time USDC moves reserve → vault or vault → wallet (drives flow animations) */
  flowPulse: number;
  lastFlow: { kind: "unlock" | "claim"; serviceId: string; amountUsdc: number } | null;
  lastReceipt: Receipt | null;
}

interface Actions {
  mint: (to: Address, amountUsdc: number) => ActionResult;
  subscribe: (serviceId: string, subscriber?: Address) => ActionResult;
  /**
   * `opts.source` marks who raised it (defaults to "chaos" = manual injection); the payout math is identical either way.
   * `opts.statusHoldMs` keeps the service badge in its incident state for longer than the default 14s
   * (the watchdog holds it while an incident is still open, then calls recoverService when the endpoint answers).
   */
  injectOutage: (
    serviceId: string,
    minutes: number,
    title: string,
    opts?: { source?: IncidentSource; statusHoldMs?: number },
  ) => ActionResult<{ receipt: Receipt; incident: OutageIncident }>;
  claim: (serviceId: string, subscriber?: Address) => ActionResult;
  registerService: (input: NewServiceInput) => ActionResult<{ receipt: Receipt; service: ServicePlan }>;
  fundReserve: (serviceId: string, amountUsdc: number) => ActionResult;
  recoverService: (serviceId: string) => void;
  tickRecovery: () => void;
  recordProbe: (probe: ProbeResult) => void;
  clearReceipt: () => void;
  resetDemo: () => void;
}

export type UpHeldState = DataState & Actions;

function initialData(): DataState {
  const createdAt = new Date(0).toISOString();
  const services = SEED_SERVICES.map((s) => buildService(s, createdAt));
  const seedEvents: ChainEvent[] = services.flatMap((svc, i) => [
    {
      id: `seed_reg_${svc.id}`,
      type: "ServiceRegistered" as const,
      serviceId: svc.id,
      actor: PROVIDER_TREASURY,
      detail: `${svc.name} registered · ${formatUsdc(svc.monthlyPriceUsdc)}/mo · SLA ${formatBps(svc.slaTargetBps)}`,
      txHash: sandboxTxHash("registerService", i * 2, svc.slug),
      blockNumber: SEED_BLOCK - 900 + i * 40,
      timestamp: createdAt,
    },
    {
      id: `seed_fund_${svc.id}`,
      type: "ReserveFunded" as const,
      serviceId: svc.id,
      actor: PROVIDER_TREASURY,
      amountUsdc: svc.reserveBalanceUsdc,
      detail: `${svc.name} reserve funded · ${formatUsdc(svc.reserveBalanceUsdc)} USDC`,
      txHash: sandboxTxHash("fundReserve", i * 2 + 1, svc.slug),
      blockNumber: SEED_BLOCK - 880 + i * 40,
      timestamp: createdAt,
    },
  ]);
  return {
    services,
    subscriptions: [],
    incidents: [],
    balances: { [JUDGE_WALLET]: SEED_JUDGE_BALANCE, [PROVIDER_TREASURY]: SEED_PROVIDER_BALANCE },
    events: seedEvents.reverse(),
    probes: [],
    blockNumber: SEED_BLOCK,
    nonce: 10,
    incidentSeq: 0,
    flowPulse: 0,
    lastFlow: null,
    lastReceipt: null,
  };
}

function beatStatusFor(bar: HeartbeatWindow): HeartbeatWindow["status"] {
  if (bar.downtimeMinutes >= 30) return "DOWN";
  if (bar.downtimeMinutes > 0) return "DEGRADED";
  return bar.status === "DOWN" ? "UP" : bar.status;
}

/** Paints downtime into the most recent 8h windows, walking backwards. */
function applyDowntimeToBars(history: HeartbeatWindow[], minutes: number): HeartbeatWindow[] {
  const bars = history.map((b) => ({ ...b }));
  let remaining = minutes;
  for (let i = bars.length - 1; i >= 0 && remaining > 0; i--) {
    const cap = WINDOW_MINUTES - bars[i].downtimeMinutes;
    if (cap <= 0) continue;
    const take = Math.min(cap, remaining);
    bars[i].downtimeMinutes += take;
    bars[i].status = beatStatusFor(bars[i]);
    bars[i].latencyMs = bars[i].status === "DOWN" ? 0 : bars[i].latencyMs * 3;
    remaining -= take;
  }
  return bars;
}

/** No https URL, or a fictional / private host the probe route refuses (*.demo, *.local, …): its heartbeat is synthesized. */
function isSyntheticEndpoint(endpoint: string): boolean {
  if (!/^https:\/\//i.test(endpoint)) return true;
  try {
    const host = new URL(endpoint).hostname;
    return host === "localhost" || /\.(demo|local|internal|localhost)$/i.test(host);
  } catch {
    return true;
  }
}

function statusForSeverity(sev: OutageIncident["severity"], minutes: number): ServiceStatus {
  if (sev === "MODERATE" || sev === "SEVERE" || minutes >= 120) return "OUTAGE";
  return "DEGRADED";
}

const storage = createJSONStorage(() => {
  if (typeof window === "undefined") {
    return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
  }
  try {
    const k = "__upheld_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
  }
});

export const useUpHeld = create<UpHeldState>()(
  persist(
    (set, get) => {
      /** Builds a sandbox receipt + bumps the sandbox block / nonce. */
      const makeReceipt = (
        method: string,
        from: Address,
        to: Address,
        args: Record<string, string>,
        events: ChainEventType[],
        amountUsdc?: number,
      ): Receipt => {
        const { nonce, blockNumber } = get();
        const nextBlock = blockNumber + 1 + (nonce % 3);
        const receipt: Receipt = {
          txHash: sandboxTxHash(method, nonce, args),
          blockNumber: nextBlock,
          method,
          from,
          to,
          args,
          events,
          amountUsdc,
          gasUsed: 46_000 + ((nonce * 7919) % 52_000),
          timestamp: new Date().toISOString(),
          mode: "sandbox",
        };
        set({ nonce: nonce + 1, blockNumber: nextBlock, lastReceipt: receipt });
        return receipt;
      };

      const pushEvents = (events: ChainEvent[]) => set((s) => ({ events: [...events.reverse(), ...s.events].slice(0, 200) }));

      const ev = (
        type: ChainEventType,
        receipt: Receipt,
        actor: Address,
        detail: string,
        extra: Partial<ChainEvent> = {},
      ): ChainEvent => ({
        id: `${receipt.txHash}_${type}_${Math.random().toString(36).slice(2, 8)}`,
        type,
        actor,
        detail,
        txHash: receipt.txHash,
        blockNumber: receipt.blockNumber,
        timestamp: receipt.timestamp,
        ...extra,
      });

      return {
        ...initialData(),

        mint: (to, amountUsdc) => {
          if (!Number.isInteger(amountUsdc) || amountUsdc <= 0) return { ok: false, error: "Amount must be positive." };
          if (amountUsdc > FAUCET_MAX_USDC) return { ok: false, error: "Faucet max is 1,000 USDC per call." };
          const receipt = makeReceipt("faucet", to, SANDBOX_USDC_ADDRESS, { to, amount: String(amountUsdc) }, ["FaucetMint"], amountUsdc);
          set((s) => ({ balances: { ...s.balances, [to]: (s.balances[to] ?? 0) + amountUsdc } }));
          pushEvents([ev("FaucetMint", receipt, to, `Minted ${formatUsdc(amountUsdc)} test USDC`, { amountUsdc })]);
          return { ok: true, receipt };
        },

        subscribe: (serviceId, subscriber = JUDGE_WALLET) => {
          const s = get();
          const svc = s.services.find((x) => x.id === serviceId);
          if (!svc) return { ok: false, error: "Service not found." };
          if (s.subscriptions.some((x) => x.serviceId === serviceId && x.subscriberAddress === subscriber))
            return { ok: false, error: "Already subscribed" };
          const bal = s.balances[subscriber] ?? 0;
          if (bal < svc.monthlyPriceUsdc) return { ok: false, error: `Insufficient USDC. This plan costs ${formatUsdc(svc.monthlyPriceUsdc)}. Mint test USDC from the faucet.` };
          const cap = seatCapacity(svc, s.subscriptions);
          if (cap.availableUsdc < cap.coverPerSeatUsdc)
            return { ok: false, error: `${svc.name} is sold out. Its reserve can't cover another seat (${formatUsdc(cap.coverPerSeatUsdc)} per seat). The provider can add funds on /provider.` };
          const receipt = makeReceipt("subscribe", subscriber, SANDBOX_SLA_ADDRESS, { serviceId: String(svc.onChainId) }, ["Subscribed"], svc.monthlyPriceUsdc);
          const sub: Subscription = {
            id: `sub_${svc.slug}_${subscriber.slice(2, 8)}_${Date.now().toString(36)}`,
            serviceId,
            subscriberAddress: subscriber,
            startedAt: receipt.timestamp,
            paidAmountUsdc: svc.monthlyPriceUsdc,
            accruedCompensationUsdc: 0,
            claimedCompensationUsdc: 0,
            // like subscribe(): joining mid-breach starts at the current tier, so only further degradation pays
            creditedCompensationUsdc: initialCreditUsdc(svc.monthlyPriceUsdc, svc.currentUptimeBps, svc.slaTargetBps, svc.compensationTiers),
            // lock this seat's worst-case refund in the provider reserve (no backing, no sale)
            seatCoverUsdc: cap.coverPerSeatUsdc,
            status: "ACTIVE",
            lastTxHash: receipt.txHash,
          };
          set((st) => ({
            subscriptions: [...st.subscriptions, sub],
            balances: {
              ...st.balances,
              [subscriber]: (st.balances[subscriber] ?? 0) - svc.monthlyPriceUsdc,
              [svc.providerAddress]: (st.balances[svc.providerAddress] ?? 0) + svc.monthlyPriceUsdc,
            },
            services: st.services.map((x) => (x.id === serviceId ? { ...x, activeSubscribersCount: x.activeSubscribersCount + 1 } : x)),
          }));
          pushEvents([ev("Subscribed", receipt, subscriber, `Subscribed to ${svc.name} · paid ${formatUsdc(svc.monthlyPriceUsdc)} USDC`, { serviceId, amountUsdc: svc.monthlyPriceUsdc })]);
          return { ok: true, receipt };
        },

        injectOutage: (serviceId, minutesRaw, title, opts) => {
          const source: IncidentSource = opts?.source ?? "chaos";
          const s = get();
          const svc = s.services.find((x) => x.id === serviceId);
          if (!svc) return { ok: false, error: "Service not found." };
          const minutes = Math.floor(minutesRaw);
          if (!(minutes > 0)) return { ok: false, error: "Downtime must be at least 1 minute." };
          const subs = s.subscriptions.filter((x) => x.serviceId === serviceId);
          const sim = simulateOutage({
            totalDowntimeMinutes: svc.totalDowntimeMinutes,
            additionalDowntimeMinutes: minutes,
            monthlyPriceUsdc: svc.monthlyPriceUsdc,
            slaTargetBps: svc.slaTargetBps,
            tiers: svc.compensationTiers,
            reserveBalanceUsdc: svc.reserveBalanceUsdc,
            creditedUsdc: subs.map(creditedOf),
            seatCoverUsdc: subs.map((x) => seatCoverOf(x, svc)),
          });
          const seq = s.incidentSeq + 1;
          const attestationHash = computeAttestationHash(svc.onChainId, seq, minutes, sim.newUptimeBps);
          const unlockEvents: ChainEventType[] = sim.paidSubscribers > 0 ? ["OutageRecorded", "CompensationUnlocked"] : ["OutageRecorded"];
          const receipt = makeReceipt(
            "recordOutage",
            MONITOR_ATTESTOR,
            SANDBOX_SLA_ADDRESS,
            { serviceId: String(svc.onChainId), additionalDowntimeMinutes: String(minutes), attestationHash },
            unlockEvents,
            sim.totalCompensationUsdc,
          );
          const severity = sim.evaluation.severity;
          const incident: OutageIncident = {
            id: `inc_${seq}`,
            seq,
            serviceId,
            title,
            severity,
            downtimeMinutes: minutes,
            totalDowntimeAfter: sim.newTotalDowntimeMinutes,
            previousUptimeBps: sim.previousUptimeBps,
            newUptimeBps: sim.newUptimeBps,
            slaBreached: sim.evaluation.breached,
            refundPercentageBps: sim.evaluation.refundBps,
            refundPerSubscriberUsdc: sim.refundPerSubscriberUsdc,
            subscribersCompensated: sim.paidSubscribers,
            totalCompensationTriggeredUsdc: sim.totalCompensationUsdc,
            reserveAfterUsdc: sim.reserveAfterUsdc,
            attestationHash,
            txHash: receipt.txHash,
            blockNumber: receipt.blockNumber,
            createdAt: receipt.timestamp,
            source,
          };
          // credit subscribers in insertion order, exactly like the contract loop (top up to the tier, never twice)
          const payout = new Map<string, { paid: number; creditedAfter: number; coverAfter: number }>();
          subs.forEach((sub, i) =>
            payout.set(sub.id, { paid: sim.payoutsUsdc[i] ?? 0, creditedAfter: sim.creditedAfterUsdc[i] ?? creditedOf(sub), coverAfter: sim.seatCoverAfterUsdc[i] ?? seatCoverOf(sub, svc) }),
          );
          set((st) => ({
            incidentSeq: seq,
            incidents: [incident, ...st.incidents],
            services: st.services.map((x) =>
              x.id === serviceId
                ? {
                    ...x,
                    totalDowntimeMinutes: sim.newTotalDowntimeMinutes,
                    currentUptimeBps: sim.newUptimeBps,
                    reserveBalanceUsdc: sim.reserveAfterUsdc,
                    totalPaidOutUsdc: x.totalPaidOutUsdc + sim.totalCompensationUsdc,
                    status: statusForSeverity(severity, minutes),
                    statusUntil: Date.now() + Math.max(INCIDENT_RECOVERY_MS, opts?.statusHoldMs ?? 0),
                    heartbeatHistory: applyDowntimeToBars(x.heartbeatHistory, minutes),
                  }
                : x,
            ),
            subscriptions: st.subscriptions.map((sub) => {
              const p = payout.get(sub.id);
              if (!p) return sub;
              if (p.paid <= 0) return { ...sub, creditedCompensationUsdc: p.creditedAfter, seatCoverUsdc: p.coverAfter };
              return {
                ...sub,
                accruedCompensationUsdc: sub.accruedCompensationUsdc + p.paid,
                creditedCompensationUsdc: p.creditedAfter,
                seatCoverUsdc: p.coverAfter,
                status: "COMPENSATION_AVAILABLE" as const,
                lastTxHash: receipt.txHash,
              };
            }),
            flowPulse: sim.totalCompensationUsdc > 0 ? st.flowPulse + 1 : st.flowPulse,
            lastFlow: sim.totalCompensationUsdc > 0 ? { kind: "unlock", serviceId, amountUsdc: sim.totalCompensationUsdc } : st.lastFlow,
          }));
          const evs: ChainEvent[] = [
            ev(
              "OutageRecorded",
              receipt,
              MONITOR_ATTESTOR,
              `${svc.name} · ${title} · +${formatMinutes(minutes)} · uptime ${formatBps(sim.newUptimeBps)}${sim.evaluation.breached ? ` (SLA ${formatBps(svc.slaTargetBps)} breached, ${sim.evaluation.refundBps / 100}% refund)` : " (within SLA)"}`,
              { serviceId, attestationHash },
            ),
          ];
          for (const sub of subs) {
            const paid = payout.get(sub.id)?.paid ?? 0;
            if (paid <= 0) continue;
            evs.push(
              ev("CompensationUnlocked", receipt, sub.subscriberAddress, `${formatUsdc(paid)} USDC moved from reserve to claimable balance`, {
                serviceId,
                amountUsdc: paid,
              }),
            );
          }
          pushEvents(evs);
          return { ok: true, receipt: { receipt, incident } };
        },

        claim: (serviceId, subscriber = JUDGE_WALLET) => {
          const s = get();
          const sub = s.subscriptions.find((x) => x.serviceId === serviceId && x.subscriberAddress === subscriber);
          const svc = s.services.find((x) => x.id === serviceId);
          if (!sub || !svc) return { ok: false, error: "No subscription found." };
          const owed = sub.accruedCompensationUsdc;
          if (owed <= 0) return { ok: false, error: "No compensation available" };
          const receipt = makeReceipt("claimCompensation", subscriber, SANDBOX_SLA_ADDRESS, { serviceId: String(svc.onChainId) }, ["CompensationClaimed"], owed);
          set((st) => ({
            subscriptions: st.subscriptions.map((x) =>
              x.id === sub.id
                ? { ...x, accruedCompensationUsdc: 0, claimedCompensationUsdc: x.claimedCompensationUsdc + owed, status: "CLAIMED" as const, lastTxHash: receipt.txHash }
                : x,
            ),
            balances: { ...st.balances, [subscriber]: (st.balances[subscriber] ?? 0) + owed },
            flowPulse: st.flowPulse + 1,
            lastFlow: { kind: "claim", serviceId, amountUsdc: owed },
          }));
          pushEvents([ev("CompensationClaimed", receipt, subscriber, `Claimed ${formatUsdc(owed)} USDC from ${svc.name}`, { serviceId, amountUsdc: owed })]);
          return { ok: true, receipt };
        },

        registerService: (input) => {
          const s = get();
          const name = input.name.trim();
          if (name.length < 2) return { ok: false, error: "Service name is required." };
          if (s.services.some((x) => x.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: "A service with that name already exists." };
          if (!(input.monthlyPriceUsdc > 0)) return { ok: false, error: "Monthly price must be greater than 0." };
          if (input.slaTargetBps < 9900 || input.slaTargetBps > 9999) return { ok: false, error: "SLA target must be between 99.00% and 99.99%." };
          const tiers = [input.minorBreachRefundBps, input.moderateBreachRefundBps, input.severeBreachRefundBps];
          if (tiers.some((t) => t < 0 || t > 10000)) return { ok: false, error: "Refund tiers must be between 0% and 100%." };
          if (!(tiers[0] <= tiers[1] && tiers[1] <= tiers[2])) return { ok: false, error: "Refund tiers must increase: minor ≤ moderate ≤ severe." };
          if (input.initialReserveUsdc < 0) return { ok: false, error: "Reserve cannot be negative." };
          const treasury = s.balances[PROVIDER_TREASURY] ?? 0;
          if (input.initialReserveUsdc > treasury) return { ok: false, error: `Treasury only holds ${formatUsdc(treasury)} USDC.` };

          let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "service";
          if (s.services.some((x) => x.slug === slug)) slug = `${slug}-${s.services.length + 1}`;
          const onChainId = Math.max(...s.services.map((x) => x.onChainId)) + 1;
          const receipt = makeReceipt(
            "registerService",
            PROVIDER_TREASURY,
            SANDBOX_SLA_ADDRESS,
            {
              name,
              monthlyPriceUsdc: String(input.monthlyPriceUsdc),
              slaTargetBps: String(input.slaTargetBps),
              minorRefundBps: String(input.minorBreachRefundBps),
              moderateRefundBps: String(input.moderateBreachRefundBps),
              severeRefundBps: String(input.severeBreachRefundBps),
            },
            ["ServiceRegistered"],
          );
          const endpoint = input.endpointUrl.trim();
          const service: ServicePlan = {
            id: `svc_${slug}`,
            onChainId,
            name,
            slug,
            category: input.category,
            description: input.description.trim() || `${input.category} service with a ${formatBps(input.slaTargetBps)} uptime guarantee.`,
            endpointUrl: endpoint,
            synthetic: isSyntheticEndpoint(endpoint),
            accent: input.accent,
            providerAddress: PROVIDER_TREASURY,
            monthlyPriceUsdc: input.monthlyPriceUsdc,
            slaTargetBps: input.slaTargetBps,
            currentUptimeBps: 10000,
            totalDowntimeMinutes: 0,
            reserveBalanceUsdc: 0,
            totalPaidOutUsdc: 0,
            activeSubscribersCount: 0,
            status: "OPERATIONAL",
            statusUntil: null,
            compensationTiers: {
              minorBreachRefundBps: input.minorBreachRefundBps,
              moderateBreachRefundBps: input.moderateBreachRefundBps,
              severeBreachRefundBps: input.severeBreachRefundBps,
            },
            heartbeatHistory: generateHeartbeats(slug, 30 + (onChainId * 13) % 40),
            createdAt: receipt.timestamp,
          };
          set((st) => ({ services: [...st.services, service] }));
          pushEvents([ev("ServiceRegistered", receipt, PROVIDER_TREASURY, `${name} registered · ${formatUsdc(input.monthlyPriceUsdc)}/mo · SLA ${formatBps(input.slaTargetBps)}`, { serviceId: service.id })]);
          if (input.initialReserveUsdc > 0) {
            const r = get().fundReserve(service.id, input.initialReserveUsdc);
            if (!r.ok) return { ok: false, error: r.error };
          }
          return { ok: true, receipt: { receipt, service: get().services.find((x) => x.id === service.id)! } };
        },

        fundReserve: (serviceId, amountUsdc) => {
          const s = get();
          const svc = s.services.find((x) => x.id === serviceId);
          if (!svc) return { ok: false, error: "Service not found." };
          if (!Number.isInteger(amountUsdc) || amountUsdc <= 0) return { ok: false, error: "Amount must be positive." };
          const treasury = s.balances[PROVIDER_TREASURY] ?? 0;
          if (treasury < amountUsdc) return { ok: false, error: "Insufficient USDC in provider treasury." };
          const receipt = makeReceipt("fundReserve", PROVIDER_TREASURY, SANDBOX_SLA_ADDRESS, { serviceId: String(svc.onChainId), amountUsdc: String(amountUsdc) }, ["ReserveFunded"], amountUsdc);
          const newReserve = svc.reserveBalanceUsdc + amountUsdc;
          set((st) => ({
            balances: { ...st.balances, [PROVIDER_TREASURY]: (st.balances[PROVIDER_TREASURY] ?? 0) - amountUsdc },
            services: st.services.map((x) => (x.id === serviceId ? { ...x, reserveBalanceUsdc: newReserve } : x)),
          }));
          pushEvents([ev("ReserveFunded", receipt, PROVIDER_TREASURY, `${svc.name} reserve +${formatUsdc(amountUsdc)} · balance ${formatUsdc(newReserve)} USDC`, { serviceId, amountUsdc })]);
          return { ok: true, receipt };
        },

        recoverService: (serviceId) =>
          set((st) => ({ services: st.services.map((x) => (x.id === serviceId ? { ...x, status: "OPERATIONAL", statusUntil: null } : x)) })),

        tickRecovery: () => {
          const now = Date.now();
          const due = get().services.some((x) => x.statusUntil !== null && x.statusUntil <= now);
          if (!due) return;
          set((st) => ({
            services: st.services.map((x) => (x.statusUntil !== null && x.statusUntil <= now ? { ...x, status: "OPERATIONAL", statusUntil: null } : x)),
          }));
        },

        recordProbe: (probe) => set((st) => ({ probes: [probe, ...st.probes].slice(0, 60) })),
        clearReceipt: () => set({ lastReceipt: null }),
        resetDemo: () => set({ ...initialData() }),
      };
    },
    {
      name: "upheld-demo-state",
      version: 1,
      storage,
      skipHydration: true,
      partialize: (s) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { lastReceipt, lastFlow, ...rest } = s;
        return rest as unknown as UpHeldState;
      },
    },
  ),
);

// ---------- selectors / derived helpers ----------

export function contractUsdcHoldings(state: Pick<DataState, "services" | "subscriptions">): number {
  const reserves = state.services.reduce((a, s) => a + s.reserveBalanceUsdc, 0);
  const claimable = state.subscriptions.reduce((a, s) => a + s.accruedCompensationUsdc, 0);
  return reserves + claimable;
}

export function walletClaimable(state: Pick<DataState, "subscriptions">, addr: Address = JUDGE_WALLET): number {
  return state.subscriptions.filter((s) => s.subscriberAddress === addr).reduce((a, s) => a + s.accruedCompensationUsdc, 0);
}

export function fleetUptimeBps(services: ServicePlan[]): number {
  if (!services.length) return 10000;
  return Math.floor(services.reduce((a, s) => a + s.currentUptimeBps, 0) / services.length);
}

export const BARS = BAR_COUNT;
export { USDC_UNIT };
