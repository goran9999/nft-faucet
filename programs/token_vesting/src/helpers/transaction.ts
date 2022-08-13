import { Metadata } from "@metaplex-foundation/mpl-token-metadata";
import {
  createInitializeMintInstruction,
  createMint,
  getOrCreateAssociatedTokenAccount,
  initializeMintInstructionData,
  mintTo,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  Transaction,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { min } from "bn.js";

export async function sendTransaction(
  connection: Connection,
  instructions: TransactionInstruction[],
  signers: Keypair[],
  feePayer: Keypair
) {
  const transaction = new Transaction({ feePayer: feePayer.publicKey });
  transaction.add(...instructions);
  signers.push(feePayer);
  const tx = await connection.sendTransaction(transaction, signers);

  console.log(tx);
  await connection.confirmTransaction(tx);
}

export async function mintMultipleNftsToWallet(
  wallet: Keypair,
  nftAmount: number,
  connection: Connection
) {
  try {
    const mints: PublicKey[] = [];
    const tokenAccs: PublicKey[] = [];
    for (let i = 0; i < nftAmount; i++) {
      const mint = await createMint(
        connection,
        wallet,
        wallet.publicKey,
        wallet.publicKey,
        0
      );

      const ata = await getOrCreateAssociatedTokenAccount(
        connection,
        wallet,
        mint,
        wallet.publicKey
      );
      mints.push(mint);
      tokenAccs.push(ata.address);
      await mintTo(connection, wallet, mint, ata.address, wallet, 1);
    }
    return { mints, tokenAccs };
  } catch (error) {
    console.log(error);
  }
}
