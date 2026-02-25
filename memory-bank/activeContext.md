# Active Context
_Обновлено: 2026-02-25_

## Текущий фокус
Phase 2 / Iteration 2.4 завершена: добавлен domain-level deterministic check CHK-004 по presence peer/chain mapping в intent (`peers` non-empty).

## Следующий шаг
Определить следующий узкий NTT intent invariant (без full schema-engine), сохраняя PASS/FAIL/SKIPPED semantics и существующие runtime guards.

## Открытые вопросы
- Нужна ли в следующем шаге поддержка альтернативного naming для peer mappings (`peerMappings`/`chains`) или оставляем строго `peers` до стабилизации schema?
- Нужно ли нормализовать минимальный fixture contract для intent-level checks?
- CHK-001 policy gap: blocking + SKIPPED при отсутствии обязательного config (`ntt.json`) может давать false green CI (SKIPPED не фейлит CI).
- RPC error policy normalization: уточнить единые правила для timeout / transport / invalid response / node error-response (FAIL vs SKIPPED).

## Последние решения
- CHK-001/002/003 semantics не изменялись.
- Runtime model остаётся PASS/FAIL/SKIPPED only.
- Legacy WARN не используется для runtime model.
