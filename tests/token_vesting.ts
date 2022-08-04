import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { TokenVesting } from "../target/types/token_vesting";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  Account,
  createAssociatedTokenAccount,
  createMint,
  createMintToCheckedInstruction,
  getOrCreateAssociatedTokenAccount,
  TokenInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { sendTransaction } from "../programs/token_vesting/src/helpers/transaction";
import { assert } from "chai";
import { BN } from "bn.js";
describe("token_vesting", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.TokenVesting as Program<TokenVesting>;
  const connection = anchor.getProvider().connection;
  const timeoutFn = async (waitMs) =>
    new Promise((resolve) => setTimeout(() => {}, waitMs));
  let mint: PublicKey | undefined;
  let wallet: Keypair | undefined;
  let tokenAccount: Account | undefined;
  let consumer: Keypair | undefined;
  before(async () => {
    wallet = Keypair.generate();
    consumer = Keypair.generate();
  });

  beforeEach(function (done) {
    setTimeout(done, 5000);
  });

  it("should mint token to account!", async () => {
    const airdropIx = await connection.requestAirdrop(
      wallet.publicKey,
      5000000000
    );
    await connection.confirmTransaction(airdropIx);
    mint = await createMint(
      connection,
      wallet,
      wallet.publicKey,
      wallet.publicKey,
      9
    );
    tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet,
      mint,
      wallet.publicKey
    );
    const mintIx = createMintToCheckedInstruction(
      mint,
      tokenAccount.address,
      wallet.publicKey,
      40000,
      9
    );
    await sendTransaction(connection, [mintIx], [wallet], wallet);
    const createdTokenAccount = await connection.getParsedTokenAccountsByOwner(
      wallet.publicKey,
      { mint }
    );
    assert.equal(
      +createdTokenAccount.value[0].account.data.parsed.info.tokenAmount.amount,
      40000
    );
  });

  it("should initialize vesting", async () => {
    const [vestmentData] = await PublicKey.findProgramAddress(
      [Buffer.from("vestment"), wallet.publicKey.toBuffer()],
      program.programId
    );
    const [vestedTokens] = await PublicKey.findProgramAddress(
      [Buffer.from("vestment"), mint.toBuffer()],
      program.programId
    );

    const initializeVestingIx = program.instruction.initializeVestmet(
      new BN(25000),
      new BN(3600),
      new BN(1),
      {
        accounts: {
          consumer: consumer.publicKey,
          sourceTokenAccount: tokenAccount.address,
          vestedMint: mint,
          vestor: wallet.publicKey,
          vestedTokens,
          vestmentData,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );
    await sendTransaction(connection, [initializeVestingIx], [wallet], wallet);
    const vestmentAccount = await program.account.vestmentData.fetch(
      vestmentData
    );
    assert.equal(vestmentAccount.amount.toNumber(), 25000, "Vesting amount");
    assert.equal(
      vestmentAccount.vestmentMint.toString(),
      mint.toString(),
      "Vesting mint"
    );
    assert.equal(
      vestmentAccount.consumer.toString(),
      consumer.publicKey.toString(),
      "Vesting consumer"
    );
    assert.equal(
      vestmentAccount.vestor.toString(),
      wallet.publicKey.toString(),
      "Vesting owner"
    );
  });
  it("should claim vested tokens", async () => {
    const airdropIx = await connection.requestAirdrop(
      consumer.publicKey,
      50000000
    );
    await connection.confirmTransaction(airdropIx);
    const [vestmentData] = await PublicKey.findProgramAddress(
      [Buffer.from("vestment"), wallet.publicKey.toBuffer()],
      program.programId
    );
    const [vestedTokens] = await PublicKey.findProgramAddress(
      [Buffer.from("vestment"), mint.toBuffer()],
      program.programId
    );
    const vestmentDataAccount = await program.account.vestmentData.fetch(
      vestmentData
    );
    const consumerTA = await createAssociatedTokenAccount(
      connection,
      consumer,
      mint,
      consumer.publicKey
    );
    console.log(consumerTA.toBase58(), "CONSUMER TA");
    const claimIx = program.instruction.claimVestedTokens({
      accounts: {
        consumer: consumer.publicKey,
        destinationTokenAccount: consumerTA,
        vestedTokens: vestedTokens,
        vestmentData: vestmentData,
        vestmentMint: vestmentDataAccount.vestmentMint,
        vestor: vestmentDataAccount.vestor,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
    });
    await sendTransaction(connection, [claimIx], [consumer], consumer);
    const consumerTaBalance = await connection.getParsedTokenAccountsByOwner(
      consumer.publicKey,
      { mint: vestmentDataAccount.vestmentMint }
    );
    console.log(consumerTaBalance.value[0].account.data.parsed);
    assert.isAbove(
      +consumerTaBalance.value[0].account.data.parsed.info.tokenAmount.amount,
      3,
      "Claimed more than 3 tokens"
    );
  });
});
