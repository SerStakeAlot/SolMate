# SolMate Escrow Deployment Guide

Complete guide for deploying the SolMate escrow smart contract and frontend.

## Prerequisites

- Solana CLI installed and configured
- Anchor CLI 0.30.1+ installed
- Wallet with SOL on target network
- Node.js 20+ for frontend

## Step 1: Configure Solana CLI

```bash
# Set to devnet for testing
solana config set --url devnet

# Create or set your keypair
solana-keygen new -o ~/.config/solana/id.json

# Airdrop SOL for deployment (devnet only)
solana airdrop 2

# Check balance
solana balance
```

## Step 2: Build Anchor Program

```bash
cd anchor
anchor build
```

This generates:
- `target/deploy/sol_mate_escrow.so` - Compiled program
- `target/idl/sol_mate_escrow.json` - Program interface

## Step 3: Get Program ID

```bash
# Deploy program and get address
anchor deploy --provider.cluster devnet

# Or get keypair address
solana address -k target/deploy/sol_mate_escrow-keypair.json
```

Example output:
```
Program Id: EscrowProgram11111111111111111111111111111
```

## Step 4: Update Program ID

Update the program ID in these files:

### 1. Anchor Program (`anchor/programs/sol_mate_escrow/src/lib.rs`)
```rust
declare_id!("YOUR_PROGRAM_ID_HERE");
```

### 2. Frontend Utility (`utils/escrow.ts`)
```typescript
export const PROGRAM_ID = new PublicKey('YOUR_PROGRAM_ID_HERE');
```

### 3. Anchor Config (`Anchor.toml`)
```toml
[programs.devnet]
sol_mate_escrow = "YOUR_PROGRAM_ID_HERE"
```

## Step 5: Rebuild with Correct Program ID

```bash
cd anchor
anchor build
anchor deploy --provider.cluster devnet
```

## Step 6: Verify Deployment

```bash
# Check program account exists
solana account YOUR_PROGRAM_ID_HERE

# Test program (optional)
anchor test --skip-local-validator
```

## Step 7: Deploy Frontend

### For Development
```bash
npm install
npm run dev
```

### For Production (Vercel)

1. Push to GitHub
2. Import to Vercel
3. Set environment variables (if needed):
   - `NEXT_PUBLIC_SOLANA_NETWORK=devnet`
4. Deploy

## Testing the Escrow Flow

### 1. Create a Match

```bash
# In browser:
1. Connect Phantom wallet (ensure on Devnet)
2. Go to /play → Host Match
3. Select stake tier (e.g., 1 SOL)
4. Click "Create Match"
5. Approve transaction in wallet
```

### 2. Join a Match

```bash
# In new browser/wallet:
1. Connect different wallet
2. Go to /play → Join Match
3. Browse lobby for your match
4. Click "Join Match"
5. Approve transaction
```

### 3. Play and Complete

```bash
1. Play chess game to checkmate
2. Winner is auto-determined
3. Result submitted on-chain (auto)
4. Payout executed (auto)
5. Check wallet balance (winner gets ~90% of pot)
```

## Verify Transactions

```bash
# Get transaction signature from UI
solana confirm SIGNATURE

# View on Solana Explorer
https://explorer.solana.com/tx/SIGNATURE?cluster=devnet
```

## Common Issues

### "Insufficient funds"
- Airdrop more SOL: `solana airdrop 2`
- Check balance: `solana balance`

### "Program deploy failed"
- Ensure wallet has enough SOL (~2+ SOL for deployment)
- Check program size isn't too large
- Verify Anchor version matches (0.30.1)

### "Transaction simulation failed"
- Check program ID matches in all files
- Verify PDAs are derived correctly
- Ensure wallet is on correct network (devnet)

### "Invalid instruction"
- Program might not be deployed
- Check program ID is correct
- Verify instruction discriminators match

## Network Migration

### Devnet → Testnet
```bash
solana config set --url testnet
anchor deploy --provider.cluster testnet
```

### Testnet → Mainnet
```bash
solana config set --url mainnet-beta
anchor deploy --provider.cluster mainnet-beta
```

⚠️ **Warning**: Mainnet deployment costs real SOL. Test thoroughly on devnet first!

## Monitoring

### Fee Vault Balance
```bash
# Derive fee vault PDA
# ["fee_vault"]
# Check balance on explorer or CLI
```

### Active Matches
```bash
# Query program accounts
solana program show YOUR_PROGRAM_ID --accounts
```

## Upgrades

```bash
# Build new version
anchor build

# Upgrade program (requires upgrade authority)
solana program deploy target/deploy/sol_mate_escrow.so \
  --program-id YOUR_PROGRAM_ID \
  --upgrade-authority ~/.config/solana/id.json
```

## Security Checklist

- [ ] Program ID updated in all locations
- [ ] Tested on devnet with real transactions
- [ ] Fee vault PDA verified
- [ ] Match creation/joining flow tested
- [ ] Payout distribution verified
- [ ] Self-match prevention confirmed
- [ ] Deadline enforcement tested
- [ ] All error cases handled in UI
- [ ] Transaction confirmations shown to users
- [ ] Explorer links provided for verification

## Support

For issues:
1. Check Solana Explorer for transaction details
2. Review program logs: `solana logs YOUR_PROGRAM_ID`
3. Verify wallet network matches program network
4. Check browser console for frontend errors

## Next Steps

- Add custom RPC endpoint for better reliability
- Implement transaction retry logic
- Add comprehensive error messages
- Set up monitoring/alerting for fee vault
- Consider program upgrade schedule
