pub mod create_match;
pub mod join_match;
pub mod submit_result;
pub mod confirm_payout;
pub mod cancel_match;

// Re-export the account structs (required by Anchor macros)
// The handler name collision is expected - each is used with full path
#[allow(ambiguous_glob_reexports)]
pub use create_match::*;
pub use join_match::*;
pub use submit_result::*;
pub use confirm_payout::*;
pub use cancel_match::*;
