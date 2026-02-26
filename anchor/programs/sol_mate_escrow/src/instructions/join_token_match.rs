use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer as TokenTransfer};
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct JoinTokenMatch<'info> {
    #[account(
        mut,
        constraint = match_account.status == MatchStatus::Open @ EscrowError::MatchNotOpen,
    )]
    pub match_account: Account<'info, TokenMatch>,

    /// The SPL token mint (must match match_account.mint)
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

    /// Escrow token account (already created during create_token_match)
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = escrow_authority,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    /// Player B's token account
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = player_b,
    )]
    pub player_b_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub player_b: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<JoinTokenMatch>) -> Result<()> {
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

    let stake_amount = match_account.stake_amount;

    // Transfer tokens from player B to escrow
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TokenTransfer {
                from: ctx.accounts.player_b_token_account.to_account_info(),
                to: ctx.accounts.escrow_token_account.to_account_info(),
                authority: ctx.accounts.player_b.to_account_info(),
            },
        ),
        stake_amount,
    )?;

    // Update match state
    match_account.player_b = Some(ctx.accounts.player_b.key());
    match_account.status = MatchStatus::Active;
    match_account.activated_at = clock.unix_timestamp;

    msg!("Player B joined token match. Match is now Active.");
    msg!("Escrow holds {} raw token units", stake_amount * 2);

    Ok(())
}
