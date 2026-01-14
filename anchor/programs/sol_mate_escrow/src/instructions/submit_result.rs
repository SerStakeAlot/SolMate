use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct SubmitResult<'info> {
    #[account(
        mut,
        constraint = match_account.status == MatchStatus::Active @ EscrowError::MatchNotActive,
    )]
    pub match_account: Account<'info, Match>,
    
    #[account(
        constraint = submitter.key() == match_account.player_a 
                  || submitter.key() == match_account.player_b.unwrap() 
                  @ EscrowError::OnlyPlayersCanSubmit
    )]
    pub submitter: Signer<'info>,
}

pub fn handler(ctx: Context<SubmitResult>, winner: Pubkey) -> Result<()> {
    let match_account = &mut ctx.accounts.match_account;
    
    // Validate winner is one of the players
    let player_b = match_account.player_b.ok_or(EscrowError::MatchNotActive)?;
    require!(
        winner == match_account.player_a || winner == player_b,
        EscrowError::InvalidWinner
    );
    
    // Update match state
    match_account.winner = Some(winner);
    match_account.status = MatchStatus::Finished;
    
    msg!("Match finished. Winner: {}", winner);
    
    Ok(())
}
