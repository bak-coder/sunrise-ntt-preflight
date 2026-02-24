# Chain RPC Reference — Solana + EVM — Sunrise NTT Preflight

> Covers: Solana JSON-RPC, Anchor account reads, PDA patterns, SPL token checks, EVM RPC
> Source: docs.solana.com + @solana/kit + viem
> **Last verified: 2026-01-15** — content accuracy against live docs/endpoints
> **Last updated: 2026-02-24** — file last edited

---

## SDK Choice

```
✅ Primary:  @solana/kit  — recommended by Solana Foundation, used in all new templates
❌ Avoid:   @solana/web3.js — legacy (still works, not removed, but not recommended for new code)
                             допускается только для interop или существующих примеров
```

> Interop: если сторонняя библиотека тянет `@solana/web3.js` типы — используй адаптер-слой,
> не смешивай типы `Connection` из web3.js с `createSolanaRpc` из kit в одном модуле.

---

## Clusters & RPC Endpoints

| Cluster  | URL                               | Use                    |
|----------|-----------------------------------|------------------------|
| Mainnet  | https://api.mainnet-beta.solana.com | Production            |
| Devnet   | https://api.devnet.solana.com     | Development / demos    |
| Testnet  | https://api.testnet.solana.com    | Protocol stress tests  |

**Rate limits (public RPC):**
- 100 requests per 10 seconds per IP
- For CI pipelines: use Helius or QuickNode to avoid 429

**CLI config:**
```bash
solana config set --url https://api.devnet.solana.com
```

**overrides.json (NTT CLI custom RPC):**
```json
{
  "solana": {
    "rpc": "https://your-helius-rpc.helius.xyz"
  }
}
```

---

## @solana/kit — Recommended SDK

```typescript
import { createSolanaRpc } from "@solana/kit";

const rpc = createSolanaRpc("https://api.devnet.solana.com");
```

> `@solana/kit` — официальный современный SDK. Используй его для нового кода.
> `@solana/web3.js` — legacy. Не удалён, но новый код писать на нём не нужно.
> Если нужен interop (например, Anchor тянет web3.js типы) — оборачивай в адаптер.

---

## Account Reads

### getAccountInfo

```typescript
// @solana/kit
const accountInfo = await rpc.getAccountInfo(address, {
  encoding: "base64",
}).send();

// accountInfo.value === null → account doesn't exist (not initialized)
// accountInfo.value.data → base64-encoded account data
// accountInfo.value.lamports → SOL balance in lamports
// accountInfo.value.owner → program that owns this account
```

### getMultipleAccounts (batch)

```typescript
const accounts = await rpc.getMultipleAccounts(
  [address1, address2, address3],
  { encoding: "base64" }
).send();
```

---

## PDA Derivation

### Pattern (TypeScript)

```typescript
import { PublicKey } from "@solana/kit"; // or from "@solana/web3.js" compat

const [pda, bump] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("ntt_manager_peer"),  // seed 1: static string
    Buffer.from(chainIdBytes),         // seed 2: chain ID as bytes
  ],
  nttManagerProgramId
);
```

### NttManagerPeer PDA

From the NTT SDK source (`pdas.peerAccount(chain)`):
```typescript
// Seed pattern for NttManagerPeer account:
// seed[0] = "peer"  (or "ntt_manager_peer" — check IDL)
// seed[1] = wormhole chain ID as uint16 little-endian bytes

function peerAccountAddress(
  nttManagerProgramId: PublicKey,
  wormholeChainId: number
): PublicKey {
  const chainIdBuffer = Buffer.alloc(2);
  chainIdBuffer.writeUInt16LE(wormholeChainId);
  
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("peer"), chainIdBuffer],
    nttManagerProgramId
  );
  return pda;
}
```

> ⚠️ Verify exact seeds from the NTT IDL — check `ntt.json` in
> `wormhole-foundation/demo-ntt-solana-multisig-tools/src/config/idl.json`

---

## Anchor Program Account Reads

The NTT Solana program uses Anchor. To deserialize accounts:

```typescript
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import nttIdl from "./idl/ntt.json"; // from NTT repo

const connection = new Connection(rpcUrl);
const provider = new AnchorProvider(connection, wallet, {});
const program = new Program(nttIdl, provider);

// Read NttManagerPeer
const peer = await program.account.nttManagerPeer.fetchNullable(
  peerPDAAddress
);
// peer === null → NOT registered

// Read NttManager config
const config = await program.account.config.fetch(configPDAAddress);
// config.mode.locking / config.mode.burning
// config.mint → SPL mint PublicKey
```

---

## Mint Authority Check

```typescript
import { getMint } from "@solana/spl-token";

const mintInfo = await getMint(connection, mintAddress);

// For BURNING mode: NttManager PDA must be mintAuthority
const expectedMintAuthority = nttManagerPdaAddress;
const isMintAuthorityCorrect = 
  mintInfo.mintAuthority?.equals(expectedMintAuthority) ?? false;

if (!isMintAuthorityCorrect) {
  // FAIL: MintAuthorityMissing
  // mintInfo.mintAuthority is either null or wrong address
}
```

