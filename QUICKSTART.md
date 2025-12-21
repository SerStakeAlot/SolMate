# Quick Start Guide for SolMate

## For Users

### Prerequisites
- A Solana wallet (install [Phantom](https://phantom.app/) or [Solflare](https://solflare.com/))
- Some SOL in your wallet (for testing on devnet, use the [Solana Faucet](https://faucet.solana.com/))

### Using the App
1. Visit the deployed app or run locally
2. Click "Select Wallet" in the top-right corner
3. Choose your wallet (Phantom or Solflare)
4. Approve the connection request
5. Explore the interface:
   - View the chess board
   - Set wager amounts
   - Check the side bets section
   - View your stats (once connected)

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

### Project Structure
```
app/
  ├── layout.tsx          # Root layout with WalletProvider
  ├── page.tsx            # Home page
  └── globals.css         # Global styles

components/
  ├── WalletProvider.tsx  # Solana wallet configuration
  ├── WalletButton.tsx    # Wallet connect button
  └── ChessGame.tsx       # Main game interface
```

### Making Changes

#### Update Solana Network
Edit `components/WalletProvider.tsx`:
```typescript
const network = WalletAdapterNetwork.Devnet; // Change to Testnet or Mainnet
```

#### Add Custom RPC Endpoint
```typescript
const endpoint = useMemo(() => 'https://your-custom-rpc.com', []);
```

#### Customize Styling
All styles are in `app/globals.css` and use Tailwind CSS classes.

### Adding Chess Logic

To implement actual chess functionality:

1. Install chess.js:
```bash
npm install chess.js
```

2. Create a new hook `lib/useChess.ts`:
```typescript
import { Chess } from 'chess.js';
import { useState } from 'react';

export function useChess() {
  const [game] = useState(() => new Chess());
  
  const makeMove = (from: string, to: string) => {
    try {
      game.move({ from, to });
      return true;
    } catch {
      return false;
    }
  };
  
  return { game, makeMove };
}
```

3. Use in `components/ChessGame.tsx`

### Building Anchor Programs

When ready to add smart contracts:

1. Install Anchor CLI:
```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest
```

2. Initialize Anchor workspace:
```bash
anchor init solmate-contracts
cd solmate-contracts
```

3. Develop your programs in `programs/`
4. Deploy to devnet: `anchor deploy --provider.cluster devnet`

## Troubleshooting

### Wallet won't connect
- Ensure you have a wallet extension installed
- Check that you're on the correct network (devnet/mainnet)
- Try refreshing the page

### Build errors
- Clear `.next` folder: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check Node.js version: `node --version` (should be 20+)

### Styling issues
- Verify Tailwind config is correct
- Check that `@tailwindcss/postcss` is installed
- Clear Next.js cache

## Resources

- [Solana Documentation](https://docs.solana.com/)
- [Anchor Book](https://book.anchor-lang.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Wallet Adapter Docs](https://github.com/anza-xyz/wallet-adapter)

## Getting Help

If you encounter issues:
1. Check the documentation above
2. Search existing GitHub issues
3. Open a new issue with details about your problem
4. Join the Solana Discord for community support
