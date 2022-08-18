use std::borrow::Borrow;
use std::mem::size_of;

use crate::error::VestmenErrors;
use crate::state::{NftCollectionData, NftMetadataData};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_spl::token::{self, Mint, Token};
use itertools::Itertools;
use mpl_token_metadata::state::{Collection, Creator};
use mpl_token_metadata::{
    instruction::{create_master_edition_v3, create_metadata_accounts_v3},
    ID,
};

#[derive(Accounts)]
pub struct MintNftCollection<'info> {
    #[account(init,payer=nft_authority,seeds=[b"nft-minting",nft_authority.key.as_ref(),collection_address.key().as_ref()],bump,space=8+size_of::<NftCollectionData>())]
    pub nft_collection_data: Account<'info, NftCollectionData>,
    #[account(mut)]
    nft_authority: Signer<'info>,
    #[account()]
    pub collection_address: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
    pub rent: Sysvar<'info, Rent>,
    ///CHECK:metadata program
    pub metadata_program: AccountInfo<'info>,
}

pub fn mint_nft_collection<'a, 'b, 'c, 'info>(
    ctx: Context<'a, 'b, 'c, 'info, MintNftCollection<'info>>,
    nft_metadata_data: Vec<NftMetadataData>,
) -> Result<()> {
    let nft_collecton_data = &mut ctx.accounts.nft_collection_data;
    let current_timestamp = Clock::get().unwrap().unix_timestamp;
    nft_collecton_data.mint_timestamp = current_timestamp;
    nft_collecton_data.number_of_nfts = ctx.remaining_accounts.len().checked_div(4).unwrap() as u32;
    nft_collecton_data.collection_address = ctx.accounts.collection_address.key();

    require!(
        nft_metadata_data.len() == ctx.remaining_accounts.len().checked_div(4).unwrap(),
        VestmenErrors::MissingMetadataData
    );

    let mut counter = 0;
    for (nft_mint, associated_token_account, metadata_pda, edition_pda) in
        ctx.remaining_accounts.iter().tuples()
    {
        token::mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::MintTo {
                    mint: nft_mint.clone(),
                    to: associated_token_account.clone(),
                    authority: ctx.accounts.nft_authority.to_account_info().clone(),
                },
            ),
            1,
        )
        .unwrap();

        let metadata_account = Pubkey::find_program_address(
            &[b"metadata", ID.as_ref(), nft_mint.key().as_ref()],
            ID.borrow(),
        )
        .0;
        require!(
            metadata_account == metadata_pda.key(),
            RequireKeysEqViolated
        );

        let metadata_data = nft_metadata_data.get(counter).unwrap();
        let create_metadata_ix = create_metadata_accounts_v3(
            ID,
            metadata_pda.key(),
            nft_mint.key(),
            ctx.accounts.nft_authority.key(),
            ctx.accounts.nft_authority.key(),
            ctx.accounts.nft_authority.key(),
            metadata_data.name.clone(),
            metadata_data.symbol.clone(),
            metadata_data.uri.clone(),
            Some(vec![Creator {
                address: ctx.accounts.nft_authority.key(),
                share: 100,
                verified: false,
            }]),
            0,
            true,
            true,
            Some(Collection {
                key: ctx.accounts.collection_address.key(),
                verified: false,
            }),
            None,
            None,
        );
        counter = counter.checked_add(1).unwrap();
        invoke(
            &create_metadata_ix,
            &[
                metadata_pda.to_account_info(),
                nft_mint.to_account_info(),
                ctx.accounts.nft_authority.to_account_info().clone(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.rent.to_account_info(),
                ctx.accounts.metadata_program.to_account_info(),
            ],
        )?;
        let edition = Pubkey::find_program_address(
            &[
                b"metadata",
                ID.as_ref(),
                nft_mint.key().as_ref(),
                b"edition",
            ],
            ID.borrow(),
        )
        .0;
        require!(edition == edition_pda.key(), RequireKeysEqViolated);
        let create_masted_edition_ix = create_master_edition_v3(
            ID,
            edition_pda.key(),
            nft_mint.key(),
            ctx.accounts.nft_authority.key(),
            ctx.accounts.nft_authority.key(),
            metadata_pda.key(),
            ctx.accounts.nft_authority.key(),
            Some(1),
        );
        invoke(
            &create_masted_edition_ix,
            &[
                metadata_pda.to_account_info(),
                nft_mint.clone(),
                edition_pda.to_account_info(),
                ctx.accounts.nft_authority.to_account_info().clone(),
                ctx.accounts.metadata_program.to_account_info(),
                ctx.accounts.rent.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
    }
    Ok(())
}
