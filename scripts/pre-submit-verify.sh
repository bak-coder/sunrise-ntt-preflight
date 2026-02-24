#!/usr/bin/env bash
# scripts/pre-submit-verify.sh
# ─────────────────────────────────────────────────────────────────────────────
# One command to run before demo recording and hackathon submission.
# Checks: tool versions | live endpoints | schema validation | fixture smoke
#
# Usage:
#   bash scripts/pre-submit-verify.sh
#   bash scripts/pre-submit-verify.sh --testnet   (default)
#   bash scripts/pre-submit-verify.sh --mainnet   (production check)
#
# Requirements: curl, jq, node (for schema validation)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
# Flags:
#   --testnet           Use testnet endpoint (default)
#   --mainnet           Use mainnet endpoint
#   --write-snapshots   Update live-endpoint-snapshots/ after curl (default: OFF)
#   --no-write          Explicitly disable snapshot writing (CI default)
#
# In CI, pass --no-write to avoid unexpected git diff.
# Locally, pass --write-snapshots to refresh snapshots before demo recording.
#
# Example CI usage:
#   bash scripts/pre-submit-verify.sh --testnet --no-write
# Example local usage:
#   bash scripts/pre-submit-verify.sh --testnet --write-snapshots

NETWORK="--testnet"
WRITE_SNAPSHOTS="no"  # OFF by default — prevents unexpected git diff in CI

for arg in "$@"; do
  case "$arg" in
    --mainnet)        NETWORK="--mainnet" ;;
    --testnet)        NETWORK="--testnet" ;;
    --write-snapshots) WRITE_SNAPSHOTS="yes" ;;
    --no-write)       WRITE_SNAPSHOTS="no" ;;
    *) echo "Unknown flag: $arg. Valid: --testnet --mainnet --write-snapshots --no-write"; exit 1 ;;
  esac
done
if [[ "$NETWORK" == "--mainnet" ]]; then
  EXECUTOR_URL="https://executor.labsapis.com"
  EXECUTOR_ENV="mainnet"
else
  EXECUTOR_URL="https://executor-testnet.labsapis.com"
  EXECUTOR_ENV="testnet"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SNAPSHOT_FILE="$REPO_ROOT/live-endpoint-snapshots/capabilities-${EXECUTOR_ENV}.json"
SCHEMA_FILE="$REPO_ROOT/schemas/executor-capabilities.schema.json"
FIXTURES_DIR="$REPO_ROOT/fixtures"

REQUIRED_NTT_TAG="v1.5.0+cli"
REQUIRED_SOLANA_VERSION="1.18.26"
REQUIRED_ANCHOR_VERSION="0.29.0"
REQUIRED_BUN_VERSION="1.2.23"

# Chain IDs that MUST have ERN1 in requestPrefixes
REQUIRED_CHAINS=("1" "2" "23" "30")  # Solana, Ethereum, Arbitrum, Base

PASS=0
WARN=0
FAIL=0

# ── Helpers ──────────────────────────────────────────────────────────────────
green()  { echo -e "  \033[32m✅ PASS\033[0m  $*"; }
yellow() { echo -e "  \033[33m⚠️  WARN\033[0m  $*"; }
red()    { echo -e "  \033[31m❌ FAIL\033[0m  $*"; }
info()   { echo -e "  \033[34mℹ️\033[0m  $*"; }
header() { echo -e "\n\033[1m$*\033[0m"; }

check_pass() { green "$1"; PASS=$((PASS + 1)); }
check_warn() { yellow "$1"; WARN=$((WARN + 1)); }
check_fail() { red "$1"; FAIL=$((FAIL + 1)); }

require_command() {
  if ! command -v "$1" &>/dev/null; then
    check_fail "Command not found: $1 (required for this check)"
    return 1
  fi
}

# ── 1. Tool Versions ─────────────────────────────────────────────────────────
header "1. TOOL VERSIONS"

