pub mod create_match;
pub mod join_match;
pub mod submit_result;
pub mod confirm_payout;
pub mod cancel_match;
pub mod withdraw_fees;
pub mod abandon_match;
pub mod force_refund;
pub mod admin_rescue;
pub mod create_token_match;
pub mod join_token_match;
pub mod submit_token_result;
pub mod confirm_token_payout;
pub mod cancel_token_match;
pub mod abandon_token_match;
pub mod force_token_refund;
pub mod withdraw_token_fees;
pub mod admin_rescue_token;

// Re-export the account structs (required by Anchor macros)
// The handler name collision is expected - each is used with full path
#[allow(ambiguous_glob_reexports)]
pub use create_match::*;
pub use join_match::*;
pub use submit_result::*;
pub use confirm_payout::*;
pub use cancel_match::*;
pub use withdraw_fees::*;
pub use abandon_match::*;
pub use force_refund::*;
pub use admin_rescue::*;
pub use create_token_match::*;
pub use join_token_match::*;
pub use submit_token_result::*;
pub use confirm_token_payout::*;
pub use cancel_token_match::*;
pub use abandon_token_match::*;
pub use force_token_refund::*;
pub use withdraw_token_fees::*;
pub use admin_rescue_token::*;
