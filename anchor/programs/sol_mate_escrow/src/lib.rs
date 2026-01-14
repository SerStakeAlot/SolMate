use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod errors;

// Re-export everything from instructions for Anchor macros
pub use instructions::*;

declare_id!("H1Sn4JQvsZFx7HreZaQn4Poa3hkoS9iGnTwrtN2knrKV");

#[program]
pub mod sol_mate_escrow {
    use super::*;

    pub fn create_match(
        ctx: Context<CreateMatch>,
        stake_tier: u8,
        join_deadline: i64,
    ) -> Result<()> {
        crate::instructions::create_match::handler(ctx, stake_tier, join_deadline)
    }

    pub fn join_match(ctx: Context<JoinMatch>) -> Result<()> {
        crate::instructions::join_match::handler(ctx)
    }

    pub fn submit_result(ctx: Context<SubmitResult>, winner: Pubkey) -> Result<()> {
        crate::instructions::submit_result::handler(ctx, winner)
    }

    pub fn confirm_payout(ctx: Context<ConfirmPayout>) -> Result<()> {
        crate::instructions::confirm_payout::handler(ctx)
    }

    pub fn cancel_match(ctx: Context<CancelMatch>) -> Result<()> {
        crate::instructions::cancel_match::handler(ctx)
    }

    pub fn withdraw_fees(ctx: Context<WithdrawFees>, amount: u64) -> Result<()> {
        crate::instructions::withdraw_fees::handler(ctx, amount)
    }
}
