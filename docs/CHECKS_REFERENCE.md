# Checks Reference — Sunrise NTT Preflight

> Implementation guide for all 10 checks in `ntt-preflight verify`
> **Last verified: 2026-01-15** — content accuracy against live docs/endpoints
> **Last updated: 2026-02-24** — file last edited
> Source: wormhole.com/docs NTT + Executor guides

---

## Evidence Contract Format

Each check below includes an **Evidence Contract** table:

| Field | Description |
|-------|-------------|
| **Inputs** | What the check reads (accounts, config, APIs) |
| **Evidence collected** | What data is captured for the report |
| **Decision rule** | Exact condition that triggers FAIL vs PASS |
| **Failure class** | On-chain error this check prevents |
| **SKIPPED when** | Conditions under which check is skipped (not FAIL) |
| **Operator remediation** | Exact NTT CLI / config change to fix it |

> **Invariant: No check ever produces false PASS.** If data is unavailable → SKIPPED or WARN, never PASS.

---

## Priority Overview

| ID | Check | Severity | Catches |
|----|-------|----------|---------|
| `CHK-001` | `peer-registration` | 🔴 blocking | PeerNotRegistered |
| `CHK-002` | `decimals-sync` | 🔴 blocking | InvalidPeerDecimals |
| `CHK-003` | `mint-authority-policy` | 🔴 blocking | MintAuthorityMissing |
| `CHK-004` | `rate-limit-sanity` | 🔴 blocking | Stuck queue |
| `CHK-005` | `ata-rent-readiness` | 🔴 blocking | ATA creation failure |
| `CHK-006` | `executor-transceiver-registration` | 🔴 blocking | NoEnabledTransceivers |
| `CHK-007` | `executor-relay-capabilities` | 🔴 blocking | Chain not supported by Executor |
| `CHK-008` | `executor-endpoint-reachability` | ⚠️ warn | Testnet URL in mainnet config |
| `CHK-009` | `executor-quote-sanity` | ⚠️ warn | Routing issues |
| `CHK-010` | `compute-budget-sanity` | ⚠️ warn | Insufficient compute budget |

Exit 1 if any 🔴 fails. Exit 0 if only ⚠️ warns.

Usage: `ntt-preflight verify --only CHK-001,CHK-002` or `--skip CHK-009`

---

## Generic NTT Checks

---

### `CHK-001` `peer-registration` 🔴 blocking

**What it catches:** `PeerNotRegistered` on reverse transfer

**Mechanism:**
1. Read `NttManagerPeer` account on Solana side via Anchor IDL
2. For each remote chain: query EVM RPC for `NttManager.getPeer(wormholeChainId)`
3. Assert BOTH directions are registered

**Solana side:**
```typescript
const peer = await program.account.nttManagerPeer.fetchNullable(
  pdas.peerAccount(remoteChainId)
);
// null → NOT REGISTERED → FAIL
```

**EVM side (reverse check):**
```typescript
const peerData = await evmClient.readContract({
  address: remotNttManager,
  abi: NTT_MANAGER_ABI,
  functionName: "getPeer",
  args: [SOLANA_WORMHOLE_CHAIN_ID], // = 1
});
// peerData.peerAddress == bytes32(0) → NOT REGISTERED → FAIL
```

**Evidence format:**
```
❌ FAIL  peer-registration
         Solana→Base: REGISTERED (decimals: 6 ✓)
         Base→Solana: MISSING
         Evidence: NttManagerPeer[chainId=30] not found on Base (EVM RPC)
         On-chain error class: PeerNotRegistered
         → Reverse transfers will fail at redeem step.
```

**Graceful degradation (EVM RPC unavailable):**
```
⚠️ WARN  peer-registration [partial]
         Solana→Base: PASS ✓
         Base→Solana: SKIPPED (EVM RPC unavailable, 3 retries)
         → Run with --rpc-evm <url> to verify reverse peer
```
> Never false PASS, never crash. SKIPPED with explicit reason.

**Why NTT CLI can't do this:** `ntt status` reads only the local chain's state.

**Evidence Contract:**