# Solana CLI
if require_command solana; then
  ACTUAL=$(solana --version 2>/dev/null | grep -oP '\d+\.\d+\.\d+' | head -1 || echo "unknown")
  if [[ "$ACTUAL" == "$REQUIRED_SOLANA_VERSION" ]]; then
    check_pass "solana-cli $ACTUAL"
  else
    check_warn "solana-cli $ACTUAL (expected $REQUIRED_SOLANA_VERSION)"
  fi
fi

# Anchor
if require_command anchor; then
  ACTUAL=$(anchor --version 2>/dev/null | grep -oP '\d+\.\d+\.\d+' | head -1 || echo "unknown")
  if [[ "$ACTUAL" == "$REQUIRED_ANCHOR_VERSION" ]]; then
    check_pass "anchor $ACTUAL"
  else
    check_warn "anchor $ACTUAL (expected $REQUIRED_ANCHOR_VERSION)"
  fi
fi

# Bun
if command -v bun &>/dev/null; then
  ACTUAL=$(bun --version 2>/dev/null | head -1 || echo "unknown")
  if [[ "$ACTUAL" == "$REQUIRED_BUN_VERSION" ]]; then
    check_pass "bun $ACTUAL"
  else
    check_warn "bun $ACTUAL (expected $REQUIRED_BUN_VERSION)"
  fi
else
  info "bun not found — checking node fallback"
  if require_command node; then
    ACTUAL=$(node --version 2>/dev/null | head -1 || echo "unknown")
    if [[ "$ACTUAL" > "v18" ]]; then
      check_pass "node $ACTUAL (≥ v18 ✓)"
    else
      check_warn "node $ACTUAL (expected ≥ v18)"
    fi
  fi
fi

# NTT CLI
if command -v ntt &>/dev/null; then
  ACTUAL=$(ntt --version 2>/dev/null | head -1 || echo "unknown")
  if echo "$ACTUAL" | grep -q "1.5.0"; then
    check_pass "ntt-cli: $ACTUAL"
  else
    check_warn "ntt-cli: $ACTUAL (expected $REQUIRED_NTT_TAG)"
  fi
else
  check_warn "ntt-cli not found — needed for demo-setup.sh"
fi

# jq (required for this script)
if command -v jq &>/dev/null; then
  check_pass "jq $(jq --version 2>/dev/null)"
else
  check_fail "jq not found — required for capabilities snapshot parsing"
fi

# ── 2. NTT Repo Tag Check ────────────────────────────────────────────────────
header "2. REPOSITORY TAGS"

if require_command git; then
  # Check if we're inside NTT repo or can query it
  NTT_TAG_SHA=$(git ls-remote --tags \
    https://github.com/wormhole-foundation/native-token-transfers \
    "refs/tags/${REQUIRED_NTT_TAG}" 2>/dev/null | awk '{print $1}' || echo "")

  if [[ -n "$NTT_TAG_SHA" ]]; then
    check_pass "native-token-transfers tag $REQUIRED_NTT_TAG exists → SHA: ${NTT_TAG_SHA:0:12}..."
    info "Update SOURCES_LOCK.md with this SHA if not already pinned"
  else
    check_warn "Could not verify tag $REQUIRED_NTT_TAG (network or auth issue)"
  fi
fi

# ── 3. Live Executor Endpoint ────────────────────────────────────────────────
header "3. LIVE EXECUTOR ENDPOINT ($EXECUTOR_ENV)"
info "Fetching: $EXECUTOR_URL/v0/capabilities"

HTTP_CODE=$(curl -s -o /tmp/caps_response.json -w "%{http_code}" \
  --max-time 10 "$EXECUTOR_URL/v0/capabilities" 2>/dev/null || echo "000")

