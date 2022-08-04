import {
    Connection,
    Keypair,
    Transaction,
    TransactionInstruction,
  } from "@solana/web3.js";
  
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
    console.log(tx)
    await connection.confirmTransaction(tx);
  }