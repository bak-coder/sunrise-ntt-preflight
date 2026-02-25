# Active Context
_Обновлено: 2026-02-25_

## Текущий фокус
Phase 2 / Iteration 2.6 завершена: добавлен CHK-006 для shape-sanity ключей в top-level `peers` mapping (domain-level deterministic check).

## Следующий шаг
Выбрать следующий узкий intent invariant без schema-engine и без изменения runtime semantics/guards (PASS/FAIL/SKIPPED).

## Открытые вопросы
- Когда и как расширять key/path policy beyond top-level `peers` без scope creep?
- Нужна ли отдельная policy для normalization vs strictness по peer keys в будущем?

## Последние решения
- CHK-006 использует только ConfigSourceAdapter, без RPC.
- Runtime guards/contracts не менялись.
- Legacy WARN не влияет на runtime model.