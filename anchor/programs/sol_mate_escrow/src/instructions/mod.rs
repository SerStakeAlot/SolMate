pub mod create_match;
pub mod join_match;
pub mod submit_result;
pub mod confirm_payout;
pub mod cancel_match;
pub mod withdraw_fees;
pub mod abandon_match;
pub mod force_refund;

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
