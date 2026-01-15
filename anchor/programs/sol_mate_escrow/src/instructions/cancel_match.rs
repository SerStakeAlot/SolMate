use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct CancelMatch<'info> {
    #[account(
        mut,
        constraint = match_account.status == MatchStatus::Open @ EscrowError::MatchNotOpen,
        constraint = match_account.player_b.is_none() @ EscrowError::CannotCancelAfterJoin,
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
    
    #[account(
        mut,
        constraint = player_a.key() == match_account.player_a @ EscrowError::OnlyCreatorCanCancel
    )]
    pub player_a: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CancelMatch>) -> Result<()> {
    let match_account = &ctx.accounts.match_account;
    
    // Get stake amount before we modify anything
    let stake_amount = match_account.stake_amount_lamports();
    
    // Transfer stake back to player A using PDA signer seeds
    let match_key = match_account.key();
    let escrow_bump = match_account.escrow_bump;
    let escrow_seeds: &[&[u8]] = &[
        b"escrow",
        match_key.as_ref(),
        &[escrow_bump],
    ];
    
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
    
    msg!("Match cancelled. Stake refunded to player A.");
    
    Ok(())
}
