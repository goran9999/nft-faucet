import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
export class NftVestmentRecord {
  nftMint: PublicKey;
  cliffDate: BN;
  sourceTokenAccount: PublicKey;

  constructor(args: {
    nftMint: PublicKey;
    cliffDate: BN;
    sourceTokenAccount: PublicKey;
  }) {
    this.cliffDate = args.cliffDate;
    this.nftMint = args.nftMint;
    this.sourceTokenAccount = args.sourceTokenAccount;
  }
}

export function createNftRecordSchema() {
  return new Map<Function, any>([
    [
      NftVestmentRecord,
      {
        kind: "struct",
        fields: [
          //   ["accountDiscriminator", [8]],
          ["nftMint", "pubkey"],
          ["cliffDate", "i64"],
          ["sourceTokenAccount", "pubkey"],
          ["reserved", [8]],
        ],
      },
    ],
  ]);
}
