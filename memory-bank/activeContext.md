# Active Context
_Обновлено: 2026-02-25_

## Текущий фокус
Phase 3 / Iteration 3.2 завершена: реализован CHK-008 (mock-first decimals-sync mismatch) на том же registrations[] fixture model, совместно с CHK-007.

## Следующий шаг
Сохранить mock-first траекторию для peer/decimals use-cases и подготовить переход к hybrid/mock+real path в следующих итерациях без изменения runtime semantics/guards.

## Открытые вопросы
- Когда и как вводить real path для CHK-007/008 при сохранении deterministic behavior и тех же reason-code контрактов?
- Нужна ли нормализация policy для local chain derivation beyond `solana` в mock slices?

## Последние решения
- CHK-008 работает только в mock-chain mode в Iteration 3.2.
- Fixture schema из CHK-007 переиспользована без redesign.
- Runtime model/guards не менялись.