use anchor_lang::prelude::*;

#[error_code]
pub enum EscrowError {
    #[msg("Invalid stake tier. Must be 0 (0.5 SOL), 1 (1 SOL), 2 (5 SOL), or 3 (10 SOL)")]
    InvalidStakeTier,
    
    #[msg("Match is not in Open status")]
    MatchNotOpen,
    
    #[msg("Match is not in Active status")]
    MatchNotActive,
    
    #[msg("Match is not in Finished status")]
    MatchNotFinished,
    
    #[msg("Join deadline has passed")]
    JoinDeadlinePassed,
    
    #[msg("Cannot join your own match")]
    CannotJoinOwnMatch,
    
    #[msg("Only match creator can cancel")]
    OnlyCreatorCanCancel,
    
    #[msg("Cannot cancel after someone joined")]
    CannotCancelAfterJoin,
    
    #[msg("Invalid winner address")]
    InvalidWinner,
    
    #[msg("Only players can submit result")]
    OnlyPlayersCanSubmit,
    
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    
    #[msg("Match already has a winner")]
    MatchAlreadyFinished,
}
