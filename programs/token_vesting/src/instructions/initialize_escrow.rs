use std::mem::size_of;

use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke, system_instruction::transfer},
};
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};
use spl_token::instruction::sync_native;

use crate::{error::VestmenErrors, state::EscrowData};
#[derive(Accounts)]
pub struct InitializeEscrow<'info> {
    #[account(init,payer=escrow_initializer,seeds=[b"escrow",offered_mint.key().as_ref(),wanted_mint.key().as_ref()],bump,space=8+size_of::<EscrowData>())]
    pub escrow_data: Account<'info, EscrowData>,
    #[account()]
    pub offered_mint: Account<'info, Mint>,
    #[account(mut)]
    pub escrow_initializer: Signer<'info>,
    #[account()]
    pub wanted_mint: Account<'info, Mint>,
    #[account(mut,constraint=source_token_account.mint==offered_mint.key() @VestmenErrors::WrongTokenAccMint)]
    pub source_token_account: Account<'info, TokenAccount>,
    #[account(init,payer=escrow_initializer,seeds=[b"escrow",escrow_data.key().as_ref()],bump,token::mint=offered_mint,token::authority=escrow_token_account)]
    pub escrow_token_account: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn initialize_escrow(
    ctx: Context<InitializeEscrow>,
    offered_amount: u64,
    wanted_amount: u64,
) -> Result<()> {
    let escrow_data = &mut ctx.accounts.escrow_data;
    let source_token_account = &ctx.accounts.source_token_account;
    escrow_data.escrow_initialized_at = Clock::get().unwrap().unix_timestamp;
    escrow_data.escrow_initializer = ctx.accounts.escrow_initializer.key();
    escrow_data.offered_amount = offered_amount;
    escrow_data.wanted_amount = wanted_amount;
    escrow_data.wanted_mint = ctx.accounts.wanted_mint.key();
    escrow_data.offered_mint = ctx.accounts.offered_mint.key();
    escrow_data.source_token_account = ctx.accounts.source_token_account.key();
    escrow_data.escrow_token_account = ctx.accounts.escrow_token_account.key();

    if source_token_account.is_native() {
        let transfer_sol_ix = transfer(
            &ctx.accounts.escrow_initializer.key(),
            &ctx.accounts.escrow_token_account.key(),
            offered_amount,
        );
        invoke(
            &transfer_sol_ix,
            &[
                ctx.accounts.escrow_initializer.to_account_info().clone(),
                ctx.accounts.escrow_token_account.to_account_info().clone(),
            ],
        )?;
        let sync_native_ix = sync_native(
            &ctx.accounts.token_program.key(),
            &ctx.accounts.escrow_token_account.key(),
        )?;
        invoke(
            &sync_native_ix,
            &[ctx.accounts.escrow_token_account.to_account_info()],
        )?;
        return Ok(());
    } else {
        anchor_spl::token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.source_token_account.to_account_info(),
                    to: ctx.accounts.escrow_token_account.to_account_info(),
                    authority: ctx.accounts.escrow_initializer.to_account_info(),
                },
            ),
            offered_amount,
        )?;
    }

    Ok(())
}
