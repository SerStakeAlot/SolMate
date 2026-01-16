use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::state::*;
use crate::errors::*;

/// Abandon an active match that has no winner.
/// Either player can call this after a timeout period (e.g., 1 hour from match start).
/// Both players get their stakes refunded.
#[derive(Accounts)]
pub struct AbandonMatch<'info> {
    #[account(
        mut,
        constraint = match_account.status == MatchStatus::Active @ EscrowError::MatchNotActive,
        constraint = match_account.winner.is_none() @ EscrowError::MatchAlreadyHasWinner,
        close = player_a
    )]
    pub match_account: Account<'info, Match>,
    
    #[account(
        mut,
        seeds = [b"escrow", match_account.key().as_ref()],
        bump = match_account.escrow_bump
    )]
    /// CHECK: PDA for holding escrow funds
    pub escrow: AccountInfo<'info>,
    
    /// CHECK: Player A receives their stake back and rent from closed account
    #[account(
        mut,
        constraint = player_a.key() == match_account.player_a
    )]
    pub player_a: AccountInfo<'info>,
    
    /// CHECK: Player B receives their stake back
    #[account(
        mut,
        constraint = match_account.player_b.is_some() && player_b.key() == match_account.player_b.unwrap() @ EscrowError::InvalidPlayerB
    )]
    pub player_b: AccountInfo<'info>,
    
    /// The player calling this instruction (must be either player_a or player_b)
    #[account(
        constraint = caller.key() == match_account.player_a || 
                    (match_account.player_b.is_some() && caller.key() == match_account.player_b.unwrap()) 
                    @ EscrowError::NotAPlayer
    )]
    pub caller: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<AbandonMatch>) -> Result<()> {
    let match_account = &ctx.accounts.match_account;
    
    // Get stake amount
    let stake_amount = match_account.stake_amount_lamports();
    
    // Build escrow signer seeds
    let match_key = match_account.key();
    let escrow_bump = match_account.escrow_bump;
    let escrow_seeds: &[&[u8]] = &[
        b"escrow",
        match_key.as_ref(),
        &[escrow_bump],
    ];
    
    // Refund Player A
    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow.to_account_info(),
                to: ctx.accounts.player_a.to_account_info(),
            },
            &[escrow_seeds],
        ),
        stake_amount,
    )?;
    
    // Refund Player B
    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow.to_account_info(),
                to: ctx.accounts.player_b.to_account_info(),
            },
            &[escrow_seeds],
        ),
        stake_amount,
    )?;
    
    msg!("Match abandoned. Stakes refunded to both players.");
    
    Ok(())
}
