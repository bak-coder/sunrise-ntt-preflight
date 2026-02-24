# Wormhole Executor API Reference — Sunrise NTT Preflight

> Source: wormholelabs-xyz/example-messaging-executor + wormhole.com/docs/protocol
> **Last verified: 2026-01-15** — content accuracy against live docs/endpoints
> **Last updated: 2026-02-24** — file last edited

---

## What is the Executor?

The Executor is a permissionless, quote-based cross-chain execution framework built by Wormhole.
It enables automatic token redemption on destination chains without a dedicated relayer.

**Replaces:** Wormhole Standard Relayer (SR)
**Used by:** NTT with Executor (ERN1), CCTP with Executor (ERC1/ERC2)

---

## Endpoint URLs

```
Mainnet:  https://executor.labsapis.com
Testnet:  https://executor-testnet.labsapis.com
```

The Sunrise Executor uses these same endpoints (it's the Wormhole Executor infrastructure).

---

## API Endpoints

### GET /v0/capabilities

Returns what the relay provider supports, **keyed by Wormhole chain ID** (as string).

**⚠️ CRITICAL: Use testnet endpoint for development (Wormhole recommends this):**
```
GET https://executor-testnet.labsapis.com/v0/capabilities   ← dev/test
GET https://executor.labsapis.com/v0/capabilities           ← production only
```

**Real response schema (chain-keyed object):**
```json
{
  "1": {
    "requestPrefixes": ["ERN1"],
    "gasDropOffLimit": "10000000",
    "maxGasLimit": "1400000",
    "maxMsgValue": "100000000"
  },
  "2": {
    "requestPrefixes": ["ERN1"],
    "gasDropOffLimit": "5000000000000000",
    "maxGasLimit": "1000000",
    "maxMsgValue": "1000000000000000"
  },
  "23": {
    "requestPrefixes": ["ERN1"],
    "gasDropOffLimit": "5000000000000000",
    "maxGasLimit": "1000000",
    "maxMsgValue": "1000000000000000"
  },
  "30": {
    "requestPrefixes": ["ERN1"],
    "gasDropOffLimit": "5000000000000000",
    "maxGasLimit": "1000000",
    "maxMsgValue": "1000000000000000"
  }
}
```

> Keys are Wormhole chain IDs as strings: "1"=Solana, "2"=Ethereum, "23"=Arbitrum, "30"=Base
> ⚠️ Schema is dynamic — keys and values may change. Always validate against live response before release.

**Fields per chain entry:**
- `requestPrefixes` — relay types supported for that chain as destination (e.g. `["ERN1"]`)
- `gasDropOffLimit` — max gas the relayer will drop off (native token units)
- `maxGasLimit` — maximum gas limit for the redeem transaction
- `maxMsgValue` — maximum msgValue the relayer accepts

**Correct check pattern:**
```typescript
const caps = await fetch("https://executor-testnet.labsapis.com/v0/capabilities")
  .then(r => r.json());

const srcEntry = caps[String(srcWormholeChainId)];
const dstEntry = caps[String(dstWormholeChainId)];

const ok =
  !!srcEntry &&                                   // source chain is supported
  !!dstEntry &&                                   // destination chain is supported
  Array.isArray(dstEntry.requestPrefixes) &&
  dstEntry.requestPrefixes.includes("ERN1");      // ERN1 enabled on destination

if (!ok) {
  // FAIL: executor-relay-capabilities
}
```

**What Preflight checks:**
1. `caps[srcChainId]` exists
2. `caps[dstChainId]` exists
3. `caps[dstChainId].requestPrefixes.includes("ERN1")`

---

### POST /v0/quote

Generate a signed execution quote.

**Request body:**
```json
{
  "srcChain": 2,
  "dstChain": 1,
  "relayInstructions": "0x..."
}
```

**Response:**
```json
{
  "signedQuote": "0x...",
  "estimatedCost": "11500000"
}
```

> `estimatedCost` for Solana destination = lamports required (including priority fees + rent)
> For new wallet ATA creation: cost is higher (relayer auto-creates ATA)

**Quote header structure (parsed on-chain by Executor Contract):**
```
bytes4   prefix          // 4-byte prefix, version-specific, MUST NOT change
address  quoterAddress   // Public key of quoter (identifies relay provider)
bytes32  payeeAddress    // UniversalAddress of payee on source chain
uint16   sourceChain     // Wormhole Chain ID
uint16   destinationChain
uint64   expiryTime      // Unix timestamp; quote rejected after this
```

---

### POST /v0/status/tx

Check execution status of a submitted transaction.

**Request body:**
```json
{
  "txHash": "0x...",
  "chainId": 2
}
```

**Response:**
```json
{
  "status": "completed" | "pending" | "failed",
  "executionTxHash": "...",
  "completedAt": "2025-01-15T10:32:00Z"
}
```

---

## Relay Instruction Types

### GasInstruction (for NTT and CCTP)
```typescript
{
  type: "GasInstruction",
  gasLimit: bigint,    // gas limit for redeeming transaction
  msgValue: bigint,    // native token to forward (0 for NTT transfers)
}
```

### GasDropOffInstruction (optional)
```typescript
{
  type: "GasDropOffInstruction",
  dropOffAmount: bigint,  // native token to drop to recipient
}
```
> Relay provider only respects the FIRST GasDropOffInstruction
> Drop-off is `min(requested, configured_limit)` from `/v0/capabilities`

---

## ERN1 — Executor Request for NTT v1

`ERN1` is the relay instruction type identifier for NTT with Executor.

```
bytes4  prefix = "ERN1"   // 0x45524E31
uint16  srcChain           // Wormhole Chain ID of source
bytes32 srcManager         // NttManager address on source chain
bytes32 messageId          // NTT message ID
```

**ABI fingerprint check:**
When verifying `executor-transceiver-registration`, Preflight checks:
```
NttManager.transceivers[executor_address].enabled == true
NttManager.transceivers[executor_address].type == "ERN1"
```

---

## NTT + Executor Flow

```
1. Client → GET /v0/capabilities  (verify chain pair + ERN1 supported)
2. Client → POST /v0/quote        (get signed quote + estimated cost)
3. Client → sendTransfer(signedQuote, relayInstructions) on source chain
4. Executor (off-chain) → monitors source chain for execution requests
5. Executor → calls receiveMessage() on NttManager (destination chain)
6. Client → POST /v0/status/tx    (monitor completion)
```

**For Solana destination — important:**
- `msgValue` must cover: priority fees + rent + optional gas drop-off
- Minimum `msgValue` for Solana ≈ `11_500_000` lamports (with ATA creation buffer)
- If ATA doesn't exist: relayer auto-creates it, increasing cost
- `msgValue` is NOT forwarded to NTT Transceiver's `receiveMessage` (set to 0)

---

## Compute Budget (Solana)

The Executor estimates compute units via `determineComputeBudget`:
1. Simulates the redeem transaction
2. Sets budget to `120% of unitsConsumed`

**Static minimum (for `compute-budget-sanity` check):**
```
documented_minimum = 187_430 CU (observed base for NTT redeem)
required_with_buffer = documented_minimum × 1.2 = 224_916 CU
```

If `gasLimit < 224_916` → `WARN` (static check, never flaky)

---

## Disabling Standard Relayer when using Executor

If NttManager was configured with a Standard Relayer transceiver AND you're adding Executor:
- Set `automatic: false` in `encodedInstructions`
- This routes delivery exclusively through Executor
- Prevents duplicate delivery

---

## NTT with Executor — Deployed Addresses

**Solana Helper Programs:**
- `example-ntt-svm-lut` — manages Lookup Tables for NTT programs without canonical LUTs
- `example-ntt-with-executor-svm` — generates and attaches Executor relay instructions on-chain

Full addresses: https://wormhole.com/docs/products/reference/executor-addresses/

---

## TypeScript SDK Usage

```typescript
import { Client } from "./api-docs/tsp-output/clients/js";

const client = new Client({ baseUrl: "https://executor.labsapis.com/v0" });

// Check capabilities (chain-keyed response)
const caps = await client.capabilities.list();
// caps["1"]  → Solana entry with { requestPrefixes, gasDropOffLimit, maxGasLimit, maxMsgValue }
// caps["30"] → Base entry
// Verify ERN1 on destination:
const dstSupported = !!caps[String(dstChainId)] &&
  caps[String(dstChainId)].requestPrefixes.includes("ERN1");

// Get quote
const { signedQuote, estimatedCost } = await client.quote.create({
  srcChain: 2,   // Ethereum
  dstChain: 1,   // Solana
  relayInstructions: "0x...",
});

// Check status
const status = await client.status.getTransaction({
  txHash: "0x...",
  chainId: 2,
});
```

---

## Cache Strategy for Preflight

`executor-relay-capabilities` uses TTL caching:

```typescript
interface CachedCapabilities {
  // Chain-keyed: caps["1"], caps["30"], etc.
  data: Record<string, {
    requestPrefixes: string[];
    gasDropOffLimit: string;
    maxGasLimit: string;
    maxMsgValue: string;
  }>;
  fetchedAt: string;  // ISO timestamp
  ttl_seconds: 3600;  // 1 hour
}
```

⚠️ Schema is live and may change — re-validate against `LIVE_ENDPOINT_SNAPSHOTS/` before release.

If endpoint unavailable → use cached response + log warning:
```
executor-relay-capabilities: PASS (cached 2025-01-15T10:32:00Z, TTL 1h)
```

---

## Executor Framework Architecture

```
Relay Provider:
  Quoter (off-chain) → signed quotes
  Relayer (off-chain) → monitors + executes

On-chain:
  Executor Contract/Program → receives requestExecution
  NttManager → final receiveMessage/redeem

Identifiers:
  Relay Provider = Quoter's EVM public key
  Payee = wallet receiving payment on source chain
```

---

## References

- NTT with Executor guide: https://wormhole.com/docs/protocol/infrastructure-guides/ntt-executor/
- CCTP with Executor guide: https://wormhole.com/docs/protocol/infrastructure-guides/cctp-executor/
- Executor Framework: https://wormhole.com/docs/protocol/infrastructure/relayers/executor-framework/
- Executor addresses: https://wormhole.com/docs/products/reference/executor-addresses/
- Example Messaging Executor repo: https://github.com/wormholelabs-xyz/example-messaging-executor
- demo-ntt-ts-sdk (Executor route example): https://github.com/wormhole-foundation/demo-ntt-ts-sdk
