# Active Context
_Обновлено: 2026-02-25_

## Текущий фокус
Phase 3 / Iteration 3.4 завершена: добавлен repeatable mock demo-flow script (broken -> verify -> plan -> fixed -> re-verify -> READY).

## Следующий шаг
Подготовить следующий шаг mock-first/real-transition без изменения runtime semantics/guards и без tx execution.

## Открытые вопросы
- Когда выводить demo script в README quickstart (отдельный короткий блок)?
- Нужно ли параметризовать script fixture paths для разных demo-сценариев?

## Последние решения
- Demo orchestration остаётся mock-only и read-only.
- Использованы существующие CHK-007/008 и plan mapping без расширения логики.