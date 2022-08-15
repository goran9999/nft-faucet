use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke_signed, system_instruction::transfer},
};
use anchor_spl::token::{self, close_account, CloseAccount, Mint, Token, TokenAccount, Transfer};

use crate::{error::VestmenErrors, state::VestmentData};

#[derive(Accounts)]
pub struct CancelVestment<'info> {
    #[account(mut,seeds=[b"vestment",vestment_data.vestor.key().as_ref(),vestment_data.consumer.key().as_ref()],bump)]
    vestment_data: Account<'info, VestmentData>,
    vestment_mint: Account<'info, Mint>,
    #[account(mut,seeds=[b"vestment",vestment_mint.key().as_ref()],bump)]
    vested_tokens: Account<'info, TokenAccount>,
    #[account(mut,constraint=source_token_account.mint==vestment_data.vestment_mint.key() @VestmenErrors::WrongTokenAccMint,constraint=source_token_account.owner==vestment_data.vestor @VestmenErrors::WrongOwner)]
    source_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    payer: Signer<'info>,
    #[account(mut)]
    vestor: SystemAccount<'info>,
    #[account(mut,seeds=[b"sol",vestment_data.key().as_ref()],bump)]
    ///CHECK:system account
    sol_token_account: UncheckedAccount<'info>,
    //sysvars
    token_program: Program<'info, Token>,
    system_progam: Program<'info, System>,
}

pub fn cancel_vestment(ctx: Context<CancelVestment>) -> Result<()> {
    let vestor_cancel_authority = ctx
        .accounts
        .vestment_data
        .vestor_cancel_authority
        .unwrap_or_default();
    let consumer_cancel_authority: Pubkey = ctx
        .accounts
        .vestment_data
        .consumer_cancel_authority
        .unwrap_or_default();

    let mut can_cancel = false;
    if ctx.accounts.payer.key() == vestor_cancel_authority.key()
        || ctx.accounts.payer.key() == consumer_cancel_authority.key()
    {
        can_cancel = true;
    }
    require!(can_cancel == true, VestmenErrors::WrongCancelAuthority);

    if ctx.accounts.vested_tokens.is_native() {
        let sol_ta_balance = &ctx.accounts.sol_token_account.lamports();
        let transfer_sol_ix = transfer(
            &ctx.accounts.sol_token_account.key(),
            &ctx.accounts.vestment_data.vestor,
            sol_ta_balance.clone(),
        );
        invoke_signed(
            &transfer_sol_ix,
            &[
                ctx.accounts.sol_token_account.to_account_info().clone(),
                ctx.accounts.vestor.to_account_info().clone(),
            ],
            &[&[
                b"sol",
                ctx.accounts.vestment_data.key().as_ref(),
                &[*ctx.bumps.get(&"sol_token_account".to_string()).unwrap()],
            ]],
        )?;
        return Ok(());
    }

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vested_tokens.to_account_info(),
                to: ctx.accounts.source_token_account.to_account_info(),
                authority: ctx.accounts.vested_tokens.to_account_info(),
            },
            &[&[
                b"vestment",
                ctx.accounts.vestment_mint.key().as_ref(),
                &[*ctx.bumps.get(&"vested_tokens".to_string()).unwrap()],
            ]],
        ),
        ctx.accounts.vestment_data.amount,
    )?;

    ctx.accounts.vestment_data.withdrawn_amount = ctx.accounts.vestment_data.amount;
    ctx.accounts.vestment_data.amount = 0;

    close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.vested_tokens.to_account_info(),
            destination: ctx.accounts.payer.to_account_info(),
            authority: ctx.accounts.vested_tokens.to_account_info(),
        },
        &[&[
            b"vestment",
            ctx.accounts.vestment_mint.key().as_ref(),
            &[*ctx.bumps.get(&"vested_tokens".to_string()).unwrap()],
        ]],
    ))?;

    Ok(())
}
