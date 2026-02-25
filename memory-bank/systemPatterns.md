# System Patterns

## Архитектура

```
ntt-preflight CLI
├── verify command
│   ├── Check Engine (sequential)
│   │   ├── Generic NTT checks (5 checks)
│   │   └── Sunrise Executor checks (4–5 checks, по профилю)
│   ├── RPC Layer (Solana + EVM, graceful degradation)
│   └── Reporter (console + report.json)
├── plan command
│   └── tx-plan generator (tx-plan.md + tx-plan.json)
└── GitHub Action wrapper
```

Профили (`--profile`):
- `sunrise-executor` — Generic NTT + Sunrise Executor checks (primary)
- `ntt-generic` — только Generic NTT checks

## Ключевые паттерны

### Intent vs Actual Diff
- Где применяется: ядро всех checks — сравниваем `ntt.json` (intent) с реальным on-chain состоянием
- Почему выбран: единственный способ поймать config drift и половинчатую регистрацию
- Механизм: читаем `NttManagerPeer` аккаунт через Anchor IDL (Solana side), EVM RPC для remote chain

### Двусторонняя проверка peer registration
- Где применяется: `peer-registration` check
- Почему выбран: `ntt status` видит только локальную сторону; reverse peer нужно проверять отдельно
- Resilience: если EVM RPC недоступен → SKIPPED с явным указанием, не false PASS

### Blocking vs Warning severity
- Где применяется: классификация всех checks
- Blocking: `peer-registration`, `decimals-sync`, `mint-authority-policy`, `rate-limit-sanity`, `ata-rent-readiness`, `executor-transceiver-registration`, `executor-relay-capabilities`
- Warning: `executor-endpoint-reachability` (конфигурируемо), `executor-quote-sanity`, `compute-budget-sanity` [static]
- В GitHub Action: `fail-on: blocking` — warnings не блокируют PR

### Graceful degradation для внешних зависимостей
- Где применяется: EVM RPC (peer-registration), Executor API (executor-relay-capabilities)
- EVM RPC недоступен → SKIPPED (не crash, не false PASS), с инструкцией `--rpc-evm <url>`
- Executor API → TTL-кеш с явным timestamp в выводе; fallback на `fixtures/capabilities-response.json`

### ABI fingerprint verification
- Где применяется: `executor-transceiver-registration`
- Почему: NTT — стандарт с фиксированным интерфейсом; при несовпадении ABI — явное предупреждение вместо молчаливо неправильного результата
- Механизм: selector match против NTT Manager v2.1.0 (known ABI)

### Static-first compute budget check
- Где применяется: `compute-budget-sanity`
- Default (static): детерминированная проверка по документированному минимуму × 1.2 — никогда не флакит
- `--deep` (experimental, stretch): симуляция через `simulateTransaction` — изолирована, не в core flow

### Dual demo mode
- Где применяется: demo и fallback для презентации
- Primary: реальный devnet с намеренно сломанным состоянием (`demo-setup.sh`)
- Fallback: `--mock-chain` + `fixtures/broken-state.json` (snapshot реального devnet), тот же check engine

## Решения, которые НЕ принимаем
- Инструмент не исполняет транзакции и не касается ключей — только читает и анализирует
- Simulation не входит в core flow — только за `--deep` флагом (stretch)
- Параллельный запуск checks не планируется — sequential, предсказуемый вывод
- Инструмент не синхронизирует состояние (не `ntt pull`) — только assertion

## Runtime status semantics (scaffold baseline)

- Базовая модель статусов: PASS / FAIL / SKIPPED (WARN не используется).
- FAIL допустим только для checks с severity_class=blocking.
- Для severity_class=non-blocking допустимы только PASS или SKIPPED.
- Комбинация non-blocking + FAIL считается нарушением runtime contract.
- SKIPPED не трактуется как PASS и всегда требует reason_code/details.
- CI aggregation опирается на пару (severity_class, status):
  - fail-on: blocking -> есть blocking FAIL
  - fail-on: all -> есть любой FAIL (эквивалентно blocking в scaffold baseline, пока non-blocking FAIL запрещён)
  - fail-on: none -> не фейлим по статусам checks
