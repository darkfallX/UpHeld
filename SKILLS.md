# SKILLS.md: UpHealth Implementation Playbooks for Claude & Coding Agents

> Use alongside `AGENTS.md` (hard rules), `PRODUCT.md` (features & schema), `MOTION.md` (visual system & choreography), and `BASE_AND_MCP_GUIDE.md` (Base docs + Free Web Design MCP & UI resources).

---

## How to Execute These Skills

Work sequentially through Skills 01 to 07. After each skill:
1. Verify all TypeScript types compile (`npm run typecheck` or `npx tsc --noEmit`).
2. Ensure every new UI component is wired to real state (never leave static non-interactive mocks).
3. Respect the **100% Free Web Design Toolkit** rules-never install paid packages or use purple AI gradients.

---

### Skill 01: Project Scaffold & Free Web Design Registry Setup

**Trigger:** Starting the repository or initializing the frontend stack.

**Steps:**
1. Initialize a clean **Next.js (App Router, TypeScript, Tailwind CSS)** or **Vite + React + TypeScript + Tailwind CSS** project in the root folder.
2. Install core free dependencies:
   ```bash
   npm install lucide-react framer-motion clsx tailwind-merge viem wagmi @tanstack/react-query
   ```
3. Initialize `shadcn` (`components.json`) and merge the **100% free registries** (`@magicui` and `@react-bits`) into `components.json`:
   ```json
   {
     "registries": {
       "@magicui": "https://magicui.design/r/{name}.json",
       "@react-bits": "https://reactbits.dev/r/{name}.json"
     }
   }
   ```
4. Configure Google Fonts in root layout:
   - Display / Headings: `Space Grotesk` or `Plus Jakarta Sans` (`600`, `700`)
   - Body: `Inter` (`400`, `500`, `600`)
   - Telemetry / Uptime / USDC Monospace: `JetBrains Mono` or `IBM Plex Mono` (`400`, `500`, `600`)

**Definition of Done:** App boots cleanly, fonts load, `components.json` includes `@magicui` and `@react-bits`, and CSS variables from `MOTION.md` are applied.

---

### Skill 02: Base Smart Contracts (`UpHealthSLA.sol` & `MockUSDC.sol`)

**Trigger:** Implementing Pillar 4 (Smart Contract System on Base).

**Steps:**
1. Create `contracts/MockUSDC.sol`:
   - Standard 6-decimal ERC-20 token on Base Sepolia (`chainId: 84532`).
   - Public `faucet(address to, uint256 amount)` function allowing any tester or judge to mint up to `1,000 USDC` (`1_000_000_000` minor units) per call with zero restrictions.
2. Create `contracts/UpHealthSLA.sol`:
   - Stores `Service` structs (`provider`, `name`, `monthlyPriceUsdc`, `slaTargetBps`, `currentUptimeBps`, `totalDowntimeMinutes`, `reserveBalanceUsdc`, `minorRefundBps`, `moderateRefundBps`, `severeRefundBps`, `active`).
   - Stores `Subscription` structs (`subscriber`, `serviceId`, `paidUsdc`, `claimableUsdc`, `claimedUsdc`, `active`).
   - Implements:
     - `registerService(...)`
     - `fundReserve(uint256 serviceId, uint256 amountUsdc)`
     - `subscribe(uint256 serviceId)`
     - `recordOutage(uint256 serviceId, uint256 downtimeMinutes, bytes32 attestationHash)`
     - `claimCompensation(uint256 serviceId)`
3. Export the compiled ABIs and deterministic contract helper functions in `src/lib/contracts.ts`.
4. Implement **Dual Execution Mode** in `src/lib/web3-provider.tsx`:
   - **Live Base Sepolia Wallet Mode:** Uses Wagmi/Viem connected to Base Sepolia (`https://sepolia.base.org`, Chain ID `84532`).
   - **Instant Judge Sandbox Mode (Default fallback when no wallet connected):** Uses an in-app deterministic Base Sepolia session wallet (`0x71C...9A2B`) pre-funded with `100.00 USDC` and synchronized with the persistent state store, generating real cryptographic `keccak256` attestation hashes and simulated transaction receipts so judges never get stuck on wallet popups.

**Definition of Done:** Both Solidity contracts are complete and syntactically valid; the frontend can switch seamlessly between Live Base Sepolia Wallet and Instant Judge Sandbox Wallet.

---

### Skill 03: Service Monitoring & Deterministic SLA Calculation Engine

**Trigger:** Implementing Pillar 3 (Service Monitoring System).

**Steps:**
1. Build `src/lib/sla-engine.ts` with pure, unit-tested functions:
   - `calculateUptimeBps(totalDowntimeMinutes: number, windowMinutes = 43200): number`
   - `evaluateSlaBreach(currentUptimeBps: number, slaTargetBps: number, tiers: CompensationTiers): { breached: boolean; severity: "NONE" | "MINOR" | "MODERATE" | "SEVERE"; refundBps: number }`
   - `calculateSubscriberRefundUsdc(monthlyPriceUsdc: number, refundBps: number): number`
