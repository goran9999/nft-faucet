use anchor_lang::error_code;

#[error_code]
pub enum VestmenErrors {
    #[msg("Wrong token account mint")]
    WrongTokenAccMint,
    #[msg("Wrong token account owner")]
    WrongOwner,
    #[msg("Token transfer failed")]
    TokenTransferFailure,
    #[msg("Wrong claim authority")]
    WrongClaimAuthority,
    #[msg("Wrong destination account mint")]
    WrongDestinationMint,
    #[msg("Vestment not started yet!")]
    VestmentNotStarted,
    #[msg("All tokens already claimed")]
    TokensClaimed,
    #[msg("Not allowed to cancel vesting")]
    WrongCancelAuthority,
    #[msg("Account already initialized")]
    NftRecordAlredyInitialized,
    #[msg("Missing data about cliff period")]
    MissingCliffPeriod,
    #[msg("Missing data about dedicated consumers")]
    MissingDedicatedConsumers,
}
