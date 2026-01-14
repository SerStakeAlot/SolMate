use anchor_lang::prelude::*;
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
}

pub fn handler(ctx: Context<CancelMatch>) -> Result<()> {
    let match_account = &mut ctx.accounts.match_account;
    
    // Refund player A's stake
    let stake_amount = match_account.stake_amount_lamports();
    
    **ctx.accounts.escrow.try_borrow_mut_lamports()? -= stake_amount;
    **ctx.accounts.player_a.try_borrow_mut_lamports()? += stake_amount;
    
    // Update status
    match_account.status = MatchStatus::Cancelled;
    
    msg!("Match cancelled. Stake refunded to player A.");
    
    Ok(())
}