| Field | Value |
|-------|-------|
| **Check ID** | `CHK-001` |
| **Inputs** | `ntt.json` chain list + Solana RPC (NttManagerPeer account) + EVM RPC (getPeer call) |
| **Evidence collected** | Peer registration status both directions + peer address + tokenDecimals |
| **Decision rule** | `peerAccount == null` (Solana) OR `peerAddress == bytes32(0)` (EVM) → FAIL |
| **Failure class** | `PeerNotRegistered` |
| **SKIPPED when** | EVM RPC unavailable after 3 retries → reverse direction SKIPPED with reason |
| **Operator remediation** | `ntt add-peer --chain <remoteChain> --address <peerAddress>` then `ntt push` |

---

### `CHK-002` `decimals-sync` 🔴 blocking

**What it catches:** `InvalidPeerDecimals`

**Mechanism:**
Compare decimals from three sources:
1. `ntt.json` declared value for each peer
2. On-chain `NttManagerPeer.tokenDecimals` (Solana Anchor account)
3. Actual token decimals from SPL mint / EVM token contract

```typescript
const peerAccount = await program.account.nttManagerPeer.fetch(peerPDA);
const onChainDecimals = peerAccount.tokenDecimals;

const nttJsonDecimals = config.chains[chainName].decimals; // from ntt.json

const actualTokenDecimals = await getMint(connection, mintAddress)
  .then(m => m.decimals); // for Solana token
```

**Evidence format:**
```
❌ FAIL  decimals-sync
         ntt.json declares: Base peer decimals = 18
         On-chain registration: decimals = 6
         Evidence: NttManager.peers[Base].tokenDecimals = 6
         On-chain error class: InvalidPeerDecimals
```

**Note:** This is an assertion (not `ntt pull`). 
- `ntt pull` = sync (mutates local file)
- `decimals-sync` = assertion (read-only check)

**Evidence Contract:**

| Field | Value |
|-------|-------|
| **Check ID** | `CHK-002` |
| **Inputs** | `ntt.json` peer decimals + Solana `NttManagerPeer.tokenDecimals` + SPL mint decimals |
| **Evidence collected** | All 3 decimal values per chain for diff display |
| **Decision rule** | Any mismatch across ntt.json / on-chain / actual token → FAIL |
| **Failure class** | `InvalidPeerDecimals` |
| **SKIPPED when** | Peer account not found (covered by peer-registration check first) |
| **Operator remediation** | `ntt pull` to sync ntt.json, then `ntt push` to re-register with correct decimals |

---

### `CHK-003` `mint-authority-policy` 🔴 blocking

**What it catches:** `MintAuthorityMissing` — burn/mint physically impossible

**Mechanism:**
```typescript
const mintInfo = await getMint(connection, mintAddress);

if (mode === "burning") {
  // mintAuthority MUST be transferred to NttManager PDA
  const nttManagerPDA = getNttManagerPDA(nttManagerProgramId);
  const isCorrect = mintInfo.mintAuthority?.equals(nttManagerPDA);
  
  if (!isCorrect) {
    // FAIL: mintAuthority is still original deployer or wrong address
  }
}
```

**For EVM BURNING mode:**
- Check `token.minters(nttManagerAddress)` returns `true`
- ABI call: `isMinter(address) → bool` or similar (depends on token contract)

**Evidence format:**
```
❌ FAIL  mint-authority-policy
         Mode: burn-mint
         Expected mintAuthority: <NttManager PDA>
         Actual mintAuthority: <deployer wallet>
         → mintAuthority not transferred to NttManager. Burns will fail.
```

**Evidence Contract:**

| Field | Value |
|-------|-------|
| **Check ID** | `CHK-003` |
| **Inputs** | Solana SPL mint info + NttManager PDA + `mode` from ntt.json |
| **Evidence collected** | Actual `mintAuthority` address vs expected NttManager PDA |
| **Decision rule** | `mintInfo.mintAuthority !== nttManagerPDA` when mode=BURNING → FAIL |
| **Failure class** | `MintAuthorityMissing` |
| **SKIPPED when** | Mode is LOCKING (check only applies to BURNING mode) |
| **Operator remediation** | Transfer mint authority: `spl-token authorize <mint> mint <nttManagerPDA>` |

---

### `CHK-004` `rate-limit-sanity` 🔴 blocking

**What it catches:** Zero rate limit → queues blocked → stuck transactions

