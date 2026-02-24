# SOURCES_LOCK.md — Pinned Sources

> ⚠️ Перед сабмитом хакатона: обновить `verified_at`, перепроверить live endpoints, chain support и версии.

---

## Repositories (pinned by tag/commit)

| Repo | Pin | Level | Drift Risk | Re-check |
|------|-----|-------|------------|---------|
| `wormhole-foundation/native-token-transfers` | tag `v1.5.0+cli` | **source-of-truth** (protocol) | Medium — CLI evolves | `git tag`, check releases |
| `wormhole-foundation/demo-ntt-ts-sdk` | branch `main` ⚠️ | example/reference | High — examples change | pin to commit before release |
| `wormholelabs-xyz/example-messaging-executor` | branch `main` ⚠️ | API spec reference | Medium | check `api-docs/` folder |
| `wormhole-foundation/demo-ntt-solana-multisig-tools` | branch `main` ⚠️ | secondary example | High | verify IDL matches NTT version |

**How to pin before submission:**
```bash
# Get current commit SHA:
git ls-remote https://github.com/wormhole-foundation/native-token-transfers refs/tags/v1.5.0+cli
# → update table above with SHA
```

---

## Documentation URLs

| URL | Content | Level | Verified At |
|-----|---------|-------|-------------|
| `https://wormhole.com/docs/protocol/infrastructure-guides/ntt-executor/` | NTT + Executor integration guide | **official docs** | 2026-01 |
| `https://wormhole.com/docs/products/token-transfers/native-token-transfers/guides/troubleshoot/` | NTT troubleshooting | official docs | 2026-01 |
| `https://wormhole.com/docs/products/token-transfers/native-token-transfers/reference/manager/solana/` | Solana NTT Manager reference | official docs | 2026-01 |
| `https://wormhole.com/docs/products/token-transfers/native-token-transfers/reference/cli-commands/` | NTT CLI commands | official docs | 2026-01 |
| `https://wormhole.com/docs/products/reference/chain-ids/` | Wormhole Chain IDs | official docs | 2026-01 |
| `https://wormhole.com/docs/products/reference/executor-addresses/` | Executor addresses | official docs | 2026-01 |
| `https://docs.solana.com/clusters` | Solana clusters + RPC | official docs | 2026-01 |
| `https://www.anchor-lang.com/docs` | Anchor framework | official docs | 2026-01 |

---

## Live Endpoints

| Endpoint | Environment | Level | Drift Risk |
|----------|-------------|-------|------------|
| `https://executor-testnet.labsapis.com/v0/capabilities` | dev/test | live API | **HIGH** — schema may change |
| `https://executor.labsapis.com/v0/capabilities` | production | live API | **HIGH** |
| `https://api.devnet.solana.com` | Solana devnet | live RPC | Low — stable |
| `https://api.mainnet-beta.solana.com` | Solana mainnet | live RPC | Low |

**Pre-submission checklist for live endpoints:**
- [ ] Fetch `/v0/capabilities` testnet and compare against `LIVE_ENDPOINT_SNAPSHOTS/capabilities-testnet.json`
- [ ] Verify chain IDs in response still match `ADDRESSES_AND_IDS.md`
- [ ] Check `requestPrefixes` still includes `"ERN1"` for destination chains

---

## Version Compatibility

| Tool | Version Used | Where Specified | Check Before Release |
|------|-------------|-----------------|----------------------|
| Solana CLI | v1.18.26 | Docker image, NTT guide | `solana --version` |
| Anchor | v0.29.0 | Docker image, NTT guide | `anchor --version` |
| NTT CLI | v1.5.0+cli | tag pin above | `ntt --version` |
| Bun | v1.2.23 | NTT install instructions | `bun --version` |
| @solana/kit | latest | `npm i @solana/kit` | check package.json |

---

## How to re-verify before submission

```bash
# 1. Check capabilities live response
curl https://executor-testnet.labsapis.com/v0/capabilities | jq .

# 2. Compare with snapshot
diff <(curl -s https://executor-testnet.labsapis.com/v0/capabilities | jq -S .) \
     <(jq -S . live-endpoint-snapshots/capabilities-testnet.json)

# 3. Check NTT CLI version
ntt --version

# 4. Verify chain IDs haven't changed
curl https://wormhole.com/docs/products/reference/chain-ids/ | grep -A2 "Solana"
```
