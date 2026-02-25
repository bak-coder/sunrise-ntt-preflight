# Active Context
_Обновлено: 2026-02-25_

## Текущий фокус
Заполнение memory bank из финального спека v6. Проект определён полностью — архитектура, checks, профили, demo flow, скоуп. Готов к старту разработки.

## Следующий шаг
Bootstrap Gate пройден — все 4 ключевых файла заполнены. Следующее действие: декомпозиция скоупа на задачи и запуск первого субагента. Рекомендуемая точка входа — scaffolding CLI (entry point, профили, базовая структура check engine).

## Открытые вопросы
- Конкретный Node.js / TypeScript стек не зафиксирован явно — нужно подтверждение перед scaffolding
- Имя npm пакета / бинаря не определено (предположение: `ntt-preflight`)
- Где будет лежать Sunrise Executor endpoint URL — в `ntt.json` или hardcoded / env variable

## Последние решения
- v6 финализирован как source of truth для всего memory bank
- `compute-budget-sanity [static]` — в Core, `--deep` simulation — в Stretch
- Dual demo mode: devnet primary + `--mock-chain` fallback
- `fail-on: blocking` — warnings не блокируют PR в GitHub Action

# Active Context

## Обновлено
2026-02-25

## Текущий фокус
Финализация runtime semantics для scaffold baseline перед coding-фазой: PASS/FAIL/SKIPPED, без WARN, с запретом non-blocking FAIL.

## Следующий шаг
Запустить coding-фазу scaffold CLI с зафиксированным контрактом статусов и CI aggregation по (severity_class, status), без допуска false PASS.

## Открытые вопросы
- Нужен ли отдельный quality-metric по количеству SKIPPED в CI summary (информативно, без блокировки)?

## Последние решения
- Для scaffold baseline non-blocking FAIL запрещён.
- Non-blocking проверки возвращают только PASS или SKIPPED.
- SKIPPED всегда сопровождается reason_code/details и не считается PASS.
