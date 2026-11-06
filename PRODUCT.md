# PRODUCT.md: UpHealth Product Requirements & Architecture Blueprint

> Product Name: **UpHealth** (Tagline: *"Uptime, Upheld on Base"*)
> Category: **Blockchain-Powered SLA Subscription & Automated Compensation Platform on Base**
> Target Event: **Vibestarter Vibeathon**

---

## 1. Executive Summary & North Star

When digital services (cloud storage, streaming apps, developer APIs, SaaS tools) go down, customers still pay full price. Traditional Service Level Agreements (SLAs) are buried in legal PDFs, require customers to manually submit support tickets with log proof, and only pay out in non-transferable store credits months later.

**UpHealth fixes this by combining subscription billing and SLA enforcement into a single programmable escrow loop on Base:**

> **UpHealth lets businesses sell performance-backed digital subscriptions, while customers automatically receive USDC compensation when the service fails to meet its promised reliability.**

### What UpHealth Is (and Isn't)
- **What we ARE building:** A two-sided subscription platform with an integrated, automated uptime monitoring and USDC compensation mechanism on Base.
- **What we are NOT building:** We are not trying to force Netflix, X, or Spotify into our smart contract. Instead, digital businesses register their services directly on UpHealth, lock a USDC reliability reserve, and use their **On-Chain SLA Badge** to win customer trust. Longer-term, the underlying engine becomes an embeddable protocol/SDK for any subscription business.

---

## 2. The 5 Core System Pillars

### Pillar 1: Consumer Dashboard (`/consumer`)
- **Service Marketplace:** Browse registered digital services displaying their monthly price in USDC, promised Uptime SLA (e.g., `99.90%`), locked Provider Reserve health badge, and live 30-day availability sparkline.
- **1-Click USDC Subscription:** Subscribe to any plan using Base USDC (supports real Base Sepolia wallet signatures OR instant pre-funded Judge Demo Wallet).
- **Live Uptime Telemetry:** View real-time status (`Operational`, `Degraded`, `Major Outage`), current billing-cycle availability %, and exact downtime minutes accrued.
- **Automatic Compensation Vault:** When a subscribed service drops below its SLA guarantee, the exact USDC refund amount unlocks automatically. Users can see the breakdown (e.g., *"CloudBox dropped to 99.72% vs 99.95% guarantee → 25% SLA refund = $2.50 USDC unlocked"*) and claim it to their wallet in one click.

### Pillar 2: Provider Dashboard (`/provider`)
- **Register Digital Service:** Businesses register their service name, category (`Streaming`, `Cloud Storage`, `Developer API`, `AI SaaS`), health-check endpoint URL, and brand accent.
- **Create Subscription Plans & SLA Guarantees:**
  - Monthly price in USDC (e.g., `$10.00 USDC / month`).
  - Target Uptime Guarantee in basis points (e.g., `99.90%` = max `43.2 minutes` downtime/month).
- **Define Tiered Compensation Policy:**
  - **Tier 1 (Minor Breach):** Uptime `< SLA` down to `99.0%` → **10% USDC refund**
  - **Tier 2 (Moderate Breach):** Uptime `< 99.0%` down to `98.0%` → **25% USDC refund**
  - **Tier 3 (Severe Breach):** Uptime `< 98.0%` → **50% - 100% USDC refund**
- **Compensation Reserve Management:** Providers deposit USDC into their dedicated on-chain SLA Reserve Vault (`fundReserve(serviceId, amount)`), proving to customers that compensation is 100% liquid and backed on Base.

### Pillar 3: Service Monitoring & Outage Verification System (`/monitor`)
- **Automated Heartbeat Engine:** Periodically checks registered service endpoints (and processes simulated chaos events in demo mode), recording status codes (`200 OK`, `502 Bad Gateway`, `503 Service Unavailable`), latency (`ms`), and incident start/end timestamps.
- **Deterministic Availability Calculator:**
  - Standard 30-day billing window = `43,200 minutes`.
  - Formula:
    $$\text{Uptime (bps)} = \left\lfloor \frac{43200 - \text{DowntimeMinutes}}{43200} \times 10000 \right\rfloor$$
- **Incident Attestation Log:** Every outage generates a structured incident record with an attestation hash (`keccak256(serviceId, incidentId, downtimeMinutes, resultingUptimeBps)`) that triggers the smart contract's compensation calculation.

### Pillar 4: Smart Contract System on Base (`contracts/UpHealthSLA.sol`)
Deployed (or deployable via script) on **Base Sepolia (`chainId: 84532`)**:
- **`MockUSDC.sol`:** ERC-20 token with 6 decimals and a public `faucet(address to, uint256 amount)` function so anyone testing on Base Sepolia can mint free USDC anytime.
- **`UpHealthSLA.sol`:**
  - `registerService(string name, uint256 monthlyPriceUsdc, uint16 slaTargetBps, uint16[3] refundTiersBps)`
  - `fundReserve(uint256 serviceId, uint256 amountUsdc)`
  - `subscribe(uint256 serviceId)`: Transfers USDC from subscriber and registers active subscription for current epoch.
  - `recordOutageAndCalculateCompensation(uint256 serviceId, uint256 downtimeMinutes, bytes32 incidentProof)`: Updates rolling uptime, evaluates breach tier against `slaTargetBps`, earmarks pro-rata USDC from `providerReserve` to each affected subscriber's `claimableCompensation[subscriber][serviceId]`.
  - `claimCompensation(uint256 serviceId)`: Transfers unlocked USDC directly to the subscriber and emits `CompensationClaimed(subscriber, serviceId, amountUsdc)`.

