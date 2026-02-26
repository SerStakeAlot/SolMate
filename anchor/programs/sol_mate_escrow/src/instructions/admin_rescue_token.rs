use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, TokenInterface, TokenAccount, Mint, TransferChecked, CloseAccount};
use crate::state::*;
use crate::errors::*;
use super::withdraw_fees::get_admin_pubkey;

/// Admin rescue for token matches: drain escrow token account from a stuck/missubmitted
/// token match to a specified recipient. Only callable by the platform admin wallet.
/// Works on ANY match status (Active, Finished, etc.) and closes the match account.
#[derive(Accounts)]
pub struct AdminRescueToken<'info> {
    #[account(
        mut,
        close = admin
    )]
    pub match_account: Account<'info, TokenMatch>,

    /// The SPL token mint
    #[account(
        constraint = mint.key() == match_account.mint @ EscrowError::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    /// CHECK: PDA authority for the escrow token account
    #[account(
        seeds = [b"token_escrow", match_account.key().as_ref()],
        bump = match_account.escrow_bump
    )]
    pub escrow_authority: AccountInfo<'info>,

    /// Escrow token account
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = escrow_authority,
        associated_token::token_program = token_program,
    )]
    pub escrow_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Recipient's token account (receives rescued tokens)
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = recipient,
        associated_token::token_program = token_program,
    )]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: The wallet that will receive the rescued tokens
    #[account(mut)]
    pub recipient: AccountInfo<'info>,

    /// Platform admin — must be the hardcoded admin pubkey
    #[account(
        mut,
        constraint = admin.key() == get_admin_pubkey() @ EscrowError::Unauthorized
    )]
    pub admin: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<AdminRescueToken>) -> Result<()> {
    let match_account = &ctx.accounts.match_account;
    let escrow_balance = ctx.accounts.escrow_token_account.amount;
    let decimals = ctx.accounts.mint.decimals;

    msg!("Admin rescue (token) initiated");
    msg!("Match status: {:?}", match_account.status);
    msg!("Escrow token balance: {} raw units", escrow_balance);
    msg!("Recipient: {}", ctx.accounts.recipient.key());

    if escrow_balance > 0 {
        // Build escrow authority PDA signer seeds
        let match_key = match_account.key();
        let escrow_seeds = &[
            b"token_escrow".as_ref(),
            match_key.as_ref(),
            &[match_account.escrow_bump],
        ];
        let escrow_signer = &[&escrow_seeds[..]];

        // Transfer all tokens to recipient
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.recipient_token_account.to_account_info(),
                    authority: ctx.accounts.escrow_authority.to_account_info(),
                },
                escrow_signer,
            ),
            escrow_balance,
            decimals,
        )?;

        // Close escrow token account — return rent to admin
        token_interface::close_account(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                CloseAccount {
                    account: ctx.accounts.escrow_token_account.to_account_info(),
                    destination: ctx.accounts.admin.to_account_info(),
                    authority: ctx.accounts.escrow_authority.to_account_info(),
                },
                escrow_signer,
            ),
        )?;
    }

    msg!("Admin rescue complete. {} tokens sent to recipient. Match account closed.", escrow_balance);

    Ok(())
}
