# VERSION_MATRIX.md

> Быстрый compatibility glance. Детали + pinned SHA → `SOURCES_LOCK.md`.
> **Last verified: 2026-01-15** — versions checked against official docs/guides
> **Last updated: 2026-02-24** — file last edited

---

## Runtime & Toolchain

| Tool | Required Version | How to Check | Notes |
|------|-----------------|--------------|-------|
| Solana CLI | **1.18.26** | `solana --version` | Specified in NTT SVM deployment guide |
| Anchor | **0.29.0** | `anchor --version` | Required by NTT Manager program |
| Bun | **1.2.23** | `bun --version` | Used by NTT CLI install |
| Node.js | ≥ 18 LTS | `node --version` | Fallback if Bun unavailable |
| NTT CLI | **v1.5.0+cli** | `ntt --version` | Pin: tag `v1.5.0+cli` |
| Rust | stable (≥ 1.75) | `rustc --version` | For Anchor / Solana build tools |

---

## npm Packages

| Package | Version | Role |
|---------|---------|------|
| `@solana/kit` | **latest** (≥ 1.0) | Primary Solana SDK — use instead of web3.js |
| `@solana/web3.js` | — (legacy) | NOT used in new code; interop only |
| `@coral-xyz/anchor` | **^0.30** | Anchor TS client — IDL account reads |
| `@solana/spl-token` | **^0.4** | Mint, ATA, mintAuthority checks |
| `viem` | **^2** | EVM RPC — reverse peer check |
| `@wormhole-foundation/sdk-definitions` | **^1** | RelayInstructions layouts, serializeLayout |
| `@wormhole-foundation/sdk-solana-ntt` | **^1** | NTT SDK: getPeer, getConfig, getTokenDecimals |
| `@wormhole-foundation/sdk-evm-ntt` | **^1** | NTT SDK: EVM getPeer, reverse check |

---

## Wormhole Protocol Versions

| Component | Version | Notes |
|-----------|---------|-------|
| NTT Protocol | **v2** | Manager + Transceiver architecture |
| Wormhole Core | v2 | Guardian network, VAA v1 |
| Executor API | **v0** (beta) | `/v0/capabilities`, `/v0/quote`, `/v0/status/tx` |
| ERN1 relay type | v1 | NTT with Executor identifier |

---

## Compatibility Notes

```
Anchor 0.29.0  ←→  Solana CLI 1.18.26   ✅ tested (NTT SVM guide)
Anchor 0.30.x  ←→  Solana CLI 1.18.26   ⚠️  may work but not NTT-certified
@coral-xyz/anchor ^0.30 ←→ @solana/kit  ⚠️  interop adapter needed for types
```

**Interop rule:** `@coral-xyz/anchor` и `@wormhole-foundation/sdk-solana-ntt`
могут тянуть `@solana/web3.js` типы. Не смешивай `Connection` (web3.js) с
`createSolanaRpc` (kit) в одном модуле — используй адаптер-слой.

---

## Docker Image (demo / CI)

```dockerfile
FROM ubuntu:20.04
# Solana CLI  1.18.26
# Anchor      0.29.0
# Bun         1.2.23
# NTT CLI     v1.5.0+cli
```

---

## Verified Against

| Source | Date |
|--------|------|
| wormhole.com/docs NTT SVM Deployment guide | 2026-01-15 |
| wormhole.com/docs NTT + Executor integration guide | 2026-01-15 |
| github.com/wormhole-foundation/native-token-transfers tag `v1.5.0+cli` | 2026-01-15 |
| executor-testnet.labsapis.com /v0/capabilities | 2026-01-15 |

> 🔄 **Re-verify before submission:** Run `scripts/pre-submit-verify.sh`
