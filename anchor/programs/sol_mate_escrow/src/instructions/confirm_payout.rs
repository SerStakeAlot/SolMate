use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct ConfirmPayout<'info> {
    #[account(
        mut,
        constraint = match_account.status == MatchStatus::Finished @ EscrowError::MatchNotFinished,
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
        init_if_needed,
        payer = payer,
        space = FeeVault::LEN,
        seeds = [b"fee_vault"],
        bump
    )]
    pub fee_vault: Account<'info, FeeVault>,
    
    #[account(mut)]
    /// CHECK: Winner receives payout
    pub winner: AccountInfo<'info>,
    
    #[account(mut)]
    /// CHECK: Player A created the match
    pub player_a: AccountInfo<'info>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ConfirmPayout>) -> Result<()> {
    let match_account = &ctx.accounts.match_account;
    
    // Verify winner
    let winner_key = match_account.winner.ok_or(EscrowError::MatchNotFinished)?;
    require!(
        winner_key == ctx.accounts.winner.key(),
        EscrowError::InvalidWinner
    );
    
    // Calculate amounts
    let stake_amount = match_account.stake_amount_lamports();
    let total_pot = stake_amount
        .checked_mul(2)
        .ok_or(EscrowError::ArithmeticOverflow)?;
    
    // Calculate fee (10% from each player = 20% of one stake = 10% of total pot)
    let fee_amount = total_pot
        .checked_div(10)
        .ok_or(EscrowError::ArithmeticOverflow)?;
    
    let payout_amount = total_pot
        .checked_sub(fee_amount)
        .ok_or(EscrowError::ArithmeticOverflow)?;
    
    let _escrow_lamports = ctx.accounts.escrow.lamports();
    
    msg!("Total pot: {} lamports", total_pot);
    msg!("Fee (10%): {} lamports", fee_amount);
    msg!("Payout to winner: {} lamports", payout_amount);
    
    // Transfer fee to vault
    **ctx.accounts.escrow.try_borrow_mut_lamports()? -= fee_amount;
    **ctx.accounts.fee_vault.to_account_info().try_borrow_mut_lamports()? += fee_amount;
    
    // Transfer payout to winner
    **ctx.accounts.escrow.try_borrow_mut_lamports()? -= payout_amount;
    **ctx.accounts.winner.try_borrow_mut_lamports()? += payout_amount;
    
    // Update fee vault stats
    let fee_vault = &mut ctx.accounts.fee_vault;
    if fee_vault.total_collected == 0 {
        fee_vault.bump = ctx.bumps.fee_vault;
    }
    fee_vault.total_collected = fee_vault
        .total_collected
        .checked_add(fee_amount)
        .ok_or(EscrowError::ArithmeticOverflow)?;
    
    msg!("Payout complete. Match account closed.");
    
    Ok(())
}
