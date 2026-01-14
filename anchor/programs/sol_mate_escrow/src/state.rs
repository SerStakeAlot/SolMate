use anchor_lang::prelude::*;

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
}

impl Match {
    pub const LEN: usize = 8 + 32 + 33 + 1 + 8 + 1 + 33 + 1 + 1; // 118 bytes + discriminator
    
    pub fn stake_amount_lamports(&self) -> u64 {
        match self.stake_tier {
            0 => 500_000_000,      // 0.5 SOL
            1 => 1_000_000_000,    // 1 SOL
            2 => 5_000_000_000,    // 5 SOL
            3 => 10_000_000_000,   // 10 SOL
            _ => 0,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
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
