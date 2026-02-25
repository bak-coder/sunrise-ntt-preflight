# Progress

## Завершено
- [2026-02-25] Финализирован спек v6 (Sunrise NTT Preflight)
- [2026-02-25] Заполнены все 6 файлов memory bank из спека v6
- [2026-02-25] Bootstrap Gate: projectBrief, productContext, techContext, systemPatterns — заполнены минимумом
- [2026-02-25] Реализован scaffold baseline: CLI verify/plan, runtime contracts и guards, lifecycle skeleton, profile registry, report.json и tx-plan contract artifacts; smoke run успешен
- [2026-02-25] Phase 2 / Iteration 2.1: реализован CHK-001 (Config Intent Source Readiness) через ConfigSourceAdapter; добавлен adapter contract layer (config real + evm stub); verify pipeline и report.json подтверждены smoke run (success + degradation)
- [2026-02-25] Phase 2 / Iteration 2.2: добавлен read-only Solana RPC adapter и CHK-002 (RPC-backed deterministic health check); verify/report pipeline подтверждён smoke runs (success + degradation)

## В работе
- Декомпозиция скоупа на задачи для субагентов — не начата

## Предстоит (Core, в порядке приоритета)
- CLI scaffolding: entry point, `verify` / `plan` команды, профили, базовая структура check engine
- RPC Layer: Solana (Anchor IDL) + EVM (graceful degradation)
- Generic NTT checks: `peer-registration`, `decimals-sync`, `mint-authority-policy`, `rate-limit-sanity`, `ata-rent-readiness`
- Sunrise Executor checks: `executor-transceiver-registration` (ABI fingerprint), `executor-relay-capabilities` (TTL-кеш), `executor-endpoint-reachability`, `executor-quote-sanity`, `compute-budget-sanity` [static]
- Reporter: console output (PASS/FAIL/WARN + evidence), `report.json`
- Plan generator: `tx-plan.md` + `tx-plan.json`
- GitHub Action wrapper
- Dual demo mode: fixtures + `--mock-chain`, `--show-raw-api-response`

## Предстоит (Stretch)
- `compute-budget-sanity --deep` (simulation)
- Историческое сравнение readiness state

## Блокеры
- Нет. Проект готов к старту разработки.

- [2026-02-25] Уточнены runtime semantics scaffold baseline: PASS/FAIL/SKIPPED; WARN исключён; non-blocking FAIL запрещён; CI aggregation определён через (severity_class, status)
