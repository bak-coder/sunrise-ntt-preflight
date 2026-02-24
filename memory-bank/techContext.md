# Tech Context

## Стек
- Runtime: Node.js (CLI) / TypeScript
- Solana: Anchor IDL для чтения on-chain аккаунтов (`NttManagerPeer`, transceiver registry)
- EVM: прямые RPC вызовы по адресам из `ntt.json` (peer registration, decimals)
- Wormhole RPC: для cross-chain данных где применимо
- GitHub Actions: YAML workflow

## Ключевые внешние зависимости

| Зависимость | Зачем | Resilience |
|---|---|---|
| Solana RPC (`--rpc-url`) | Читать on-chain аккаунты NTT Manager | Обязательный параметр |
| EVM RPC (`--rpc-evm`) | Проверять reverse peer registration | Graceful degradation → SKIPPED |
| Sunrise Executor `/v0/capabilities` | Проверять поддержку chain pair и relay mode | TTL-кеш + fixtures fallback |

## Конфигурация входа
- `ntt.json` — основной конфиг деплоя (intent source)
- `--profile sunrise-executor` / `ntt-generic`
- `--rpc-url` — Solana RPC (обязательный)
- `--rpc-evm` — EVM RPC (опциональный, без него peer-registration partial)
- `--mock-chain` — demo режим, читает fixtures
- `--show-raw-api-response` — выводит живой HTTP ответ Executor API
- `--deep` — включает simulation в compute-budget-sanity (experimental, stretch)
- `--output` — путь для tx-plan артефактов

## Форматы артефактов
- `report.json` — машиночитаемый полный отчёт
- `tx-plan.md` — человекочитаемый план с командами
- `tx-plan.json` — машиночитаемый план для автоматизации
- `fixtures/broken-state.json` — snapshot devnet для --mock-chain
- `fixtures/capabilities-response.json` — snapshot Executor API ответа

## Sunrise Executor API

Реальный ответ `/v0/capabilities` (зафиксирован из mainnet):
```json
{
  "supported_chains": ["Solana", "Base", "Arbitrum", "Monad"],
  "supported_relay_types": ["ERN1"],
  "status": "active"
}
```
TTL кеша: 1 час. При недоступности — используется закешированный ответ с явным timestamp.

## NTT Manager — ключевые on-chain структуры
- `NttManagerPeer[chainId]` — peer registration (Anchor IDL, Solana)
- `transceivers[address].enabled` — включён ли transceiver
- `transceivers[address].type` — тип релея (ERN1 для Sunrise Executor)
- ABI fingerprint: NTT Manager v2.1.0 (known, stable interface)

## GitHub Action конфигурация
```yaml
uses: your-org/ntt-preflight@v1
with:
  profile: sunrise-executor
  config: ./ntt.json
  rpc-url: ${{ secrets.SOLANA_RPC_URL }}
  fail-on: blocking   # blocking | all | none
```
Trigger: `paths: ntt.json` — запускается только при изменении конфига.

## Известные ограничения
- EVM RPC недоступность делает `peer-registration` частичным (Solana side only)
- `--deep` simulation может флакить на нестабильных RPC — поэтому изолирована от core
- Executor API TTL-кеш: данные могут быть до 1 часа устаревшими при недоступности endpoint
