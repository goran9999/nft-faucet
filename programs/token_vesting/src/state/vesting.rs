use anchor_lang::prelude::*;
#[derive(Debug)]
#[account]
pub struct VestmentData {
    pub vestor: Pubkey,
    pub consumer: Pubkey,
    pub vestment_start: i64,
    pub vestment_mint: Pubkey,
    pub amount: u64,
    pub vestment_end: i64,
    pub cliff: i64,
}
