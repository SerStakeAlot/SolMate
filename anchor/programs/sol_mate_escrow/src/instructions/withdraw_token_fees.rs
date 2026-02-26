use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer as TokenTransfer};
use crate::errors::*;
use super::withdraw_fees::get_admin_pubkey;

/// Admin instruction to withdraw collected token fees from the fee vault ATA.
/// Only callable by the hardcoded admin wallet.
#[derive(Accounts)]
pub struct WithdrawTokenFees<'info> {
    /// The SPL token mint
    pub mint: Account<'info, Mint>,

    /// CHECK: PDA authority for the fee vault token account
    #[account(
        seeds = [b"token_fee_vault"],
        bump
    )]
    pub fee_vault_authority: AccountInfo<'info>,

    /// Fee vault token account (holds collected fees)
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = fee_vault_authority,
    )]
    pub fee_vault_token_account: Account<'info, TokenAccount>,

    /// Admin's token account (receives withdrawn fees)
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = admin,
    )]
    pub admin_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<WithdrawTokenFees>, amount: u64) -> Result<()> {
    // Verify admin is the authorized wallet
    let admin_pubkey = get_admin_pubkey();
    require!(ctx.accounts.admin.key() == admin_pubkey, EscrowError::Unauthorized);

    let available_balance = ctx.accounts.fee_vault_token_account.amount;

    // Determine withdrawal amount
    let withdraw_amount = if amount == 0 {
        available_balance // Withdraw all if amount is 0
    } else {
        require!(amount <= available_balance, EscrowError::InsufficientFunds);
        amount
    };

    require!(withdraw_amount > 0, EscrowError::InsufficientFunds);

    msg!("Withdrawing {} tokens to admin", withdraw_amount);
    msg!("Fee vault token balance before: {}", available_balance);

    // Build fee vault authority PDA signer seeds
    let fee_vault_seeds = &[
        b"token_fee_vault".as_ref(),
        &[ctx.bumps.fee_vault_authority],
    ];
    let fee_vault_signer = &[&fee_vault_seeds[..]];

    // Transfer tokens from fee vault to admin
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TokenTransfer {
                from: ctx.accounts.fee_vault_token_account.to_account_info(),
                to: ctx.accounts.admin_token_account.to_account_info(),
                authority: ctx.accounts.fee_vault_authority.to_account_info(),
            },
            fee_vault_signer,
        ),
        withdraw_amount,
    )?;

    msg!("Token fee withdrawal complete.");

    Ok(())
}
