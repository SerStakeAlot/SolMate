# SolMate: Quests & Token Wager Matches — Implementation Document

> **Status:** Planning
> **Date:** 2026-02-15
> **Tokens Supported:** $MATE (`5CJN2E6dDU9XxDJnz3ZEELxPP8HsGTKPbsNVB2djpump`) and $SKR (`SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3`)
> **Quest Treasury:** 100M $MATE

---

## Table of Contents

1. [Overview](#overview)
2. [Part 1: Token Wager Matches](#part-1-token-wager-matches)
3. [Part 2: Quest System](#part-2-quest-system)
4. [Anti-Abuse Measures](#anti-abuse-measures)
5. [Implementation Phases](#implementation-phases)
6. [Technical Architecture](#technical-architecture)

---

## Overview

Two interconnected features that create a flywheel for $MATE and $SKR demand:

1. **Token Wager Matches** — Players wager $MATE or $SKR instead of SOL. Requires a new on-chain escrow program (or new instructions added to existing `sol_mate_escrow`) that handles SPL token transfers instead of native SOL transfers.

2. **Quest System** — Daily quests tied exclusively to wager match activity. Players earn $MATE rewards for playing and winning wager matches. Distributed from a 100M $MATE treasury.

**The flywheel:** Quests reward $MATE → Players use earned $MATE in token wager matches → Platform collects 10% fee in tokens → Tokens recycled to treasury or burned → Players need more $MATE to keep playing → Buy pressure.

---

## Part 1: Token Wager Matches

### What Changes From SOL Wager Matches

| Aspect | Current (SOL) | New (Token) |
|--------|--------------|-------------|
| Currency | Native SOL (lamports) | SPL Token ($MATE or $SKR) |
| Transfer method | `system_program::transfer` | `token::transfer` (CPI to Token Program) |
| Escrow account | PDA holding SOL in lamports | PDA-owned Associated Token Account (ATA) |
| Fee vault | PDA holding SOL | PDA-owned ATA for each token mint |
| Account structs | `SystemProgram` | `TokenAccount`, `Mint`, `TokenProgram`, `AssociatedTokenProgram` |
| Stake tiers | Fixed SOL amounts | Fixed token amounts per mint |

### Token Wager Stake Tiers

**$MATE tiers** (6 decimals):
| Tier | Amount | Raw Units |
|------|--------|-----------|
| 0 | 50,000 $MATE | 50_000_000_000 |
| 1 | 100,000 $MATE | 100_000_000_000 |
| 2 | 250,000 $MATE | 250_000_000_000 |
| 3 | 500,000 $MATE | 500_000_000_000 |
| 4 | 1,000,000 $MATE | 1_000_000_000_000 |

**$SKR tiers** (6 decimals):
| Tier | Amount | Raw Units |
|------|--------|-----------|
| 0 | 500 $SKR | 500_000_000 |
| 1 | 1,000 $SKR | 1_000_000_000 |
| 2 | 2,500 $SKR | 2_500_000_000 |
| 3 | 5,000 $SKR | 5_000_000_000 |
| 4 | 10,000 $SKR | 10_000_000_000 |

> **Note:** Exact tier amounts TBD — adjust based on token price and desired accessibility.

### On-Chain Program: New Instructions

Add the following instructions to the existing `sol_mate_escrow` program (Program ID: `H1Sn4JQvsZFx7HreZaQn4Poa3hkoS9iGnTwrtN2knrKV`). This avoids deploying a second program and keeps all match logic unified.

#### New State Account: `TokenMatch`

```rust
#[account]
pub struct TokenMatch {
    pub player_a: Pubkey,           // 32
    pub player_b: Option<Pubkey>,   // 33
    pub mint: Pubkey,               // 32 — which token ($MATE or $SKR mint address)
    pub stake_tier: u8,             // 1
    pub stake_amount: u64,          // 8 — raw token amount for this tier
    pub join_deadline: i64,         // 8
    pub status: MatchStatus,        // 1 — reuse existing MatchStatus enum
    pub winner: Option<Pubkey>,     // 33
    pub bump: u8,                   // 1
    pub escrow_bump: u8,            // 1
}
// Total: 8 (discriminator) + 32 + 33 + 32 + 1 + 8 + 8 + 1 + 33 + 1 + 1 = 158 bytes
```

Key difference from `Match`: stores `mint` (which token) and `stake_amount` (raw token units) instead of deriving amount from tier via `stake_amount_lamports()`.

#### New Instruction: `create_token_match`

```rust
#[derive(Accounts)]
#[instruction(stake_tier: u8, seed: u64, mint_address: Pubkey)]
pub struct CreateTokenMatch<'info> {
    #[account(
        init,
        payer = player_a,
        space = TokenMatch::LEN,
        seeds = [b"token_match", player_a.key().as_ref(), &seed.to_le_bytes()],
        bump
    )]
    pub match_account: Account<'info, TokenMatch>,

    /// The SPL token mint ($MATE or $SKR)
    pub mint: Account<'info, Mint>,

    /// Escrow token account (PDA-owned ATA)
    #[account(
        init_if_needed,
        payer = player_a,
        associated_token::mint = mint,
        associated_token::authority = escrow_authority,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for the escrow token account
    #[account(seeds = [b"token_escrow", match_account.key().as_ref()], bump)]
    pub escrow_authority: AccountInfo<'info>,

    /// Player A's token account
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = player_a,
    )]
    pub player_a_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub player_a: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
```

**Handler logic:**
1. Validate `mint` is an allowed mint ($MATE or $SKR address — hardcoded or stored in a config PDA)
2. Validate `stake_tier` (0-4)
3. Look up `stake_amount` based on `mint` + `stake_tier`
4. Initialize `TokenMatch` account
5. CPI `token::transfer` from `player_a_token_account` → `escrow_token_account` for `stake_amount`

#### New Instruction: `join_token_match`

```rust
#[derive(Accounts)]
pub struct JoinTokenMatch<'info> {
    #[account(mut, constraint = match_account.status == MatchStatus::Open)]
    pub match_account: Account<'info, TokenMatch>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = escrow_authority,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(seeds = [b"token_escrow", match_account.key().as_ref()], bump)]
    pub escrow_authority: AccountInfo<'info>,

    /// Player B's token account
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = player_b,
    )]
    pub player_b_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub player_b: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
```

**Handler logic:**
1. Validate `player_b != player_a` (no self-matching)
2. Validate `join_deadline` not passed
3. Validate `mint` matches `match_account.mint`
4. CPI `token::transfer` from `player_b_token_account` → `escrow_token_account` for `stake_amount`
5. Set `match_account.player_b`, status → `Active`

#### New Instruction: `submit_token_result`

Identical logic to existing `submit_result` but operates on `TokenMatch` account. Sets winner and status → `Finished`.

#### New Instruction: `confirm_token_payout`

```rust
#[derive(Accounts)]
pub struct ConfirmTokenPayout<'info> {
    #[account(
        mut,
        constraint = match_account.status == MatchStatus::Finished,
        close = player_a
    )]
    pub match_account: Account<'info, TokenMatch>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = escrow_authority,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(seeds = [b"token_escrow", match_account.key().as_ref()], bump)]
    pub escrow_authority: AccountInfo<'info>,

    /// Fee vault token account (platform fees collected here)
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = fee_vault_authority,
    )]
    pub fee_vault_token_account: Account<'info, TokenAccount>,

    #[account(seeds = [b"token_fee_vault"], bump)]
    pub fee_vault_authority: AccountInfo<'info>,

    /// Winner's token account
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = winner,
    )]
    pub winner_token_account: Account<'info, TokenAccount>,

    /// CHECK: validated against match_account.winner
    #[account(mut)]
    pub winner: AccountInfo<'info>,

    /// CHECK: Player A for rent return
    #[account(mut)]
    pub player_a: AccountInfo<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
```

**Handler logic:**
1. Validate `winner` matches `match_account.winner`
2. Calculate: `total_pot = stake_amount * 2`
3. Calculate: `fee = total_pot / 10` (10%)
4. Calculate: `payout = total_pot - fee`
5. CPI `token::transfer` (signed by escrow PDA) → `fee_vault_token_account` for `fee`
6. CPI `token::transfer` (signed by escrow PDA) → `winner_token_account` for `payout`
7. Close `escrow_token_account`, return rent to `player_a`

#### New Instructions: `cancel_token_match`, `abandon_token_match`, `force_token_refund`

Mirror existing SOL versions but use `token::transfer` CPI instead of `system_program::transfer`. Same status checks and validation logic.

#### New Instruction: `withdraw_token_fees`

Admin instruction to withdraw collected token fees from the fee vault ATA.

### Allowed Mints Validation

Hardcode allowed mints in the program:

```rust
pub fn is_allowed_mint(mint: &Pubkey) -> bool {
    let mate_mint = pubkey!("5CJN2E6dDU9XxDJnz3ZEELxPP8HsGTKPbsNVB2djpump");
    let skr_mint = pubkey!("SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3");
    *mint == mate_mint || *mint == skr_mint
}
```

### Frontend Changes

#### New Files
- `utils/tokenEscrow.ts` — Anchor client functions for all `*_token_*` instructions (mirrors `utils/escrow.ts` but for SPL tokens)

#### Modified Files
- `app/play/page.tsx` — Add token wager match creation option (select $MATE or $SKR, pick tier)
- `app/lobby/page.tsx` — Display token wager matches alongside SOL matches, filter by currency
- `components/ChessGame.tsx` — Handle token match flow (create, join, submit result, confirm payout) using `tokenEscrow.ts`
- `app/refund/page.tsx` — Support claiming winnings from token matches

#### UX Flow
1. Player selects "Host Match" → chooses currency (SOL / $MATE / $SKR) → picks stake tier → creates match
2. Lobby shows matches with currency icon and amount
3. Joining a token match prompts wallet to approve SPL token transfer
4. On win, player claims payout in the same token they wagered

### Backend Changes

#### Modified Files
- `backend/src/types.ts` — Add `matchCurrency` field to match types (`'SOL' | 'MATE' | 'SKR'`)
- `backend/src/hostedMatch.ts` — Store currency type with hosted match data
- `backend/src/matchmaking.ts` — Separate queues per currency (SOL queue, MATE queue, SKR queue)
- `backend/src/gameRoom.ts` — Track currency type in game room for result submission
- `backend/src/statsStore.ts` — Track token match stats separately

#### Database Schema Addition
```sql
-- Add to existing matches table or create new
ALTER TABLE matches ADD COLUMN currency TEXT DEFAULT 'SOL';
ALTER TABLE matches ADD COLUMN token_mint TEXT;
ALTER TABLE matches ADD COLUMN token_stake_amount INTEGER;
```

---

## Part 2: Quest System

### Design Principles

- **Wager-match-only:** Quests exclusively reward wager match participation (SOL or token matches both count)
- **Simple:** 4 daily quests, no weekly/milestone complexity at launch
- **Treasury-funded:** 100M $MATE distributed from a server-controlled hot wallet
- **Anti-farmable:** Minimum match quality requirements prevent abuse

### Daily Quests (Reset Every 24h at 00:00 UTC)

| Quest ID | Description | Reward | Condition |
|----------|------------|--------|-----------|
| `play_1` | Play 1 wager match | 3,000 $MATE | Complete any wager match (SOL, $MATE, or $SKR) |
| `win_1` | Win 1 wager match | 5,000 $MATE | Win any wager match |
| `play_3` | Play 3 wager matches | 8,000 $MATE | Complete 3 wager matches |
| `win_3` | Win 3 wager matches | 15,000 $MATE | Win 3 wager matches |

**Max daily earn per wallet: 31,000 $MATE**

### Quest Validation Rules

A wager match counts toward quest progress only if:
1. **Minimum 10 moves** — Game lasted at least 10 total moves (5 per side)
2. **Unique opponents** — Each match must be against a different wallet address (per daily reset)
3. **Valid conclusion** — Game ended via checkmate or timeout (not abandonment)

### Treasury Budget Math

| Scenario | Daily Players | Avg Earn/Player | Daily Spend | Runway |
|----------|--------------|-----------------|-------------|--------|
| Early | 10 | 15,000 $MATE | 150,000 | 667 days |
| Growing | 50 | 15,000 $MATE | 750,000 | 133 days |
| Active | 100 | 15,000 $MATE | 1,500,000 | 67 days |
| Peak | 200 | 15,000 $MATE | 3,000,000 | 33 days |

At 50 daily active players averaging half the daily cap, the 100M treasury lasts roughly **4-5 months**. As token wager match fees recycle $MATE back to the platform (10% fee), some of this can be recycled into the treasury to extend runway.

### Distribution Mechanism: Server-Side Transfer (Option A)

**How it works:**
1. Load a server-controlled hot wallet with $MATE from your treasury
2. Backend tracks quest progress in SQLite
3. When player completes a quest, they click "Claim" on the `/quests` page
4. Backend validates completion, then executes an SPL token transfer from the hot wallet to the player's wallet
5. Transaction hash stored in DB as proof of payment

**Server-side transfer implementation:**
- Use `@solana/spl-token` library with `transfer` or `transferChecked`
- Hot wallet keypair stored as environment variable (encrypted)
- Rate limit: 1 claim per quest per day per wallet
- Log all distributions for accounting

**Why not on-chain:** A dedicated quest vault program adds complexity without meaningful trust benefit — the server already determines game outcomes. If the server is compromised, quest rewards are the least concern. Keep it simple, ship fast.

### Database Schema

```sql
-- Quest progress tracking
CREATE TABLE quest_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT NOT NULL,
    quest_id TEXT NOT NULL,              -- 'play_1', 'win_1', 'play_3', 'win_3'
    progress INTEGER DEFAULT 0,          -- current count
    target INTEGER NOT NULL,             -- required count
    completed BOOLEAN DEFAULT FALSE,
    claimed BOOLEAN DEFAULT FALSE,
    claim_tx_hash TEXT,                  -- Solana transaction signature
    quest_date TEXT NOT NULL,            -- '2026-02-15' (UTC date for daily reset)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(wallet_address, quest_id, quest_date)
);

-- Quest match validation (track which matches counted)
CREATE TABLE quest_match_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT NOT NULL,
    match_id TEXT NOT NULL,
    opponent_wallet TEXT NOT NULL,
    move_count INTEGER NOT NULL,
    result TEXT NOT NULL,                -- 'win', 'loss'
    currency TEXT NOT NULL,             -- 'SOL', 'MATE', 'SKR'
    quest_date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(wallet_address, match_id, quest_date)
);

-- Distribution ledger
CREATE TABLE quest_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT NOT NULL,
    quest_id TEXT NOT NULL,
    amount INTEGER NOT NULL,            -- raw token units
    tx_hash TEXT NOT NULL,              -- Solana transaction signature
    quest_date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Backend Implementation

#### New Files
- `backend/src/questStore.ts` — Quest progress tracking, validation, reset logic
- `backend/src/questRewards.ts` — $MATE transfer execution using `@solana/spl-token`

#### Modified Files
- `backend/src/gameRoom.ts` — On match completion, call `questStore.recordMatch()` to update quest progress
- `backend/src/hostedMatch.ts` — Same: on hosted match completion, update quest progress
- `backend/src/server.ts` — Add quest API endpoints:
  - `GET /api/quests/:walletAddress` — Get daily quest status
  - `POST /api/quests/claim` — Claim completed quest reward

#### Quest Progress Flow
```
Match completes (checkmate/timeout)
  → gameRoom/hostedMatch calls questStore.recordMatch(walletAddress, matchId, opponentWallet, moveCount, result, currency)
  → questStore validates: moveCount >= 10, unique opponent for today
  → questStore increments progress for play_1, play_3 (always) and win_1, win_3 (if won)
  → questStore marks quest as completed if progress >= target
  → Player sees updated progress on /quests page
  → Player clicks "Claim" → POST /api/quests/claim
  → Backend validates quest is completed + not yet claimed
  → questRewards.distribute(walletAddress, amount) executes SPL transfer
  → Records tx_hash in quest_rewards table
  → Returns tx_hash to frontend for confirmation
```

### Frontend Implementation

#### New Files
- `app/quests/page.tsx` — Daily quest dashboard

#### Quest Page Design

```
┌─────────────────────────────────────────────────┐
│  DAILY QUESTS                    Resets in: 14h  │
│─────────────────────────────────────────────────│
│                                                  │
│  ⬜ Play 1 Wager Match           3,000 $MATE    │
│     Progress: 0/1                    [ Locked ]  │
│                                                  │
│  ⬜ Win 1 Wager Match            5,000 $MATE    │
│     Progress: 0/1                    [ Locked ]  │
│                                                  │
│  ⬜ Play 3 Wager Matches         8,000 $MATE    │
│     Progress: 0/3                    [ Locked ]  │
│                                                  │
│  ⬜ Win 3 Wager Matches         15,000 $MATE    │
│     Progress: 0/3                    [ Locked ]  │
│                                                  │
│─────────────────────────────────────────────────│
│  Today's Earnings: 0 / 31,000 $MATE             │
│  Treasury Remaining: 99,750,000 $MATE            │
└─────────────────────────────────────────────────┘
```

- Progress bars fill as matches complete
- "Locked" → "Claim" button when quest is completed
- "Claimed" with green check + tx link after claiming
- Countdown timer to daily reset (00:00 UTC)

#### Modified Files
- `components/Navigation.tsx` — Add "Quests" nav link
- `app/play/page.tsx` — Show active quest progress reminder ("2/3 matches toward daily quest")

---

## Anti-Abuse Measures

### Match Quality Filters
| Rule | Purpose |
|------|---------|
| Minimum 10 moves per match | Prevents instant-resign farming |
| Unique opponent per quest-day | Prevents two wallets trading wins |
| Valid conclusion (checkmate/timeout only) | Prevents abandoned match exploitation |

### Rate Limits
| Limit | Value |
|-------|-------|
| Max claims per wallet per day | 4 (one per quest) |
| Max $MATE per wallet per day | 31,000 |
| API claim endpoint rate limit | 10 requests/minute per IP |

### Monitoring
- Log all quest completions and claims
- Alert if single IP claims from 3+ wallets in a day
- Alert if two wallets exclusively play each other
- Weekly review of top earners for suspicious patterns

---

## Implementation Phases

### Phase 1: Token Wager Matches
**Scope:** On-chain program + frontend + backend support for $MATE and $SKR wager matches

1. Add `TokenMatch` state and 7 new instructions to `sol_mate_escrow` program
2. Write and run Anchor tests for all token match instructions
3. Deploy upgraded program to devnet
4. Build `utils/tokenEscrow.ts` client
5. Update frontend: match creation, lobby, game flow, payout claiming
6. Update backend: currency tracking in match types, separate queues, stats
7. Test end-to-end on devnet
8. Deploy to mainnet

### Phase 2: Quest System
**Scope:** Quest tracking, daily reset, $MATE distribution

1. Create quest database tables
2. Build `questStore.ts` and `questRewards.ts` backend modules
3. Hook quest progress into match completion flow
4. Build `/quests` page
5. Set up server hot wallet with $MATE
6. Build claim endpoint with SPL transfer logic
7. Add quest progress indicators to game/lobby pages
8. Test full flow on devnet
9. Deploy to mainnet

### Phase 3: Iteration (Post-Launch)
- Adjust reward amounts based on player activity data
- Add weekly quests if daily engagement is strong
- Add milestone quests (first win, 100 matches, etc.)
- Consider tiered quest access (hold $MATE to unlock higher reward quests)
- Evaluate moving quest distribution on-chain if trust becomes a concern
- Recycle collected token fees back into quest treasury

---

## Technical Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                    │
│                                                              │
│  /play          /lobby         /game         /quests         │
│  (create match) (browse/join)  (play chess)  (daily quests)  │
│       │              │              │              │         │
│       └──── utils/tokenEscrow.ts ───┘              │         │
│       └──── utils/escrow.ts (SOL) ──┘              │         │
│                                                    │         │
│                                          GET /api/quests     │
│                                          POST /api/claim     │
└────────────────────────┬───────────────────────┬─────────────┘
                         │                       │
                         ▼                       ▼
┌────────────────────────────────┐  ┌──────────────────────────┐
│     SOLANA PROGRAM             │  │     BACKEND (Express)     │
│     sol_mate_escrow            │  │                           │
│                                │  │  gameRoom.ts              │
│  Existing:                     │  │    → questStore.recordMatch│
│    create_match (SOL)          │  │                           │
│    join_match (SOL)            │  │  questStore.ts             │
│    submit_result (SOL)         │  │    → track progress       │
│    confirm_payout (SOL)        │  │    → validate matches     │
│    cancel_match (SOL)          │  │    → daily reset           │
│    abandon_match (SOL)         │  │                           │
│    force_refund (SOL)          │  │  questRewards.ts           │
│    withdraw_fees (SOL)         │  │    → SPL token transfer   │
│                                │  │    → hot wallet keypair   │
│  New:                          │  │                           │
│    create_token_match ($TOKEN) │  │  SQLite:                   │
│    join_token_match ($TOKEN)   │  │    quest_progress          │
│    submit_token_result         │  │    quest_match_log         │
│    confirm_token_payout        │  │    quest_rewards           │
│    cancel_token_match          │  │                           │
│    abandon_token_match         │  └──────────────────────────┘
│    force_token_refund          │
│    withdraw_token_fees         │
│                                │
│  State:                        │
│    Match (SOL) — existing      │
│    TokenMatch — new            │
│    FeeVault (SOL) — existing   │
│    Token fee vault — PDA ATA   │
└────────────────────────────────┘
```

---

## Open Questions

1. **Token wager tier amounts** — What $MATE and $SKR amounts feel right for each tier? Depends on current token price and desired accessibility.
2. **Fee recycling** — Should 10% token match fees go back into quest treasury, get burned, or accumulate for future use?
3. **Quest reward amounts** — Start with proposed amounts (3K/5K/8K/15K) and adjust after 2 weeks of data?
4. **Token-2022 support** — $MATE and $SKR appear to use standard Token Program. Confirm neither uses Token-2022 extensions that would change transfer logic.
5. **Hot wallet security** — How to secure the server-side keypair for quest distributions? Options: environment variable, AWS KMS, or dedicated signer service.