---

## ATA (Associated Token Account) Check

```typescript
import { getAssociatedTokenAddressSync, getAccount } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

const ata = getAssociatedTokenAddressSync(mintAddress, recipientAddress);

let ataExists = false;
try {
  await getAccount(connection, ata);
  ataExists = true;
} catch {
  ataExists = false;
  // If Executor automates redeem: it will create ATA, increasing cost
}

// Rent check: minimum balance for ATA
const RENT_EXEMPT_MINIMUM = 2_039_280; // lamports for ATA (as of 2025)
const payerBalance = await connection.getBalance(payerAddress);
const isRentReady = payerBalance >= RENT_EXEMPT_MINIMUM;
```

---

## Simulating Transactions (Compute Budget)

```typescript
// For compute-budget-sanity --deep (simulation mode)
const simulateResult = await rpc.simulateTransaction(
  serializedTransaction,
  { encoding: "base64" }
).send();

const unitsConsumed = simulateResult.value.unitsConsumed;
// Required budget = unitsConsumed * 1.2 (Executor logic)
```

---

## Rate Limits (Anchor Account)

```typescript
// OutboundRateLimitParams
const outboundRateLimit = await program.account.outboundRateLimit.fetch(
  outboundRateLimitPDA
);
// outboundRateLimit.rateLimit.limit → 0 = BLOCKED

// InboundRateLimitParams (per chain)  
const inboundRateLimit = await program.account.inboundRateLimit.fetchNullable(
  inboundRateLimitPDA  // derived from chain ID
);
```

---

## Useful JSON-RPC Raw Calls

```typescript
// Check if program account exists (any account)
const accountInfoRaw = await rpc.getAccountInfo(
  address,
  { commitment: "confirmed" }
).send();
// null value = account doesn't exist

// getMinimumBalanceForRentExemption
const rentExemption = await rpc.getMinimumBalanceForRentExemption(
  accountSize  // bytes
).send();
```

---

## Wormhole Chain IDs (for PDA derivation)

```typescript
const WORMHOLE_CHAIN_IDS = {
  Solana:   1,
  Ethereum: 2,
  BSC:      4,
  Polygon:  5,
  Avalanche: 6,
  Arbitrum: 23,
  Optimism: 24,
  Base:     30,
  Berachain: 39,  // TBD, verify from docs
};
```

Full list: https://wormhole.com/docs/products/reference/chain-ids/

---

## EVM RPC (for Reverse Peer Check)

```typescript
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const client = createPublicClient({
  chain: base,
  transport: http(evmRpcUrl),
});

// Call NttManager.getPeer(chainId) on EVM
const peerData = await client.readContract({
  address: nttManagerAddress as `0x${string}`,
  abi: NTT_MANAGER_ABI,
  functionName: "getPeer",
  args: [wormholeChainId],
});

// peerData = { peerContract: bytes32, tokenDecimals: uint8, inboundLimit: uint256 }
// peerContract == bytes32(0) → NOT registered
```

**NttManager ABI fragment (EVM):**
```json
[
  {
    "name": "getPeer",
    "type": "function",
    "stateMutability": "view",
    "inputs": [{ "name": "chainId_", "type": "uint16" }],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "components": [
          { "name": "peerAddress", "type": "bytes32" },
          { "name": "tokenDecimals", "type": "uint8" }
        ]
      }
    ]
  },
  {
    "name": "getTransceivers",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address[]" }]
  },
  {
    "name": "isTransceiverEnabled",
    "type": "function", 
    "stateMutability": "view",
    "inputs": [{ "name": "transceiver", "type": "address" }],
    "outputs": [{ "name": "", "type": "bool" }]
  }
]
```

---

## Graceful Degradation Pattern (Reverse Peer Check)

```typescript
async function checkReversePeer(
  evmRpcUrl: string | undefined,
  nttManagerAddress: string,
  wormholeChainId: number
): Promise<CheckResult> {
  if (!evmRpcUrl) {
    return {
      status: "SKIPPED",
      reason: "EVM RPC not configured. Run with --rpc-evm <url> to verify reverse peer.",
    };
  }

  const attempts = 3;
  for (let i = 0; i < attempts; i++) {
    try {
      const peer = await queryEvmPeer(evmRpcUrl, nttManagerAddress, wormholeChainId);
      return peer ? { status: "PASS" } : { status: "FAIL", error: "PeerNotRegistered" };
    } catch (err) {
      if (i === attempts - 1) {
        return {
          status: "SKIPPED",
          reason: `EVM RPC unavailable after ${attempts} retries. ${err.message}`,
        };
      }
      await sleep(1000 * (i + 1)); // backoff
    }
  }
}
```

---

## References

- Solana clusters: https://docs.solana.com/clusters
- @solana/kit: https://github.com/solana-labs/solana-web3.js (new monorepo)
- Solana cookbook: https://solanacookbook.com
- Anchor docs: https://www.anchor-lang.com/docs
- SPL token: https://spl.solana.com/token
