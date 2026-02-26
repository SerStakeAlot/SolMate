use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod errors;

// Re-export everything from instructions for Anchor macros
pub use instructions::*;

declare_id!("79mzfYBWp6thaU5pYLJLpNBXCrSoZVVyttTHuWx732cr");

#[program]
pub mod sol_mate_escrow {
    use super::*;

    // ========== SOL Wager Instructions ==========

    pub fn create_match(
        ctx: Context<CreateMatch>,
        stake_tier: u8,
        seed: u64,
        join_deadline: i64,
    ) -> Result<()> {
        crate::instructions::create_match::handler(ctx, stake_tier, seed, join_deadline)
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

    pub fn abandon_match(ctx: Context<AbandonMatch>) -> Result<()> {
        crate::instructions::abandon_match::handler(ctx)
    }

    pub fn force_refund(ctx: Context<ForceRefund>) -> Result<()> {
        crate::instructions::force_refund::handler(ctx)
    }

    pub fn withdraw_fees(ctx: Context<WithdrawFees>, amount: u64) -> Result<()> {
        crate::instructions::withdraw_fees::handler(ctx, amount)
    }

    pub fn admin_rescue(ctx: Context<AdminRescue>) -> Result<()> {
        crate::instructions::admin_rescue::handler(ctx)
    }

    // ========== Token Wager Instructions ($MATE / $SKR) ==========

    pub fn create_token_match(
        ctx: Context<CreateTokenMatch>,
        stake_tier: u8,
        seed: u64,
        join_deadline: i64,
    ) -> Result<()> {
        crate::instructions::create_token_match::handler(ctx, stake_tier, seed, join_deadline)
    }

    pub fn join_token_match(ctx: Context<JoinTokenMatch>) -> Result<()> {
        crate::instructions::join_token_match::handler(ctx)
    }

    pub fn submit_token_result(ctx: Context<SubmitTokenResult>, winner: Pubkey) -> Result<()> {
        crate::instructions::submit_token_result::handler(ctx, winner)
    }

    pub fn confirm_token_payout(ctx: Context<ConfirmTokenPayout>) -> Result<()> {
        crate::instructions::confirm_token_payout::handler(ctx)
    }

    pub fn cancel_token_match(ctx: Context<CancelTokenMatch>) -> Result<()> {
        crate::instructions::cancel_token_match::handler(ctx)
    }

    pub fn abandon_token_match(ctx: Context<AbandonTokenMatch>) -> Result<()> {
        crate::instructions::abandon_token_match::handler(ctx)
    }

    pub fn force_token_refund(ctx: Context<ForceTokenRefund>) -> Result<()> {
        crate::instructions::force_token_refund::handler(ctx)
    }

    pub fn withdraw_token_fees(ctx: Context<WithdrawTokenFees>, amount: u64) -> Result<()> {
        crate::instructions::withdraw_token_fees::handler(ctx, amount)
    }

    pub fn admin_rescue_token(ctx: Context<AdminRescueToken>) -> Result<()> {
        crate::instructions::admin_rescue_token::handler(ctx)
    }
}
