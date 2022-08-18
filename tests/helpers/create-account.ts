import { web3 } from "@project-serum/anchor";
import {
  ACCOUNT_SIZE,
  createInitializeMintInstruction,
  getMinimumBalanceForRentExemptAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import { PublicKey, Connection, Keypair } from "@solana/web3.js";
export async function createAccountOwendBySpecifiedUser(
  connection: Connection,
  user: PublicKey
) {
  try {
    const newAcc = Keypair.generate();
    const createAccountIx = web3.SystemProgram.createAccount({
      fromPubkey: user,
      lamports: await getMinimumBalanceForRentExemptAccount(connection),
      newAccountPubkey: newAcc.publicKey,
      programId: TOKEN_PROGRAM_ID,
      space: ACCOUNT_SIZE,
    });
    const createMintIx = createInitializeMintInstruction(
      newAcc.publicKey,
      0,
      user,
      user
    );
    return { createAccountIx, createMintIx, newAcc };
  } catch (error) {}
}
