# Active Context
_Обновлено: 2026-02-25_

## Текущий фокус
Phase 2 / Iteration 2.2 завершена: реализован первый real RPC-backed deterministic check (Solana RPC health) через adapter layer.

## Следующий шаг
Выбрать следующий минимальный domain-level check (NTT-specific) поверх уже работающих config + RPC readiness checks, не меняя runtime semantics и guards.

## Открытые вопросы
- Нужен ли в следующей итерации единый timeout flag для RPC adapters (без изменения core semantics)?
- Как унифицировать трактовку RPC node error-response: operational FAIL vs policy-based SKIPPED для отдельных checks?

## Последние решения
- Source of truth по статусам сохранён: PASS/FAIL/SKIPPED only.
- Legacy WARN в старых заметках не влияет на runtime model.
- CHK-001 policy gap не менялся в Iteration 2.2.
