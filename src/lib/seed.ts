import { PROVIDER_TREASURY } from "./chain";
import { usdc } from "./sla-engine";
import type { HeartbeatWindow, ServiceCategory, ServicePlan } from "./types";

export const WINDOW_MINUTES = 480; // each of the 90 bars = 8 hours
export const BAR_COUNT = 90;
export const DEFAULT_TIERS = { minorBreachRefundBps: 1000, moderateBreachRefundBps: 2500, severeBreachRefundBps: 5000 };

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 30 days of clean 8-hour windows (100% uptime) with realistic latency jitter. */
export function generateHeartbeats(seedKey: string, baseLatency: number): HeartbeatWindow[] {
  const rand = mulberry32(hashString(seedKey));
  return Array.from({ length: BAR_COUNT }, (_, index) => {
    const jitter = Math.round((rand() - 0.5) * baseLatency * 0.5);
    const spike = rand() > 0.965; // occasional latency spike: slow but not down
    return {
      index,
      status: spike ? "DEGRADED" : "UP",
      latencyMs: Math.max(4, baseLatency + jitter + (spike ? baseLatency * 4 : 0)),
      downtimeMinutes: 0,
    } satisfies HeartbeatWindow;
  });
}

interface SeedInput {
  onChainId: number;
  name: string;
  slug: string;
  category: ServiceCategory;
  description: string;
  endpointUrl: string;
  synthetic: boolean;
  accent: string;
  price: number;
  slaTargetBps: number;
  reserve: number;
  baseLatency: number;
}

export function buildService(s: SeedInput, createdAt: string): ServicePlan {
  return {
    id: `svc_${s.slug}`,
    onChainId: s.onChainId,
    name: s.name,
    slug: s.slug,
    category: s.category,
    description: s.description,
    endpointUrl: s.endpointUrl,
    synthetic: s.synthetic,
    accent: s.accent,
    providerAddress: PROVIDER_TREASURY,
    monthlyPriceUsdc: usdc(s.price),
    slaTargetBps: s.slaTargetBps,
    currentUptimeBps: 10000,
    totalDowntimeMinutes: 0,
    reserveBalanceUsdc: usdc(s.reserve),
    totalPaidOutUsdc: 0,
    activeSubscribersCount: 0,
    status: "OPERATIONAL",
    statusUntil: null,
    compensationTiers: { ...DEFAULT_TIERS },
    heartbeatHistory: generateHeartbeats(s.slug, s.baseLatency),
    createdAt,
  };
}

export const SEED_SERVICES: SeedInput[] = [
  {
    onChainId: 1,
    name: "Streamly",
    slug: "streamly",
    category: "Streaming",
    description: "4K film and live audio streaming.",
    endpointUrl: "https://api.streamly.demo/health",
    synthetic: true,
    accent: "#F97316",
    price: 12,
    slaTargetBps: 9990,
    reserve: 2400,
    baseLatency: 38,
  },
  {
    onChainId: 2,
    name: "CloudBox",
    slug: "cloudbox",
    category: "Cloud Storage",
    description: "Encrypted file storage and sync for teams.",
    endpointUrl: "https://status.cloudbox.demo/health",
    synthetic: true,
    accent: "#0EA5E9",
    price: 10,
    slaTargetBps: 9995,
    reserve: 5000,
    baseLatency: 52,
  },
  {
    onChainId: 3,
    name: "HyperNode RPC",
    slug: "hypernode-rpc",
    category: "Developer Infrastructure",
    description: "Low-latency RPC nodes for Base.",
    endpointUrl: "https://sepolia.base.org",
    synthetic: false,
    accent: "#14B8A6",
    price: 25,
    slaTargetBps: 9999,
    reserve: 10000,
    baseLatency: 21,
  },
];

export const SEED_JUDGE_BALANCE = usdc(100);
export const SEED_PROVIDER_BALANCE = usdc(25000);
export const SEED_BLOCK = 18_406_220;