**Mechanism:**
```typescript
const outboundLimit = await program.account.outboundRateLimit.fetch(
  outboundRateLimitPDA
);

for (const chain of remoteChains) {
  const inboundLimit = await program.account.inboundRateLimit.fetchNullable(
    inboundRateLimitPDA(chain)
  );
  
  if (inboundLimit?.rateLimit.limit === 0n) {
    // FAIL: zero inbound limit for this chain
  }
}

if (outboundLimit.rateLimit.limit === 0n) {
  // FAIL: zero outbound limit
}
```

**Evidence format:**
```
✅ PASS  rate-limit-sanity (inbound: 1000 USDC/hr, outbound: 1000 USDC/hr)
```
or:
```
❌ FAIL  rate-limit-sanity
         Outbound limit: 0 → queue will block all outbound transfers
         Fix: ntt configure rate-limit --outbound 1000000000
```

**Evidence Contract:**

| Field | Value |
|-------|-------|
| **Check ID** | `CHK-004` |
| **Inputs** | Solana `outboundRateLimit` PDA + `inboundRateLimit` PDA per remote chain |
| **Evidence collected** | Limit value (bigint) for outbound + each inbound direction |
| **Decision rule** | `rateLimit.limit === 0n` (either direction) → FAIL |
| **Failure class** | Zero rate limit → all transfers to/from that chain queue-blocked |
| **SKIPPED when** | Rate limit account doesn't exist (indicates chain not initialized — separate error) |
| **Operator remediation** | Set via NTT CLI: `ntt configure rate-limit --chain <X> --inbound <amount> --outbound <amount>` then `ntt push` |

---

### `CHK-005` `ata-rent-readiness` 🔴 blocking

**What it catches:** Executor ignores GasDropOff < rent minimum → tokens arrive but recipient ATA missing

**Mechanism:**
```typescript
const RENT_EXEMPT_MIN = 2_039_280; // lamports

// Check if ATA exists
const ata = getAssociatedTokenAddressSync(mint, recipient);
let ataExists = false;
try {
  await getAccount(connection, ata);
  ataExists = true;
} catch { /* account doesn't exist */ }

// Check payer reserve
const payerBalance = await connection.getBalance(payerAddress);
const isPayerReady = payerBalance >= RENT_EXEMPT_MIN;

if (!ataExists && !isPayerReady) {
  // FAIL: ATA will be created by Executor (costs rent) but payer can't cover it
}
```

**Evidence format:**
```
✅ PASS  ata-rent-readiness (payer reserve ≥ 2_039_280 lamports ✓)
```

**Evidence Contract:**

| Field | Value |
|-------|-------|
| **Check ID** | `CHK-005` |
| **Inputs** | Solana ATA address for recipient + payer SOL balance |
| **Evidence collected** | ATA exists (bool) + payer balance in lamports + `RENT_EXEMPT_MIN = 2_039_280` |
| **Decision rule** | ATA missing AND payer balance < `RENT_EXEMPT_MIN` → FAIL |
| **Failure class** | Token arrival at recipient fails — Executor tries to create ATA but payer can't cover rent |
| **SKIPPED when** | ATA already exists (no rent needed) → PASS immediately |
| **Operator remediation** | Fund payer wallet with ≥ 0.01 SOL buffer, OR pre-create recipient ATA |

---

## Sunrise Executor Checks

---

### `CHK-006` `executor-transceiver-registration` 🔴 blocking

**What it catches:** `NoEnabledTransceivers` on Executor redeem

**Mechanism:**
1. Read `TransceiverInfo` from NttManager transceiver registry
2. Find entry with `address == SUNRISE_EXECUTOR_ADDRESS`
3. Assert `enabled == true` AND `type == "ERN1"`

**Solana side (Anchor):**
```typescript
// Get all transceivers from NttManager
const config = await program.account.config.fetch(configPDA);
// config.enabledXcvrs or similar field — check IDL

// Verify executor address is in transceivers list with ERN1 type
const executorTransceiver = transceivers.find(
  t => t.address.equals(SUNRISE_EXECUTOR_PROGRAM_ID)
);

if (!executorTransceiver) {
  // FAIL: executor not registered at all
}
if (!executorTransceiver.enabled) {
  // FAIL: registered but not enabled
}
if (executorTransceiver.type !== "ERN1") {
  // FAIL: wrong relay type (e.g., ERN0 = old version)
}
```

