# Project Brief

## Суть проекта
Sunrise NTT Preflight — Sunrise-native CLI + GitHub Action для проверки готовности NTT-деплоя перед миграцией в production.

CLI command: `ntt-preflight`
Public name: **Sunrise NTT Preflight**

## Проблема, которую решаем
Sunrise добавляет поверх стандартного NTT компонент Executor — сервис автоматического redeem на Solana. Большинство "тихих" проблем возникают на стыке: NTT Manager настроен, а Executor integration path сломан — и это не видно до первого реального трансфера. Существующий `ntt status` читает только локальную сторону и не делает assertion между intent и on-chain состоянием.

Цена одного production инцидента: 2–4 часа инженерного времени, stuck funds, репутационный ущерб перед листингом.

## Позиционирование
```
NTT CLI       = imperative management tool (executes commands)
NTT Preflight = declarative verification layer (asserts correctness)
```
Как `terraform plan` vs `terraform apply`. Sunrise-first, not Sunrise-only.

## Три failure pattern, которые ловит инструмент
1. **Half-registered peer** → `PeerNotRegistered` (reverse transfer)
2. **Decimal mismatch** → `InvalidPeerDecimals`
3. **Executor path not ready** → `NoEnabledTransceivers`

## Скоуп MVP (10–12 дней, соло)

### Core (обязательно)
- Generic NTT checks: `peer-registration`, `decimals-sync`, `mint-authority-policy`, `rate-limit-sanity`, `ata-rent-readiness`
- Sunrise Executor checks: `executor-transceiver-registration`, `executor-relay-capabilities`, `executor-endpoint-reachability`, `executor-quote-sanity`, `compute-budget-sanity` [static]
- Root-cause analysis с on-chain evidence
- `plan` → `tx-plan.md` / `tx-plan.json`
- `report.json`
- GitHub Action с `fail-on: blocking` и `paths: ntt.json` trigger
- Dual demo mode: devnet + `--mock-chain`
- `fixtures/capabilities-response.json`
- `--show-raw-api-response` флаг

### Stretch (если останется время)
- `compute-budget-sanity --deep` (simulation, experimental)
- Историческое сравнение readiness state
- Richer compute-budget estimation

## Что НЕ входит в скоуп
- Исполнение транзакций — инструмент не касается ключей
- Параллельная (не Sunrise) Executor интеграция
- Полноценная симуляция транзакций (только за `--deep` флагом, stretch)

## Критерии успеха
- `ntt-preflight verify` ловит все три failure pattern до деплоя
- `ntt-preflight plan` выдаёт исполнимый tx-план с точными командами
- GitHub Action запускается при изменении `ntt.json` и блокирует PR при blocking checks
- Demo: сломанное состояние → root cause → план → re-verify READY за 30 секунд
- Graceful degradation при недоступности EVM RPC (SKIPPED, не crash и не false PASS)

## Целевая аудитория и рынок
- ~25–30 активных NTT deployments
- $1.2–1.5 млрд TVL под риском (~60% от $2.5 млрд Wormhole TVL)
- 9 поддерживаемых сетей (Ethereum, Arbitrum, Base, Solana, Berachain и др.)
- Якорные проекты: Lido (wstETH), Sky Protocol (USDS, $824 млн), BlackRock BUIDL ($500 млн)
