use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer as TokenTransfer, CloseAccount};
use anchor_spl::associated_token::AssociatedToken;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct ConfirmTokenPayout<'info> {
    #[account(
        mut,
        constraint = match_account.status == MatchStatus::Finished @ EscrowError::MatchNotFinished,
        close = player_a
    )]
    pub match_account: Account<'info, TokenMatch>,

    /// The SPL token mint
    #[account(
        constraint = mint.key() == match_account.mint @ EscrowError::MintMismatch,
    )]
    pub mint: Account<'info, Mint>,

    /// CHECK: PDA authority for the escrow token account
    #[account(
        seeds = [b"token_escrow", match_account.key().as_ref()],
        bump = match_account.escrow_bump
    )]
    pub escrow_authority: AccountInfo<'info>,

    /// Escrow token account holding both players' stakes
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = escrow_authority,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for the fee vault token account
    #[account(
        seeds = [b"token_fee_vault"],
        bump
    )]
    pub fee_vault_authority: AccountInfo<'info>,

    /// Fee vault token account (platform fees collected here)
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = fee_vault_authority,
    )]
    pub fee_vault_token_account: Account<'info, TokenAccount>,

    /// Winner's token account
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = winner,
    )]
    pub winner_token_account: Account<'info, TokenAccount>,

    /// CHECK: Winner receives payout — validated against match_account.winner
    #[account(mut)]
    pub winner: AccountInfo<'info>,

    /// CHECK: Player A for rent return (match account close)
    #[account(mut)]
    pub player_a: AccountInfo<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ConfirmTokenPayout>) -> Result<()> {
    let match_account = &ctx.accounts.match_account;

    // Verify winner
    let winner_key = match_account.winner.ok_or(EscrowError::MatchNotFinished)?;
    require!(
        winner_key == ctx.accounts.winner.key(),
        EscrowError::InvalidWinner
    );

    // Calculate amounts
    let stake_amount = match_account.stake_amount;
    let total_pot = stake_amount
        .checked_mul(2)
        .ok_or(EscrowError::ArithmeticOverflow)?;

    // 10% fee
    let fee_amount = total_pot
        .checked_div(10)
        .ok_or(EscrowError::ArithmeticOverflow)?;

    let payout_amount = total_pot
        .checked_sub(fee_amount)
        .ok_or(EscrowError::ArithmeticOverflow)?;

    msg!("Total pot: {} tokens", total_pot);
    msg!("Fee (10%): {} tokens", fee_amount);
    msg!("Payout to winner: {} tokens", payout_amount);

    // Build escrow authority PDA signer seeds
    let match_key = ctx.accounts.match_account.key();
    let escrow_seeds = &[
        b"token_escrow".as_ref(),
        match_key.as_ref(),
        &[ctx.accounts.match_account.escrow_bump],
    ];
    let escrow_signer = &[&escrow_seeds[..]];

    // Transfer fee to fee vault
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TokenTransfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.fee_vault_token_account.to_account_info(),
                authority: ctx.accounts.escrow_authority.to_account_info(),
            },
            escrow_signer,
        ),
        fee_amount,
    )?;

    // Transfer payout to winner
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TokenTransfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.winner_token_account.to_account_info(),
                authority: ctx.accounts.escrow_authority.to_account_info(),
            },
            escrow_signer,
        ),
        payout_amount,
    )?;

    // Close escrow token account — return rent lamports to player_a
    token::close_account(
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

    msg!("Token payout complete. Match account closed.");

    Ok(())
}
