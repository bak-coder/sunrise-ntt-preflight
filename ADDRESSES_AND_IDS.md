# ADDRESSES_AND_IDS.md

> Single source of truth for all addresses, chain IDs, and endpoints used in Preflight.
> ⚠️ Verify against live docs before submission: https://wormhole.com/docs/products/reference/chain-ids/

---

## Wormhole Chain IDs

> Source: https://wormhole.com/docs/products/reference/chain-ids/
> **Do not hardcode from memory — always cross-reference this table.**

| Chain | Wormhole Chain ID | Use in Preflight |
|-------|-------------------|-----------------|
| Solana | **1** | Primary destination for NTT + Executor |
| Ethereum | **2** | Source chain (mainnet) |
| BSC | **4** | — |
| Polygon | **5** | — |
| Avalanche | **6** | — |
| Arbitrum | **23** | Supported in Executor |
| Optimism | **24** | — |
| Base | **30** | Supported in Executor |
| Berachain | TBD (verify) | — |
| Monad | TBD — testnet ~40 | — |

**For PDA derivation (Solana):**
```typescript
const WORMHOLE_CHAIN_IDS = {
  Solana:   1,
  Ethereum: 2,
  Arbitrum: 23,
  Base:     30,
} as const;

// chainIdToBuffer for PDA seed:
const chainIdBuffer = Buffer.alloc(2);
chainIdBuffer.writeUInt16LE(WORMHOLE_CHAIN_IDS.Base); // = 30
```

---

## Executor Endpoints

| Environment | URL |
|-------------|-----|
| **Testnet (dev/test)** | `https://executor-testnet.labsapis.com` |
| **Mainnet (production only)** | `https://executor.labsapis.com` |

Wormhole explicitly recommends testnet for development and testing.
Mainnet endpoint = production-ready deployments only.

**API paths:**
```
GET  /v0/capabilities    → chain-keyed capabilities (requestPrefixes, gasDropOffLimit, ...)
POST /v0/quote           → signed execution quote
POST /v0/status/tx       → transaction execution status
```

---

## Solana RPC Endpoints

| Cluster | URL |
|---------|-----|
| Mainnet | `https://api.mainnet-beta.solana.com` |
| Devnet  | `https://api.devnet.solana.com` |
| Testnet | `https://api.testnet.solana.com` |

**Rate limits (public):** 100 req / 10 sec per IP.
For CI: use Helius or QuickNode — set via `secrets.SOLANA_RPC_URL`.

---

## NTT + Executor Helper Programs (Solana)

> Source: https://wormhole.com/docs/products/reference/executor-addresses/

| Program | Purpose |
|---------|---------|
| Executor Program (SVM) | `Ax7mtQPbNPQmghd7C3BHrMdwwmkAXBDq7kNGfXNcc7dg` |
| `example-ntt-svm-lut` | Manages Lookup Tables for NTT programs |
| `example-ntt-with-executor-svm` | Generates + attaches Executor relay instructions on-chain |
| `example-cctp-with-executor-svm` | CCTP variant: `CXGRA5SCc8jxDbaQPZrmmZNu2JV34DP7gFW4m31uC1zs` |

**⚠️ Verify full NTT + Executor address list before production:**
https://wormhole.com/docs/products/reference/executor-addresses/#ntt-with-executor

---

## NTT Program IDs (Devnet — demo fixtures only)

> These are PLACEHOLDER values for demo/mock mode.
> For real devnet deployment: replace with actual deployed program IDs from `ntt.json`.

```
NTT Manager Program (Solana devnet):  NTTMgr11111111111111111111111111111111111111
Wormhole Transceiver (devnet):        WHTr11111111111111111111111111111111111111
SPL Mint (devnet, test token):        So11111111111111111111111111111111111111112
```

---

## Relay Instruction Type Identifiers

| Identifier | Protocol | Description |
|------------|---------|-------------|
| `ERN1` | NTT v1 with Executor | NTT transfer redeem via Executor |
| `ERC1` | CCTP v1 with Executor | USDC transfer via Executor |
| `ERC2` | CCTP v2 with Executor | — |

**ERN1 on-chain prefix:** `0x45524E31` ("ERN1" as bytes4)

---

## Well-Known Solana Program Addresses

```
System Program:         11111111111111111111111111111111
Token Program (SPL):    TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
Associated Token Program: ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bRS
Compute Budget Program: ComputeBudget111111111111111111111111111111
Wormhole Core (Mainnet): worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth
Wormhole Core (Devnet):  3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5
```

---

## ATA Rent Constants (Solana)

```typescript
const RENT_EXEMPT_MINIMUM_LAMPORTS = 2_039_280; // for a standard ATA (as of 2025)
// Source: getMinimumBalanceForRentExemption(165) on Solana mainnet
// 165 bytes = Token account size
```

---

## Compute Budget Constants

```typescript
const DOCUMENTED_NTT_REDEEM_MIN_CU = 187_430;     // observed base
const REQUIRED_WITH_20_PCT_BUFFER = 224_916;       // = Math.ceil(187430 * 1.2)
const RECOMMENDED_GAS_LIMIT = 225_000;             // round up
```

Source: Wormhole NTT + Executor guide — Executor uses `determineComputeBudget`
which sets budget to 120% of simulated `unitsConsumed`.
