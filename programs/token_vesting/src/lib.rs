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
        duration: i64,
        cliff: i64,
    ) -> Result<()> {
        return instructions::initialize_vestmet(ctx, amount, duration, cliff);
    }

    pub fn claim_vested_tokens(ctx: Context<ClaimVestedTokens>) -> Result<()> {
        return instructions::claim_vested_tokens(ctx);
    }
}