- Инвариант: при неполных/недостоверных данных PASS запрещён.
- Инвариант: при деградации внешней зависимости не допускается false PASS.

### Scaffold implementation baseline (CLI + runtime contracts)
- Реализован минимальный scaffold CLI: команды verify/plan.
- Runtime status model в коде: PASS / FAIL / SKIPPED (WARN отсутствует).
- Введены runtime guards:
  - non-blocking + FAIL => contract violation
  - SKIPPED без reason_code/details => contract violation
  - PASS при degradation=true => contract violation
- Check engine scaffold: sequential lifecycle, deterministic-first ordering.
- Registry профилей подключён: ntt-generic, sunrise-executor.
- Degradation path в scaffold маппится в SKIPPED (не PASS).

### Iteration 2.1: CHK-001 real deterministic path
- Добавлен read-only adapter contract layer:
  - ConfigSourceAdapter (рабочий, file-based)
  - EvmReadAdapter (contract/stub, TODO на будущую интеграцию)
- Реализован первый real deterministic check:
  - CHK-001 Config Intent Source Readiness
  - Проверяет ntt.json: present/readable/parseable
  - severity_class: blocking
- Degradation mapping:
  - CONFIG_NOT_FOUND / CONFIG_UNREADABLE -> SKIPPED, degradation=true
  - CONFIG_PARSE_ERROR -> FAIL
- Check подключён в registry профилей ntt-generic и sunrise-executor через существующий lifecycle/report pipeline.

### Iteration 2.2: First RPC-backed deterministic check
- Добавлен read-only Solana RPC adapter (`getHealth`) в adapter layer.
- Добавлен CHK-002 `solana-rpc-health-readiness` (blocking, deterministic).
- Semantics:
  - getHealth result "ok" -> PASS
  - Валидный RPC response с error/non-ok -> FAIL
  - Транспорт/timeout/invalid response -> SKIPPED с degradation=true
- Reason codes для degradation: RPC_UNAVAILABLE, RPC_TIMEOUT, RPC_READ_ERROR, RPC_RESPONSE_INVALID.
- Check подключён в ntt-generic и sunrise-executor через существующий lifecycle/report pipeline.

### Iteration 2.3: First domain-level deterministic check
- Добавлен CHK-003 `ntt-intent-manager-program-id-invariant` (blocking, deterministic).
- Check использует ConfigSourceAdapter и проверяет доменный инвариант:
  - `ntt.json.manager.solanaProgramId` должен существовать и соответствовать base58-like формату (32..44).
- Semantics:
  - source/read failure -> SKIPPED (reason_code из config adapter, degradation=true)
  - parse/domain invariant violation -> FAIL
  - invariant satisfied -> PASS
- Check подключён в ntt-generic и sunrise-executor через существующий lifecycle/report pipeline.

### Iteration 2.4: Domain-level peer/chain mapping presence check
- Добавлен CHK-004 `ntt-peer-chain-mapping-presence` (blocking, deterministic).
- Check использует ConfigSourceAdapter и проверяет узкий intent invariant:
  - секция `peers` должна существовать и содержать >=1 запись.
  - Текущий invariant path (fixture contract): top-level `peers`.
- Ожидаемая форма `peers`: object (не array / не scalar).
- Критерий non-empty: `Object.keys(peers).length >= 1`.
- Semantics:
  - source/read failure -> SKIPPED (reason_code из config adapter, degradation=true)
  - parse error -> FAIL (CONFIG_PARSE_ERROR)
  - peers missing -> FAIL (NTT_PEER_MAPPING_MISSING)
  - peers empty -> FAIL (NTT_PEER_MAPPING_EMPTY)
  - peers non-empty -> PASS
- Check подключён в ntt-generic и sunrise-executor через существующий lifecycle/report pipeline.