2. Build a real HTTP/status probe endpoint (`/api/monitor/ping` or client-side health poller) that can ping actual URLs **plus** accept deterministic chaos injections from `/demo`.
3. Generate 30-day heartbeat arrays (90 bars per service card, each representing an 8-hour window) that visually update in real time when an outage is triggered.

**Definition of Done:** Injecting `35 mins`, `480 mins`, or `1,200 mins` of downtime produces exact basis-point uptime changes and exact 6-decimal USDC refund amounts.

---

### Skill 04: Consumer Dashboard (`/consumer`)

**Trigger:** Implementing Pillar 1.

**Steps:**
1. Display the **Consumer Wallet Header**:
   - Connected address pill (`Base Sepolia • 84532`), current `USDC` balance, **"Mint +100 Testnet USDC"** button, and total `"Unlocked SLA Compensation"` counter.
2. **Marketplace Grid:**
   - Cards for **Streamly**, **CloudBox**, **HyperNode RPC**, and any provider-added services.
   - Each card shows: Category badge, Service Name, Price in USDC, Promised SLA (`99.95%`), Provider Reserve Backing (`$5,000 USDC Locked`), 90-bar Uptime Sparkline, and **Subscribe with USDC** button.
3. **My Active Subscriptions & Claims Panel:**
   - Lists subscribed services, live uptime %, downtime minutes this billing cycle, and an animated **"Claim $X.XX USDC Compensation"** button whenever `accruedCompensationUsdc > 0`.

---

### Skill 05: Provider Dashboard (`/provider`)

**Trigger:** Implementing Pillar 2.

**Steps:**
1. **Provider Overview Metrics:** Total Active Subscribers, Monthly Recurring USDC (`MRR`), Total Locked SLA Reserves, and Current Fleet Reliability %.
2. **Register New Digital Service Form:**
   - Service Name, Category, Endpoint URL, Monthly Price (`USDC`), Uptime Guarantee slider/input (`99.00%` - `99.99%`), and Compensation Tier percentages (`10% / 25% / 50%`).
   - Initial USDC Reserve deposit amount.
   - Submitting immediately adds the service to the shared store so it appears in `/consumer` and `/demo`.
3. **Reserve Management Table:**
   - Allows providers to click **"+ Top Up Reserve ($500 USDC)"** on existing services (`Streamly`, `CloudBox`, `HyperNode RPC`) and inspect historical outage payouts.

---

### Skill 06: Interactive Hackathon Demo / Chaos Theater (`/demo`)

**Trigger:** Implementing Pillar 5 (the centerpiece for Vibestarter judges).

**Steps:**
1. Create a 3-column desktop layout (and clean segmented tabs on mobile `<768px`):
   - **Left Column: Consumer View:** Wallet balance (`100.00 USDC`), 1-click Subscribe buttons for `Streamly`, `CloudBox`, and `HyperNode RPC`, and live Claim Refund cards.
   - **Center Column: Chaos Outage Simulator & Live Heartbeat Oscilloscope:**
     - Interactive SVG Heartbeat waveform that pulses green (`#10B981`) during normal operation and spikes/flatlines crimson (`#EF4444`) during an injected outage.
     - 3 Preset Chaos Buttons:
       1. `Inject 35m CDN Glitch (Minor SLA Breach -> 10% Refund)`
       2. `Inject 8h Storage Outage (Moderate SLA Breach -> 25% Refund)`
       3. `Inject 20h Regional Blackout (Severe SLA Breach -> 50% Refund)`
     - Custom Downtime Slider (`1 min` to `2,500 mins`) with live preview of resulting uptime % and payout tier.
   - **Right Column: Smart Contract & Provider Reserve Ledger:**
     - Shows `UpHealthSLA.sol` live state: Provider Locked Reserve decreasing, Subscriber Claimable Pool increasing, and a live scrolling **On-Chain Event & Attestation Feed** (`Subscribed`, `OutageAttested`, `CompensationUnlocked`, `CompensationClaimed`).
2. Add a prominent **"Reset Demo Scenario"** button in the top bar.

---

### Skill 07: Editorial Landing Page (`/`) & Final Verification

**Trigger:** Polishing the entry experience and running final checks.

**Steps:**
1. Build `/` following `MOTION.md`:
   - Architectural hero with headline: *"Subscriptions that refund you when the service goes down."*
   - Interactive mini-specimen right in the hero where visitors can toggle a service from `99.99% Operational` to `98.80% Outage` and watch the USDC escrow stream unlock.
   - Section explaining the 4-step Base loop (`Subscribe in USDC` → `Provider Locks SLA Reserve` → `Monitor Attests Uptime` → `Smart Contract Auto-Compensates`).
2. Run `npm run build` and verify zero TypeScript, ESLint, or runtime errors.
