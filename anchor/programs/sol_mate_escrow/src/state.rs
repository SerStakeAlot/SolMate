use anchor_lang::prelude::*;
use std::str::FromStr;

#[account]
pub struct Match {
    pub player_a: Pubkey,           // 32
    pub player_b: Option<Pubkey>,   // 33 (1 + 32)
    pub stake_tier: u8,             // 1
    pub join_deadline: i64,         // 8
    pub status: MatchStatus,        // 1
    pub winner: Option<Pubkey>,     // 33 (1 + 32)
    pub bump: u8,                   // 1
    pub escrow_bump: u8,            // 1
    pub activated_at: i64,          // 8 — timestamp when match went Active (player B joined)
}

impl Match {
    pub const LEN: usize = 8 + 32 + 33 + 1 + 8 + 1 + 33 + 1 + 1 + 8; // 126 bytes + discriminator

    pub fn stake_amount_lamports(&self) -> u64 {
        match self.stake_tier {
            0 => 500_000_000,      // 0.5 SOL
            1 => 1_000_000_000,    // 1 SOL
            2 => 100_000_000,      // 0.1 SOL
            3 => 10_000_000_000,   // 10 SOL (reserved)
            4 => 50_000_000,       // 0.05 SOL
            _ => 0,
        }
    }
}

#[account]
pub struct TokenMatch {
    pub player_a: Pubkey,           // 32
    pub player_b: Option<Pubkey>,   // 33 (1 + 32)
    pub mint: Pubkey,               // 32 — which token ($MATE or $SKR mint address)
    pub stake_tier: u8,             // 1
    pub stake_amount: u64,          // 8 — raw token amount for this tier
    pub join_deadline: i64,         // 8
    pub status: MatchStatus,        // 1
    pub winner: Option<Pubkey>,     // 33 (1 + 32)
    pub bump: u8,                   // 1
    pub escrow_bump: u8,            // 1
    pub activated_at: i64,          // 8 — timestamp when match went Active
}

impl TokenMatch {
    pub const LEN: usize = 8 + 32 + 33 + 32 + 1 + 8 + 8 + 1 + 33 + 1 + 1 + 8; // 166 bytes + discriminator

    /// Returns the stake amount for a given mint + tier, or None if invalid.
    pub fn get_stake_amount(mint: &Pubkey, stake_tier: u8) -> Option<u64> {
        let mate_mint = Pubkey::from_str("5CJN2E6dDU9XxDJnz3ZEELxPP8HsGTKPbsNVB2djpump").unwrap();
        let skr_mint = Pubkey::from_str("SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3").unwrap();

        if *mint == mate_mint {
            // $MATE has 6 decimals
            match stake_tier {
                0 => Some(50_000_000_000),       // 50,000 $MATE
                1 => Some(100_000_000_000),      // 100,000 $MATE
                2 => Some(250_000_000_000),      // 250,000 $MATE
                3 => Some(500_000_000_000),      // 500,000 $MATE
                4 => Some(1_000_000_000_000),    // 1,000,000 $MATE
                _ => None,
            }
        } else if *mint == skr_mint {
            // $SKR has 6 decimals
            match stake_tier {
                0 => Some(500_000_000),          // 500 $SKR
                1 => Some(1_000_000_000),        // 1,000 $SKR
                2 => Some(2_500_000_000),        // 2,500 $SKR
                3 => Some(5_000_000_000),        // 5,000 $SKR
                4 => Some(10_000_000_000),       // 10,000 $SKR
                _ => None,
            }
        } else {
            None
        }
    }

    pub fn is_allowed_mint(mint: &Pubkey) -> bool {
        Self::get_stake_amount(mint, 0).is_some()
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum MatchStatus {
    Open,       // Created, waiting for player_b
    Active,     // Both players joined, game in progress
    Finished,   // Winner declared, ready for payout
    Cancelled,  // Cancelled by creator before join
}

#[account]
pub struct FeeVault {
    pub total_collected: u64,
    pub bump: u8,
}

impl FeeVault {
    pub const LEN: usize = 8 + 8 + 1; // 17 bytes + discriminator
}
