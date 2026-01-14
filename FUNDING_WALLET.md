# 💰 How to Fund Your Devnet Wallet

## The Error You're Seeing

```
Error: Simulation failed. 
Message: Transaction simulation failed: Attempt to debit an account but found no record of a prior credit.
```

This means **your wallet doesn't have enough SOL** on Solana Devnet to create or join matches.

## Solution: Get Free Devnet SOL

### Option 1: Solana Faucet (Web)

1. **Visit**: https://faucet.solana.com/
2. **Enter your wallet address** (copy from your wallet or the app)
3. **Select "Devnet"** from the dropdown
4. **Click "Confirm Airdrop"**
5. **Wait 10-30 seconds** for the SOL to arrive
6. **Refresh your wallet** to see the balance

You'll receive **1-2 SOL** which is enough for many matches!

### Option 2: Solana CLI (Command Line)

If you have Solana CLI installed:

```bash
# Replace YOUR_WALLET_ADDRESS with your actual address
solana airdrop 2 YOUR_WALLET_ADDRESS --url devnet
```

### Option 3: Phantom Wallet Built-in Faucet

1. Open Phantom wallet
2. Click the settings/menu icon
3. Look for "Developer Settings" or "Devnet"
4. Some versions have a built-in airdrop button

## How Much SOL Do You Need?

- **Minimum for testing**: 0.5 SOL
- **Recommended**: 2-5 SOL
- **For multiple matches**: 10+ SOL

### Stake Requirements by Tier:
- **Tier 0**: 0.5 SOL
- **Tier 1**: 1.0 SOL
- **Tier 2**: 5.0 SOL
- **Tier 3**: 10.0 SOL

Plus a small amount for transaction fees (~0.001 SOL per transaction).

## Troubleshooting

### "Airdrop Failed" or Rate Limited
- The faucet has rate limits
- Wait 5-10 minutes and try again
- Try a different faucet service
- Use a VPN if you're rate limited by IP

### Still Not Enough SOL?
- Request multiple times (wait between requests)
- Ask in Solana Discord for devnet SOL
- Use alternative faucets like https://solfaucet.com/

### Balance Not Showing Up?
1. Wait 30 seconds
2. Refresh your wallet
3. Check you're on **Devnet** (not Mainnet!)
4. Verify the transaction on Solana Explorer

## Quick Check

**In the app**, you'll now see a yellow warning in the bottom-right corner if your balance is too low. It will show:
- Your current balance
- A direct link to the faucet

## After Funding

Once you have SOL:
1. Refresh the page
2. The warning should disappear
3. Try creating or joining a match again
4. Your transaction should succeed! ✅

## Need More Help?

- Solana Discord: https://discord.gg/solana
- Solana Docs: https://docs.solana.com/
- Devnet Explorer: https://explorer.solana.com/?cluster=devnet

---

**Remember**: This is Devnet SOL (test currency). It has no real value and is only for testing! 🧪
