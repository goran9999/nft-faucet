use anchor_lang::{
    prelude::*,
    solana_program::{
        native_token::LAMPORTS_PER_SOL, program::invoke_signed, system_instruction::transfer,
    },
};
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
    ///CHECK:system account
    #[account(mut,seeds=[b"sol",vestment_data.key().as_ref()],bump)]
    sol_token_account: UncheckedAccount<'info>,
    //sysvars
    clock: Sysvar<'info, Clock>,
    token_program: Program<'info, Token>,
    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>,
}

pub fn claim_vested_tokens(ctx: Context<ClaimVestedTokens>) -> Result<()> {
    let vestment_data = &mut ctx.accounts.vestment_data;
    let consumer = &ctx.accounts.consumer;
    let mut current_timestapm = Clock::get().unwrap().unix_timestamp;
    let has_cliffed = vestment_data.has_cliffed;
    if current_timestapm > vestment_data.vestment_end {
        current_timestapm = vestment_data.vestment_end;
    }
    let withdraw_start = match vestment_data.last_vestment > 0 {
        true => vestment_data.last_vestment,
        false => match vestment_data.cliff_date {
            Some(cliff_date) => cliff_date,
            None => vestment_data.vestment_start,
        },
    };
    vestment_data.last_vestment = current_timestapm;

    require!(vestment_data.amount > 0, VestmenErrors::TokensClaimed);

    require!(
        current_timestapm >= withdraw_start,
        VestmenErrors::VestmentNotStarted
    );
    require!(
        consumer.key() == vestment_data.consumer.key(),
        VestmenErrors::WrongClaimAuthority
    );

    let mut cliff_release: u64 = 0;
    if !has_cliffed {
        cliff_release = vestment_data.cliff_release_amount;
        vestment_data.cliff_release_amount = 0;
    }
    let mut vested_amount: u64 = 0;
    vested_amount = vested_amount.checked_add(cliff_release).unwrap();
    let left_amount = vestment_data.amount.checked_sub(vested_amount).unwrap();
    let time_passed = current_timestapm
        .checked_sub(withdraw_start)
        .unwrap()
        .checked_div(vestment_data.release_time)
        .unwrap()
        .checked_mul(vestment_data.release_amount.try_into().unwrap())
        .unwrap();
    vestment_data.amount = vestment_data.amount.checked_sub(cliff_release).unwrap();

    if time_passed > left_amount.try_into().unwrap() {
        vested_amount = vested_amount.checked_add(left_amount).unwrap();
        vestment_data.amount = 0;
    } else {
        let tokens_amount_to_transfer: u64 = time_passed.try_into().unwrap();
        vested_amount = vested_amount
            .checked_add(tokens_amount_to_transfer)
            .unwrap();
        vestment_data.amount = vestment_data
            .amount
            .checked_sub(tokens_amount_to_transfer)
            .unwrap();
    }
    msg!("Vested am {}", vested_amount);

    if ctx.accounts.destination_token_account.is_native() && vestment_data.amount > 0 {
        let transfer_sol_ix = transfer(
            &ctx.accounts.sol_token_account.clone().key(),
            &ctx.accounts.consumer.key(),
            vested_amount.checked_mul(LAMPORTS_PER_SOL).unwrap(),
        );
        invoke_signed(
            &transfer_sol_ix,
            &[
                ctx.accounts.sol_token_account.to_account_info(),
                ctx.accounts.consumer.to_account_info(),
            ],
            &[&[
                b"sol",
                vestment_data.key().as_ref(),
                &[*ctx.bumps.get(&"sol_token_account".to_string()).unwrap()],
            ]],
        )?;
    } else if ctx.accounts.vested_tokens.is_native() && vestment_data.amount == 0 {
        let sol_account_balance = ctx.accounts.sol_token_account.to_account_info().lamports();
        let transfer_total_amount_ix = transfer(
            &ctx.accounts.sol_token_account.key(),
            &ctx.accounts.consumer.key(),
            sol_account_balance,
        );
        invoke_signed(
            &transfer_total_amount_ix,
            &[
                ctx.accounts.sol_token_account.to_account_info().clone(),
                ctx.accounts.consumer.to_account_info().clone(),
            ],
            &[&[
                b"sol",
                vestment_data.key().as_ref(),
                &[*ctx.bumps.get(&"sol_token_account".to_string()).unwrap()],
            ]],
        )?;
    } else {
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
    }
    if vestment_data.amount == 0 {
        token::close_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::CloseAccount {
                account: ctx.accounts.vested_tokens.to_account_info(),
                destination: ctx.accounts.consumer.to_account_info(),
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
