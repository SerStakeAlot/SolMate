use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, TokenInterface, TokenAccount, Mint, TransferChecked};
use anchor_spl::associated_token::AssociatedToken;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(stake_tier: u8, seed: u64)]
pub struct CreateTokenMatch<'info> {
    #[account(
        init,
        payer = player_a,
        space = TokenMatch::LEN,
        seeds = [b"token_match", player_a.key().as_ref(), &seed.to_le_bytes()],
        bump
    )]
    pub match_account: Account<'info, TokenMatch>,

    /// The SPL token mint ($MATE or $SKR) — supports both Token and Token-2022
    pub mint: InterfaceAccount<'info, Mint>,

    /// CHECK: PDA authority for the escrow token account
    #[account(
        seeds = [b"token_escrow", match_account.key().as_ref()],
        bump
    )]
    pub escrow_authority: AccountInfo<'info>,

    /// Escrow token account (ATA owned by escrow_authority PDA)
    #[account(
        init,
        payer = player_a,
        associated_token::mint = mint,
        associated_token::authority = escrow_authority,
        associated_token::token_program = token_program,
    )]
    pub escrow_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Player A's token account
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = player_a,
        associated_token::token_program = token_program,
    )]
    pub player_a_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub player_a: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateTokenMatch>,
    stake_tier: u8,
    seed: u64,
    join_deadline: i64,
) -> Result<()> {
    msg!("Creating token match with seed: {}", seed);

    let mint_key = ctx.accounts.mint.key();

    // Validate mint and get stake amount
    let stake_amount = TokenMatch::get_stake_amount(&mint_key, stake_tier)
        .ok_or(EscrowError::InvalidMint)?;

    let match_account = &mut ctx.accounts.match_account;
    match_account.player_a = ctx.accounts.player_a.key();
    match_account.player_b = None;
    match_account.mint = mint_key;
    match_account.stake_tier = stake_tier;
    match_account.stake_amount = stake_amount;
    match_account.join_deadline = join_deadline;
    match_account.status = MatchStatus::Open;
    match_account.winner = None;
    match_account.bump = ctx.bumps.match_account;
    match_account.escrow_bump = ctx.bumps.escrow_authority;
    match_account.activated_at = 0;

    // Transfer tokens from player A to escrow (transfer_checked for Token-2022 compat)
    let decimals = ctx.accounts.mint.decimals;
    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.player_a_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.escrow_token_account.to_account_info(),
                authority: ctx.accounts.player_a.to_account_info(),
            },
        ),
        stake_amount,
        decimals,
    )?;

    msg!("Token match created. Mint: {}, Tier: {}, Stake: {} raw units", mint_key, stake_tier, stake_amount);
    msg!("Join deadline: {}", join_deadline);

    Ok(())
}
