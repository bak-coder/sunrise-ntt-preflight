# NTT Core Reference — Sunrise NTT Preflight

> Source: wormhole-foundation/native-token-transfers + wormhole.com/docs
> **Last verified: 2026-01-15** — content accuracy against live docs/endpoints
> **Last updated: 2026-02-24** — file last edited

---

## Architecture Overview

```
NttManager (per-token, per-chain)
  └── controls multiple Transceivers
        └── Transceiver: sends/receives NTT messages
              └── ERN1 (Executor) or Wormhole standard
```

**Two modes:**
- `LOCKING` — tokens locked on source chain (hub), burned/minted on spoke chains
- `BURNING` — burn on source, mint on destination (fully multichain supply)

⚠️ WARNING: If NttManager on source = `LOCKING`, all target chain NttManagers MUST be `BURNING`. Mismatch = stuck funds.

---

## Core Components

### NttManager
- One manager per token per chain
- Handles: rate limiting, message attestation, transceiver coordination
- Keeps track of `tokenDecimals` for each connected chain
- Amount trimmed to `min(TRIMMED_DECIMALS=8, source_decimals, destination_decimals)`

### Transceiver
- Implements `ITransceiver` interface
- Sends messages forwarded from NttManager
- Receives and delivers to peer NttManager on destination chain
- Key functions: `sendMessage()`, `quoteDeliveryPrice()`
- Types: `wormhole` (standard), `ERN1` (Executor), others

---

## Solana Account Structure

### NttManagerPeer (PDA)
Stores peer registration for a given chain.

```typescript
// From: solana/ts/sdk/ntt.ts — getPeer()
const peer = await program.account.nttManagerPeer.fetchNullable(
  pdas.peerAccount(chain)  // PDA derived from chain ID
);

// Peer object structure:
{
  address: Uint8Array,      // peer NttManager address on remote chain (32 bytes)
  tokenDecimals: number,    // declared decimals for the remote token
  inboundLimit: bigint,     // rate limit for inbound transfers from this chain
}
```

**Returned Ntt.Peer<C> shape:**
```typescript
{
  address: {
    chain: C,
    address: UniversalAddress,
  },
  tokenDecimals: number,
  inboundLimit: bigint,
}
```

### NttManagerConfig (PDA)
```typescript
const config = await NTT.getConfig(program, pdas);
// config.mint — SPL mint address
// config.custody — custody account for locking mode
// config.mode — "burning" | "locking"
```

### TransceiverRegistry
Stores list of enabled transceivers. Key for `executor-transceiver-registration` check:
```typescript
// Transceiver entry has:
{
  address: PublicKey,   // transceiver program address
  enabled: boolean,
  type: string,         // "wormhole" | "ERN1" | ...
}
```

---

## Payload Structure (NTT Message)

```
[4]byte prefix = 0x994E5454  // 0x99'N''T''T'
uint8  decimals              // decimals for the amount
uint64 amount                // amount (trimmed)
[32]byte source_token        // source chain token address
[32]byte recipient_address   // recipient
uint16 recipient_chain       // Wormhole Chain ID
```

Amounts are `uint64`, capped at `TRIMMED_DECIMALS` (8). Dust is never destroyed.

---

## Three Error Classes (Documented Failure Patterns)

### `PeerNotRegistered`
- **Cause:** `NttManagerPeer` account for the reverse chain does not exist
- **When:** First transfer in the reverse direction
- **Check:** `peer-registration` — both directions must have `NttManagerPeer` accounts
- **EVM equivalent:** `setPeer()` not called on remote chain NttManager

### `InvalidPeerDecimals`  
- **Cause:** `decimals` field in peer registration doesn't match the actual token decimals
- **When:** Any transfer attempt
- **EVM source:** `setPeer(peerChainId, peerContract, decimals, inboundLimit)` called with wrong `decimals`
- **Check:** `decimals-sync` — compare `ntt.json` declarations vs on-chain `tokenDecimals`

### `NoEnabledTransceivers`
- **Cause:** No transceiver registered with `enabled: true` in NttManager, or ERN1 type not set
- **When:** Redeem attempt via Executor
- **Check:** `executor-transceiver-registration` — verify ERN1 transceiver at expected address

---

## SDK Methods (NTT Solana TypeScript)

```typescript
// Read peer registration
const peer: Ntt.Peer<C> | null = await ntt.getPeer(chain);
// null → peer NOT registered

// Read token decimals
const decimals: number = await ntt.getTokenDecimals();

// Read config (mode, mint, custody)
const config = await ntt.getConfig();

// Read inbound rate limit
const limit = await ntt.getInboundLimit(chain);
```

Source: `native-token-transfers/solana/ts/sdk/ntt.ts`

---

## Rate Limiting