### Pillar 5: Interactive Hackathon Demo: "Chaos Theater" (`/demo`)
Designed specifically so hackathon judges can experience the entire two-sided loop on a single screen in under 45 seconds:
- **Pre-Seeded Fictional Services:**
  1. **Streamly**: 4K Indie Cinema & Live Audio Streaming (`$12.00 USDC/mo`, `99.90%` SLA Guarantee, `$2,400 USDC` Locked Reserve).
  2. **CloudBox**: Encrypted Team Drive & Asset Sync (`$10.00 USDC/mo`, `99.95%` SLA Guarantee, `$5,000 USDC` Locked Reserve).
  3. **HyperNode RPC**: Low-Latency Web3 Node Infrastructure (`$25.00 USDC/mo`, `99.99%` SLA Guarantee, `$10,000 USDC` Locked Reserve).
- **Interactive Chaos Controls:**
  - Judge selects a service (e.g., **CloudBox**) and clicks **Subscribe ($10 USDC)**.
  - Judge clicks **"Trigger Simulated Outage"** and picks a scenario:
    - *Scenario A: Regional CDN Outage (35 mins downtime)* → Drops CloudBox from `100.00%` to `99.91%` (Breaches `99.95%` SLA → **10% Refund = $1.00 USDC**).
    - *Scenario B: Storage Cluster Failover (480 mins / 8 hrs downtime)* → Drops CloudBox to `98.88%` (Tier 2 Breach → **25% Refund = $2.50 USDC**).
    - *Scenario C: Multi-Region Blackout (1,200 mins / 20 hrs downtime)* → Drops CloudBox to `97.22%` (Tier 3 Severe Breach → **50% Refund = $5.00 USDC**).
  - Judge watches the live heartbeat waveform flatline in crimson, the SLA calculator trip, the Provider Reserve pool decrement, and the Consumer Claim card light up in emerald.
  - Judge clicks **"Claim $2.50 USDC Refund"** → Balance increments immediately with a verifiable Base transaction hash / receipt modal.
  - Includes a **"Reset Demo State"** button at the top bar to restore initial balances and 100% uptime anytime.

---

## 3. Data Models (TypeScript / Database Schema)

All monetary amounts are stored in **integer minor units (6 decimals for USDC)** and percentages in **basis points (bps)**.

```ts
export interface ServicePlan {
  id: string;
  onChainId: number;
  name: string;                  // e.g., "Streamly", "CloudBox", "HyperNode RPC"
  slug: string;
  category: "Streaming" | "Cloud Storage" | "Developer Infrastructure" | "SaaS";
  description: string;
  endpointUrl: string;           // e.g., "https://status.cloudbox.demo/health"
  monthlyPriceUsdc: number;      // e.g., 10_000_000 ($10.00 USDC)
  slaTargetBps: number;          // e.g., 9995 (99.95%)
  currentUptimeBps: number;      // e.g., 10000 (100.00%) -> updates on outage
  totalDowntimeMinutes: number;  // Out of 43,200 mins/month
  reserveBalanceUsdc: number;    // Locked provider USDC reserve
  activeSubscribersCount: number;
  status: "OPERATIONAL" | "DEGRADED" | "OUTAGE";
  compensationTiers: {
    minorBreachRefundBps: number;    // e.g., 1000 (10% refund when < slaTargetBps)
    moderateBreachRefundBps: number; // e.g., 2500 (25% refund when < 9900 bps)
    severeBreachRefundBps: number;   // e.g., 5000 (50% refund when < 9800 bps)
  };
  heartbeatHistory: Array<{
    timestamp: string;
    status: "UP" | "DEGRADED" | "DOWN";
    latencyMs: number;
  }>;
}

export interface Subscription {
  id: string;
  serviceId: string;
  subscriberAddress: string;
  startedAt: string;
  paidAmountUsdc: number;
  accruedCompensationUsdc: number;
  claimedCompensationUsdc: number;
  status: "ACTIVE" | "COMPENSATION_AVAILABLE" | "CLAIMED";
  lastTxHash: string;
}

export interface OutageIncident {
  id: string;
  serviceId: string;
  title: string;
  severity: "MINOR" | "MODERATE" | "SEVERE";
  downtimeMinutes: number;
  previousUptimeBps: number;
  newUptimeBps: number;
  slaBreached: boolean;
  refundPercentageBps: number;
  totalCompensationTriggeredUsdc: number;
  attestationHash: string;
  createdAt: string;
}
```

---

## 4. Golden-Path Judge Walkthrough (30-Second Script)

1. **Open `/` (Landing Page):** Judge sees the headline *"Subscriptions that refund you when the service goes down."* and the interactive live **Heartbeat-to-Payout** widget. Clicks **"Launch Interactive Demo" (`/demo`)**.
2. **Subscribe (`0:05`):** Judge has a pre-funded Demo Wallet (`100.00 USDC` on Base Sepolia) or connects their own wallet. Judge subscribes to **CloudBox ($10/mo, 99.95% SLA)** and **Streamly ($12/mo, 99.90% SLA)**.
3. **Inject Outage (`0:15`):** In the center Chaos Simulator panel, judge selects **CloudBox** and clicks **"Simulate 8-Hour Storage Outage"**.
4. **Automatic Calculation (`0:22`):**
   - CloudBox status flips from `OPERATIONAL` to `MAJOR OUTAGE`.
   - Rolling uptime animates down from `100.00%` to `98.88%` (breaching the `99.95%` guarantee).
   - Smart contract logic triggers **Tier 2 Compensation (25% refund = $2.50 USDC)**, deducting `$2.50 USDC` from CloudBox's locked reserve pool.
5. **Claim Compensation (`0:28`):** On the Consumer panel, the **"Claim $2.50 USDC"** button pulses emerald. Judge clicks it, receives `+2.50 USDC` in their wallet balance (`92.50 USDC` total), and inspects the Base Sepolia transaction receipt and incident attestation hash.
