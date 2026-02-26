use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::state::*;
use crate::errors::*;
use super::withdraw_fees::get_admin_pubkey;

/// Admin rescue: drain escrow funds from a stuck/missubmitted match to a
/// specified recipient. Only callable by the platform admin wallet.
/// Works on ANY match status (Active, Finished, etc.) and closes the match account.
#[derive(Accounts)]
pub struct AdminRescue<'info> {
    #[account(
        mut,
        close = admin
    )]
    pub match_account: Account<'info, Match>,

    #[account(
        mut,
        seeds = [b"escrow", match_account.key().as_ref()],
        bump = match_account.escrow_bump
    )]
    /// CHECK: PDA for holding escrow funds
    pub escrow: AccountInfo<'info>,

    /// CHECK: The wallet that will receive the rescued funds
    #[account(mut)]
    pub recipient: AccountInfo<'info>,

    /// Platform admin — must be the hardcoded admin pubkey
    #[account(
        mut,
        constraint = admin.key() == get_admin_pubkey() @ EscrowError::Unauthorized
    )]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<AdminRescue>) -> Result<()> {
    let match_account = &ctx.accounts.match_account;
    let escrow_balance = ctx.accounts.escrow.lamports();

    msg!("Admin rescue initiated");
    msg!("Match status: {:?}", match_account.status);
    msg!("Escrow balance: {} lamports", escrow_balance);
    msg!("Recipient: {}", ctx.accounts.recipient.key());

    if escrow_balance > 0 {
        // Build escrow signer seeds
        let match_key = match_account.key();
        let escrow_bump = match_account.escrow_bump;
        let escrow_seeds: &[&[u8]] = &[
            b"escrow",
            match_key.as_ref(),
            &[escrow_bump],
        ];

        // Transfer all escrow funds to recipient
        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow.to_account_info(),
                    to: ctx.accounts.recipient.to_account_info(),
                },
                &[escrow_seeds],
            ),
            escrow_balance,
        )?;
    }

    msg!("Admin rescue complete. {} lamports sent to recipient. Match account closed.", escrow_balance);

    Ok(())
}
