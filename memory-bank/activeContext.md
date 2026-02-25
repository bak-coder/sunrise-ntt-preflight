# Active Context
_Обновлено: 2026-02-25_

Текущий фокус: Phase 3 / Iteration 3.5.3 завершена — выполнен real rpc smoke для CHK-007 и подтверждена evidence-shape parity с mock mode.
Следующий шаг: при необходимости провести контролируемый real rpc FAIL-case smoke (без изменения логики) для демонстрации root-cause строки в live rpc path.
Открытые вопросы: нужен ли отдельный стабильный failing rpc target для repeatable CI/demo проверки FAIL-ветки CHK-007.

## Последние решения
- Demo orchestration остаётся mock-only и read-only.
- Использованы существующие CHK-007/008 и plan mapping без расширения логики.