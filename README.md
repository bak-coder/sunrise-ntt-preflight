# Sunrise NTT Preflight — Reference Pack

> Используй как первичный reference pack.
> **Перед релизом/сабмитом перепроверь live endpoints, chain support и версии по pinned sources.**
> Все источники зафиксированы в `SOURCES_LOCK.md`.

---

## Структура

```
docs/
├── NTT_REFERENCE.md              — Архитектура NTT, аккаунты, ошибки, SDK методы, CLI
├── EXECUTOR_API.md               — Endpoints, схема /v0/capabilities (chain-keyed!), ERN1
├── CHAIN_RPC_REFERENCE.md        — Solana + EVM RPC, PDA derivation, ATA, mintAuthority
└── CHECKS_REFERENCE.md           — Все 10 checks: механизм, код, evidence, failure class

fixtures/
├── broken-state.json             — Mock "сломанного" devnet состояния (для --mock-chain)
├── healthy-state.json            — Mock "готового" состояния (для re-verify demo)
└── capabilities-response.json    — Формат /v0/capabilities (chain-keyed схема)

live-endpoint-snapshots/
└── capabilities-testnet.json     — Снапшот testnet /v0/capabilities
                                    ⚠️ Обновить: curl https://executor-testnet.labsapis.com/v0/capabilities | jq .

schemas/
├── executor-capabilities.schema.json  — JSON Schema для /v0/capabilities
└── executor-status-tx.schema.json     — JSON Schema для /v0/status/tx

scripts/
└── demo-setup.sh                 — Создаёт сломанное devnet состояние за ~60 сек

SOURCES_LOCK.md                   — Pinned repos, URLs, версии + pre-submission checklist
ADDRESSES_AND_IDS.md              — Wormhole chain IDs, адреса программ, endpoints, константы
ASSUMPTIONS.md                    — Design decisions: determinism, SKIPPED vs FAIL, exit codes
```

---

## Verify/CI behavior note (Iteration P1)

`ntt-preflight verify` has two layers of behavior for config-required profiles (`ntt-generic`, `sunrise-executor`):

1. **Execution-level precondition gate**  
   Required config (`--config`) must be readable before normal check aggregation starts.
2. **Check-level statuses**  
   Checks still report only `PASS / FAIL / SKIPPED` (no `WARN`).

Why this exists: to prevent false-green CI when required config is missing, while preserving existing check semantics.

- Missing/unreadable required config now fails execution with non-zero exit **before** aggregation.
- `CHK-001` semantics do **not** change: `CONFIG_NOT_FOUND` / `CONFIG_UNREADABLE` remain `SKIPPED` at check layer.

Example:

```bash
# Valid config -> verify runs checks and writes report.json
ntt-preflight verify --profile ntt-generic --config ./fixtures/sample-ntt.json --rpc-url "$SOLANA_RPC"

# Missing required config -> precondition gate fails fast (non-zero exit), no false-green CI
ntt-preflight verify --profile ntt-generic --config ./fixtures/missing-required-config.json --rpc-url "$SOLANA_RPC"
```

---

## Критические факты (не перепутай)

### /v0/capabilities — chain-keyed, НЕ массив

```typescript
// ✅ ПРАВИЛЬНО:
const caps = await fetch("https://executor-testnet.labsapis.com/v0/capabilities").then(r => r.json());
const ok = !!caps[String(dstChainId)] &&
           caps[String(dstChainId)].requestPrefixes.includes("ERN1");

// ❌ НЕПРАВИЛЬНО (старая версия):
// caps.supported_chains.includes(...) — такого поля нет
// caps.supported_relay_types.includes(...) — такого поля нет
```

⚠️ Executor API: `capabilities` — **динамический live endpoint**. Schema и цепочки могут изменяться.
Сверяй с `live-endpoint-snapshots/capabilities-testnet.json` перед сабмитом.

### Executor endpoints

```
Testnet (dev):     https://executor-testnet.labsapis.com   ← используй это для разработки
Mainnet (prod):    https://executor.labsapis.com           ← только production-ready
```

### SDK: @solana/kit — основной, @solana/web3.js — legacy

```typescript
// ✅ Основной SDK для нового кода:
import { createSolanaRpc } from "@solana/kit";

// ❌ Не используем в новом коде (legacy, не deprecated):
// import { Connection } from "@solana/web3.js";
// Допускается только для interop с библиотеками, тянущими web3.js типы.
```

---

## npm пакеты проекта

```bash
npm install @solana/kit                           # Основной Solana SDK
npm install @coral-xyz/anchor                    # Anchor client — чтение IDL аккаунтов
npm install @solana/spl-token                    # Mint, ATA проверки
npm install viem                                  # EVM RPC (reverse peer check)
npm install @wormhole-foundation/sdk-definitions  # RelayInstructions layouts, serializeLayout
npm install @wormhole-foundation/sdk-solana-ntt  # NTT SDK Solana (getPeer, getConfig)
npm install @wormhole-foundation/sdk-evm-ntt     # NTT SDK EVM
```

**Interop заметка:** `@coral-xyz/anchor` и `@wormhole-foundation/sdk-solana-ntt`
могут тянуть `@solana/web3.js` типы. Используй адаптер-слой, не смешивай типы.

---

## Установка инструментов

```bash
# Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.18.26/install)"

# Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.29.0 && avm use 0.29.0

# NTT CLI (v1.5.0+cli tag)
git clone --branch 'v1.5.0+cli' --single-branch --depth 1 \
  https://github.com/wormhole-foundation/native-token-transfers.git
cd native-token-transfers
curl -fsSL https://bun.com/install | bash -s "bun-v1.2.23"
```

---

## Wormhole Chain IDs (ключевые)

| Chain | ID | Используется в |
|-------|-----|----------------|
| Solana | **1** | PDA derivation seeds, capabilities key |
| Ethereum | **2** | — |
| Arbitrum | **23** | — |
| Base | **30** | — |

Полный список + проверка: `ADDRESSES_AND_IDS.md`

---

## Pre-submission checklist

- [ ] Обновить снапшот: `curl https://executor-testnet.labsapis.com/v0/capabilities | jq . > live-endpoint-snapshots/capabilities-testnet.json`
- [ ] Проверить chain IDs в снапшоте = chain IDs в `ADDRESSES_AND_IDS.md`
- [ ] Обновить `verified_at` в `SOURCES_LOCK.md`
- [ ] Проверить `requestPrefixes: ["ERN1"]` в снапшоте для нужных цепочек
- [ ] `ntt --version` → совпадает с v1.5.0+cli?
- [ ] `anchor --version` → 0.29.0?

---

## Что НЕ нужно

- ❌ Eliza / LangChain / Solana Agent Kit (AI агенты не используются в v1)
- ❌ Написание Anchor программ на Rust (только чтение через IDL)
- ❌ Blueshift / RareSkills курсы