### Iteration 2.5: Domain-level peer mapping entry value shape sanity
- Добавлен CHK-005 `ntt-peer-mapping-entry-value-shape` (blocking, deterministic).
- Scope check (только top-level `peers`):
  - значение каждой записи должно быть string
  - после trim строка не пустая
  - если строка начинается с `0x`, должна соответствовать `^0x[a-fA-F0-9]{40}$`
- Semantics:
  - source/read failure -> SKIPPED (CONFIG_NOT_FOUND / CONFIG_UNREADABLE, degradation=true)
  - parse failure -> FAIL (CONFIG_PARSE_ERROR)
  - peers missing -> FAIL (NTT_PEER_MAPPING_MISSING)
  - peers non-object -> FAIL (NTT_PEER_MAPPING_SHAPE_INVALID)
  - peers empty -> FAIL (NTT_PEER_MAPPING_EMPTY)
  - invalid first entry value -> FAIL (NTT_PEER_MAPPING_ENTRY_VALUE_INVALID)
  - all entries valid -> PASS
- Check подключён в `ntt-generic` и `sunrise-executor`; порядок сохраняет config/domain checks перед RPC.

### Iteration 2.6: Domain-level peer mapping key shape sanity
- Добавлен CHK-006 `ntt-peer-mapping-key-shape` (blocking, deterministic).
- Scope check (только top-level `peers`):
  - key.trim() не пустой
  - key равен key.trim() (без leading/trailing spaces)
  - key соответствует `^[a-z0-9][a-z0-9-_]*$`
- Semantics:
  - source/read failure -> SKIPPED (CONFIG_NOT_FOUND / CONFIG_UNREADABLE, degradation=true)
  - parse failure -> FAIL (CONFIG_PARSE_ERROR)
  - peers missing -> FAIL (NTT_PEER_MAPPING_MISSING)
  - peers non-object -> FAIL (NTT_PEER_MAPPING_SHAPE_INVALID)
  - peers empty -> FAIL (NTT_PEER_MAPPING_EMPTY)
  - invalid first key -> FAIL (NTT_PEER_MAPPING_KEY_INVALID)
  - all keys valid -> PASS
- Check подключён в `ntt-generic` и `sunrise-executor`; порядок сохраняет config/domain checks перед RPC.

### Iteration P1: Required config precondition gate (false-green CI fix)
- Проблема: CHK-001 может вернуть SKIPPED при отсутствии обязательного config (`CONFIG_NOT_FOUND` / `CONFIG_UNREADABLE`), а SKIPPED не фейлит CI.
- Решение: execution-level precondition gate для verify (профили `ntt-generic`, `sunrise-executor`):
  - перед запуском checks проверяется читаемость `--config`
  - при ошибке чтения verify завершается non-zero до check aggregation
- Важно:
  - runtime status model не меняется (PASS/FAIL/SKIPPED)
  - runtime guards/contracts не меняются
  - check-level semantics CHK-001 не меняются (degradation mapping сохраняется)

  ### Docs clarification after Iteration P1
- Добавлена короткая README заметка о разделении:
  - execution-level precondition gates
  - check-level statuses (PASS/FAIL/SKIPPED)
- Явно задокументировано, что missing required config фейлит verify до aggregation (non-zero exit), при этом CHK-001 сохраняет check-level SKIPPED semantics.

### Phase 3 / Iteration 3.1: CHK-007 mock-first peer-registration symmetry
- Добавлен CHK-007 `peer-registration-symmetry-mock` (blocking, deterministic, mock-chain only).
- В этой итерации check работает только в mock-mode (`--mock-chain [fixture]`), без real RPC/on-chain reads.
- Assertion: для ожидаемых peer pair из config (`top-level peers`) регистрация должна быть симметричной:
  - local->peer == peer->local
- First-fail semantics: при первом асимметричном pair check возвращает FAIL с root-cause строкой:
  - `Solana->X: REGISTERED / X->Solana: MISSING`
- Mock fixture schema (reusable):
  - `registrations[]` с direction records `{from,to,registered,peerAddress?,decimals?}`
  - поле `decimals` оставлено для будущего CHK-008 (decimals mismatch).
- CHK-007 подключён в `ntt-generic` и `sunrise-executor`; порядок сохраняет config/domain checks перед RPC.

