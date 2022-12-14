use anchor_lang::prelude::{
    borsh::{BorshDeserialize, BorshSchema, BorshSerialize},
    *,
};

#[account]
#[derive(Debug)]
pub struct EscrowData {
    pub escrow_initializer: Pubkey,
    pub source_token_account: Pubkey,
    pub offered_amount: u64,
    pub wanted_amount: u64,
    pub offered_mint: Pubkey,
    pub wanted_mint: Pubkey,
    pub escrow_token_account: Pubkey,
    pub escrow_initialized_at: i64,
    pub offer_status: OfferStatus,
}
#[derive(Debug, BorshSchema, BorshSerialize, BorshDeserialize, Clone)]
pub enum OfferStatus {
    Initialized,
    Accepted,
    Cancelled,
}
