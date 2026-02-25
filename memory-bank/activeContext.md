# Active Context
_Обновлено: 2026-02-25_

## Текущий фокус
Phase 2 / Iteration 2.3 завершена: добавлен первый domain-level deterministic check по NTT intent (`manager.solanaProgramId`) через существующий adapter layer.

## Следующий шаг
Выбрать следующий минимальный domain-level invariant (например peer/chain mapping presence) без full schema-engine и без изменения runtime semantics/guards.

## Открытые вопросы
- Должен ли формат manager.solanaProgramId оставаться regex-level invariant или перейти на более строгую chain-aware валидацию позже?
- Как постепенно расширять domain checks, не вводя full schema validator на ранней фазе?

## Последние решения
- Runtime model остаётся PASS/FAIL/SKIPPED only.
- CHK-001/CHK-002 semantics не менялись.
- Legacy WARN не используется для runtime model.