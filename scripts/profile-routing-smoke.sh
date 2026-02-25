#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACT_ROOT="${ROOT_DIR}/artifacts/profile-routing-smoke"
GENERIC_OUT="${ARTIFACT_ROOT}/generic"
EXECUTOR_OUT="${ARTIFACT_ROOT}/executor"

CONFIG_FIXTURE="${ROOT_DIR}/fixtures/sample-ntt-missing-executor-transceiver.json"
MOCK_CHAIN_FIXTURE="${ROOT_DIR}/fixtures/mock-chain-peer-state-broken.json"
QUOTE_FIXTURE="${ROOT_DIR}/fixtures/executor-quote-invalid-shape.json"
RPC_URL="http://127.0.0.1:65535"
EXECUTOR_URL="mock://executor/capabilities/missing-field"

mkdir -p "${GENERIC_OUT}" "${EXECUTOR_OUT}"

echo "STEP 0/3: Building CLI"
npm --prefix "${ROOT_DIR}" run build >/dev/null

echo "STEP 1/3: Verify routing smoke (same fixture, different profiles)"
node "${ROOT_DIR}/dist/index.js" verify \
  --profile ntt-generic \
  --rpc-url "${RPC_URL}" \
  --config "${CONFIG_FIXTURE}" \
  --mock-chain "${MOCK_CHAIN_FIXTURE}" \
  --executor-url "${EXECUTOR_URL}" \
  --executor-quote-path "${QUOTE_FIXTURE}" \
  --output "${GENERIC_OUT}" >/dev/null

node "${ROOT_DIR}/dist/index.js" verify \
  --profile sunrise-executor \
  --rpc-url "${RPC_URL}" \
  --config "${CONFIG_FIXTURE}" \
  --mock-chain "${MOCK_CHAIN_FIXTURE}" \
  --executor-url "${EXECUTOR_URL}" \
  --executor-quote-path "${QUOTE_FIXTURE}" \
  --output "${EXECUTOR_OUT}" >/dev/null

node -e "const fs=require('fs'); const g=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const e=JSON.parse(fs.readFileSync(process.argv[2],'utf8')); const gIds=new Set(g.results.map(r=>r.check_id)); const eIds=new Set(e.results.map(r=>r.check_id)); const executorIds=['CHK-009-executor-endpoint-reachability','CHK-010-executor-relay-capabilities','CHK-011-executor-transceiver-config-presence','CHK-012-executor-quote-sanity','CHK-013-compute-budget-sanity']; for(const id of executorIds){ if(gIds.has(id)){ console.error('ntt-generic should not include '+id); process.exit(1);} if(!eIds.has(id)){ console.error('sunrise-executor should include '+id); process.exit(1);} } if(e.results.length<=g.results.length){ console.error('Expected sunrise-executor to run more checks than ntt-generic'); process.exit(1);} console.log('verify-routing-ok');" "${GENERIC_OUT}/report.json" "${EXECUTOR_OUT}/report.json" >/dev/null

echo "STEP 2/3: Plan routing smoke (same fixture, different profiles)"
node "${ROOT_DIR}/dist/index.js" plan \
  --profile ntt-generic \
  --rpc-url "${RPC_URL}" \
  --config "${CONFIG_FIXTURE}" \
  --mock-chain "${MOCK_CHAIN_FIXTURE}" \
  --executor-url "${EXECUTOR_URL}" \
  --executor-quote-path "${QUOTE_FIXTURE}" \
  --output "${GENERIC_OUT}" >/dev/null

node "${ROOT_DIR}/dist/index.js" plan \
  --profile sunrise-executor \
  --rpc-url "${RPC_URL}" \
  --config "${CONFIG_FIXTURE}" \
  --mock-chain "${MOCK_CHAIN_FIXTURE}" \
  --executor-url "${EXECUTOR_URL}" \
  --executor-quote-path "${QUOTE_FIXTURE}" \
  --output "${EXECUTOR_OUT}" >/dev/null

node -e "const fs=require('fs'); const g=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const e=JSON.parse(fs.readFileSync(process.argv[2],'utf8')); const gIds=new Set(g.steps.map(s=>s.id)); const eIds=new Set(e.steps.map(s=>s.id)); const genericForbidden=['fix-CHK-010-executor-relay-capabilities','fix-CHK-011-executor-transceiver-config-presence','fix-CHK-012-executor-quote-sanity','fix-CHK-013-compute-budget-sanity']; for(const id of genericForbidden){ if(gIds.has(id)){ console.error('ntt-generic plan should not include '+id); process.exit(1);} } const executorRequired=['fix-CHK-010-executor-relay-capabilities','fix-CHK-012-executor-quote-sanity']; for(const id of executorRequired){ if(!eIds.has(id)){ console.error('sunrise-executor plan should include '+id); process.exit(1);} } console.log('plan-routing-ok');" "${GENERIC_OUT}/tx-plan.json" "${EXECUTOR_OUT}/tx-plan.json" >/dev/null

echo "STEP 3/3: Summary"
echo "- Generic verify: ${GENERIC_OUT}/report.json"
echo "- Executor verify: ${EXECUTOR_OUT}/report.json"
echo "- Generic plan: ${GENERIC_OUT}/tx-plan.json"
echo "- Executor plan: ${EXECUTOR_OUT}/tx-plan.json"
echo "READY: profile routing behaves as expected."
