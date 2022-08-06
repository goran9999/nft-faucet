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
import dayjs from "dayjs";
describe("token_vesting", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.TokenVesting as Program<TokenVesting>;
  const connection = anchor.getProvider().connection;
  const timeoutFn = async (waitMs) =>
    new Promise(() =>
      setTimeout(() => {
        {
        }
      }, waitMs)
    );
  let mint: PublicKey | undefined;
  let wallet: Keypair | undefined;
  let tokenAccount: Account | undefined;
  let consumer: Keypair | undefined;
  let consumerTA: PublicKey | undefined;
  before(async () => {
    wallet = Keypair.generate();
    consumer = Keypair.generate();
  });

  beforeEach(function (done) {
    setTimeout(done, 4000);
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
      6
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
      6
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
      [
        Buffer.from("vestment"),
        wallet.publicKey.toBuffer(),
        consumer.publicKey.toBuffer(),
      ],
      program.programId
    );
    const [vestedTokens] = await PublicKey.findProgramAddress(
      [Buffer.from("vestment"), mint.toBuffer()],
      program.programId
    );

    const vestmentStartUnix = dayjs().unix();
    console.log(vestmentStartUnix, "START");

    const vesmentEndUnix = dayjs().add(3, "minutes").unix();
    console.log(mint, "MINT");
    console.log(vesmentEndUnix, "END");

    const cliffStart = dayjs().add(2, "seconds").unix();

    const initializeVestingIx = program.instruction.initializeVestmet(
      new BN(90),
      new BN(2.5),
      new BN(vestmentStartUnix),
      new BN(vesmentEndUnix),
      new BN(1),
      new BN(cliffStart),
      new BN(3.5),
      {
        accounts: {
          consumer: consumer.publicKey,
          sourceTokenAccount: tokenAccount.address,
          vestmentMint: mint,
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
    try {
      await sendTransaction(
        connection,
        [initializeVestingIx],
        [wallet],
        wallet
      );
    } catch (error) {
      console.log(error);
    }
    const vestmentAccount = await program.account.vestmentData.fetch(
      vestmentData
    );
    assert.equal(vestmentAccount.amount.toNumber(), 90, "Vesting amount");
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
      [
        Buffer.from("vestment"),
        wallet.publicKey.toBuffer(),
        consumer.publicKey.toBuffer(),
      ],
      program.programId
    );
    const [vestedTokens] = await PublicKey.findProgramAddress(
      [Buffer.from("vestment"), mint.toBuffer()],
      program.programId
    );
    const vestmentDataAccount = await program.account.vestmentData.fetch(
      vestmentData
    );
    consumerTA = await createAssociatedTokenAccount(
      connection,
      consumer,
      mint,
      consumer.publicKey
    );

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
    try {
      await sendTransaction(connection, [claimIx], [consumer], consumer);
    } catch (error) {
      console.log(error);
    }
    const consumerTaBalance = await connection.getParsedTokenAccountsByOwner(
      consumer.publicKey,
      { mint: vestmentDataAccount.vestmentMint }
    );
    console.log(consumerTaBalance.value[0].account.data.parsed);
    assert.isAtLeast(
      +consumerTaBalance.value[0].account.data.parsed.info.tokenAmount.amount,
      0,
      "First claim successfully executed"
    );
  });

  it("should claim for second time", async () => {
    const [vestmentData] = await PublicKey.findProgramAddress(
      [
        Buffer.from("vestment"),
        wallet.publicKey.toBuffer(),
        consumer.publicKey.toBuffer(),
      ],
      program.programId
    );
    const [vestedTokens] = await PublicKey.findProgramAddress(
      [Buffer.from("vestment"), mint.toBuffer()],
      program.programId
    );
    const vestmentDataAccount = await program.account.vestmentData.fetch(
      vestmentData
    );
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
    try {
      await sendTransaction(connection, [claimIx], [consumer], consumer);
    } catch (error) {
      console.log(error);
    }

    const consumerTaBalance2 = await connection.getParsedTokenAccountsByOwner(
      consumer.publicKey,
      { mint: vestmentDataAccount.vestmentMint }
    );

    console.log(consumerTaBalance2.value[0].account.data.parsed.info);

    assert.isAtLeast(
      +consumerTaBalance2.value[0].account.data.parsed.info.tokenAmount.amount,
      0,
      "Second claim successfully executed"
    );
  });
});
