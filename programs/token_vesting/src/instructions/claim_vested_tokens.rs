use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

use crate::{error::VestmenErrors, state::VestmentData};
#[derive(Accounts)]
#[instruction()]
pub struct ClaimVestedTokens<'info> {
    #[account(mut,seeds=[b"vestment",vestor.key.as_ref()],bump)]
    vestment_data: Account<'info, VestmentData>,
    #[account()]
    vestor: SystemAccount<'info>,
    #[account(mut)]
    consumer: Signer<'info>,
    #[account()]
    vestment_mint: Account<'info, Mint>,
    #[account(mut,seeds=[b"vestment",vestment_mint.key().as_ref()],bump)]
    vested_tokens: Account<'info, TokenAccount>,
    #[account(mut,token::authority=consumer.key(),constraint=destination_token_account.mint==vestment_mint.key() @ VestmenErrors::WrongDestinationMint)]
    destination_token_account: Account<'info, TokenAccount>,
    //sysvars
    clock: Sysvar<'info, Clock>,
    token_program: Program<'info, Token>,
}

pub fn claim_vested_tokens(ctx: Context<ClaimVestedTokens>) -> Result<()> {
    let vestment_data = &ctx.accounts.vestment_data;
    let consumer = &ctx.accounts.consumer;
    require!(
        vestment_data.consumer.key() == consumer.key(),
        VestmenErrors::WrongClaimAuthority
    );
    let current_timestamp = &ctx.accounts.clock.unix_timestamp;
    msg!("Current timestapm {}", current_timestamp);
    msg!("Vestment start {}", vestment_data.vestment_start);
    require!(
        current_timestamp > &vestment_data.vestment_start,
        VestmenErrors::VestmentNotStarted
    );
    let time_passed = current_timestamp
        .checked_sub(vestment_data.vestment_start)
        .unwrap();
    let cliff_amount = time_passed.checked_div(vestment_data.cliff).unwrap();
    let amount_to_transfer = match cliff_amount > vestment_data.amount.try_into().unwrap() {
        true => vestment_data.amount,
        false => cliff_amount.try_into().unwrap(),
    };
    match token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.vested_tokens.to_account_info(),
                to: ctx.accounts.destination_token_account.to_account_info(),
                authority: ctx.accounts.vested_tokens.to_account_info(),
            },
            &[&[
                b"vestment",
                ctx.accounts.vestment_mint.key().as_ref(),
                &[*ctx.bumps.get(&"vested_tokens".to_string()).unwrap()],
            ]],
        ),
        amount_to_transfer,
    ) {
        Ok(()) => Ok(()),
        Err(_) => todo!(),
    }
}
