use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Mint, Token, TokenAccount, Transfer};

use crate::{
    error::VestmenErrors,
    state::{NftVestingData, NftVestmentRecord},
};

#[derive(Accounts)]
pub struct ClaimNft<'info> {
    #[account(mut,seeds=[b"nft-vesting",nft_vestor.key().as_ref()],bump)]
    pub nft_vesting_data: Account<'info, NftVestingData>,
    #[account(mut,seeds=[b"nft-vesting",b"vested-nfts",nft_vesting_data.key().as_ref()],bump)]
    pub vested_nfts_owner: SystemAccount<'info>,
    #[account(mut,seeds=[b"nft-record",nft_mint.key().as_ref(),nft_vesting_data.key().as_ref(),nft_consumer.key.as_ref()],bump)]
    pub nft_vestment_record: Account<'info, NftVestmentRecord>,
    #[account()]
    nft_mint: Account<'info, Mint>,
    #[account(mut)]
    pub nft_vestor: SystemAccount<'info>,
    #[account(mut)]
    vested_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    nft_consumer: Signer<'info>,
    #[account(mut,constraint=destination_token_account.mint==nft_mint.key() @VestmenErrors::WrongTokenAccMint)]
    pub destination_token_account: Account<'info, TokenAccount>,
    //sysvars
    clock: Sysvar<'info, Clock>,
    token_program: Program<'info, Token>,
}

pub fn claim_vested_nft(ctx: Context<ClaimNft>) -> Result<()> {
    let nft_vesting_data = &mut ctx.accounts.nft_vesting_data;
    let nft_vestment_record = &mut ctx.accounts.nft_vestment_record;

    require!(
        nft_vestment_record.dedicated_consumer == ctx.accounts.nft_consumer.key(),
        VestmenErrors::WrongClaimAuthority
    );

    let current_timestamp = Clock::get().unwrap().unix_timestamp;
    msg!("Current {}", current_timestamp);
    msg!("Cliff {}", nft_vestment_record.cliff_date);
    require!(
        current_timestamp >= nft_vestment_record.cliff_date,
        VestmenErrors::VestmentNotStarted
    );
    nft_vesting_data.nft_vested_amount.checked_sub(1).unwrap();
    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vested_token_account.to_account_info(),
                to: ctx.accounts.destination_token_account.to_account_info(),
                authority: ctx.accounts.vested_nfts_owner.to_account_info(),
            },
            &[&[
                b"nft-vesting",
                b"vested-nfts",
                ctx.accounts.nft_vesting_data.key().as_ref(),
                &[*ctx.bumps.get(&"vested_nfts_owner".to_string()).unwrap()],
            ]],
        ),
        1,
    )?;
    Ok(())
}
