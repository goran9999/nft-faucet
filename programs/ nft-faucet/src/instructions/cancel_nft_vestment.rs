use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::state::{NftVestingData, NftVestmentRecord};

#[derive(Accounts)]
pub struct CancelNftVestment<'info> {
    #[account(seeds=[b"nft-vesting",nft_vestor.key().as_ref()],bump)]
    nft_vesting_data: Account<'info, NftVestingData>,
    #[account(mut)]
    nft_vestor: Signer<'info>,
    #[account(seeds=[b"nft-record",nft_mint.key().as_ref(),nft_vesting_data.key().as_ref(),dedicated_consumer.key().as_ref()],bump)]
    nft_vestment_record: Account<'info, NftVestmentRecord>,
    #[account()]
    nft_mint: Account<'info, Mint>,
    #[account(seeds=[b"nft-vesting",b"vested-nfts",nft_vesting_data.key().as_ref()],bump)]
    vested_nfts_owner: SystemAccount<'info>,
    #[account()]
    dedicated_consumer: SystemAccount<'info>,
    #[account(seeds=[b"vested-nft",vested_nfts_owner.key().as_ref(),nft_mint.key().as_ref()],bump)]
    vested_nft_account: Account<'info, TokenAccount>,
    token_account: Program<'info, Token>,
}
