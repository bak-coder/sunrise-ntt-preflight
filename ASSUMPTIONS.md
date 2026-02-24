# ASSUMPTIONS.md — Preflight v1 Design Assumptions

> Документирует что считается истинным в v1, что никогда не даёт false PASS,
> и какие проверки детерминированы vs зависят от внешних источников.

---

## 1. Deterministic vs Non-Deterministic Checks

### Deterministic (never flaky — no external dependencies)

These checks are pure: input = ntt.json config + static constants.

| Check | Why deterministic |
|-------|------------------|
| `decimals-sync` | Reads on-chain account + ntt.json — fully deterministic |
| `mint-authority-policy` | Reads Solana account — deterministic |
| `rate-limit-sanity` | Reads Solana account — deterministic |
| `compute-budget-sanity [static]` | Compares config value against hardcoded constant |

### External-Dependent (may be affected by network/API state)

| Check | External Dependency | Failure Mode |
|-------|--------------------|-|
| `peer-registration` (EVM side) | EVM RPC | → `SKIPPED` (not `FAIL`) if unavailable |
| `executor-relay-capabilities` | Executor API `/v0/capabilities` | → TTL cache fallback |
| `executor-endpoint-reachability` | HTTP to executor endpoint | → `WARN` (not crash) |
| `executor-quote-sanity` | Executor API `/v0/quote` | → `WARN` if unavailable |
| `compute-budget-sanity [--deep]` | Solana RPC simulation | → experimental, not in default run |

---

## 2. SKIPPED vs FAIL vs WARN

| Status | Meaning | When |
|--------|---------|------|
| `FAIL` | Check ran and found a definitive problem | Account missing, decimals wrong, etc. |
| `WARN` | Non-blocking issue or uncertainty | Low gas limit, quote service unavailable |
| `SKIPPED` | Check could not run due to missing input | EVM RPC not provided, with explicit reason |
| `PASS` | Check ran and everything is correct | — |

**CRITICAL invariant: a check result is NEVER `SKIPPED` when it should be `FAIL`.**

Specifically:
- `peer-registration` Solana→Remote: if Solana RPC is available, this is always `PASS` or `FAIL`
- `peer-registration` Remote→Solana (reverse): can be `SKIPPED` if EVM RPC unavailable
- `executor-relay-capabilities`: can be `PASS (cached)` but never `PASS` when no data at all

---

## 3. False PASS Prevention

The following scenarios must NEVER produce a false PASS:

**EVM RPC unavailable:**
```
✅ CORRECT:
  ⚠️ WARN  peer-registration [partial]
           Base→Solana: SKIPPED (EVM RPC unavailable)
           → Run with --rpc-evm <url>

❌ WRONG:
  ✅ PASS  peer-registration  ← false PASS, peer might be missing
```

**Executor API unavailable (no cache):**
```
✅ CORRECT:
  ⚠️ WARN  executor-relay-capabilities
           Cannot verify: API unavailable and no cached data
           → Check manually before production deploy

❌ WRONG:
  ✅ PASS  executor-relay-capabilities  ← false PASS
```

**ABI fingerprint mismatch:**
```
✅ CORRECT:
  ⚠️ WARN  executor-transceiver-registration
           ABI mismatch: expected NTT v2.1.0, detected unknown
           → Verify NTT Manager version manually

❌ WRONG:
  ✅ PASS  executor-transceiver-registration  ← might be reading wrong fields
```

---

## 4. Exit Code Contract

```
exit 0  → All blocking checks PASS (warnings allowed)
exit 1  → At least one blocking check FAIL
```

`--fail-on` flag (GitHub Action):
```yaml
fail-on: blocking   # default — only FAIL on blocking
fail-on: all        # also FAIL on warnings
fail-on: none       # always exit 0 (report only)
```

---

## 5. Operator Safety Assumption

Preflight is **read-only**. It never:
- Signs transactions
- Touches private keys
- Submits transactions to chain
- Calls write functions on any program or contract

All tx-plan output is for the operator to review and execute manually (or via multisig).

---

## 6. Config (ntt.json) as Source of Intent

`ntt.json` = the operator's declared intent.
On-chain state = reality.
Preflight = diffs intent vs reality.

Preflight does NOT modify `ntt.json`. If a field is missing from `ntt.json`, Preflight
reports it as missing config (not as a deployment error).

---

## 7. Scope of v1

**In scope:**
- All 10 checks listed in CHECKS_REFERENCE.md
- `--profile sunrise-executor` and `--profile ntt-generic`
- Solana + EVM (read-only)
- `report.json`, `tx-plan.md`, `tx-plan.json`
- GitHub Action

**Out of scope for v1 (stretch):**
- `compute-budget-sanity --deep` (simulation mode)
- Historical state comparison
- Multi-chain deployments (>2 chains simultaneously)
- Sui / Aptos chains
- On-chain fix automation

---

## 8. Mock Mode Assumptions

`--mock-chain` mode:
- Loads `fixtures/broken-state.json` (or `--fixtures-path <file>`)
- Runs the exact same check engine as live mode
- The ONLY difference: RPC calls are replaced by fixture data
- Results must be identical to what a live run against that state would produce

This means: if fixture says `nttManagerPeer_Base: null` → check must return `FAIL peer-registration`.
No shortcuts, no hardcoded results in mock mode.