**ABI fingerprint check:**
```typescript
// Before running check: verify NTT Manager version
const knownABI = "NTT Manager v2.1.0";
const selectorMatch = await verifyABIFingerprint(nttManagerAddress);

if (!selectorMatch) {
  // WARN: ABI mismatch — results may be unreliable
  console.warn(`executor-transceiver-registration: ABI mismatch
    Expected: ${knownABI}
    → Verify NTT Manager version manually`);
}
```

**Evidence format:**
```
❌ FAIL  executor-transceiver-registration
         ABI fingerprint: NTT Manager v2.1.0 ✓
         Expected: Sunrise Executor 0x1a2b...3c4d (ERN1)
         Found in transceivers[]: [0xdead...beef (ERN0)]
         → ERN1 relay type not enabled. NoEnabledTransceivers.
```

**Evidence Contract:**

| Field | Value |
|-------|-------|
| **Check ID** | `CHK-006` |
| **Inputs** | Solana NttManager config account + SUNRISE_EXECUTOR_PROGRAM_ID constant + ABI fingerprint |
| **Evidence collected** | Full transceivers[] list + executor entry (address, enabled, type) |
| **Decision rule** | Executor address missing OR `enabled=false` OR `type!="ERN1"` → FAIL |
| **Failure class** | `NoEnabledTransceivers` |
| **SKIPPED when** | ABI fingerprint mismatch — downgrade to WARN (results may be unreliable) |
| **Operator remediation** | `ntt add-transceiver --type ERN1 --address <executor>` then `ntt push` |

---

### `CHK-007` `executor-relay-capabilities` 🔴 blocking

**What it catches:** Executor doesn't support the chain pair or ERN1 not enabled for destination

**⚠️ Use testnet endpoint for dev** (Wormhole explicitly recommends this):
```
GET https://executor-testnet.labsapis.com/v0/capabilities  ← dev/test
GET https://executor.labsapis.com/v0/capabilities          ← production
```

**Capabilities response format (chain-keyed):**
```json
{
  "1":  { "requestPrefixes": ["ERN1"], "gasDropOffLimit": "10000000", ... },
  "30": { "requestPrefixes": ["ERN1"], "gasDropOffLimit": "5000000000000000", ... }
}
```
> Keys are Wormhole chain IDs as strings. Schema is live — may change.

**Mechanism:**
```typescript
const EXECUTOR_URL = process.env.EXECUTOR_URL 
  ?? "https://executor-testnet.labsapis.com"; // testnet for dev
const CACHE_TTL_MS = 3_600_000; // 1 hour

// Check TTL cache first
const cached = loadCapabilitiesCache();
if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
  return validateCapabilities(cached.data, srcChainId, dstChainId);
}

// Fetch fresh
const caps = await fetch(`${EXECUTOR_URL}/v0/capabilities`).then(r => r.json());
saveCapabilitiesCache(caps);

// Validate using chain-keyed schema:
const srcEntry = caps[String(srcWormholeChainId)];
const dstEntry = caps[String(dstWormholeChainId)];

const ok =
  !!srcEntry &&
  !!dstEntry &&
  Array.isArray(dstEntry.requestPrefixes) &&
  dstEntry.requestPrefixes.includes("ERN1");

if (!ok) {
  // FAIL
}
```

**Evidence format:**
```
✅ PASS  executor-relay-capabilities (GET /v0/capabilities → 200 OK ✓)
         Chain 2 (Ethereum): ERN1 ✓
         Chain 1 (Solana): ERN1 ✓
```
or with cache:
```
✅ PASS  executor-relay-capabilities (cached 2025-01-15T10:32:00Z, TTL 1h)
```

**Evidence Contract:**

| Field | Value |
|-------|-------|
| **Check ID** | `CHK-007` |
| **Inputs** | `/v0/capabilities` response (live or TTL-cached) + srcChainId + dstChainId |
| **Evidence collected** | HTTP status + caps[srcId] exists + caps[dstId].requestPrefixes |
| **Decision rule** | srcId missing OR dstId missing OR `requestPrefixes` doesn't include "ERN1" → FAIL |
| **Failure class** | Chain pair not supported by Executor; ERN1 not enabled for destination |
| **SKIPPED when** | No live data AND no cache → WARN with explicit message (never silent PASS) |
| **Operator remediation** | Verify chain support at executor-testnet endpoint; if absent, contact Wormhole |