### Phase 3 / Iteration 3.2: CHK-008 mock-first decimals-sync mismatch
- Добавлен CHK-008 `decimals-sync-mock` (blocking, deterministic, mock-chain only).
- Reuse текущей fixture schema из CHK-007:
  - `registrations[]` records `{from,to,registered,peerAddress?,decimals?}`.
- Assertion:
  - для каждого ожидаемого pair (`solana<->peer` из top-level `peers`) directional registrations должны иметь одинаковые decimals.
- Semantics:
  - source/read failure -> SKIPPED (CONFIG_NOT_FOUND / CONFIG_UNREADABLE, degradation=true)
  - mock disabled -> SKIPPED (MOCK_CHAIN_DISABLED)
  - config/mock parse errors -> FAIL (CONFIG_PARSE_ERROR / MOCK_CHAIN_PARSE_ERROR)
  - invalid fixture shape -> FAIL (MOCK_CHAIN_FIXTURE_SHAPE_INVALID)
  - missing directional registration or decimals metadata -> FAIL (NTT_DECIMALS_REGISTRATION_MISSING)
  - directional decimals mismatch -> FAIL (NTT_DECIMALS_MISMATCH)
  - all checked pairs aligned -> PASS
- CHK-008 подключён в `ntt-generic` и `sunrise-executor`; CHK-007 + CHK-008 агрегируются совместно в mock mode.

### Phase 3 / Iteration 3.3: Mock-aware actionable plan generation
- `plan` command в mock-mode теперь строит actionable steps из текущих check результатов (in-process, без tx execution).
- Текущий mapping покрывает:
  - CHK-007 FAIL -> шаг на восстановление peer-registration symmetry
  - CHK-008 FAIL -> шаг на выравнивание directional decimals
- Порядок шагов детерминирован и следует порядку checks (CHK-007 затем CHK-008).
- При отсутствии actionable FAIL возвращается минимальный план: "No actions generated from current check failures."
- Формат `tx-plan.md` / `tx-plan.json` сохранён (без schema расширения).

### Phase 3 / Iteration 3.4: Demo-flow orchestration script (mock-first)
- Добавлен `scripts/demo-mock-flow.sh` для repeatable narrative:
  - broken mock verify -> actionable plan -> fixed mock re-verify.
- Скрипт использует существующие CHK-007/CHK-008 + plan mapping (без новых check semantics).
- Скрипт fail-fast проверяет ожидаемые состояния:
  - broken: CHK-007/008 FAIL
  - plan: содержит fix шаги для CHK-007/008
  - fixed: CHK-007/008 PASS и `ci_should_fail=false`
- Артефакты фиксированы по путям в `artifacts/demo-mock-flow/*`.

### Phase 3 / real-transition
- Solana adapter now supports existence-only peer account read via derived peer PDA (`["peer", uint16_le(chain_id)]` + manager program id), with normalized `exists` result and degradation-safe failure mapping.
- Explicitly no decimals/account deserialization yet.

### Phase 3 / Iteration 3.5.2:
CHK-007 now supports source routing:
mock mode via fixture (existing path)
rpc mode via Solana existence-only peer PDA reads
Check contract/evidence shape unchanged.
Rpc mode currently uses minimal peer-key → chain-id mapping and existence-only basis (no decimals parsing).

Phase 4 / Iteration 4.1:
Added thin executor endpoint reachability check (CHK-009) with mock-first + real GET adapter path.
Policy: reachability PASS only for HTTP 2xx; non-2xx is FAIL; transport/config degradation maps to SKIPPED.
Explicitly no /v0/capabilities payload parsing yet (reserved for 4.2).

Phase 4 / Iteration 4.2
Added CHK-010 executor-relay-capabilities using existing executor HTTP adapter transport from 4.1.
Minimal validation policy only: HTTP 2xx, parseable JSON, required top-level fields/types (supported_chains:string[], supported_relay_types:string[], status:string).
Transport/config failures remain degradation-path SKIPPED; payload/status invalid maps to FAIL.