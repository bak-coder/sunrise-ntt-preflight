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
