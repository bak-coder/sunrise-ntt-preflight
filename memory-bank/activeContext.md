# Active Context
_Обновлено: 2026-02-25_

## Текущий фокус
Phase 2 / Iteration 2.1 завершена: реализован один real deterministic check (CHK-001) через read-only adapter contracts.

## Следующий шаг
Iteration 2.2: добавить следующий минимальный real check (или расширить CHK-001 до domain-level assertions), не меняя runtime semantics и guard-инварианты.

## Последние решения
- Source of truth по статусам сохранён: PASS/FAIL/SKIPPED only.
- Legacy WARN в старых заметках не используется для runtime semantics.
- EVM источник пока оставлен как adapter contract/stub с TODO, без сетевой интеграции.