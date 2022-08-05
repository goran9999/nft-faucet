use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

use crate::{error::VestmenErrors, state::VestmentData};
#[derive(Accounts)]
#[instruction()]
pub struct ClaimVestedTokens<'info> {
    #[account(mut,seeds=[b"vestment",vestor.key().as_ref(),consumer.key().as_ref()],bump)]
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
    let vestment_data = &mut ctx.accounts.vestment_data;
    let consumer = &ctx.accounts.consumer;
    let mut current_timestapm = Clock::get().unwrap().unix_timestamp;
    let has_cliffed = vestment_data.has_cliffed;
    if current_timestapm > vestment_data.vestment_end {
        current_timestapm = vestment_data.vestment_end;
    }
    let withdraw_start = match vestment_data.cliff_date {
        Some(cliff_date) => {
            if !has_cliffed {
                cliff_date
            } else {
                vestment_data.vestment_start
            }
        }
        None => vestment_data.vestment_start,
    };

    require!(vestment_data.amount > 0, VestmenErrors::TokensClaimed);

    require!(
        current_timestapm >= withdraw_start,
        VestmenErrors::VestmentNotStarted
    );
    require!(
        consumer.key() == vestment_data.consumer.key(),
        VestmenErrors::WrongClaimAuthority
    );
    let cliff_percentage: u64 = match vestment_data.cliff_percentage {
        Some(percentage) => {
            if !has_cliffed {
                vestment_data.has_cliffed = true;
                percentage
            } else {
                0
            }
        }
        None => 0,
    }
    .checked_div(100)
    .unwrap()
    .into();

    let mut vested_amount: u64 = 0;
    let cliff_amount: u64 = vestment_data.amount.checked_mul(cliff_percentage).unwrap();
    vested_amount = vested_amount.checked_add(cliff_amount).unwrap();
    let left_amount = vestment_data.amount.checked_sub(vested_amount).unwrap();
    let time_passed = current_timestapm
        .checked_sub(withdraw_start)
        .unwrap()
        .checked_div(vestment_data.release_time)
        .unwrap()
        .checked_mul(vestment_data.release_amount.try_into().unwrap())
        .unwrap();

    if time_passed > left_amount.try_into().unwrap() {
        vested_amount = vested_amount.checked_add(left_amount).unwrap();
        vestment_data.amount = 0;
    } else {
        let tokens_amount_to_transfer: u64 = time_passed.try_into().unwrap();
        vested_amount = vested_amount
            .checked_add(tokens_amount_to_transfer)
            .unwrap();
        vestment_data
            .amount
            .checked_sub(tokens_amount_to_transfer)
            .unwrap();
    }

    token::transfer(
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
        vested_amount.try_into().unwrap(),
    )?;
    if vestment_data.amount == 0 {
        token::close_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::CloseAccount {
                account: ctx.accounts.vested_tokens.to_account_info(),
                destination: ctx.accounts.destination_token_account.to_account_info(),
                authority: ctx.accounts.vested_tokens.to_account_info(),
            },
            &[&[
                b"vestment",
                ctx.accounts.vestment_mint.key().as_ref(),
                &[*ctx.bumps.get(&"vested_tokens".to_string()).unwrap()],
            ]],
        ))?;
        return Ok(());
    }
    Ok(())
}
