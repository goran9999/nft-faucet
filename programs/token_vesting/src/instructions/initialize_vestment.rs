use std::mem::size_of;

use crate::{error::VestmenErrors, state::VestmentData};
use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Mint, Token, TokenAccount, Transfer};

#[derive(Accounts)]
#[instruction()]
pub struct InitializeVestment<'info> {
    #[account()]
    vested_mint: Account<'info, Mint>,
    #[account(mut,constraint=source_token_account.mint==vested_mint.key() @ VestmenErrors::WrongTokenAccMint)]
    source_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    vestor: Signer<'info>,
    #[account(init,payer=vestor,seeds=[b"vestment",vested_mint.key().as_ref()],bump,token::mint=vested_mint,token::authority=vested_tokens)]
    vested_tokens: Account<'info, TokenAccount>,
    #[account(init,payer=vestor,seeds=[b"vestment",vestor.key().as_ref()],bump,space=8+size_of::<VestmentData>())]
    vestment_data: Account<'info, VestmentData>,
    consumer: SystemAccount<'info>,
    system_program: Program<'info, System>,
    clock: Sysvar<'info, Clock>,
    token_program: Program<'info, Token>,
    rent: Sysvar<'info, Rent>,
}

pub fn initialize_vestmet(
    ctx: Context<InitializeVestment>,
    amount: u64,
    duration: i64,
    cliff: i64,
) -> Result<()> {
    let vestment_data = &mut ctx.accounts.vestment_data;
    vestment_data.amount = amount;
    vestment_data.consumer = ctx.accounts.consumer.key();
    vestment_data.vestor = ctx.accounts.vestor.key();
    vestment_data.vestment_mint = ctx.accounts.vested_mint.key();
    vestment_data.vestment_start = Clock::get().unwrap().unix_timestamp;
    vestment_data.vestment_end = duration;
    vestment_data.cliff = cliff;

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