---

### `CHK-008` `executor-endpoint-reachability` ⚠️ warning (blocking in `--strict`)

**What it catches:** devnet URL in mainnet config (copy-paste error)

**Mechanism:**
```typescript
const endpointUrl = config.executorEndpoint;

// 1. Check reachability
const response = await fetch(`${endpointUrl}/v0/capabilities`, {
  signal: AbortSignal.timeout(5000),
});

// 2. Verify it's the right network
const caps = await response.json();
const expectedNetwork = config.network; // "mainnet" | "testnet"
const isTestnet = endpointUrl.includes("testnet");

if (expectedNetwork === "Mainnet" && isTestnet) {
  // FAIL: testnet endpoint in mainnet config
}
```

**Evidence format:**
```
❌ FAIL  executor-endpoint-reachability
         Config network: Mainnet
         Endpoint: https://executor-testnet.labsapis.com  ← testnet URL!
         → Replace with: https://executor.labsapis.com
```

**Evidence Contract:**

| Field | Value |
|-------|-------|
| **Check ID** | `CHK-008` |
| **Inputs** | `config.executorEndpoint` URL + `config.network` (mainnet/testnet) |
| **Evidence collected** | HTTP reachability + URL testnet/mainnet classification |
| **Decision rule** | `config.network=="Mainnet"` AND endpoint URL contains "testnet" → FAIL |
| **Failure class** | Wrong environment — testnet relayer won't relay mainnet transactions |
| **SKIPPED when** | Endpoint unreachable → WARN (not FAIL — might be network issue) |
| **Operator remediation** | Update executor endpoint in config to `https://executor.labsapis.com` |

---

### `CHK-009` `executor-quote-sanity` ⚠️ warning

**What it catches:** routing issues before real transfer

**Mechanism:**
```typescript
// Dry-run quote with small test amount
const testRelayInstructions = encodeGasInstruction({
  gasLimit: 225_000n,
  msgValue: 0n,
});

const quoteResponse = await fetch(`${EXECUTOR_URL}/v0/quote`, {
  method: "POST",
  body: JSON.stringify({
    srcChain: srcWormholeChainId,
    dstChain: dstWormholeChainId,
    relayInstructions: testRelayInstructions,
  }),
});

if (!quoteResponse.ok) {
  // WARN: quote failed — routing issue
}
const { estimatedCost } = await quoteResponse.json();
// estimatedCost in lamports for Solana destination
```

**Evidence format:**
```
✅ PASS  executor-quote-sanity (100 USDC → fee 0.12 USDC ✓)
```

**Evidence Contract:**

| Field | Value |
|-------|-------|
| **Check ID** | `CHK-009` |
| **Inputs** | `POST /v0/quote` with test GasInstruction + srcChain + dstChain |
| **Evidence collected** | HTTP status + `estimatedCost` in destination native units |
| **Decision rule** | Non-200 response → WARN (not FAIL — Executor may be temporarily unavailable) |
| **Failure class** | Routing not available for this chain pair (soft warning) |
| **SKIPPED when** | `executor-relay-capabilities` already FAILed — no point quoting |
| **Operator remediation** | Retry later; if persistent, verify chain pair in capabilities |

---

### `CHK-010` `compute-budget-sanity` ⚠️ warning

**What it catches:** insufficient compute budget → failed redeem on Solana

**Two modes:**

**Static (default — deterministic, never flaky):**
```typescript
const DOCUMENTED_MIN_CU = 187_430; // observed base for NTT redeem
const REQUIRED_WITH_BUFFER = Math.ceil(DOCUMENTED_MIN_CU * 1.2); // = 224_916

const configuredGasLimit = config.gasLimit ?? 200_000;

if (configuredGasLimit < REQUIRED_WITH_BUFFER) {
  return {
    status: "WARN",
    message: `Config gasLimit: ${configuredGasLimit}
Documented minimum (×1.2): ${REQUIRED_WITH_BUFFER}
→ Increase gasLimit to ≥ ${REQUIRED_WITH_BUFFER}`
  };
}
```

**Simulation (--deep flag — experimental):**
```typescript
// Simulate actual redeem transaction
const simulation = await rpc.simulateTransaction(serializedRedeemTx).send();
const unitsConsumed = simulation.value.unitsConsumed;
const requiredBudget = Math.ceil(unitsConsumed * 1.2);

if (configuredGasLimit < requiredBudget) {
  return { status: "WARN", ... };
}
```