if [[ "$HTTP_CODE" == "200" ]]; then
  check_pass "GET /v0/capabilities → HTTP $HTTP_CODE"

  # Validate it's a JSON object (chain-keyed)
  if jq -e 'type == "object"' /tmp/caps_response.json >/dev/null 2>&1; then
    check_pass "Response is JSON object (chain-keyed schema)"

    # Check required chains have ERN1
    ALL_CHAINS_OK=true
    for CHAIN_ID in "${REQUIRED_CHAINS[@]}"; do
      ERN1_PRESENT=$(jq -r --arg c "$CHAIN_ID" \
        'if .[$c].requestPrefixes then (.[$c].requestPrefixes | index("ERN1") != null) else false end' \
        /tmp/caps_response.json 2>/dev/null || echo "false")

      if [[ "$ERN1_PRESENT" == "true" ]]; then
        check_pass "Chain $CHAIN_ID: requestPrefixes includes ERN1 ✓"
      else
        CHAIN_ENTRY=$(jq -r --arg c "$CHAIN_ID" 'if .[$c] then "found" else "MISSING" end' \
          /tmp/caps_response.json 2>/dev/null || echo "error")
        if [[ "$CHAIN_ENTRY" == "MISSING" ]]; then
          check_warn "Chain $CHAIN_ID: NOT in capabilities response (chain may not be supported yet)"
        else
          check_fail "Chain $CHAIN_ID: entry found but ERN1 NOT in requestPrefixes"
        fi
        ALL_CHAINS_OK=false
      fi
    done

    # Update snapshot (only if --write-snapshots flag passed)
    if $ALL_CHAINS_OK; then
      if [[ "$WRITE_SNAPSHOTS" == "yes" ]]; then
        TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        jq --arg ts "$TIMESTAMP" --arg env "$EXECUTOR_ENV" --arg url "$EXECUTOR_URL/v0/capabilities" \
          '{_meta: {endpoint: $url, environment: $env, captured_at: $ts, WARNING: "Live response — schema and supported chains may change. Re-fetch before submission."}} + .' \
          /tmp/caps_response.json > "$SNAPSHOT_FILE" 2>/dev/null || \
          cp /tmp/caps_response.json "$SNAPSHOT_FILE"
        check_pass "Snapshot written → $SNAPSHOT_FILE (--write-snapshots)"
      else
        check_pass "Live response OK — snapshot NOT written (pass --write-snapshots to update)"
        info "To refresh: bash scripts/pre-submit-verify.sh --write-snapshots"
      fi
    else
      check_warn "Snapshot NOT updated due to ERN1 check failures above"
    fi
  else
    check_fail "Response is not a JSON object — schema may have changed!"
    info "Raw response: $(cat /tmp/caps_response.json | head -c 200)"
  fi
else
  check_fail "GET /v0/capabilities → HTTP $HTTP_CODE (endpoint unreachable)"
  info "Check network access to $EXECUTOR_URL"
fi

# ── 4. Schema Validation ────────────────────────────────────────────────────
header "4. SCHEMA VALIDATION"

if [[ -f "$SNAPSHOT_FILE" ]]; then
  # Basic schema check without ajv (check key presence in JSON)
  CHAIN_COUNT=$(jq '[keys[] | select(test("^[0-9]+$"))] | length' "$SNAPSHOT_FILE" 2>/dev/null || echo "0")
  if [[ "$CHAIN_COUNT" -gt 0 ]]; then
    check_pass "Snapshot has $CHAIN_COUNT chain entries (numeric keys)"

    # Verify required fields in first chain entry
    FIRST_CHAIN=$(jq -r '[keys[] | select(test("^[0-9]+$"))] | .[0]' "$SNAPSHOT_FILE" 2>/dev/null || echo "")
    if [[ -n "$FIRST_CHAIN" ]]; then
      FIELDS_OK=$(jq -r --arg c "$FIRST_CHAIN" \
        'if (.[$c].requestPrefixes and .[$c].gasDropOffLimit and .[$c].maxGasLimit and .[$c].maxMsgValue) then "ok" else "missing" end' \
        "$SNAPSHOT_FILE" 2>/dev/null || echo "error")
      if [[ "$FIELDS_OK" == "ok" ]]; then
        check_pass "Schema fields present: requestPrefixes, gasDropOffLimit, maxGasLimit, maxMsgValue"
      else
        check_fail "Schema fields missing in chain entry $FIRST_CHAIN — schema may have changed"
        info "Expected: requestPrefixes, gasDropOffLimit, maxGasLimit, maxMsgValue"
        info "Actual entry: $(jq --arg c "$FIRST_CHAIN" '.[$c]' "$SNAPSHOT_FILE" 2>/dev/null)"
      fi
    fi
  else
    check_fail "Snapshot has no numeric chain ID keys — wrong schema!"
  fi

  # Full ajv validation if available
  if command -v ajv &>/dev/null 2>&1; then
    if ajv validate -s "$SCHEMA_FILE" -d "$SNAPSHOT_FILE" --errors=text 2>/dev/null; then
      check_pass "ajv schema validation PASSED"
    else
      check_fail "ajv schema validation FAILED — update schema or fix snapshot"
    fi
  else
    info "ajv not installed — skipping full JSON Schema validation"
    info "Install: npm i -g ajv-cli | then re-run"
  fi
