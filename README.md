# UpHeld: Uptime, Upheld on Base

UpHeld is a subscription platform on Base where every plan comes with an uptime guarantee. Businesses sell digital subscriptions in USDC (a dollar-pegged token), and each plan states how often the service will be online, for example 99.95% of the time. The provider funds a USDC reserve when it lists the plan. If a recorded outage takes the service below its guarantee, the UpHealthSLA contract credits a refund to every subscriber from that reserve, and each subscriber claims it with one transaction.

Built for Vibestarter Vibeathon 02 (theme: Night shift). The app runs on testnet only: Base Sepolia, chain ID 84532. No real money is used.

Live app: <add your Vercel URL>

> **Two modes.** The **Judge Sandbox** is the default and needs no wallet. It is a prefunded test wallet inside the app that runs an in-browser copy of the contract with the same integer math. **Live mode** on `/contracts` sends real transactions to Base Sepolia from your own browser wallet. Anything labelled "sandbox" runs in your browser and is not on a blockchain.

---

## Contents

1. [Quick start](#quick-start)
2. [Full test guide](#full-test-guide)
3. [Stress tests](#stress-tests)
4. [Live mode with a real wallet (optional)](#live-mode-with-a-real-wallet-optional)
5. [How it works](#how-it-works) · [Trust model](#trust-model) · [Contracts](#contracts) · [Units](#units)
6. [Project structure](#project-structure) · [Running locally](#running-locally) · [Deploying](#deploying) · [Troubleshooting](#troubleshooting)

---

## Quick start

No wallet is needed. Start from a fresh state: if anything is already subscribed, click **Reset demo state** at the top right of `/demo`, then **Click to confirm**.

| # | Do this | Expected result |
| --- | --- | --- |
| 1 | Open `/` and click **Launch interactive demo**. | The Chaos Theater opens at `/demo`. The **Judge Sandbox wallet** shows **$100.00**. |
| 2 | In **01 Consumer view**, under **Plans**, find **CloudBox** ($10.00/mo · SLA 99.95%) and click **Subscribe $10**. | The button changes to an **Active** pill. The wallet goes from **$100.00 to $90.00**. Step 1 of the progress bar is ticked. |
| 3 | In **02 Outage simulator**, keep the **CloudBox** tab selected. Under **Presets**, the **8h storage outage** row previews `→ 98.88% · Tier 2 · Moderate breach → +$2.50`. Click it. | The progress bar is replaced by a report with a red outline: **SLA breached · Tier 2 · Moderate breach**, CloudBox **98.88%** (from 100.00%), downtime **8h**, unlocked **$2.50**, 1 subscriber. In **03 Reserve ledger** the provider reserve goes from **$5,000.00 to $4,997.50** and the claimable vault shows **$2.50**. |
| 4 | In **01 Consumer view**, under **Compensation**, click **Claim $2.50 USDC**. | A receipt opens. The card collapses to **CloudBox · $2.50 claimed**. The wallet goes from **$90.00 to $92.50**. All four steps are ticked. |

How 98.88% is calculated: a billing window is 30 days, or 43,200 minutes. 8 hours is 480 minutes, so uptime = floor((43,200 - 480) × 10,000 / 43,200) = 9,888 basis points = 98.88%. That is below 99.00%, which puts it in Tier 2. Tier 2 refunds 25% of the $10 price, so $2.50.

On a phone the three panels are behind tabs: **01 Consumer**, **02 Chaos** and **03 Ledger**.

---

## Full test guide

Each section lists where to go, what to click and what you should see. Unless a step says otherwise, start from a fresh state (**Reset demo state**, then **Click to confirm**).

**Refund tiers.** All seeded plans use the same tiers. Tier 1 applies as soon as uptime drops below the plan's guarantee and refunds 10% of the monthly price. Tier 2 (below 99.00%) refunds 25%. Tier 3 (below 98.00%) refunds 50%. Uptime is stored in **basis points** (bps), which are hundredths of a percent, so 9,995 bps = 99.95%.

Seeded services:

| Service | Price | Guarantee | Downtime allowed per 30 days | Reserve |
| --- | --- | --- | --- | --- |
| Streamly | $12.00/mo | 99.90% | 43.2 min | $2,400 |
| CloudBox | $10.00/mo | 99.95% | 21.6 min | $5,000 |
| HyperNode RPC | $25.00/mo | 99.99% | 4.3 min | $10,000 |

### 1. Outage presets

Where: `/demo` → **02 Outage simulator** → **Presets**. Subscribe to CloudBox first. Each row shows the resulting uptime and your refund before you click it.

| Preset | Minutes | Result on a fresh CloudBox |
| --- | --- | --- |
| **2h 48m DB failover** (moon icon, `03:12 UTC` tag) | 168 | 99.61% · Tier 1 · +$1.00 |
| **35m CDN glitch** | 35 | 99.91% · Tier 1 · +$1.00 |
| **8h storage outage** | 480 | 98.88% · Tier 2 · +$2.50 |
| **20h regional outage** | 1,200 | 97.22% · Tier 3 · +$5.00 |

1. Click **2h 48m DB failover**. The report reads **SLA breached · Tier 1 · Minor breach**, followed by a moon icon and the notice **Paid while you slept**: "CloudBox was down from 03:12 UTC. $1.00 is ready to claim." The preset models a database failover from 03:12 to 06:00 UTC (168 minutes), so 03:12 is part of the preset, not the time of your click.
2. The report closes after about 9 seconds (about 6.5 seconds when you received nothing) and the progress bar returns.
3. Reset, subscribe again and try each other preset on a fresh CloudBox. Their notice reads "CloudBox was down for 35m." (or 8h, 20h), followed by the amount ready to claim.
4. Switch the service tab to **Streamly** and look at **35m CDN glitch**. It previews `within SLA · no refund`, because Streamly allows 43.2 minutes of downtime.

The same downtime has a different result under a different guarantee, and the refund is shown before you record anything.

### 2. Custom downtime

Where: `/demo` → **Record an outage** panel → **Custom downtime**.

1. Drag the slider (1 to 2,500 minutes; it starts at 240, which is 4h). The three boxes below it update as you drag: **Uptime after**, **Tier** and **Your refund**.
2. On a fresh CloudBox, set it to **21** minutes: 99.95%, tier "none". Set it to **22** minutes: 99.94%, 10% refund. This is the exact edge of the 99.95% guarantee, calculated with whole numbers and rounded down, as in the contract.
3. Click **Record 22m outage on CloudBox**. A new incident is recorded in the same way as a preset.

The app and the Solidity contract round the same way, to one basis point. There is no floating-point rounding.

### 3. Recording the same tier twice pays nothing

Where: `/demo`, CloudBox, subscribed.

1. Click **2h 48m DB failover**. Your refund is **$1.00** (99.61%, Tier 1).
2. Click it again. The preview already said **tier already paid**. Uptime drops to 99.22%, which is still Tier 1, so no new refund is credited.
3. Click **8h storage outage**. Uptime 98.11%, Tier 2. Your refund is **$1.50**, the difference between Tier 2 ($2.50) and what you already received ($1.00).
4. Click **20h regional outage**. Uptime 95.33%, Tier 3. Your refund is another **$2.50**, for a total of $5.00.
5. Every further outage previews **tier already paid**. $5.00 (50% of the price) is the maximum one CloudBox subscriber can receive.

Each subscriber is credited up to the highest tier reached and is never paid twice for the same tier, so repeated outage records cannot drain the provider's reserve.

### 4. Subscribing during an outage

Where: `/demo`, CloudBox, **not** subscribed.

1. Click **8h storage outage**. A toast reads **CloudBox SLA breached · 25% refund** with "100.00% → 98.88% · no active subscribers". The report shows **Unlocked $0.00**.
2. Click **Subscribe $10**. You pay $10 and start at the current tier (Tier 2 = $2.50), but nothing is claimable, because that outage happened before you subscribed.
3. Click **8h storage outage** again. Uptime 97.77%, Tier 3. Your refund is **$2.50**, not $5.00: you are paid only for the drop since you subscribed.

A subscriber cannot wait for an outage and then subscribe to collect a refund for it.

### 5. Sold-out plans

Each subscription is fully backed. When someone subscribes, that subscriber's maximum refund (Tier 3, 50% of the price) is set aside from the provider's reserve. A plan whose reserve cannot back another subscriber shows **Sold out**.

Seats left = floor(free reserve ÷ maximum refund per seat). For CloudBox that is $5,000 ÷ $5.00 = 1,000 seats, which is too many to sell out by hand. Create a small plan instead:

1. Open `/provider` → **New service**. Name: `Tiny Plan`. Monthly price: `10`. Initial reserve: `4`. Leave the tiers at 10 / 25 / 50%. The hint under the reserve reads **covers 0 tier-3 payouts**.
2. Click **Register & lock reserve**. A toast reads **Tiny Plan is live**.
3. In **Reserve management**, the Tiny Plan row reads **$0 locked · 0 seats left** (amber).
4. Open `/consumer` (or `/demo`). Tiny Plan shows **Backed seats: Sold out** and a disabled **Sold out** button.
5. On `/provider`, click **+ $500** on the Tiny Plan row. It now reads **100 seats left** ($504 ÷ $5.00), and you can subscribe again.

Variation: register with an initial reserve of `5`. The row shows **1 seats left**. After you subscribe, `/provider` shows **0 seats left**.

A provider cannot sell more coverage than its reserve holds, so every refund is funded in advance.

### 6. Provider registration and reserve top-up

Where: `/provider`.

1. The header shows the **Provider treasury** (a sandbox wallet holding $25,000.00) and four stats: **Active subscribers**, **Monthly recurring**, **Locked SLA reserves** and **Fleet reliability**.
2. In **New service**, enter a name (for example `NightOwl Transcribe`), a category, and optionally a health endpoint and a description. The defaults are a price of $15, guaranteed uptime of **99.90%** (the slider runs from 99.00% to 99.99% and shows the bps value and the allowed downtime, here about 43 minutes per 30 days), tiers of 10 / 25 / 50% and a reserve of $1,500 (**covers 200 tier-3 payouts**).
3. Click **Register & lock reserve**. The treasury drops by $1,500, a toast reads **NightOwl Transcribe is live**, and the form shows "NightOwl Transcribe is registered. View it in the marketplace or test it in the Chaos Theater."
4. The new plan appears in **Reserve management**, on `/consumer`, as a new tab in the `/demo` simulator, on `/monitor` and in the `/contracts` reserves table.
5. Click **+ $500** on any row. The reserve rises by $500 and the treasury falls by $500.
6. After an outage, **Outage payouts** at the bottom of the page lists the incident, its uptime change and the amount paid to subscribers.

Invalid input is rejected with a message and nothing is registered: a duplicate name ("A service with that name already exists."), tiers that do not increase, for example 30 / 20 / 50 ("Refund tiers must increase"), or a reserve larger than the treasury ("Treasury only holds ...").

### 7. Watchdog with a simulated outage

An **attestation** is a signed record stating that a service was down for a number of minutes, identified by a unique hash. Only an approved attestor can record one. In the sandbox the attestor is a simulated monitor address.

1. On `/demo`, subscribe to **CloudBox**.
2. Open `/monitor`. In **Watchdog**, click **Start watchdog**. A **Live** marker appears and the panel reads **Running**. Within about 5 seconds every row reads **Healthy**. HyperNode RPC shows something like `Last: 405 · 700ms`: its server answered, so it counts as up.
3. On the **CloudBox** row, click **Simulate outage**. The button turns red and reads **Restore**. Every 5 seconds a check fails: **Failed check 1 of 3 · not recorded yet**, then 2 of 3, and the small squares fill amber.
4. After about 15 seconds the watchdog records the outage. A toast reads **Outage recorded · CloudBox · +15m** and the row reads **Incident open**. 15 minutes is within CloudBox's 21.6-minute allowance (99.96%).
5. After about 30 seconds a second batch is recorded (30 minutes in total, 99.93%). That is below the 99.95% guarantee: Tier 1, **$1.00** credited to you. Check the claim card on `/demo` or `/consumer`.
6. Click **Restore**. Within about 5 seconds the row reads **Recovered · incident closed, 30m recorded in total**.
7. In the **Incident log** at the bottom of the page, these rows have an **Auto · watchdog** badge and titles such as **Watchdog · 3 failed checks · simulated outage**.
8. Click **Stop watchdog**. The panel reads **Stopped** and the rows return to **Off**.

Demo timing: each failed check counts as 5 minutes of downtime, as if a production probe ran every 5 minutes. Three failures in a row create a record, and every three further failures add another.

Limits: the watchdog runs in your browser only while `/monitor` is open. It records outages in the sandbox ledger and sends nothing to Base Sepolia. Stopping it or leaving the page discards failed checks that have not been recorded yet.

### 8. Watchdog with a real failing endpoint

1. On `/provider`, register a service with the health endpoint `https://httpbin.org/status/503` (a public test URL that always returns "503 Service Unavailable"). Set **Guaranteed uptime** to **99.99%** so the first record already breaches the SLA. Keep a reserve, for example `100`.
2. Subscribe to it on `/consumer`.
3. On `/monitor`, start the watchdog. The row reads **Real HTTP check**, then `Last: 503 · ...ms`. After 3 failed checks it records **Watchdog · 3 failed checks · status 503**, and your refund is credited.

A check fails on a 5xx response, a timeout (6 seconds), a connection failure or a DNS failure. A 4xx response counts as up. Endpoints that cannot be checked at all (an invalid URL, a private or local address, or a sample host such as `https://myapp.demo/health`) show **Can't check** and are never counted as downtime. Register `https://myapp.demo/health` to get a **Simulated host** row with its own **Simulate outage** button instead.

### 9. Night shift report

Where: `/monitor` → **Night shift report**.

The report covers every incident in the last 12 hours and shades the overnight hours (22:00 to 06:00 UTC). The heading summarizes the window, for example "2 incidents in the last 12 hours. 2 recorded by the watchdog, $1.00 in refunds unlocked." The cards show **Incidents** (auto and manual), **Downtime** and SLA breaches, **Refunds unlocked** and **Most affected**, followed by a timeline and the latest incidents with **Auto · watchdog** or **Manual · chaos** badges. After **Reset demo state** it reads **No incidents in the last 12 hours.**

This is the summary a provider reads in the morning.

### 10. Endpoint probes

Where: `/monitor` → **Endpoint probes**.

1. The URL field starts at `https://sepolia.base.org`. Click **Probe now**. The server sends a real HTTP request through `GET /api/monitor/ping` and the **Probe log** shows the status and latency.
2. Try the presets: **Base Sepolia RPC**, **BaseScan Sepolia** and each service's endpoint. Streamly and CloudBox use sample `.demo` hosts, so their probe returns **SYNTHETIC_ENDPOINT** (grey, not a failure).
3. Paste any public https URL and probe it. Local and private addresses are rejected.
4. **Check 1 endpoint · 15s** probes every real endpoint (HyperNode RPC, plus any you registered) every 15 seconds. Click **Stop checks** to stop.
5. **SLA breach calculator** (same page): choose a service to see the formula with its recorded downtime, the tier and the refund in 6-decimal minor units.

### 11. Incident hash verification

Where: `/monitor` → **Incident log**.

Each incident has a hash: `keccak256(serviceId, incidentId, downtimeMinutes, resultingUptimeBps)`. Click **Verify** next to a hash. Your browser recomputes it from the row's values and the button reads **Match**. Each row also shows its sandbox transaction hash and block number.

Anyone can confirm that a recorded outage has not been changed afterwards.

### 12. Contracts page

Where: `/contracts`. The header buttons link to **Live console**, **Trust model** and **Source & ABI**.

- **Deployments & faucet.** Network endpoints and every address the app uses (sandbox addresses are labelled "sandbox mirror"). **Mint 100** and **Mint 1,000** add test USDC to the Judge Sandbox wallet. The faucet allows at most 1,000 per call.
- **Deployment proof.** When the site has no public addresses configured, it reads **Not configured for this site.** and links to the live console. When they are configured, it lists **Verified source** links for both contracts and the **Outage transaction** and **Claim transaction** on BaseScan. No public deployment address is committed in this repository yet.
- **Escrow reserves.** All sandbox USDC held by the contract is either a provider reserve or a subscriber's claimable refund. **Provider reserves** and **Claimable compensation** add up to the total held.
- **Trust model.** Three cards: **Who records outages**, **Contract rules** and **Production roadmap** (planned work, not built yet). Each point lists the contract functions behind it. `/contracts#trust` links to this section.
- **Live on Base Sepolia.** The console for real transactions (see [Live mode](#live-mode-with-a-real-wallet-optional)).
- **Source & ABI.** The Solidity source with a tab per file and **Copy source**, and an ABI explorer with **UpHealthSLA** and **MockUSDC** tabs listing every function and event.

### 13. Reset demo state

**Reset demo state** is in the header on wide screens (shortened to **Reset** on smaller screens and in the mobile navigation row) and at the top of `/demo`. The first click arms it (**Click to confirm**, red, for 3 seconds) and the second click resets. A toast reads **Demo state reset**: "Judge wallet balance is $100.00 USDC. All services are at 100.00% uptime." Registered services, subscriptions, incidents and probes are cleared. Live-mode deployments are stored separately and are not affected.

### 14. Theme toggle

The round moon/sun button in the header switches the site between dark (the default) and light. The choice is saved in this browser.

---

## Stress tests

Edge cases and abuse attempts, with the expected result.

| Test | Expected result |
| --- | --- |
| Click a preset 10 times quickly | Each click creates its own incident with its own number and hash. Uptime drops each time. Money moves only when a new, higher tier is reached, and never above the Tier 3 cap per subscriber ($5.00 on CloudBox). The report switches to the newest incident and still closes on its own. |
| Zero-minute outage | Not possible from the UI: the slider starts at 1 minute and the live console offers 35, 480 or 1,200 minutes. The sandbox rejects it ("Downtime must be at least 1 minute.") and the contract reverts ("No downtime"). |
| Very long outage | Slider maximum is 2,500 minutes → 94.21%, Tier 3. Keep recording 20h outages: uptime stops at **0.00%** and never goes negative. Payouts stay capped at Tier 3. |
| Claim twice | After a claim the card collapses into a "claimed" row and the button is removed. The sandbox and the contract both reject a second claim ("No compensation available"). In live mode the Claim button is disabled at $0. |
| Subscribe twice | The button changes to **Active**. The sandbox and the contract both reject it ("Already subscribed"). |
| Sold out | See [Sold-out plans](#5-sold-out-plans). The button is disabled and reads **Sold out**. Topping up the reserve allows new subscriptions. |
| Not enough USDC | Register a plan priced at $200 and subscribe: "Insufficient USDC. This plan costs $200.00. Mint test USDC from the faucet." Mint and try again. |
| Invalid provider input | A duplicate name, tiers that do not increase or a reserve above the treasury are rejected with a message. Nothing is registered. |
| Wallet rejects the connection | Toast: "You cancelled the request in your wallet. Nothing was shared." The sandbox keeps working. |
| Wrong network | The header wallet button turns amber and reads **Wrong network**. Live actions stay disabled until you click **Switch to Base Sepolia** and approve. |
| Wallet popup hidden behind the window | After about 6 seconds the wallet menu adds: "If you don't see it, click the wallet icon in your browser toolbar. It may be behind this window." A **Cancel** button is available. |
| No wallet installed | The wallet menu reads "No wallet extension found in this browser." with an **Install MetaMask** link (or **Open UpHeld in the MetaMask app** on a phone) and offers Coinbase Smart Wallet (passkey, no extension). The full demo works without a wallet. |
| Phone width (390 px) | `/demo` shows the 01 / 02 / 03 tabs. Preset rows hide the word "Record" so the label fits. Tables scroll inside their card. The page does not scroll sideways. |
| Reduced motion (turn on "Reduce motion" in your OS) | Smooth scrolling is off, the hero logo stays still and animations are reduced. Every control still works. |
| Refresh during the flow | Balances, subscriptions, incidents and claims are kept (saved in this browser). Old breach reports are not shown again. A running watchdog stops, and failed checks that were not recorded are discarded. In a private window or with site storage blocked, state lasts only until refresh. |
| Two tabs | Tabs do not sync. Each tab saves its full state when you act in it, so the last tab you used wins. Reload a tab before using it again. |
| Reset while the watchdog has an open incident | The watchdog drops the open incident on its next check and adds no minutes to the reset service. |
| Live mode: record an outage from a wallet that is not an attestor | **Record** is disabled with an explanation. On a shared deployment the console offers **Deploy your own copy (2 transactions)**. The contract itself reverts with "Not an attestor". |

---

## Live mode with a real wallet (optional)

The Judge Sandbox covers every feature, so live mode is optional. It runs the same contract on Base Sepolia with real transactions.

> **Wallet safety**
>
> - **Never share your seed phrase (the 12 or 24 recovery words) or your private key with anyone**, including UpHeld, support staff or anyone in a chat. UpHeld never asks for them, and nothing in this project needs them.
> - Use a **burner wallet**: a new wallet created only for testing, holding nothing of value.
> - Base Sepolia is a test network. Its ETH and the MockUSDC tokens are free and have **no value**.
> - Connecting only shares your address. Every transaction opens a wallet window that you can reject. UpHeld approves only the exact USDC amount each step needs, never an unlimited allowance.
> - If you paste a seed phrase or private key anywhere by mistake, delete it and move your funds to a new wallet immediately.

### Set up a wallet (about 10 minutes)

1. **Install MetaMask.** Go to [metamask.io/download](https://metamask.io/download/) and add the extension to your browser.
2. **Create a new wallet.** Choose **Create a new wallet** and set a password. MetaMask shows 12 recovery words. Write them on paper, keep them private and never type them into a website. This is your burner wallet.
3. **Get free test ETH** to pay transaction fees ("gas"). Open [docs.base.org/base-chain/tools/network-faucets](https://docs.base.org/base-chain/tools/network-faucets), choose one of the Base Sepolia faucets and paste your wallet address (the `0x...` under your account name in MetaMask). 0.01 to 0.05 test ETH is enough.
4. **Connect.** On UpHeld, click **Connect wallet** in the header (or in the live console on `/contracts`), choose **MetaMask** and approve. Connecting does not ask for a signature.
5. **Switch network.** If your wallet is on another network, the button turns amber and reads **Wrong network**. Click it, then **Switch to Base Sepolia**, and approve in MetaMask. If MetaMask asks to add the network, approve that as well (chain ID 84532).

### Run the 7 live steps

Open `/contracts` and click **Live console**.

1. If the site has no public deployment configured (the current state of this repository), the console reads **No deployment found in this browser.** Click **Deploy to Base Sepolia** and confirm **two** transactions: MockUSDC (the test USDC token), then UpHealthSLA, which uses it. Your wallet becomes the owner and the only approved attestor. If you reject the second transaction, the button changes to **Deploy UpHealthSLA** and continues from there.
   If the site uses a shared deployment, your wallet cannot record outages on it. Click **Deploy your own copy (2 transactions)** in the notice above the steps, and **Back to shared deployment** to return later.
2. Leave **Parameters** at the defaults (CloudBox Live, price 10, reserve 50, SLA 9995 bps = 99.95%) and click each step's button in order. Each step is one wallet confirmation.

| Step | Button | What it does | Expected result |
| --- | --- | --- | --- |
| 1 · Mint 100 MockUSDC | **Mint** | Mints 100 free test USDC to your wallet | Balance $100.00 |
| 2 · Approve UpHealthSLA | **Approve** | Allows the contract to take exactly $60.00 (reserve plus one subscription) | Allowance $60.00 |
| 3 · Register a service | **Register** | Lists "CloudBox Live" at $10, 99.95%, tiers 10 / 25 / 50% | Service #1 exists |
| 4 · Fund reserve | **Fund** | Locks $50 as the refund reserve | Reserve $50.00 |
| 5 · Subscribe | **Subscribe** | Pays $10 to the provider and sets aside $5.00 of the reserve for your subscription | Step ticked |
| 6 · Record an outage | Choose **480m**, then **Record** | Records 8 hours of downtime | 100.00% → 98.88%, Tier 2 |
| 7 · Claim compensation | **Claim $2.50** | Transfers your refund | $2.50 arrives and a receipt opens |

Your wallet is both the provider and the subscriber here, so the $10 goes from you back to you. You end with **$52.50** MockUSDC (100 - 50 reserve - 10 + 10 + 2.50), and the reserve ends at **$47.50**. After step 4, step 2 may show as unticked again because funding used most of the allowance. The remaining $10 still covers step 5.

3. **Find your transactions.** **Your Base Sepolia transactions** lists every hash with a link to [sepolia.basescan.org](https://sepolia.basescan.org), the public block explorer for Base Sepolia. After step 7, a **Claim transaction** box shows the claim hash with a **Copy hash** button. You can also search your wallet address on BaseScan to see every transaction it sent.

---

## How it works

1. **A provider lists a plan** with a USDC price, an uptime guarantee in bps, three refund tiers and a USDC reserve locked in the contract.
2. **A subscriber pays** the monthly price directly to the provider. The contract sets aside that subscriber's maximum refund from the reserve. If the reserve cannot cover another subscriber, the plan is sold out.
3. **An approved attestor records an outage** (minutes down and a unique hash). The contract recalculates 30-day uptime in bps and determines the tier.
4. **Each subscriber is credited** up to the refund for the highest tier reached. The amount moves from that subscriber's reserved coverage into a claimable balance.
5. **The subscriber claims** the balance in one transaction.

In the Judge Sandbox, `src/lib/store.ts` runs the same steps in your browser with the same integer math (`src/lib/sla-engine.ts`), and outages are recorded by a sandbox monitor address. Receipts are labelled as sandbox receipts. Attestation hashes are real `keccak256(abi.encodePacked(serviceId, incidentSeq, downtimeMinutes, uptimeBps))` values.

## Trust model

- **Who records outages.** Only approved attestors can call `recordOutage`. The deployer is the first attestor and can add or remove others with `setAttestor`. `transferOwnership` moves the attestor role to the new owner and removes it from the old one. Providers and subscribers cannot record outages. In production, the attestor would be an independent monitoring network in which several probes must agree on an outage.
- **Refund limits.** Each subscriber is credited at most the refund for the highest tier reached. A deeper breach pays only the difference, and recording the same tier again pays nothing. A subscriber who joins during a breach is paid only for further drops.
- **Fully backed subscriptions.** Subscribing sets aside that subscriber's maximum refund (the severe tier) from the provider's reserve, and refunds are paid from that amount. A provider can sell only as many subscriptions as the reserve can pay in full (`availableReserve`, `seatCoverRequired`). Subscriptions a provider buys from its own wallets cannot use up a real customer's coverage, and the subscriber list is limited by the reserve, which also limits the payout loop.
- **Input checks.** Zero-minute outages and reused attestation hashes are rejected. Refund tiers must increase and stay at or below 100%, and the price must be above zero.
- **Payments.** Subscribers withdraw refunds themselves (`claimCompensation`), and the balance is set to zero before the transfer. Live mode approves only the exact USDC amount needed, never an unlimited allowance.
- **Known limits (testnet build).** The 30-day window does not reset yet, so downtime accumulates for the lifetime of a deployment. There is no reserve withdrawal, and reserved coverage is not released when a plan ends. Each `subscribe()` call is a single payment with no renewals. Attestors are trusted.

In the Judge Sandbox, outages are recorded by a sandbox monitor address, either manually from the Chaos Theater or by the watchdog on `/monitor`. On `/contracts`, deploying your own copy makes your wallet its attestor.

## Contracts

`contracts/MockUSDC.sol` and `contracts/UpHealthSLA.sol` target Base Sepolia (chain ID 84532) and are compiled with solc 0.8.24 (optimizer on, 200 runs, EVM version `paris`). MockUSDC is a 6-decimal test token with a public faucet limited to 1,000 USDC per call. `npm run compile:contracts` regenerates the ABIs, bytecode and sources in `src/lib/contract-artifacts.ts`. `npm run verify:input` writes the BaseScan Standard-JSON verification inputs to `contracts/verify/` and checks that they compile to the exact bytecode the app deploys.

No public deployment address is committed in this repository. See [Deploying](#deploying) to deploy, verify and connect your own.

## Units

- **USDC:** 6-decimal integer minor units. `10_000_000` = 10.00 USDC. No floating-point values are used for money.
- **Uptime, SLA targets and refund tiers:** basis points. `9995` = 99.95%, `2500` = a 25% refund.
- **Billing window:** 43,200 minutes (30 days). Uptime = floor((43,200 - downtime) × 10,000 / 43,200), calculated the same way in TypeScript and Solidity. `tests/sla-engine.test.ts` includes a reference value captured from an EVM run of the contracts.

## Design system

Minimal, monochrome layout. Dark is the default (`#000000` background); the header toggle switches to light and saves the choice. Blue is used only for function (focus rings, live indicators). Red for outages and amber for degraded service appear only in monitoring data. Fonts are Geist and Geist Mono. Icons are lucide-react only, with no emojis. The landing page logo (`src/components/monolith/`) is a silver 3D letter U rendered with React Three Fiber. It stays still under `prefers-reduced-motion` and falls back to an SVG when WebGL is unavailable. All tooling is free: Tailwind CSS v4, framer-motion, three and @react-three/fiber, lenis, lucide-react, viem and wagmi, Geist.

## Routes

| Route | Description |
| --- | --- |
| `/` | Landing page: Base Sepolia status, outage refund example, refund tiers, trust model summary, provider section with a reserve calculator, and links to the app |
| `/demo` | Chaos Theater: consumer view · outage simulator · reserve ledger and event log |
| `/consumer` | Plans with a category filter, refund terms on each card, subscriptions, uptime bars and claims |
| `/provider` | Service registration, reserve top-ups, seat backing and payout history |
| `/monitor` | Watchdog, service availability, night shift report, HTTP probes, SLA breach calculator, incident log with hash verification |
| `/contracts` | Addresses and faucet, deployment proof, escrow reserves, trust model, live Base Sepolia console, source and ABI |

## Project structure

```
contracts/               MockUSDC.sol, UpHealthSLA.sol, verify/ (BaseScan inputs)
scripts/                 compile-contracts.mjs, verify-input.mjs
src/app/                 Next.js App Router pages and /api/monitor/ping
src/components/app/      Consumer, provider, monitor, contracts and live console screens
src/components/demo/     Chaos Theater
src/components/monitor/  Watchdog panel, night shift report
src/components/landing/  Landing page sections
src/components/layout/   Header, wallet controls, theme toggle, receipts, toasts
src/hooks/               use-actions, use-watchdog, reduced-motion and hydration helpers
src/lib/                 sla-engine (integer math), store (sandbox), seed, chain, contracts, live-deployment, wagmi
tests/                   sla-engine.test.ts (Vitest)
backups/                 Older UI snapshots, not used by the app
```

## Running locally

Requires Node.js 20 or newer (tested with Node 22).

```bash
npm install
npm run dev                # http://localhost:3000
npm test                   # Vitest: SLA engine, including a reference value from an EVM run
npm run typecheck          # tsc --noEmit
npm run lint               # ESLint
npm run build              # production build
npm run start              # serve the production build
npm run compile:contracts  # rebuild src/lib/contract-artifacts.ts from contracts/*.sol
npm run verify:input -- 0xYourMockUSDCAddress   # BaseScan verification inputs and constructor arguments
```

Optional: copy `.env.example` to `.env.local` to point live mode at an existing deployment and show deployment proof on `/contracts`. All values are public addresses and transaction hashes. Never put a private key or seed phrase in this file; none is needed. Running `compile:contracts` changes the deployed bytecode, so redeploy the contracts before verifying them.

## Deploying

1. **Host the app on Vercel.** Push the repository to GitHub, then in Vercel choose **Add New → Project** and import it. Vercel detects Next.js; the default build command (`npm run build`) works as is.
2. **Environment variables (optional).** The Judge Sandbox works without any. To point the site at your own contracts, add the variables from `.env.example` in **Settings → Environment Variables**: `NEXT_PUBLIC_UPHELD_SLA_ADDRESS`, `NEXT_PUBLIC_MOCK_USDC_ADDRESS`, `NEXT_PUBLIC_PROOF_OUTAGE_TX` and `NEXT_PUBLIC_PROOF_CLAIM_TX`. The two addresses take effect only when both are valid. These values are built into the page, so redeploy after changing them. Never add a private key or seed phrase.
3. **Deploy the contracts.** On `/contracts`, use the live console to deploy MockUSDC and UpHealthSLA from a burner wallet and run the 7 steps. Copy both contract addresses, the claim transaction hash and the record-outage transaction hash.
4. **Verify on BaseScan.** Run `npm run verify:input -- 0xYourMockUSDCAddress`. It writes the Standard-JSON inputs to `contracts/verify/`, confirms they match the deployed bytecode and prints the compiler version and the UpHealthSLA constructor arguments. On BaseScan, open each contract address, choose **Verify and Publish**, select **Solidity (Standard-Json-Input)** with that compiler version and upload the matching file. No API key is needed.
5. **Add the proof.** Set the four environment variables and redeploy. **Deployment proof** on `/contracts` then lists the verified contracts and both transactions.

## Troubleshooting

| Problem | Solution |
| --- | --- |
| My numbers do not match this README. | Earlier activity is saved in your browser. Click **Reset demo state**, then **Click to confirm**. |
| I recorded an outage and received nothing. | Check the preview line before clicking: **within SLA · no refund** (the guarantee still holds), **+$X if subscribed** or **$0.00 · not subscribed** (you are not subscribed to that service), or **tier already paid** (you already received this tier). |
| A plan shows **Sold out**. | Its reserve cannot back another subscriber. Top it up with **+ $500** on `/provider`. |
| The breach report disappeared. | It closes after 6.5 to 9 seconds. The incident remains in the **Event log** on `/demo` and the **Incident log** on `/monitor`. |
| The watchdog is not recording anything. | Keep `/monitor` open with the watchdog started. Sample `.demo` hosts fail only when you click **Simulate outage**. Rows marked **Can't check** are never counted. |
| HyperNode RPC shows `405`. | This is expected. The Base Sepolia RPC answers plain GET requests with 405, and any response below 500 counts as up. |
| The Base Sepolia status shows **RPC unreachable**. | The public RPC did not respond. Only the status indicator and live mode are affected; the sandbox demo works offline. |
| **Record** is disabled in live mode. | Your wallet is not an attestor on that deployment. Deploy your own copy from the console. |
| A live transaction fails with "insufficient funds". | You need Base Sepolia ETH for gas. Use a faucet from [docs.base.org](https://docs.base.org/base-chain/tools/network-faucets). |
| Nothing happens when I click Connect or Confirm. | The wallet popup may be behind the browser window. Click the wallet icon in the browser toolbar, or click **Cancel** and try again. |
| The app does not load inside an iframe. | Security headers block framing for this wallet-connected app. Open the link directly. |
| My demo state disappeared after a refresh. | Private windows and blocked site data keep state in memory only. Use a normal browser window. |
