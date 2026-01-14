use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct JoinMatch<'info> {
    #[account(
        mut,
        constraint = match_account.status == MatchStatus::Open @ EscrowError::MatchNotOpen,
    )]
    pub match_account: Account<'info, Match>,
    
    #[account(
        mut,
        seeds = [b"escrow", match_account.key().as_ref()],
        bump = match_account.escrow_bump
    )]
    /// CHECK: PDA for holding escrow funds
    pub escrow: AccountInfo<'info>,
    
    #[account(mut)]
    pub player_b: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<JoinMatch>) -> Result<()> {
    let match_account = &mut ctx.accounts.match_account;
    let clock = Clock::get()?;
    
    // Validate join deadline
    require!(
        clock.unix_timestamp <= match_account.join_deadline,
        EscrowError::JoinDeadlinePassed
    );
    
    // Prevent self-matching
    require!(
        ctx.accounts.player_b.key() != match_account.player_a,
        EscrowError::CannotJoinOwnMatch
    );
    
    // Calculate stake amount
    let stake_amount = match_account.stake_amount_lamports();
    
    // Transfer player B's stake to escrow
    let transfer_ix = system_program::Transfer {
        from: ctx.accounts.player_b.to_account_info(),
        to: ctx.accounts.escrow.to_account_info(),
    };
    
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_ix,
        ),
        stake_amount,
    )?;
    
    // Update match state
    match_account.player_b = Some(ctx.accounts.player_b.key());
    match_account.status = MatchStatus::Active;
    
    msg!("Player B joined match. Match is now Active.");
    msg!("Escrow holds {} lamports", stake_amount * 2);
    
    Ok(())
}
