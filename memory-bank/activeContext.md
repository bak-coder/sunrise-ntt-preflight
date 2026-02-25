# Active Context
_Обновлено: 2026-02-25_

## Текущий фокус
Phase 3 / Iteration 3.3 завершена: реализован mock-aware plan generation bridge (diagnostic -> actionable steps) для CHK-007/CHK-008.

## Следующий шаг
Подготовить расширение plan mapping на последующие checks, сохраняя mock-first режим и без перехода к tx execution.

## Открытые вопросы
- Когда и как расширять action mapping beyond CHK-007/008 без усложнения policy-слоя?
- Нужен ли явный приоритет/severity ordering для mixed actionable failures в будущем?

## Последние решения
- Plan generation остаётся read-only (без signing/sending).
- `tx-plan` строится из check results/evidence, без real RPC path additions.
- Runtime model/guards не менялись.