**Evidence format:**
```
⚠️ WARN  compute-budget-sanity [static]
         Config gasLimit: 200_000
         Documented minimum (×1.2): 224_916
         → Increase gasLimit to ≥ 225_000
```

**Evidence Contract:**

| Field | Value |
|-------|-------|
| **Check ID** | `CHK-010` |
| **Inputs** | `config.gasLimit` from ntt.json + `DOCUMENTED_MIN_CU = 187_430` constant |
| **Evidence collected** | Configured value vs required minimum with 1.2× buffer |
| **Decision rule** | `configuredGasLimit < ceil(187430 * 1.2)` → WARN |
| **Failure class** | Soft warning — redeem may fail on Solana with insufficient compute |
| **SKIPPED when** | No gasLimit configured (report as missing config, not sanity fail) |
| **Operator remediation** | Set `gasLimit ≥ 225_000` in ntt.json relay instructions config |

---

## Check Priority & Dependencies

```
BLOCKING checks (exit 1 on any fail):
  CHK-001  peer-registration
  CHK-002  decimals-sync
  CHK-003  mint-authority-policy
  CHK-004  rate-limit-sanity
  CHK-005  ata-rent-readiness
  CHK-006  executor-transceiver-registration
  CHK-007  executor-relay-capabilities

WARNING checks (exit 0, reported but not blocking):
  CHK-008  executor-endpoint-reachability  (→ blocking in --strict mode)
  CHK-009  executor-quote-sanity
  CHK-010  compute-budget-sanity

DEPENDENCIES (run order):
  CHK-008 → CHK-007 → CHK-009  (reachability before capabilities before quote)

FILTER usage:
  ntt-preflight verify --only CHK-001,CHK-002   # just peer + decimals
  ntt-preflight verify --skip CHK-009           # skip quote (offline mode)
  ntt-preflight verify --profile sunrise-executor  # CHK-001 to CHK-010
  ntt-preflight verify --profile ntt-generic    # CHK-001 to CHK-005 only
```

---

## report.json Shape (CHK IDs as keys)

```json
{
  "generatedAt": "2026-01-15T10:32:00Z",
  "profile": "sunrise-executor",
  "overallStatus": "FAIL",
  "checks": {
    "CHK-001": {
      "id": "CHK-001",
      "name": "peer-registration",
      "status": "FAIL",
      "severity": "blocking",
      "evidence": "Solana→Base: REGISTERED ✓\nBase→Solana: MISSING",
      "failureClass": "PeerNotRegistered",
      "remediation": "ntt add-peer --chain Base --address <peerAddress>"
    },
    "CHK-002": {
      "id": "CHK-002",
      "name": "decimals-sync",
      "status": "PASS",
      "severity": "blocking",
      "evidence": "ntt.json: 6, on-chain: 6, actual token: 6 ✓"
    }
  },
  "exitCode": 1
}
```

> CHK IDs enable: `--only`, `--skip` filtering / golden output diffs / demo narration / judge Q&A

---

## Check Engine Flow

```
1. Parse ntt.json
2. Connect to Solana RPC
3. Connect to EVM RPC (optional, graceful degradation if missing)
4. Connect to Executor API (TTL cache fallback)
5. Run Generic NTT checks
6. If profile == "sunrise-executor": Run Sunrise Executor checks
7. Aggregate results
8. Generate report.json + tx-plan.md
9. Exit code: 0 (PASS/WARN) or 1 (any BLOCKING fail)
```

---

## Competitive Moat Summary

| Check | NTT CLI | ntt-preflight |
|-------|---------|---------------|
| Reverse peer on remote chain | ❌ local only | ✅ both sides + graceful degradation |
| decimals assertion (not sync) | ❌ only `ntt pull` | ✅ blocking assertion |
| ERN1 transceiver registration | ❌ lists, doesn't assert | ✅ + ABI fingerprint |
| `/v0/capabilities` chain pair | ❌ | ✅ + TTL cache |
| devnet URL in mainnet config | ❌ | ✅ |
| compute budget static check | ❌ | ✅ never flaky |
| intent vs actual diff | ❌ | ✅ core mechanism |
