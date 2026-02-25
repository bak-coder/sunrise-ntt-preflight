#!/usr/bin/env bash
set -euo pipefail

# demo-mock-flow.sh
# Runs deterministic mock narrative:
# broken -> verify -> plan -> fixed -> re-verify
# No real RPC/on-chain reads; uses local JSON-RPC mock server.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACT_ROOT="${ROOT_DIR}/artifacts/demo-mock-flow"
BROKEN_OUT="${ARTIFACT_ROOT}/1-broken-verify"
PLAN_OUT="${ARTIFACT_ROOT}/2-plan"
FIXED_OUT="${ARTIFACT_ROOT}/3-fixed-verify"

BROKEN_FIXTURE="${ROOT_DIR}/fixtures/mock-chain-peer-state-broken.json"
FIXED_FIXTURE="${ROOT_DIR}/fixtures/mock-chain-peer-state-pass.json"
CONFIG_FIXTURE="${ROOT_DIR}/fixtures/sample-ntt.json"
RPC_URL="http://127.0.0.1:18890"

echo "STEP 0/4: Preparing environment"
mkdir -p "${BROKEN_OUT}" "${PLAN_OUT}" "${FIXED_OUT}"

echo "STEP 0/4: Building CLI"
npm --prefix "${ROOT_DIR}" run build >/dev/null

echo "STEP 0/4: Starting local mock RPC server (${RPC_URL})"
node -e "const http=require('http'); const server=http.createServer((req,res)=>{req.on('data',()=>{}); req.on('end',()=>{res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({jsonrpc:'2.0',id:'mock',result:'ok'}));});}); server.listen(18890,()=>console.log('mock-rpc-ready')); setInterval(()=>{},1<<30);" >/tmp/ntt-preflight-mock-rpc.log 2>&1 &
MOCK_RPC_PID=$!
cleanup() {
  kill "${MOCK_RPC_PID}" >/dev/null 2>&1 || true
}
trap cleanup EXIT
sleep 0.2

echo "STEP 1/4: Verify broken mock fixture (expect FAIL with CHK-007/CHK-008)"
node "${ROOT_DIR}/dist/index.js" verify \
  --profile ntt-generic \
  --rpc-url "${RPC_URL}" \
  --config "${CONFIG_FIXTURE}" \
  --mock-chain "${BROKEN_FIXTURE}" \
  --output "${BROKEN_OUT}" >/dev/null

node -e "const fs=require('fs'); const p=process.argv[1]; const report=JSON.parse(fs.readFileSync(p,'utf8')); const byId=Object.fromEntries(report.results.map(r=>[r.check_id,r])); if(!report.summary.ci_should_fail){console.error('Expected broken scenario ci_should_fail=true'); process.exit(1);} if(byId['CHK-007-peer-registration-symmetry-mock']?.status!=='FAIL'){console.error('Expected CHK-007 FAIL in broken scenario'); process.exit(1);} if(byId['CHK-008-decimals-sync-mock']?.status!=='FAIL'){console.error('Expected CHK-008 FAIL in broken scenario'); process.exit(1);} console.log('broken-verify-ok');" "${BROKEN_OUT}/report.json" >/dev/null

echo "STEP 2/4: Generate plan from broken scenario (expect actionable steps)"
node "${ROOT_DIR}/dist/index.js" plan \
  --profile ntt-generic \
  --rpc-url "${RPC_URL}" \
  --config "${CONFIG_FIXTURE}" \
  --mock-chain "${BROKEN_FIXTURE}" \
  --output "${PLAN_OUT}" >/dev/null

node -e "const fs=require('fs'); const p=process.argv[1]; const plan=JSON.parse(fs.readFileSync(p,'utf8')); const ids=plan.steps.map(s=>s.id); if(!ids.includes('fix-CHK-007-peer-registration-symmetry-mock')){console.error('Expected CHK-007 action step in plan'); process.exit(1);} if(!ids.includes('fix-CHK-008-decimals-sync-mock')){console.error('Expected CHK-008 action step in plan'); process.exit(1);} console.log('plan-ok');" "${PLAN_OUT}/tx-plan.json" >/dev/null

echo "STEP 3/4: Verify fixed mock fixture (expect READY-style green)"
node "${ROOT_DIR}/dist/index.js" verify \
  --profile ntt-generic \
  --rpc-url "${RPC_URL}" \
  --config "${CONFIG_FIXTURE}" \
  --mock-chain "${FIXED_FIXTURE}" \
  --output "${FIXED_OUT}" >/dev/null

node -e "const fs=require('fs'); const p=process.argv[1]; const report=JSON.parse(fs.readFileSync(p,'utf8')); const byId=Object.fromEntries(report.results.map(r=>[r.check_id,r])); if(report.summary.ci_should_fail){console.error('Expected fixed scenario ci_should_fail=false'); process.exit(1);} if(byId['CHK-007-peer-registration-symmetry-mock']?.status!=='PASS'){console.error('Expected CHK-007 PASS in fixed scenario'); process.exit(1);} if(byId['CHK-008-decimals-sync-mock']?.status!=='PASS'){console.error('Expected CHK-008 PASS in fixed scenario'); process.exit(1);} console.log('fixed-verify-ok');" "${FIXED_OUT}/report.json" >/dev/null

echo "STEP 4/4: Demo summary"
echo "- Broken report: ${BROKEN_OUT}/report.json"
echo "- Plan artifact: ${PLAN_OUT}/tx-plan.md"
echo "- Fixed report: ${FIXED_OUT}/report.json"
echo "READY: mock narrative succeeded (broken -> plan -> fixed)."
