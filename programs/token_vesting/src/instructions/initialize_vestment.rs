use std::mem::size_of;

use crate::{error::VestmenErrors, state::VestmentData};
use anchor_lang::context::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Mint, Token, TokenAccount, Transfer};

#[derive(Accounts)]
#[instruction()]
pub struct InitializeVestment<'info> {
    #[account(mut,constraint=source_token_account.mint==vestment_mint.key() @ VestmenErrors::WrongTokenAccMint)]
    source_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    vestor: Signer<'info>,
    consumer: SystemAccount<'info>,
    #[account()]
    vestment_mint: Account<'info, Mint>,
    #[account(init,payer=vestor,seeds=[b"vestment",vestor.key().as_ref(),consumer.key().as_ref()],bump,space=8+size_of::<VestmentData>())]
    vestment_data: Account<'info, VestmentData>,
    #[account(init,payer=vestor,seeds=[b"vestment",vestment_mint.key().as_ref()],bump,token::mint=vestment_mint,token::authority=vested_tokens)]
    vested_tokens: Account<'info, TokenAccount>,
    system_program: Program<'info, System>,
    clock: Sysvar<'info, Clock>,
    token_program: Program<'info, Token>,
    rent: Sysvar<'info, Rent>,
}

pub fn initialize_vestmet(
    ctx: Context<InitializeVestment>,
    amount: u64,
    release_amount: u64,
    vestment_start: i64,
    vestment_end: i64,
    release_period: i64,
    cliff_start: Option<i64>,
    cliff_percentage: Option<u64>,
) -> Result<()> {
    let vestment_data = &mut ctx.accounts.vestment_data;
    vestment_data.amount = amount;
    vestment_data.consumer = ctx.accounts.consumer.key();
    vestment_data.vestor = ctx.accounts.vestor.key();
    vestment_data.vestment_mint = ctx.accounts.vestment_mint.key();
    vestment_data.vestment_start = vestment_start;
    vestment_data.vestment_end = vestment_end;
    vestment_data.cliff_date = cliff_start;
    vestment_data.release_amount = release_amount;
    vestment_data.release_time = release_period;
    vestment_data.has_cliffed = false;

    vestment_data.cliff_release_amount = match cliff_percentage {
        Some(amount) => amount,
        None => 0,
    };

    let accounts_iter = &mut ctx.remaining_accounts.iter();
    let vestor_authority = match next_account_info(accounts_iter) {
        Ok(vestor) => vestor.key().into(),
        _ => None,
    };
    let consumer_authority = match next_account_info(accounts_iter) {
        Ok(consumer) => consumer.key().into(),
        _ => None,
    };

    vestment_data
        .cancel_authorities
        .append(&mut vec![vestor_authority, consumer_authority]);

    match transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.source_token_account.to_account_info(),
                to: ctx.accounts.vested_tokens.to_account_info(),
                authority: ctx.accounts.vestor.to_account_info(),
            },
        ),
        amount,
    ) {
        Ok(()) => Ok(()),
        _ => Ok(msg!("Problem sending tokens")),
    }
}
