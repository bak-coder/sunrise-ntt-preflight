# Progress

## Завершено
- [2026-02-25] Финализирован спек v6 (Sunrise NTT Preflight)
- [2026-02-25] Заполнены все 6 файлов memory bank из спека v6
- [2026-02-25] Bootstrap Gate: projectBrief, productContext, techContext, systemPatterns — заполнены минимумом
- [2026-02-25] Реализован scaffold baseline: CLI verify/plan, runtime contracts и guards, lifecycle skeleton, profile registry, report.json и tx-plan contract artifacts; smoke run успешен
- [2026-02-25] Phase 2 / Iteration 2.1: реализован CHK-001 (Config Intent Source Readiness) через ConfigSourceAdapter; добавлен adapter contract layer (config real + evm stub); verify pipeline и report.json подтверждены smoke run (success + degradation)
- [2026-02-25] Phase 2 / Iteration 2.2: добавлен read-only Solana RPC adapter и CHK-002 (RPC-backed deterministic health check); verify/report pipeline подтверждён smoke runs (success + degradation)
- [2026-02-25] Phase 2 / Iteration 2.3: реализован CHK-003 (domain-level invariant для ntt.json.manager.solanaProgramId) через ConfigSourceAdapter; подтверждены success/fail smoke runs и report.json pipeline
- [2026-02-25] Phase 2 / Iteration 2.4: реализован CHK-004 (domain-level peer/chain mapping presence invariant: `peers` non-empty) через ConfigSourceAdapter; подтверждены success/fail smoke runs и report.json pipeline
- [2026-02-25] Phase 2 / Iteration 2.5: реализован CHK-005 (domain-level peer mapping entry value shape sanity для top-level `peers`) через ConfigSourceAdapter; подключён в ntt-generic/sunrise-executor; smoke PASS+FAIL и report.json подтверждены
- [2026-02-25] Phase 2 / Iteration 2.6: реализован CHK-006 (domain-level peer mapping key shape sanity для top-level `peers`) через ConfigSourceAdapter; подключён в ntt-generic/sunrise-executor; smoke PASS+FAIL и report.json подтверждены
- [2026-02-25] Phase 2 / Iteration P1: исправлен false-green CI gap для missing required config через execution-level precondition gate (profiles: ntt-generic, sunrise-executor); verify теперь завершает процесс с non-zero до aggregation при CONFIG_NOT_FOUND/CONFIG_UNREADABLE

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
