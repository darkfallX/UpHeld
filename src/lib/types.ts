import type { CompensationTiers, Severity } from "./sla-engine";

export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export type ServiceCategory = "Streaming" | "Cloud Storage" | "Developer Infrastructure" | "SaaS";
export const SERVICE_CATEGORIES: ServiceCategory[] = ["Streaming", "Cloud Storage", "Developer Infrastructure", "SaaS"];

export type ServiceStatus = "OPERATIONAL" | "DEGRADED" | "OUTAGE";
export type BeatStatus = "UP" | "DEGRADED" | "DOWN";

export interface HeartbeatWindow {
  /** 0 = oldest, 89 = current 8-hour window */
  index: number;
  status: BeatStatus;
  latencyMs: number;
  /** downtime minutes recorded inside this 8h (480 min) window */
  downtimeMinutes: number;
}

export interface ServicePlan {
  id: string;
  onChainId: number;
  name: string;
  slug: string;
  category: ServiceCategory;
  description: string;
  endpointUrl: string;
  /** true when the endpoint is a fictional demo host (heartbeat is synthesized) */
  synthetic: boolean;
  accent: string;
  providerAddress: Address;
  monthlyPriceUsdc: number;
  slaTargetBps: number;
  currentUptimeBps: number;
  totalDowntimeMinutes: number;
  reserveBalanceUsdc: number;
  totalPaidOutUsdc: number;
  activeSubscribersCount: number;
  status: ServiceStatus;
  /** epoch ms when an injected incident auto-recovers to OPERATIONAL */
  statusUntil: number | null;
  compensationTiers: CompensationTiers;
  heartbeatHistory: HeartbeatWindow[];
  createdAt: string;
}

export interface Subscription {
  id: string;
  serviceId: string;
  subscriberAddress: Address;
  startedAt: string;
  paidAmountUsdc: number;
  /** currently claimable (mirrors claimableCompensation[subscriber][serviceId]) */
  accruedCompensationUsdc: number;
  /** refund already credited for the current breach (mirrors creditedCompensation[subscriber][serviceId]) */
  creditedCompensationUsdc?: number;
  /** worst-case refund still locked in the provider reserve for this seat (mirrors seatCover[subscriber][serviceId]) */
  seatCoverUsdc?: number;
  claimedCompensationUsdc: number;
  status: "ACTIVE" | "COMPENSATION_AVAILABLE" | "CLAIMED";
  lastTxHash: Hex;
}

export interface OutageIncident {
  id: string;
  seq: number;
  serviceId: string;
  title: string;
  severity: Exclude<Severity, "NONE"> | "NONE";
  downtimeMinutes: number;
  totalDowntimeAfter: number;
  previousUptimeBps: number;
  newUptimeBps: number;
  slaBreached: boolean;
  refundPercentageBps: number;
  refundPerSubscriberUsdc: number;
  subscribersCompensated: number;
  totalCompensationTriggeredUsdc: number;
  reserveAfterUsdc: number;
  attestationHash: Hex;
  txHash: Hex;
  blockNumber: number;
  createdAt: string;
  /**
   * Who raised the incident: "watchdog" = recorded automatically by the /monitor watchdog after
   * consecutive failed checks; "chaos" = injected by hand (Chaos Theater). Older saved state has none (treat as "chaos").
   */
  source?: IncidentSource;
}

export type IncidentSource = "watchdog" | "chaos";

export type ChainEventType =
  | "FaucetMint"
  | "ServiceRegistered"
  | "ReserveFunded"
  | "Subscribed"
  | "OutageRecorded"
  | "CompensationUnlocked"
  | "CompensationClaimed";

export interface ChainEvent {
  id: string;
  type: ChainEventType;
  serviceId?: string;
  actor: Address;
  amountUsdc?: number;
  detail: string;
  txHash: Hex;
  blockNumber: number;
  attestationHash?: Hex;
  timestamp: string;
}

export interface Receipt {
  txHash: Hex;
  blockNumber: number;
  method: string;
  from: Address;
  to: Address;
  args: Record<string, string>;
  events: ChainEventType[];
  amountUsdc?: number;
  gasUsed: number;
  timestamp: string;
  mode: "sandbox" | "live";
}

export interface ProbeResult {
  id: string;
  url: string;
  serviceId?: string;
  ok: boolean;
  status: number | null;
  statusText: string;
  latencyMs: number;
  error?: string;
  at: string;
}

export type ActionResult<T = Receipt> = { ok: true; receipt: T } | { ok: false; error: string };
