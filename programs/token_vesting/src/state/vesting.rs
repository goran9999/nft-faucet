use anchor_lang::prelude::*;
#[derive(Debug)]
#[account]
pub struct VestmentData {
    pub vestor: Pubkey,
    pub consumer: Pubkey,
    pub vestment_start: i64,
    pub vestment_mint: Pubkey,
    pub release_time: i64,
    pub amount: u64,
    pub vestment_end: i64,
    pub release_amount: u64,
    pub cliff_date: Option<i64>,
    pub cliff_release_amount: u64,
    pub has_cliffed: bool,
    pub vestor_cancel_authority: Option<Pubkey>,
    pub consumer_cancel_authority: Option<Pubkey>,
    pub last_vestment: i64,
    pub withdrawn_amount: u64,
}
