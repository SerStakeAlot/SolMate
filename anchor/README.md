# SolMate Escrow Program

Anchor smart contract for managing chess match stakes and payouts.

## Features

- Fixed stake tiers: 0.5, 1, 5, 10 SOL
- PDA-based escrow custody
- 10% platform fee on payouts
- Match lifecycle: Open → Active → Finished
- Automatic payout distribution
- Match cancellation before join

## Building

```bash
# Build the program
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Update program ID in lib.rs and utils/escrow.ts
```

## Testing

```bash
anchor test
```

## Program Instructions

### create_match
Creates a new match with specified stake tier and join deadline.
- Transfers player A's stake to escrow PDA
- Sets match status to Open

### join_match
Player B joins an open match.
- Validates join deadline hasn't passed
- Prevents self-matching
- Transfers player B's stake to escrow
- Sets match status to Active

### submit_result
Submits match result with winner's pubkey.
- Only callable by match participants
- Sets match status to Finished
- Records winner

### confirm_payout
Distributes funds to winner and fee vault.
- Calculates 10% platform fee
- Transfers 90% of pot to winner
- Transfers 10% to fee vault
- Closes match account

### cancel_match
Cancels unjoined match and refunds player A.
- Only callable by match creator
- Only works if no player B has joined
- Refunds stake to player A
- Closes match account

## Account Structure

### Match Account
```rust
pub struct Match {
    pub player_a: Pubkey,
    pub player_b: Option<Pubkey>,
    pub stake_tier: u8,
    pub join_deadline: i64,
    pub status: MatchStatus,
    pub winner: Option<Pubkey>,
    pub bump: u8,
    pub escrow_bump: u8,
}
```

### Fee Vault
```rust
pub struct FeeVault {
    pub total_collected: u64,
    pub bump: u8,
}
```

## PDA Seeds

- Match: `["match", player_a, timestamp]`
- Escrow: `["escrow", match_pubkey]`
- Fee Vault: `["fee_vault"]`

## Security

- Self-matching prevention
- Join deadline enforcement
- Winner validation
- Arithmetic overflow protection
- PDA-only fund custody
