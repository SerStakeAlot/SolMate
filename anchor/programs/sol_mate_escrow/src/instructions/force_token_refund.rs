use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, TokenInterface, TokenAccount, Mint, TransferChecked, CloseAccount};
use crate::state::*;
use crate::errors::*;

/// Force refund from a stuck Active token match (e.g., both players abandoned).
/// Either player can call this to recover funds.
/// Both players get their stakes refunded (split whatever is in escrow).
/// NOTE: Cannot be called on Finished matches — once a winner is declared,
/// only confirm_token_payout can release funds to prevent loser from stealing.
#[derive(Accounts)]
pub struct ForceTokenRefund<'info> {
    #[account(
        mut,
        constraint = match_account.status == MatchStatus::Active @ EscrowError::MatchNotActive,
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

pub fn handler(ctx: Context<ForceTokenRefund>) -> Result<()> {
    let match_account = &ctx.accounts.match_account;

    // Get current token balance in escrow
    let escrow_balance = ctx.accounts.escrow_token_account.amount;
    let decimals = ctx.accounts.mint.decimals;

    msg!("Force refunding from stuck Active token match");
    msg!("Escrow token balance: {} raw units", escrow_balance);

    // Build escrow authority PDA signer seeds
    let match_key = match_account.key();
    let escrow_seeds = &[
        b"token_escrow".as_ref(),
        match_key.as_ref(),
        &[match_account.escrow_bump],
    ];
    let escrow_signer = &[&escrow_seeds[..]];

    // Split whatever is in escrow between both players
    let per_player = escrow_balance / 2;
    let remainder = escrow_balance - (per_player * 2);

    // Refund Player A (gets remainder if any)
    if per_player + remainder > 0 {
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
            per_player + remainder,
            decimals,
        )?;
    }

    // Refund Player B
    if per_player > 0 {
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
            per_player,
            decimals,
        )?;
    }

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

    msg!("Force refund complete. Both players refunded.");

    Ok(())
}
