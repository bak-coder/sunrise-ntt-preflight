# Product Context

## Для кого
NTT deployment operators и protocol engineers — люди, которые деплоят и управляют NTT-конфигурациями для cross-chain токен-трансферов. Технический уровень: senior, знакомы с Solana/EVM, работают с multisig и owner-подписями.

Вторичная аудитория: DevOps/CI инженеры, которые интегрируют проверки в GitHub Actions pipeline.

## Ключевые сценарии использования

1. **Pre-deploy check** — перед первым production деплоем оператор запускает `ntt-preflight verify --profile sunrise-executor`, получает полный отчёт о готовности и исполнимый tx-план для фиксов
2. **CI guardrail** — GitHub Action автоматически запускает preflight при каждом изменении `ntt.json` в PR, блокирует мёрж при blocking checks
3. **Post-fix re-verify** — после применения tx-плана оператор перепрогоняет verify и получает `READY` по всем checks
4. **Config drift detection** — при обновлении ntt.json инструмент ловит расхождение между intent и реальным on-chain состоянием
5. **Demo / fallback** — `--mock-chain` с `fixtures/broken-state.json` для воспроизводимой демонстрации без живого devnet

## UX-принципы
- **Actionable > diagnostic** — не просто FAIL, а конкретная on-chain evidence + точные команды для фикса
- **Operator-safe** — инструмент только читает и анализирует, никогда не исполняет транзакции и не касается ключей
- **Graceful degradation** — недоступность EVM RPC → SKIPPED с явным объяснением, не crash и не false PASS
- **Demo truthfulness > flashy output** — каждый check верифицирован по реальной архитектуре
- **Deterministic core** — flaky simulation изолирована за `--deep` флагом, основной flow всегда стабилен

## Формат вывода
- `verify` — консольный отчёт с `✅ PASS / ❌ FAIL / ⚠️ WARN` + on-chain evidence per check
- `plan` → `tx-plan.md` / `tx-plan.json` — исполнимые шаги с командами, порядком, требованиями к подписи
- `report.json` — машиночитаемый артефакт для CI
- GitHub Action artifacts: `report.json` + `tx-plan.md` доступны прямо из PR интерфейса

## Бизнес-контекст
Hackathon submission для Sunrise / Wormhole экосистемы. Судейская формулировка: инструмент делает Sunrise/NTT deployment readiness проверяемой в CI за 30 секунд. Конкурентное преимущество — единственный инструмент, который запускает reverse-peer assertion + ERN1 transceiver check + `/v0/capabilities` валидацию в одном CI шаге.
