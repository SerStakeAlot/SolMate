# Pending Fix: confirm_payout CPI Transfer

## Status: WAITING FOR DEPLOYMENT FUNDS

**Date:** January 16, 2026  
**Required:** ~2.6 SOL to deployer wallet  
**Deployer Wallet:** `2BGfqbcPHCxJ9Bnvq6TQ4sPym83cv1c9QRF7UmdEp5aK`

---

## The Problem

After a chess match ends with checkmate, the `confirmPayout` instruction fails with:

```
"instruction spent from the balance of an account it does not own"
```

This happens because the escrow PDA holds the funds, but the program was trying to directly manipulate lamports using `try_borrow_mut_lamports()`. On Solana, only the **owning program** can directly debit lamports from an account. For PDAs, we need to use CPI (Cross-Program Invocation) transfers with the PDA as a signer.

---

## The Fix (ALREADY CODED)

The fix has been applied to:
**File:** `anchor/programs/sol_mate_escrow/src/instructions/confirm_payout.rs`

### Changes Made:

**Before (broken):**
```rust
// Direct lamport manipulation - doesn't work for PDAs
**ctx.accounts.escrow.try_borrow_mut_lamports()? -= fee_amount;
**ctx.accounts.fee_vault.to_account_info().try_borrow_mut_lamports()? += fee_amount;

**ctx.accounts.escrow.try_borrow_mut_lamports()? -= payout_amount;
**ctx.accounts.winner.try_borrow_mut_lamports()? += payout_amount;
```

**After (fixed):**
```rust
use anchor_lang::system_program::{transfer, Transfer};

// Create escrow signer seeds
let match_key = ctx.accounts.match_account.key();
let escrow_seeds = &[
    b"escrow".as_ref(),
    match_key.as_ref(),
    &[ctx.accounts.match_account.escrow_bump],
];
let escrow_signer = &[&escrow_seeds[..]];

// Transfer fee to vault using CPI
transfer(
    CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: ctx.accounts.escrow.to_account_info(),
            to: ctx.accounts.fee_vault.to_account_info(),
        },
        escrow_signer,
    ),
    fee_amount,
)?;

// Transfer payout to winner using CPI
transfer(
    CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: ctx.accounts.escrow.to_account_info(),
            to: ctx.accounts.winner.to_account_info(),
        },
        escrow_signer,
    ),
    payout_amount,
)?;
```

---

## Build Status

✅ Code is already modified  
✅ Program is already built (`anchor build` completed successfully)  
❌ Needs deployment (~2.6 SOL required)

---

## To Deploy When Ready

1. **Fund the deployer wallet:**
   ```
   Send ~2.6 SOL to: 2BGfqbcPHCxJ9Bnvq6TQ4sPym83cv1c9QRF7UmdEp5aK
   ```

2. **Deploy the program:**
   ```bash
   cd /workspaces/SolMate/anchor
   solana program deploy target/deploy/sol_mate_escrow.so \
     --url mainnet-beta \
     --keypair ~/.config/solana/id.json \
     --program-id H1Sn4JQvsZFx7HreZaQn4Poa3hkoS9iGnTwrtN2knrKV
   ```

3. **Remove the warning banner** from `app/play/page.tsx` (search for "WAGER_WARNING")

---

## What Works Now

- ✅ Free Play (Multiplayer) - fully functional
- ✅ Practice vs AI - fully functional
- ✅ Creating wager matches - works
- ✅ Joining wager matches - works
- ✅ Playing wager matches - works
- ✅ Submitting results - works
- ❌ Payout after win - FAILS (this fix)

---

## Program Details

- **Program ID:** `H1Sn4JQvsZFx7HreZaQn4Poa3hkoS9iGnTwrtN2knrKV`
- **Network:** Mainnet-beta
- **RPC:** Helius (`https://mainnet.helius-rpc.com/?api-key=15319bf4-5b40-4958-ac8d-6313aa55eb92`)

---

## Quick Resume Command

When you have the SOL, just say:
> "I have funded the deployer wallet, deploy the confirm_payout fix"

And I'll run the deployment command!
