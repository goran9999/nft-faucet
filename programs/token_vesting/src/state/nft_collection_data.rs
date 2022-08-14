use anchor_lang::prelude::*;

#[account]
#[derive(Debug)]
pub struct NftCollectionData {
    pub collection_authority: Pubkey,
    pub collection_address: Pubkey,
    pub mint_timestamp: i64,
    pub number_of_nfts: u32,
}

#[derive(Default, Debug, Clone, AnchorDeserialize, AnchorSerialize)]
pub struct NftMetadataData {
    pub name: String,
    pub symbol: String,
    pub uri: String,
}
