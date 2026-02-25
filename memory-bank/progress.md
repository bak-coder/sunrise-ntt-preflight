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
- [2026-02-25] Добавлена краткая README/CI usage заметка: execution-level required config precondition gate vs check-level statuses; зафиксировано поведение valid config vs missing required config после Iteration P1
- [2026-02-25] Phase 3 / Iteration 3.1: реализован CHK-007 (mock-first peer-registration symmetry) с first-fail root-cause evidence; добавлены reusable mock fixtures (`registrations[]` с decimals для будущего CHK-008); smoke PASS+FAIL и report.json pipeline подтверждены
- [2026-02-25] Phase 3 / Iteration 3.2: реализован CHK-008 (mock-first decimals-sync mismatch) с reuse registrations[] fixture schema; подключён в ntt-generic/sunrise-executor; smoke PASS + FAIL + integration (CHK-007+CHK-008 aggregate) подтверждены через report.json
- [2026-02-25] Phase 3 / Iteration 3.3: реализован mock-aware `plan` bridge из check failures в actionable `tx-plan` шаги (CHK-007/CHK-008), подтверждены 4 smoke case (peer fail, decimals fail, both fail ordered, no-actions case)
- [2026-02-25] Phase 3 / Iteration 3.4: добавлен `scripts/demo-mock-flow.sh` для полного mock narrative (broken verify -> plan -> fixed re-verify); подтверждён fail-fast сценарий и стабильные artifact paths
[2026-02-25] Phase 3 / Iteration 3.5.1: added Solana real-path adapter method for NTT peer account existence (PDA-derived, existence-only), with deterministic degradation handling for RPC/derivation failures; CHK-007 logic unchanged.
[2026-02-25] Phase 3 / Iteration 3.5.2: CHK-007 switched to source-routed execution (mock fixture or rpc existence-only via Solana adapter), preserving deterministic first-fail behavior and evidence schema; rpc transport issues mapped to SKIPPED degradation.
[2026-02-25] Phase 3 / Iteration 3.5.3: executed real rpc-mode CHK-007 smoke on Solana devnet (read-only), observed PASS, and confirmed structured evidence-shape parity with mock mode; no contract/semantics/guard changes.
[2026-02-25] Phase 4 / Iteration 4.1: implemented CHK-009 executor-endpoint-reachability (mock-first + real HTTP GET) with deterministic adapter output and degradation-safe SKIPPED mapping; wired into sunrise-executor profile; smoke validated mock PASS/FAIL and real transport degradation path.
[2026-02-25] Phase 4 / Iteration 4.2: implemented CHK-010 executor-relay-capabilities (mock-first + real /v0/capabilities) with minimal JSON shape validation and degradation-safe transport handling; integrated into sunrise-executor with CHK-009→CHK-010 ordering preserved.
[2026-02-25] Phase 4 / Iteration 4.3: implemented CHK-011 executor-transceiver-config-presence (config/mock-only). Added shallow presence/shape validation for executor transceiver reference in config, wired into sunrise-executor before transport checks, and validated with PASS/FAIL smoke fixtures + stable check ordering.
[2026-02-25] Phase 4 / Iteration 4.4: extended tx-plan actionable mapping for executor failures CHK-009/010/011 with deterministic ordering and enriched step text (reason_code + evidence summary); validated single-failure, mixed-failure, and no-actions fallback scenarios.
[2026-02-25] Phase 4 / Iteration 4.5: extended scripts/demo-mock-flow.sh to include executor-layer failures (CHK-010/011) and corresponding plan actions from existing mappings; validated deterministic broken->plan->fixed narrative with predictable artifacts and fail-fast checks.
[2026-02-25] Phase 5 / Iteration 5.1: implemented real-path Solana decimals parsing for CHK-008 rpc mode (minimal tokenDecimals extraction), added degradation-safe parse failure reason, preserved mock behavior/evidence schema/runtime contracts, and validated rpc mismatch detection with deterministic smoke.
[2026-02-25] Phase 5 / Iteration 5.1.1: validated CHK-008 Solana peer account decimals layout against authoritative upstream source; corrected parsing offset to 41; preserved runtime contracts and degradation behavior.
[2026-02-25] Phase 5 / Iteration 5.2.1: implemented CHK-012 executor-quote-sanity (mock-first), added PASS/FAIL fixtures, wired after CHK-010 in sunrise-executor, validated PASS/FAIL/SKIPPED smoke paths with existing verify/report pipeline.
[2026-02-25] Phase 5 / Iteration 5.2.2: implemented real dry-run quote retrieval routing for CHK-012; validated mock PASS + real PASS/FAIL/SKIPPED through verify/report pipeline without runtime contract changes.
[2026-02-25] Phase 5 / Iteration 5.2.3: implemented CHK-012 FAIL-driven plan mapping in tx-plan; validated FAIL generates action, PASS/SKIPPED do not; existing executor/domain mappings remain stable.
[2026-02-25] Phase 5 / Iteration 5.3.1: implemented CHK-013 compute-budget-sanity (static-only), added pass/fail fixtures, wired into sunrise-executor, and validated PASS/FAIL/SKIPPED smoke with required evidence fields.
[2026-02-25] Phase 6 / Iteration 6.2.1: added .github/workflows/ci.yml for deterministic checks + demo smoke (npm ci + demo-mock-flow), validated local run; no runtime/check logic changes.
[2026-02-25] Phase 6 / Iteration 6.3.1: updated root README to concise submission-ready format with one-liner, deterministic 30-second demo command, real output snippet, and full CHK-001..013 matrix; only README changed.
[2026-02-25] Phase 6 / Iteration 6.4: implemented CHK-013 FAIL-driven plan mapping; validated FAIL/PASS/SKIPPED behavior and kept demo-mock-flow pipeline green.
[2026-02-26] Phase 6 / Iteration 6.5: implemented structured report.json v2 + legacy; updated demo/profile smoke consumers; validated both smokes.

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
