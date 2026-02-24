# README_INDEX.md — Reference Pack Navigation

> Что открывать первым в зависимости от задачи.
> Если видишь пак первый раз → начни с "Вход в проект".

---

## 🚀 Вход в проект (первый раз)

1. **`../README.md`** — обзор структуры, критические факты (3 мин)
2. **`../VERSION_MATRIX.md`** — что нужно установить (1 мин)
3. **`NTT_REFERENCE.md`** → секция "Architecture" — понять LOCKING vs BURNING (5 мин)
4. **`CHECKS_REFERENCE.md`** → секция "Overview table" — понять что делает preflight (3 мин)

---

## 🔨 Implementing a Check

| Что делаешь | Читай |
|-------------|-------|
| Разбираешься как работает проверка | `CHECKS_REFERENCE.md` → нужный check → Evidence contract |
| Нужен PDA derivation паттерн | `CHAIN_RPC_REFERENCE.md` → "PDA Derivation" |
| Читаешь Anchor account (NttManagerPeer) | `CHAIN_RPC_REFERENCE.md` → "Anchor Account Reads" |
| Нужен EVM reverse peer check | `CHAIN_RPC_REFERENCE.md` → "EVM RPC via viem" |
| Проверяешь mintAuthority | `CHAIN_RPC_REFERENCE.md` → "Mint Authority Check" |
| Проверяешь ATA existence | `CHAIN_RPC_REFERENCE.md` → "ATA Rent Check" |
| Пишешь executor-relay-capabilities | `EXECUTOR_API.md` → "/v0/capabilities" + chain-keyed schema |
| Пишешь executor-quote-sanity | `EXECUTOR_API.md` → "/v0/quote" |
| Нужен Wormhole chain ID | `../ADDRESSES_AND_IDS.md` → "Wormhole Chain IDs" |
| Нужен адрес программы | `../ADDRESSES_AND_IDS.md` → "NTT + Executor Helper Programs" |
| Нужна константа (ATA rent, compute budget) | `../ADDRESSES_AND_IDS.md` → "Constants" |
| Непонятно какой check SKIPPED vs FAIL | `../ASSUMPTIONS.md` → "SKIPPED vs FAIL" + "False PASS" |

---

## 🎬 Demo / Fixture Refresh

| Задача | Файл |
|--------|------|
| Запустить demo с нуля | `../scripts/demo-setup.sh` |
| Обновить live capabilities snapshot | `../live-endpoint-snapshots/capabilities-testnet.json` → см. `_meta.how_to_refresh` |
| Понять что в broken-state fixture | `../fixtures/broken-state.json` → секция `_scenario` |
| Понять что в healthy-state fixture | `../fixtures/healthy-state.json` → секция `_scenario` |
| Проверить схему capabilities ответа | `../schemas/executor-capabilities.schema.json` |
| Обновить все фикстуры под новую схему | Сначала перечитай `EXECUTOR_API.md` → "/v0/capabilities" |

**Быстрый refresh capabilities snapshot:**
```bash
curl -s https://executor-testnet.labsapis.com/v0/capabilities | jq . \
  > ../live-endpoint-snapshots/capabilities-testnet.json
```

---

## 📋 Pre-Submission

```bash
# Одна команда — запускает все проверки:
bash ../scripts/pre-submit-verify.sh
```

Что проверяет скрипт → `../scripts/pre-submit-verify.sh` (читаемый bash с комментариями).

Если нужно вручную:

| Задача | Файл |
|--------|------|
| Pinned SHA проверка / обновление | `../SOURCES_LOCK.md` → "How to pin before submission" |
| Версии инструментов | `../VERSION_MATRIX.md` |
| Live endpoints checklist | `../SOURCES_LOCK.md` → "Pre-submission checklist" |
| Chain IDs не изменились | `../ADDRESSES_AND_IDS.md` vs live `/v0/capabilities` |
| Schema validate snapshot | `ajv validate -s ../schemas/executor-capabilities.schema.json -d ../live-endpoint-snapshots/capabilities-testnet.json` |

---

## 🗺️ Full File Map

```
sunrise-ntt-preflight-reference/
│
├── README.md                     ← критические факты, npm packages, checklist
├── VERSION_MATRIX.md             ← tool versions, compatibility (этот файл: docs/README_INDEX.md)
├── SOURCES_LOCK.md               ← pinned repos, URLs, pre-submission checklist с bash командами
├── ADDRESSES_AND_IDS.md          ← chain IDs, endpoints (testnet/mainnet separated), program addresses
├── ASSUMPTIONS.md                ← design decisions: determinism, SKIPPED/FAIL/false PASS, exit codes
│
├── docs/
│   ├── README_INDEX.md           ← (этот файл) навигация
│   ├── NTT_REFERENCE.md          ← архитектура NTT, аккаунты, ошибки, SDK, CLI
│   ├── EXECUTOR_API.md           ← /v0/capabilities (chain-keyed!), /v0/quote, ERN1
│   ├── CHAIN_RPC_REFERENCE.md    ← Solana + EVM RPC, PDA, ATA, mintAuthority, graceful degradation
│   └── CHECKS_REFERENCE.md       ← все 10 checks + Evidence contract (inputs→decision→remediation)
│
├── fixtures/
│   ├── broken-state.json         ← mock "сломанное" состояние: PeerNotRegistered + InvalidPeerDecimals + NoEnabledTransceivers
│   ├── healthy-state.json        ← mock "готовое" состояние: все checks PASS
│   └── capabilities-response.json ← reference формат /v0/capabilities
│
├── live-endpoint-snapshots/
│   └── capabilities-testnet.json ← снапшот testnet (обновлять перед demo и сабмитом)
│
├── schemas/
│   ├── executor-capabilities.schema.json ← JSON Schema для /v0/capabilities
│   └── executor-status-tx.schema.json    ← JSON Schema для /v0/status/tx
│
└── scripts/
    ├── demo-setup.sh             ← создаёт broken devnet state за ~60 сек
    └── pre-submit-verify.sh      ← versions + live curl + schema validate + smoke test
```

---

## 🧠 Quick Decision Tree

```
"Нужно понять как устроен NTT"
  → NTT_REFERENCE.md (Architecture, Account Structures)

"Нужно написать checks"
  → CHECKS_REFERENCE.md (Evidence contract для каждого check)
  → CHAIN_RPC_REFERENCE.md (код паттернов)
  → EXECUTOR_API.md (capabilities schema)

"Нужен chain ID / адрес / endpoint"
  → ADDRESSES_AND_IDS.md (всё в одном месте)

"Непонятно SKIPPED или FAIL"
  → ASSUMPTIONS.md (раздел 2 + 3)

"Готовлюсь к сабмиту"
  → scripts/pre-submit-verify.sh
  → SOURCES_LOCK.md (pre-submission checklist)
  → VERSION_MATRIX.md (актуальные ли версии)
```
