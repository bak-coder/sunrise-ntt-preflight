# Active Context
_Обновлено: 2026-02-25_

## Текущий фокус
Phase 2 / Iteration P1 завершена: устранён false-green CI gap через execution-level required config precondition gate для verify.

## Следующий шаг
Продолжить узкие domain-level invariants, сохраняя PASS/FAIL/SKIPPED semantics и runtime guards без расширения schema/policy.

## Открытые вопросы
- Нужно ли аналогично формализовать precondition-gates для других критичных обязательных входов (без изменения check semantics)?
- Как документировать policy-layer vs check-layer поведение в README/CI usage note?

## Последние решения
- Для `ntt-generic` и `sunrise-executor` отсутствие/нечитаемость required config теперь фейлит execution до aggregation.
- CHK-001 semantics не менялись.
- Legacy WARN не влияет на runtime model.