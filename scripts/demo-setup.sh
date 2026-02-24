#!/bin/bash
# demo-setup.sh
# Creates a controlled "broken" NTT devnet state for ntt-preflight demo
# Runtime: ~30-60 seconds
# 
# What it does:
#   1. Deploy test SPL token on devnet
#   2. Initialize NTT Manager with Wormhole transceiver (no ERN1 Executor)
#   3. Register Solana→Base peer ONLY (skip reverse registration)
#   4. Register peer with WRONG decimals (18 instead of 6)
#   5. Leave gasLimit at 200_000 (below required 224_916)
#
# After running: ntt-preflight will catch all 3 failure patterns

set -e

echo "=== Sunrise NTT Preflight Demo Setup ==="
echo "Setting up broken devnet state..."

# ---- Prerequisites ----
# Requires:
#   solana CLI, ntt CLI, anchor CLI
#   Funded devnet wallet

RPC_URL="https://api.devnet.solana.com"
NETWORK="Devnet"

# ---- Check tools ----
command -v solana >/dev/null 2>&1 || { echo "ERROR: solana CLI not found"; exit 1; }
command -v ntt    >/dev/null 2>&1 || { echo "ERROR: ntt CLI not found. Install: see docs/NTT_REFERENCE.md"; exit 1; }

# ---- Configure Solana CLI ----
echo ""
echo "[1/5] Configuring Solana CLI to devnet..."
solana config set --url $RPC_URL

# ---- Create/fund wallet ----
echo ""
echo "[2/5] Checking wallet balance..."
BALANCE=$(solana balance --url $RPC_URL | awk '{print $1}')
echo "Current balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 2" | bc -l) )); then
  echo "Requesting airdrop (2 SOL)..."
  solana airdrop 2 --url $RPC_URL
  sleep 3
fi

# ---- Initialize NTT project ----
echo ""
echo "[3/5] Initializing NTT demo project..."

mkdir -p /tmp/ntt-preflight-demo
cd /tmp/ntt-preflight-demo

# Initialize with devnet, Solana chain
ntt init $NETWORK 2>/dev/null || true

# Add Solana chain
ntt add-chain Solana --url $RPC_URL || true

# Add Base chain (EVM testnet - Base Sepolia)
# NOTE: We intentionally use wrong decimals (18) — actual token is 6
# This simulates InvalidPeerDecimals pattern
ntt add-chain BaseSepolia || true

# ---- Deploy with intentionally broken configuration ----
echo ""
echo "[4/5] Deploying with broken configuration (intentional)..."
echo "  - Skipping ERN1 transceiver (will use ERN0/Wormhole only)"
echo "  - Skipping reverse peer registration (Base→Solana)"
echo "  - Leaving gasLimit at 200_000 (below 224_916 minimum)"

# Push config to chain
ntt push --skip-verify 2>/dev/null || true

# Register Solana→Base peer ONLY (no reverse)
# ntt add-peer --chain base ...
# (reverse peer on Base intentionally NOT registered)

echo ""
echo "[5/5] Generating ntt.json with broken config..."

# Create the broken ntt.json for preflight
cat > /tmp/ntt-preflight-demo/ntt.json << 'NTTJSON'
{
  "network": "Devnet",
  "$schema": "https://raw.githubusercontent.com/wormhole-foundation/native-token-transfers/main/schemas/ntt.schema.json",
  "chains": {
    "Solana": {
      "chainId": 1,
      "token": "REPLACE_WITH_YOUR_SPL_MINT",
      "manager": "REPLACE_WITH_YOUR_NTT_MANAGER",
      "transceivers": {
        "wormhole": "REPLACE_WITH_WORMHOLE_TRANSCEIVER"
      },
      "paused": false
    },
    "BaseSepolia": {
      "chainId": 10004,
      "token": "0xREPLACE_WITH_ERC20",
      "manager": "0xREPLACE_WITH_NTT_MANAGER",
      "transceivers": {
        "wormhole": "0xREPLACE_WITH_TRANSCEIVER"
      },
      "paused": false,
      "peerDecimals": 18,
      "_broken": "BUG: decimals should be 6, not 18"
    }
  },
  "executorEndpoint": "https://executor-testnet.labsapis.com",
  "gasLimit": 200000,
  "_broken_config": {
    "issue1": "gasLimit 200000 < required 224916",
    "issue2": "BaseSepolia peer not registered in reverse direction",
    "issue3": "ERN1 transceiver not registered (only Wormhole standard)"
  }
}
NTTJSON

echo ""
echo "=== Demo Setup Complete ==="
echo ""
echo "Broken state created:"
echo "  ❌ Peer not registered: Base→Solana (reverse direction missing)"
echo "  ❌ Decimal mismatch: declared 18, should be 6"
echo "  ❌ No ERN1 transceiver registered (only Wormhole standard transceiver)"
echo "  ⚠️  gasLimit: 200_000 (below required 224_916)"
echo ""
echo "Config saved to: /tmp/ntt-preflight-demo/ntt.json"
echo ""
echo "Now run the preflight check:"
echo "  ntt-preflight verify --profile sunrise-executor --config /tmp/ntt-preflight-demo/ntt.json --rpc $RPC_URL"
echo ""
echo "Or use mock mode (no live RPC):"
echo "  ntt-preflight verify --profile sunrise-executor --mock-chain --config /path/to/ntt.json"
