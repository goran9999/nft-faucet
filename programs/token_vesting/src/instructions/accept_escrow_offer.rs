use std::borrow::Borrow;

use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke, system_instruction},
};
use anchor_spl::token::{
    close_account, transfer, CloseAccount, Mint, Token, TokenAccount, Transfer,
};

use crate::{
    error::VestmenErrors,
    state::{EscrowData, OfferStatus},
};

#[derive(Accounts)]

pub struct AcceptEscrow<'info> {
    #[account(mut,seeds=[b"escrow",offered_mint.key().as_ref(),wanted_mint.key().as_ref()],bump)]
    escrow_data: Account<'info, EscrowData>,
    #[account()]
    offered_mint: Account<'info, Mint>,
    #[account()]
    wanted_mint: Account<'info, Mint>,
    #[account(mut,seeds=[b"escrow",escrow_data.key().as_ref()],bump)]
    escrow_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut,constraint=initializer_token_account.mint==escrow_data.wanted_mint @VestmenErrors::WrongTokenAccMint,constraint=initializer_token_account.owner==escrow_data.escrow_initializer @VestmenErrors::WrongOwner)]
    initializer_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut,constraint=acceptor_tokens.mint==wanted_mint.key())]
    acceptor_tokens: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    escrow_initializer: SystemAccount<'info>,
    #[account(mut)]
    acceptor: Signer<'info>,
    token_program: Program<'info, Token>,
    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>,
}

pub fn accept_escrow_offer(ctx: Context<AcceptEscrow>) -> Result<()> {
    let escrow_data = &mut ctx.accounts.escrow_data;
    escrow_data.offer_status = OfferStatus::Accepted;
    if ctx.accounts.escrow_token_account.is_native() {
        close_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            CloseAccount {
                account: ctx.accounts.escrow_token_account.to_account_info(),
                destination: ctx.accounts.acceptor.to_account_info(),
                authority: ctx.accounts.escrow_token_account.to_account_info(),
            },
            &[&[
                b"escrow",
                escrow_data.key().as_ref(),
                &[*ctx.bumps.get(&"escrow_token_account".to_string()).unwrap()],
            ]],
        ))?;

        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.acceptor_tokens.to_account_info(),
                    to: ctx.accounts.initializer_token_account.to_account_info(),
                    authority: ctx.accounts.acceptor.to_account_info(),
                },
            ),
            escrow_data.wanted_amount,
        )?;
    } else {
        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.acceptor_tokens.to_account_info(),
                    authority: ctx.accounts.escrow_token_account.to_account_info(),
                },
                &[&[
                    b"escrow",
                    escrow_data.key().as_ref(),
                    &[*ctx.bumps.get(&"escrow_token_account".to_string()).unwrap()],
                ]],
            ),
            escrow_data.offered_amount,
        )?;
        let transfer_sol_ix = system_instruction::transfer(
            &ctx.accounts.acceptor.key(),
            escrow_data.escrow_initializer.borrow(),
            escrow_data.wanted_amount,
        );
        invoke(
            &transfer_sol_ix,
            &[
                ctx.accounts.acceptor.to_account_info(),
                ctx.accounts.escrow_initializer.to_account_info(),
            ],
        )?
    }
    Ok(())
}
