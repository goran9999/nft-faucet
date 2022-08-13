use std::{borrow::Borrow, mem::size_of};

use crate::{
    error::VestmenErrors,
    state::{NftVestingData, NftVestmentRecord},
};
use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke_signed, system_instruction::create_account, system_program},
    Discriminator,
};
use anchor_spl::token::{self, Token};
use itertools::Itertools;

#[derive(Accounts)]
pub struct VestNfts<'info> {
    #[account(init,payer=nft_vestor,seeds=[b"nft-vesting",nft_vestor.key().as_ref()],bump,space=8+size_of::<NftVestingData>())]
    pub nft_vesting_data: Account<'info, NftVestingData>,
    #[account(init,payer=nft_vestor,seeds=[b"nft-vesting",b"vested-nfts",nft_vesting_data.key().as_ref()],bump,space=0,owner=system_program::ID)]
    ///CHECK: system account
    pub vested_nfts_owner: UncheckedAccount<'info>,
    #[account(mut)]
    nft_vestor: Signer<'info>,
    //sysvars
    system_program: Program<'info, System>,
    clock: Sysvar<'info, Clock>,
    token_program: Program<'info, Token>,
    rent: Sysvar<'info, Rent>,
}

pub fn vest_nfts<'a, 'b, 'c, 'info>(
    ctx: Context<'a, 'b, 'c, 'info, VestNfts<'info>>,
    dedicated_consumers: Vec<Option<Pubkey>>,
    nft_number: u32,
    collection_address: Option<Pubkey>,
    cliff_dates: Vec<Option<i64>>,
) -> Result<()> {
    let remaining_accounts_len = ctx.remaining_accounts.len().checked_div(4).unwrap();

    require!(
        remaining_accounts_len == cliff_dates.len(),
        VestmenErrors::MissingCliffPeriod
    );

    require!(
        dedicated_consumers.len() == remaining_accounts_len,
        VestmenErrors::MissingDedicatedConsumers
    );

    let nft_vesting_data = &mut ctx.accounts.nft_vesting_data;
    nft_vesting_data.nft_collection_address = collection_address;
    nft_vesting_data.nft_vested_amount = nft_number;
    nft_vesting_data.nft_vestment_creator = ctx.accounts.nft_vestor.key();
    let current_timestamp = Clock::get().unwrap().unix_timestamp;
    nft_vesting_data.vestment_initialized_at = current_timestamp;

    let counter = 0;

    for (associated_ta, nft_mint, vested_tokens, nft_vestment_record_ra) in
        ctx.remaining_accounts.iter().tuples()
    {
        require!(
            nft_vestment_record_ra.data_len() == 0,
            VestmenErrors::NftRecordAlredyInitialized
        );

        let mut nft_vestment_record: Vec<u8> = Vec::new();
        nft_vestment_record.extend_from_slice(&NftVestmentRecord::discriminator());

        let cliff_start = match cliff_dates.get(counter).unwrap() {
            Some(date) => date.clone(),
            None => current_timestamp,
        };

        let nft_vestment_record_data: Vec<u8> = NftVestmentRecord {
            cliff_date: cliff_start,
            nft_mint: nft_mint.key.clone(),
            source_token_account: associated_ta.key.clone(),
            dedicated_consumer: dedicated_consumers.get(counter).unwrap().clone(),
        }
        .try_to_vec()?;
        nft_vestment_record.extend_from_slice(&nft_vestment_record_data);
        let (pda, bump) = Pubkey::find_program_address(
            &[
                b"nft-record",
                nft_mint.key.as_ref(),
                nft_vesting_data.key().as_ref(),
            ],
            ctx.program_id,
        );
        let account_size = nft_vestment_record.len();

        let rent = Rent::get()?;
        let create_account_ix = create_account(
            &ctx.accounts.nft_vestor.key,
            pda.borrow(),
            rent.minimum_balance(account_size),
            account_size.try_into().unwrap(),
            &ctx.program_id,
        );

        invoke_signed(
            &create_account_ix,
            &[
                ctx.accounts.nft_vestor.to_account_info().clone(),
                nft_vestment_record_ra.clone(),
                ctx.accounts.system_program.to_account_info().clone(),
            ],
            &[&[
                b"nft-record",
                nft_mint.key.as_ref(),
                nft_vesting_data.key().as_ref(),
                &[bump],
            ]],
        )?;
        nft_vestment_record_ra
            .data
            .borrow_mut()
            .copy_from_slice(&nft_vestment_record);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: associated_ta.clone(),
                    authority: ctx.accounts.nft_vestor.to_account_info(),
                    to: vested_tokens.to_account_info(),
                },
            ),
            1,
        )
        .unwrap();
    }
    Ok(())
}