- Configured per-chain: inbound + outbound
- **Zero rate limit = queue blocked** → transactions get stuck
- Rate limits are auto-adjusted via "cancel-flows": outbound cancels inbound reserve and vice versa
- Check: `rate-limit-sanity` — both inbound and outbound must be > 0

---

## Mint Authority (Solana)

For `BURNING` mode:
- `mintAuthority` of the SPL token must be transferred to NttManager PDA
- Without this: `MintAuthorityMissing` → burn/mint physically impossible

For EVM BURNING mode:
- NttManager must be set as `minter` on the token contract

Check: `mint-authority-policy`

---

## NTT CLI Commands (Relevant)

```bash
ntt init <network>              # Initialize deployment.json
ntt add-chain <chain>           # Add chain to deployment
ntt add-peer --chain <chain> --address <addr> --token-decimals <n>
ntt push                        # Push config on-chain
ntt pull                        # Sync decimals from on-chain to deployment.json
ntt status                      # Show local deployment state (ONLY local side)
ntt verify-binding              # Verify binding (limited)
```

**Key limitation of `ntt status`:**
Shows only the local chain's state. Does NOT verify reverse peer registration on remote chains.

---

## NTT CLI Installation

```bash
git clone --branch 'v1.5.0+cli' --single-branch --depth 1 \
  https://github.com/wormhole-foundation/native-token-transfers.git
cd native-token-transfers
curl -fsSL https://bun.com/install | bash -s "bun-v1.2.23"
export PATH="$HOME/.bun/bin:$PATH"
# Then: ntt <command>
```

---

## deployment.json / ntt.json Structure

```json
{
  "network": "Mainnet",
  "chains": {
    "Solana": {
      "chainId": 1,
      "token": "<SPL mint address>",
      "manager": "<NttManager program ID>",
      "transceivers": {
        "wormhole": "<WormholeTransceiver address>"
      },
      "paused": false
    },
    "Base": {
      "chainId": 30,
      "token": "<ERC-20 address>",
      "manager": "<NttManager contract>",
      "transceivers": {
        "wormhole": "<transceiver address>"
      },
      "paused": false
    }
  }
}
```

---

## Wormhole Chain IDs (Key Ones)

| Chain      | Wormhole Chain ID |
|------------|-------------------|
| Solana     | 1                 |
| Ethereum   | 2                 |
| Base       | 30                |
| Arbitrum   | 23                |
| Monad      | TBD (testnet 40)  |
| Berachain  | TBD               |

Full list: https://wormhole.com/docs/products/reference/chain-ids/

---

## EVM NttManager: setPeer (Solidity)

```solidity
// Must be called on BOTH chains
// Chain A: register B as peer
// Chain B: register A as peer
function setPeer(
  uint16 peerChainId,    // Wormhole Chain ID
  bytes32 peerContract,  // NttManager address on peer chain (32 bytes)
  uint8 decimals,        // token decimals on peer chain
  uint256 inboundLimit   // rate limit for transfers from peer chain
) external onlyOwner
```

`InvalidPeer` or `InvalidPeerDecimals` if unset or mismatched.

---

## Docker Dev Environment

```dockerfile
FROM ubuntu:20.04
# Solana CLI v1.18.26
RUN sh -c "$(curl -sSfL https://release.solana.com/v1.18.26/install)"
# Anchor 0.29.0
RUN cargo install --git https://github.com/coral-xyz/anchor avm --locked --force \
  && avm install 0.29.0 && avm use 0.29.0
# Node.js + Bun
RUN curl -fsSL https://bun.com/install | bash -s "bun-v1.2.23"
# Foundry
RUN curl -L https://foundry.paradigm.xyz | bash && foundryup
```

---

## Key Repos

| Repo | Purpose |
|------|---------|
| `wormhole-foundation/native-token-transfers` | Main NTT contracts + SDK + CLI |
| `wormhole-foundation/demo-ntt-ts-sdk` | TypeScript SDK usage examples |
| `wormhole-foundation/demo-ntt-solana-multisig-tools` | NTT IDL + scripts reference |
| `wormholelabs-xyz/example-messaging-executor` | Executor framework + API spec |

---

## References

- Architecture: https://wormhole.com/docs/products/token-transfers/native-token-transfers/concepts/architecture/
- Troubleshooting: https://wormhole.com/docs/products/token-transfers/native-token-transfers/guides/troubleshoot/
- CLI Commands: https://wormhole.com/docs/products/token-transfers/native-token-transfers/reference/cli-commands/
- EVM Manager: https://wormhole.com/docs/products/token-transfers/native-token-transfers/reference/manager/evm/
- Solana Manager: https://wormhole.com/docs/products/token-transfers/native-token-transfers/reference/manager/solana/
- Rate Limits: https://wormhole.com/docs/products/token-transfers/native-token-transfers/configuration/rate-limiting/
