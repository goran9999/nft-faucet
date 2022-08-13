use anchor_lang::prelude::*;

#[derive(Debug)]
#[account]
pub struct NftVestingData {
    pub nft_vestment_creator: Pubkey,
    pub nft_vested_amount: u32,
    pub vestment_initialized_at: i64,
    pub nft_collection_address: Option<Pubkey>,
}

#[derive(Debug, PartialEq)]
#[account]
pub struct NftVestmentRecord {
    pub nft_mint: Pubkey,
    pub cliff_date: i64,
    pub source_token_account: Pubkey,
    pub dedicated_consumer: Option<Pubkey>,
}
