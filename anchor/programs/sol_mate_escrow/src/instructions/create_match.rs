use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(stake_tier: u8, seed: u64)]
pub struct CreateMatch<'info> {
    #[account(
        init,
        payer = player_a,
        space = Match::LEN,
        seeds = [
            b"match",
            player_a.key().as_ref(),
            &seed.to_le_bytes()
        ],
        bump
    )]
    pub match_account: Account<'info, Match>,
    
    #[account(
        mut,
        seeds = [b"escrow", match_account.key().as_ref()],
        bump
    )]
    /// CHECK: PDA for holding escrow funds
    pub escrow: AccountInfo<'info>,
    
    #[account(mut)]
    pub player_a: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateMatch>,
    stake_tier: u8,
    seed: u64,
    join_deadline: i64,
) -> Result<()> {
    // Validate stake tier
    require!(stake_tier <= 3, EscrowError::InvalidStakeTier);
    
    let match_account = &mut ctx.accounts.match_account;
    
    // Initialize match
    match_account.player_a = ctx.accounts.player_a.key();
    match_account.player_b = None;
    match_account.stake_tier = stake_tier;
    match_account.join_deadline = join_deadline;
    match_account.status = MatchStatus::Open;
    match_account.winner = None;
    match_account.bump = ctx.bumps.match_account;
    match_account.escrow_bump = ctx.bumps.escrow;
    
    // Calculate stake amount
    let stake_amount = match_account.stake_amount_lamports();
    
    // Transfer player A's stake to escrow
    let transfer_ix = system_program::Transfer {
        from: ctx.accounts.player_a.to_account_info(),
        to: ctx.accounts.escrow.to_account_info(),
    };
    
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_ix,
        ),
        stake_amount,
    )?;
    
    msg!("Match created with stake tier: {} ({} lamports)", stake_tier, stake_amount);
    msg!("Join deadline: {}", join_deadline);
    
    Ok(())
}
