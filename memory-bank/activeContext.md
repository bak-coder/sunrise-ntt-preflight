# Active Context
_Обновлено: 2026-02-25_

## Текущий фокус
Phase 2 / Iteration 2.5 завершена: добавлен CHK-005 для shape-sanity значений в top-level `peers` mapping (domain-level deterministic check).

## Следующий шаг
Выбрать следующий узкий intent invariant без schema-engine и без изменения runtime semantics/guards (PASS/FAIL/SKIPPED).

## Открытые вопросы
- Когда (и как) расширять `peers` path support beyond top-level без scope creep?
- Нужна ли отдельная policy-фиксация для stricter peer value validation (chain-aware) в будущих итерациях?

## Последние решения
- CHK-005 использует только ConfigSourceAdapter, без RPC.
- Runtime guards/contracts не менялись.
- Legacy WARN не влияет на runtime model.
