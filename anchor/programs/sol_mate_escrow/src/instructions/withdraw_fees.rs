use anchor_lang::prelude::*;
use crate::state::FeeVault;
use crate::errors::EscrowError;
use std::str::FromStr;

// Platform admin wallet - only this address can withdraw fees
pub fn get_admin_pubkey() -> Pubkey {
    Pubkey::from_str("7BKqimAdco1XsknW88N38qf4PgXGieWN8USPgKxcf87B").unwrap()
}

#[derive(Accounts)]
pub struct WithdrawFees<'info> {
    #[account(
        mut,
        seeds = [b"fee_vault"],
        bump = fee_vault.bump,
    )]
    pub fee_vault: Account<'info, FeeVault>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<WithdrawFees>, amount: u64) -> Result<()> {
    // Verify admin is the authorized wallet
    let admin_pubkey = get_admin_pubkey();
    require!(ctx.accounts.admin.key() == admin_pubkey, EscrowError::Unauthorized);
    
    let fee_vault = &ctx.accounts.fee_vault;
    let fee_vault_info = fee_vault.to_account_info();
    
    // Get current balance (excluding rent-exempt minimum)
    let rent = Rent::get()?;
    let min_balance = rent.minimum_balance(FeeVault::LEN);
    let available_balance = fee_vault_info.lamports()
        .checked_sub(min_balance)
        .ok_or(EscrowError::InsufficientFunds)?;
    
    // Determine withdrawal amount
    let withdraw_amount = if amount == 0 {
        available_balance // Withdraw all if amount is 0
    } else {
        require!(amount <= available_balance, EscrowError::InsufficientFunds);
        amount
    };
    
    require!(withdraw_amount > 0, EscrowError::InsufficientFunds);
    
    msg!("Withdrawing {} lamports to admin", withdraw_amount);
    msg!("Fee vault balance before: {}", fee_vault_info.lamports());
    
    // Transfer from fee vault PDA to admin
    **fee_vault_info.try_borrow_mut_lamports()? -= withdraw_amount;
    **ctx.accounts.admin.to_account_info().try_borrow_mut_lamports()? += withdraw_amount;
    
    msg!("Fee vault balance after: {}", fee_vault_info.lamports());
    
    Ok(())
}
