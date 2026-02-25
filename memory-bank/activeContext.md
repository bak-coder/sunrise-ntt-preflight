# Active Context
_Обновлено: 2026-02-25_

Текущий фокус: Phase 3 / Iteration 3.5.2 завершена — CHK-007 source routing (mock/rpc) реализован при стабильном check contract.
Следующий шаг: уточнить/закрепить authoritative chain-id mapping source + подготовить дальнейший real-path rollout без включения CHK-008 rpc в этот шаг.
Открытые вопросы: нужно ли централизовать chain-key → chain-id mapping перед production hardening.

## Последние решения
- Demo orchestration остаётся mock-only и read-only.
- Использованы существующие CHK-007/008 и plan mapping без расширения логики.