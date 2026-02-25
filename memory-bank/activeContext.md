# Active Context
_Обновлено: 2026-02-25_

## Текущий фокус
Завершён coding-phase scaffold baseline: CLI, runtime contracts, lifecycle skeleton, registry/profiles, reporter/output contracts, tx-plan contracts.

## Следующий шаг
Перейти к поэтапной реализации реальных checks/RPC adapters, сохраняя runtime semantics PASS/FAIL/SKIPPED и guard-инварианты.

## Открытые вопросы
- Нужна ли отдельная CI-метрика по доле SKIPPED checks (информативно, без блокировки)?
- Когда фиксировать стабильную schema-версию report.json (v1)?

## Последние решения
- Legacy WARN не блокирует scaffold; baseline в коде строго PASS/FAIL/SKIPPED.
- non-blocking FAIL запрещён runtime guard'ом.
- PASS при degradation=true запрещён runtime guard'ом.
## Последние решения
- Для scaffold baseline non-blocking FAIL запрещён.
- Non-blocking проверки возвращают только PASS или SKIPPED.
- SKIPPED всегда сопровождается reason_code/details и не считается PASS.
