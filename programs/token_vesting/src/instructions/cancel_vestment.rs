use anchor_lang::prelude::*;
use anchor_spl::token::{
    close_account, transfer, CloseAccount, Mint, Token, TokenAccount, Transfer,
};

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
    //sysvars
    token_program: Program<'info, Token>,
    system_progam: Program<'info, System>,
}

pub fn cancel_vestment(ctx: Context<CancelVestment>) -> Result<()> {
    let mut cancel_authorities: Vec<Pubkey> = Vec::new();
    let allowed_cancelers = &ctx.accounts.vestment_data.cancel_authorities;
    for canceler in allowed_cancelers {
        match canceler {
            Some(canceller) => cancel_authorities.push(*canceller),
            _ => (),
        }
    }
    let can_cancel = allowed_cancelers.contains(&Some(ctx.accounts.payer.key()));

    require!(can_cancel == true, VestmenErrors::WrongCancelAuthority);

    transfer(
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
