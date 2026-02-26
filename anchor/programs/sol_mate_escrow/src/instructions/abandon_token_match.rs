use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, TokenInterface, TokenAccount, Mint, TransferChecked, CloseAccount};
use crate::state::*;
use crate::errors::*;

/// Abandon an active token match that has no winner.
/// Time-gated: only allowed within the first 2 minutes (connection issues)
/// or after 2 hours (truly stuck match). Between those windows the game is
/// locked in — if someone leaves, the remaining player wins via submit_token_result.
#[derive(Accounts)]
pub struct AbandonTokenMatch<'info> {
    #[account(
        mut,
        constraint = match_account.status == MatchStatus::Active @ EscrowError::MatchNotActive,
        constraint = match_account.winner.is_none() @ EscrowError::MatchAlreadyHasWinner,
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

    /// Player A's token account
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = player_a,
        associated_token::token_program = token_program,
    )]
    pub player_a_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Player A receives their stake back and rent from closed accounts
    #[account(
        mut,
        constraint = player_a.key() == match_account.player_a
    )]
    pub player_a: AccountInfo<'info>,

    /// Player B's token account
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = player_b,
        associated_token::token_program = token_program,
    )]
    pub player_b_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Player B receives their stake back
    #[account(
        mut,
        constraint = match_account.player_b.is_some() && player_b.key() == match_account.player_b.unwrap() @ EscrowError::InvalidPlayerB
    )]
    pub player_b: AccountInfo<'info>,

    /// The player calling this instruction (must be either player_a or player_b)
    #[account(
        constraint = caller.key() == match_account.player_a ||
                    (match_account.player_b.is_some() && caller.key() == match_account.player_b.unwrap())
                    @ EscrowError::NotAPlayer
    )]
    pub caller: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<AbandonTokenMatch>) -> Result<()> {
    let match_account = &ctx.accounts.match_account;
    let clock = Clock::get()?;

    // Time-gate: same logic as SOL abandon_match
    let seconds_since_activation = clock.unix_timestamp
        .checked_sub(match_account.activated_at)
        .ok_or(EscrowError::ArithmeticOverflow)?;

    let early_window: i64 = 120;   // 2 minutes
    let stuck_window: i64 = 7200;  // 2 hours

    let in_early_window = seconds_since_activation <= early_window;
    let in_stuck_window = seconds_since_activation >= stuck_window;

    // For legacy matches with activated_at == 0, allow abandon
    let is_legacy = match_account.activated_at == 0;

    require!(
        in_early_window || in_stuck_window || is_legacy,
        EscrowError::MatchLockedIn
    );

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

    // Refund Player A
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

    // Refund Player B
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.player_b_token_account.to_account_info(),
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

    msg!("Token match abandoned. Stakes refunded to both players.");

    Ok(())
}