else
  check_warn "No snapshot file at $SNAPSHOT_FILE — run live endpoint check first"
fi

# ── 5. Fixture Smoke Check ───────────────────────────────────────────────────
header "5. FIXTURE SMOKE CHECK"

# Check broken-state.json
BROKEN_FIXTURE="$FIXTURES_DIR/broken-state.json"
if [[ -f "$BROKEN_FIXTURE" ]]; then
  # Verify it has null peer (key failure pattern)
  PEER_IS_NULL=$(jq -r '.solanaState.nttManagerPeer_Base == null' "$BROKEN_FIXTURE" 2>/dev/null || echo "unknown")
  if [[ "$PEER_IS_NULL" == "true" ]]; then
    check_pass "broken-state.json: nttManagerPeer_Base is null (PeerNotRegistered scenario ✓)"
  else
    check_warn "broken-state.json: nttManagerPeer_Base not null — fixture may not simulate PeerNotRegistered"
  fi

  # Verify capabilities use chain-keyed schema (not old supported_chains array)
  OLD_SCHEMA=$(jq -r 'if .executorApi.capabilities.supported_chains then "old" else "ok" end' \
    "$BROKEN_FIXTURE" 2>/dev/null || echo "error")
  if [[ "$OLD_SCHEMA" == "old" ]]; then
    check_fail "broken-state.json: capabilities uses OLD schema (supported_chains) — update to chain-keyed!"
  else
    check_pass "broken-state.json: capabilities uses chain-keyed schema ✓"
  fi
else
  check_warn "broken-state.json not found at $BROKEN_FIXTURE"
fi

# Check healthy-state.json
HEALTHY_FIXTURE="$FIXTURES_DIR/healthy-state.json"
if [[ -f "$HEALTHY_FIXTURE" ]]; then
  PEER_IS_REGISTERED=$(jq -r '.solanaState.nttManagerPeer_Base != null' "$HEALTHY_FIXTURE" 2>/dev/null || echo "unknown")
  if [[ "$PEER_IS_REGISTERED" == "true" ]]; then
    check_pass "healthy-state.json: nttManagerPeer_Base is registered ✓"
  else
    check_warn "healthy-state.json: nttManagerPeer_Base is null — should be registered in healthy state"
  fi
else
  check_warn "healthy-state.json not found at $HEALTHY_FIXTURE"
fi

# ── 6. Summary ───────────────────────────────────────────────────────────────
header "SUMMARY"
echo ""
echo "  ✅ PASS:  $PASS"
echo "  ⚠️  WARN:  $WARN"
echo "  ❌ FAIL:  $FAIL"
echo ""

if [[ "$FAIL" -gt 0 ]]; then
  echo "  🔴 NOT READY — fix FAIL items before submission"
  exit 1
elif [[ "$WARN" -gt 0 ]]; then
  echo "  🟡 MOSTLY READY — review WARN items (acceptable for demo, not for mainnet)"
  exit 0
else
  echo "  🟢 READY — all checks passed"
  exit 0
fi
