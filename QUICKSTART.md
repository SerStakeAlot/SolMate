# Quick Start Guide for SolMate

## For Users

### Prerequisites
- A Solana wallet (install [Phantom](https://phantom.app/) or [Solflare](https://solflare.com/))
- Some SOL in your wallet (for devnet, use the [Solana Faucet](https://faucet.solana.com/))

### Using the App
1. Visit the deployed app or run locally
2. Click "Select Wallet" in the top-right corner
3. Choose your wallet (Phantom or Solflare)
4. Approve the connection request
5. Choose your mode:
   - **Host Match**: Create a staked match
   - **Join Match**: Browse and join open matches
   - **Practice**: Play against AI for free

### Creating a Staked Match
1. From home, click "Enter" (requires wallet)
2. Select "Host Match"
3. Choose your stake tier (0.5, 1, 5, or 10 SOL)
4. Click "Create Match"
5. Approve the transaction in your wallet
6. Wait for opponent to join (30 minute deadline)

### Joining a Match
1. From home, click "Enter"
2. Select "Join Match"
3. Browse the lobby
4. Filter by stake tier if desired
5. Wait 3 seconds, then click "Join Match"
6. Approve the transaction
7. Start playing!

### Playing
- Click a piece to select it
- Click a destination square to move
- Valid moves are highlighted
- Game ends on checkmate
- Winner automatically receives payout (90% of pot)
- 10% goes to platform

## For Developers

### Quick Setup
```bash
# Clone and install
git clone https://github.com/SerStakeAlot/SolMate.git
cd SolMate
npm install

# Run development server
npm run dev
```

Visit `http://localhost:3000` to see the app.

### Deploy Smart Contract (Optional)

**Requirements**:
- Solana CLI
- Anchor CLI 0.30.1+
- Wallet with SOL on devnet

```bash
# Configure Solana
solana config set --url devnet
solana airdrop 2

# Build and deploy
npm run anchor:build
npm run anchor:deploy

# Copy the program ID from output
# Update these files with new program ID:
# - anchor/programs/sol_mate_escrow/src/lib.rs (declare_id!)
# - utils/escrow.ts (PROGRAM_ID constant)
# - Anchor.toml (programs.devnet section)

# Rebuild with correct ID
npm run anchor:build
npm run anchor:deploy
```

### Project Structure
```
app/
  ├── page.tsx          # Home page
  ├── play/             # Mode selection
  ├── lobby/            # Match browser
  └── game/             # Chess game

components/
  ├── ChessGame.tsx     # Main game with escrow
  ├── WalletButton.tsx  # Wallet connection
  └── WalletProvider.tsx # Wallet context

utils/
  └── escrow.ts         # Escrow client & helpers

anchor/
  └── programs/
      └── sol_mate_escrow/  # Smart contract
```

### Making Changes

#### Update Stake Tiers
Edit `utils/escrow.ts`:
```typescript
export const STAKE_TIERS = [
  { tier: 0, label: '0.5 SOL', lamports: 0.5 * LAMPORTS_PER_SOL },
  // Add more tiers...
];
```

Also update `anchor/programs/sol_mate_escrow/src/state.rs`:
```rust
pub fn stake_amount_lamports(&self) -> u64 {
    match self.stake_tier {
        0 => 500_000_000,
        // Add more tiers...
    }
}
```

#### Change Platform Fee
Edit `anchor/programs/sol_mate_escrow/src/instructions/confirm_payout.rs`:
```rust
// Change from 10% to 5%
let fee_amount = total_pot
    .checked_div(20)  // Was 10 for 10%
    .ok_or(EscrowError::ArithmeticOverflow)?;
```

#### Customize UI Text
Edit tone/wording in:
- `app/page.tsx` - Home page
- `app/play/page.tsx` - Mode selection
- `components/ChessGame.tsx` - Game interface

#### Add Custom RPC Endpoint
Edit `components/WalletProvider.tsx`:
```typescript
const endpoint = useMemo(() => 'https://your-rpc-endpoint.com', []);
```

### Testing

#### Frontend Only
```bash
npm run dev
# Practice mode works without blockchain
```

#### Full Stack (Requires Deployed Program)
```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Watch logs
solana logs YOUR_PROGRAM_ID
```

#### Test Escrow Flow
1. Create match with wallet A
2. Join match with wallet B (different wallet!)
3. Play to checkmate
4. Verify payout in both wallets
5. Check transaction on Solana Explorer

### Common Issues

**"Cannot find module '@coral-xyz/anchor'"**
- This is expected - we build transactions manually
- No need to install @coral-xyz/anchor

**"Wallet won't connect"**
- Ensure you're on devnet
- Try refreshing the page
- Check browser console for errors

**"Transaction simulation failed"**
- Program might not be deployed
- Check program ID matches in all files
- Verify wallet has enough SOL

**"Invalid instruction"**
- Instruction discriminators might be wrong
- Rebuild and redeploy program
- Clear browser cache

### Development Tips

1. **Use Practice Mode First**
   - No wallet needed
   - Test UI changes quickly
   - Perfect for styling work

2. **Test on Devnet Thoroughly**
   - Airdrop is free
   - Transactions are fast
   - Easy to reset

3. **Check Solana Explorer**
   - Paste transaction signatures
   - View program accounts
   - Debug failed transactions

4. **Use Browser DevTools**
   - Console for errors
   - Network tab for RPC calls
   - React DevTools for state

## Resources

- [Solana Documentation](https://docs.solana.com/)
- [Anchor Book](https://book.anchor-lang.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Wallet Adapter Docs](https://github.com/anza-xyz/wallet-adapter)
- [Chess.js Documentation](https://github.com/jhlywa/chess.js)

## Getting Help

If you encounter issues:
1. Check [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
2. Review [DEPLOYMENT_ESCROW.md](DEPLOYMENT_ESCROW.md)
3. Search existing GitHub issues
4. Open a new issue with:
   - Error message
   - Transaction signature
   - Steps to reproduce
5. Join Solana Discord for community support

## What's Next?

After getting familiar with the basics:
1. Read [README.md](README.md) for full overview
2. Explore [DEPLOYMENT_ESCROW.md](DEPLOYMENT_ESCROW.md) for deployment
3. Check roadmap for upcoming features
4. Consider contributing!

## Quick Commands

```bash
# Development
npm run dev                 # Start frontend
npm run build              # Build for production
npm run anchor:build       # Build smart contract
npm run anchor:deploy      # Deploy to devnet

# Solana
solana config set --url devnet
solana airdrop 2
solana balance
solana logs PROGRAM_ID

# Testing
npm test                   # Run tests (if available)
npm run anchor:test        # Test smart contract
```

Happy coding! ♟️

