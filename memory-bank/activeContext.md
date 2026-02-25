# Active Context
_Обновлено: 2026-02-25_

## Текущий фокус
Phase 3 / Iteration 3.1 завершена: реализован mock-first вертикальный срез CHK-007 (peer-registration symmetry) с root-cause evidence.

## Следующий шаг
Перейти к следующему mock-first шагу (CHK-008 decimals mismatch) на том же fixture model, без real RPC path в этой фазе.

## Открытые вопросы
- Когда переключать CHK-007 с mock-only на hybrid/mock+real path без нарушения deterministic core?
- Как формально зафиксировать local chain derivation policy для symmetry checks (сейчас: `solana` в mock-slice)?

## Последние решения
- CHK-007 остаётся mock-chain only в Iteration 3.1.
- Runtime model и runtime guards не менялись.
- Fixture schema для `registrations[]` признана базой для CHK-007 и будущего CHK-008.