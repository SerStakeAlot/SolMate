use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, TokenInterface, TokenAccount, Mint, TransferChecked, CloseAccount};
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct CancelTokenMatch<'info> {
    #[account(
        mut,
        constraint = match_account.status == MatchStatus::Open @ EscrowError::MatchNotOpen,
        constraint = match_account.player_b.is_none() @ EscrowError::CannotCancelAfterJoin,
        close = player_a
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

    /// Player A's token account (refund destination)
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = player_a,
        associated_token::token_program = token_program,
    )]
    pub player_a_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = player_a.key() == match_account.player_a @ EscrowError::OnlyCreatorCanCancel
    )]
    pub player_a: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CancelTokenMatch>) -> Result<()> {
    let match_account = &ctx.accounts.match_account;
    let stake_amount = match_account.stake_amount;
    let decimals = ctx.accounts.mint.decimals;

    // Build escrow authority PDA signer seeds
    let match_key = match_account.key();
    let escrow_seeds = &[
        b"token_escrow".as_ref(),
        match_key.as_ref(),
        &[match_account.escrow_bump],
    ];
    let escrow_signer = &[&escrow_seeds[..]];

    // Transfer tokens back to player A
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.player_a_token_account.to_account_info(),
                authority: ctx.accounts.escrow_authority.to_account_info(),
            },
            escrow_signer,
        ),
        stake_amount,
        decimals,
    )?;

    // Close escrow token account — return rent to player A
    token_interface::close_account(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            CloseAccount {
                account: ctx.accounts.escrow_token_account.to_account_info(),
                destination: ctx.accounts.player_a.to_account_info(),
                authority: ctx.accounts.escrow_authority.to_account_info(),
            },
            escrow_signer,
        ),
    )?;

    msg!("Token match cancelled. Stake refunded to player A.");

    Ok(())
}
