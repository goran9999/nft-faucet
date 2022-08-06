use anchor_lang::prelude::*;
use instructions::*;
mod error;
pub mod instructions;
pub mod state;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
#[program]
pub mod token_vesting {
    use anchor_lang::prelude::Context;

    use super::*;

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
        return instructions::initialize_vestmet(
            ctx,
            amount,
            release_amount,
            vestment_start,
            vestment_end,
            release_period,
            cliff_start,
            cliff_percentage,
        );
    }

    pub fn claim_vested_tokens(ctx: Context<ClaimVestedTokens>) -> Result<()> {
        return instructions::claim_vested_tokens(ctx);
    }

    pub fn cancel_vestment(ctx: Context<CancelVestment>) -> Result<()> {
        return instructions::cancel_vestment(ctx);
    }
}
