import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { TokenVesting } from "../target/types/token_vesting";
import { Keypair, PublicKey, AccountMeta } from "@solana/web3.js";
import { deserialize } from "borsh";
import {
  Account,
  ACCOUNT_SIZE,
  createAccount,
  createAssociatedTokenAccount,
  createInitializeAccountInstruction,
  createInitializeMintInstruction,
  createMint,
  createMintToCheckedInstruction,
  createMintToInstruction,
  DecodedInstruction,
  getMinimumBalanceForRentExemptAccount,
  getOrCreateAssociatedTokenAccount,
  initializeAccountInstructionData,
  initializeMintInstructionData,
  isInitializeMintInstruction,
  NATIVE_MINT,
  TokenInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  walletSecret,
  secondWalletPubkey,
  secondWalletSecret,
  walletPubkey,
} from "./wallets/wallets";
import {
  mintMultipleNftsToWallet,
  sendTransaction,
} from "../programs/token_vesting/src/helpers/transaction";
import { assert } from "chai";
import { BN, min } from "bn.js";
import dayjs from "dayjs";
import {
  Metadata,
  createCreateMetadataAccountInstruction,
  CreateMetadataAccountInstructionArgs,
  Creator,
  CreateMetadataAccountInstructionAccounts,
  createSetCollectionSizeInstruction,
  PROGRAM_ID,
  createCreateMetadataAccountV3Instruction,
  CreateMetadataAccountV3InstructionArgs,
  Uses,
  UseMethod,
  createCreateMetadataAccountV2Instruction,
  CreateMetadataAccountV2InstructionArgs,
  CreateMetadataAccountV2InstructionAccounts,
  createCreateMasterEditionInstruction,
  createCreateMasterEditionV3Instruction,
  PROGRAM_ADDRESS,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  createNftRecordSchema,
  NftVestmentRecord,
} from "../programs/token_vesting/src/helpers/utilities";
describe("token_vesting", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const LAMPORTS_PER_SOL = 1000000000;
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
  let solVestor: Keypair | undefined;
  let consumer: Keypair | undefined;
  let consumerTA: PublicKey | undefined;
  // before(async () => {
  //   wallet = Keypair.generate();
  //   consumer = Keypair.generate();
  //   solVestor = Keypair.generate();
  // });

  // beforeEach(function (done) {
  //   setTimeout(done, 4000);
  // });

  // it("should mint token to account!", async () => {
  //   const airdropIx = await connection.requestAirdrop(
  //     wallet.publicKey,
  //     5000000000
  //   );
  //   await connection.confirmTransaction(airdropIx);
  //   mint = await createMint(
  //     connection,
  //     wallet,
  //     wallet.publicKey,
  //     wallet.publicKey,
  //     6
  //   );
  //   tokenAccount = await getOrCreateAssociatedTokenAccount(
  //     connection,
  //     wallet,
  //     mint,
  //     wallet.publicKey
  //   );
  //   const mintIx = createMintToCheckedInstruction(
  //     mint,
  //     tokenAccount.address,
  //     wallet.publicKey,
  //     90,
  //     6
  //   );
  //   await sendTransaction(connection, [mintIx], [wallet], wallet);
  //   const createdTokenAccount = await connection.getParsedTokenAccountsByOwner(
  //     wallet.publicKey,
  //     { mint }
  //   );
  //   assert.equal(
  //     +createdTokenAccount.value[0].account.data.parsed.info.tokenAmount.amount,
  //     90
  //   );
  // });

  // it("should initialize vesting", async () => {
  //   const [vestmentData] = await PublicKey.findProgramAddress(
  //     [
  //       Buffer.from("vestment"),
  //       wallet.publicKey.toBuffer(),
  //       consumer.publicKey.toBuffer(),
  //     ],
  //     program.programId
  //   );
  //   const [vestedTokens] = await PublicKey.findProgramAddress(
  //     [Buffer.from("vestment"), mint.toBuffer()],
  //     program.programId
  //   );

  //   const vestmentStartUnix = dayjs().unix();
  //   console.log(vestmentStartUnix, "START");

  //   const vesmentEndUnix = dayjs().add(3, "minutes").unix();
  //   console.log(mint, "MINT");
  //   console.log(vesmentEndUnix, "END");

  //   const cliffStart = dayjs().add(2, "seconds").unix();

  //   const remainingAccounts = [
  //     { isSigner: false, isWritable: false, pubkey: wallet.publicKey },
  //     { isSigner: false, isWritable: false, pubkey: consumer.publicKey },
  //   ];

  //   const initializeVestingIx = program.instruction.initializeVestmet(
  //     new BN(90),
  //     new BN(5),
  //     new BN(vestmentStartUnix),
  //     new BN(vesmentEndUnix),
  //     new BN(1),
  //     new BN(cliffStart),
  //     new BN(7),
  //     {
  //       accounts: {
  //         consumer: consumer.publicKey,
  //         sourceTokenAccount: tokenAccount.address,
  //         vestmentMint: mint,
  //         vestor: wallet.publicKey,
  //         vestedTokens,
  //         vestmentData,
  //         clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
  //         rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //         systemProgram: anchor.web3.SystemProgram.programId,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //       },
  //       remainingAccounts: remainingAccounts,
  //     }
  //   );
  //   try {
  //     await sendTransaction(
  //       connection,
  //       [initializeVestingIx],
  //       [wallet],
  //       wallet
  //     );
  //   } catch (error) {
  //     console.log(error);
  //   }
  //   const vestmentAccount = await program.account.vestmentData.fetch(
  //     vestmentData
  //   );
  //   assert.equal(vestmentAccount.amount.toNumber(), 90, "Vesting amount");
  //   assert.equal(
  //     vestmentAccount.vestmentMint.toString(),
  //     mint.toString(),
  //     "Vesting mint"
  //   );
  //   assert.equal(
  //     vestmentAccount.consumer.toString(),
  //     consumer.publicKey.toString(),
  //     "Vesting consumer"
  //   );
  //   assert.equal(
  //     vestmentAccount.vestor.toString(),
  //     wallet.publicKey.toString(),
  //     "Vesting owner"
  //   );
  // });
  // it("should claim vested tokens", async () => {
  //   const airdropIx = await connection.requestAirdrop(
  //     consumer.publicKey,
  //     5000000000
  //   );
  //   await connection.confirmTransaction(airdropIx);
  //   const [vestmentData] = await PublicKey.findProgramAddress(
  //     [
  //       Buffer.from("vestment"),
  //       wallet.publicKey.toBuffer(),
  //       consumer.publicKey.toBuffer(),
  //     ],
  //     program.programId
  //   );
  //   const [vestedTokens] = await PublicKey.findProgramAddress(
  //     [Buffer.from("vestment"), mint.toBuffer()],
  //     program.programId
  //   );
  //   const [solTokenAcc] = await PublicKey.findProgramAddress(
  //     [Buffer.from("sol"), mint.toBuffer()],
  //     program.programId
  //   );
  //   const vestmentDataAccount = await program.account.vestmentData.fetch(
  //     vestmentData
  //   );
  //   consumerTA = await createAssociatedTokenAccount(
  //     connection,
  //     consumer,
  //     mint,
  //     consumer.publicKey
  //   );

  //   const claimIx = program.instruction.claimVestedTokens({
  //     accounts: {
  //       consumer: consumer.publicKey,
  //       destinationTokenAccount: consumerTA,
  //       vestedTokens: vestedTokens,
  //       vestmentData: vestmentData,
  //       vestmentMint: vestmentDataAccount.vestmentMint,
  //       vestor: vestmentDataAccount.vestor,
  //       clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //       systemProgram: anchor.web3.SystemProgram.programId,
  //       rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //       solTokenAccount: solTokenAcc,
  //     },
  //   });
  //   try {
  //     await sendTransaction(connection, [claimIx], [consumer], consumer);
  //   } catch (error) {
  //     console.log(error);
  //   }
  //   const consumerTaBalance = await connection.getParsedTokenAccountsByOwner(
  //     consumer.publicKey,
  //     { mint: vestmentDataAccount.vestmentMint }
  //   );
  //   console.log(consumerTaBalance.value[0].account.data.parsed);
  //   assert.isAtLeast(
  //     +consumerTaBalance.value[0].account.data.parsed.info.tokenAmount.amount,
  //     0,
  //     "First claim successfully executed"
  //   );
  // });

  // it("should claim for second time", async () => {
  //   const [vestmentData] = await PublicKey.findProgramAddress(
  //     [
  //       Buffer.from("vestment"),
  //       wallet.publicKey.toBuffer(),
  //       consumer.publicKey.toBuffer(),
  //     ],
  //     program.programId
  //   );
  //   const [vestedTokens] = await PublicKey.findProgramAddress(
  //     [Buffer.from("vestment"), mint.toBuffer()],
  //     program.programId
  //   );
  //   const taPubkey = Keypair.generate();
  //   const consumerSolAccount = anchor.web3.SystemProgram.createAccount({
  //     fromPubkey: consumer.publicKey,
  //     lamports: await getMinimumBalanceForRentExemptAccount(connection),
  //     newAccountPubkey: taPubkey.publicKey,
  //     programId: anchor.web3.SystemProgram.programId,
  //     space: ACCOUNT_SIZE,
  //   });

  //   const consumerTa = createInitializeAccountInstruction(
  //     taPubkey.publicKey,
  //     NATIVE_MINT,
  //     consumer.publicKey,
  //     TOKEN_PROGRAM_ID
  //   );

  //   const vestmentDataAccount = await program.account.vestmentData.fetch(
  //     vestmentData
  //   );
  //   const claimIx = program.instruction.claimVestedTokens({
  //     accounts: {
  //       consumer: consumer.publicKey,
  //       destinationTokenAccount: consumerTA,
  //       vestedTokens: vestedTokens,
  //       vestmentData: vestmentData,
  //       vestmentMint: vestmentDataAccount.vestmentMint,
  //       vestor: vestmentDataAccount.vestor,
  //       clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //       systemProgram: anchor.web3.SystemProgram.programId,
  //       rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //       solTokenAccount: taPubkey.publicKey,
  //     },
  //   });
  //   try {
  //     await sendTransaction(
  //       connection,
  //       [consumerSolAccount, consumerTa, claimIx],
  //       [consumer],
  //       consumer
  //     );
  //   } catch (error) {
  //     console.log(error);
  //   }

  //   const consumerTaBalance2 = await connection.getParsedTokenAccountsByOwner(
  //     consumer.publicKey,
  //     { mint: vestmentDataAccount.vestmentMint }
  //   );

  //   console.log(consumerTaBalance2.value[0].account.data.parsed.info);

  //   assert.isAtLeast(
  //     +consumerTaBalance2.value[0].account.data.parsed.info.tokenAmount.amount,
  //     0,
  //     "Second claim successfully executed"
  //   );
  // });

  // it("should cancel vesting by vestor", async () => {
  //   const [vestmentData] = await PublicKey.findProgramAddress(
  //     [
  //       Buffer.from("vestment"),
  //       wallet.publicKey.toBuffer(),
  //       consumer.publicKey.toBuffer(),
  //     ],
  //     program.programId
  //   );
  //   const [vestedTokens] = await PublicKey.findProgramAddress(
  //     [Buffer.from("vestment"), mint.toBuffer()],
  //     program.programId
  //   );

  //   const cancelVestmentIx = program.instruction.cancelVestment({
  //     accounts: {
  //       payer: consumer.publicKey,
  //       sourceTokenAccount: tokenAccount.address,
  //       systemProgam: anchor.web3.SystemProgram.programId,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //       vestedTokens: vestedTokens,
  //       vestmentData: vestmentData,
  //       vestmentMint: mint,
  //     },
  //   });
  //   try {
  //     await sendTransaction(
  //       connection,
  //       [cancelVestmentIx],
  //       [consumer],
  //       consumer
  //     );
  //   } catch (error) {
  //     console.log(error);
  //   }
  //   const vestorTa = await connection.getParsedTokenAccountsByOwner(
  //     wallet.publicKey,
  //     { mint: mint }
  //   );
  //   console.log(vestorTa.value[0].account.data.parsed.info);
  //   const vestmentDataAcc = await program.account.vestmentData.fetch(
  //     vestmentData
  //   );

  //   console.log(vestmentDataAcc.withdrawnAmount.toNumber(), "WITHDRAWN AMOUNT");
  //   console.log(vestmentDataAcc.amount.toNumber(), "AMOUN");

  //   assert.equal(
  //     +vestorTa.value[0].account.data.parsed.info.tokenAmount.amount,
  //     vestmentDataAcc.withdrawnAmount.toNumber(),
  //     "Tokens withdrawed"
  //   );
  // });

  // it("should initialize sol token vesting", async () => {
  //   const airdropIx = await connection.requestAirdrop(
  //     solVestor.publicKey,
  //     9000000000
  //   );
  //   await connection.confirmTransaction(airdropIx);

  //   const remainingAccounts = [
  //     { isSigner: true, isWritable: true, pubkey: solVestor.publicKey },
  //   ];

  //   const [vestmentData] = await PublicKey.findProgramAddress(
  //     [
  //       Buffer.from("vestment"),
  //       solVestor.publicKey.toBuffer(),
  //       consumer.publicKey.toBuffer(),
  //     ],
  //     program.programId
  //   );

  //   const [vestedTokens] = await PublicKey.findProgramAddress(
  //     [Buffer.from("vestment"), NATIVE_MINT.toBuffer()],
  //     program.programId
  //   );

  //   const solSourceTa = await getOrCreateAssociatedTokenAccount(
  //     connection,
  //     solVestor,
  //     NATIVE_MINT,
  //     solVestor.publicKey
  //   );

  //   const vestmentStartUnix = dayjs().unix();
  //   console.log(solVestor.publicKey.toString(), "VESTOR");
  //   console.log(consumer.publicKey.toString(), "CONSUMER");

  //   const [solVestedTokens] = await PublicKey.findProgramAddress(
  //     [Buffer.from("sol"), vestmentData.toBuffer()],
  //     program.programId
  //   );
  //   console.log(solVestedTokens.toBase58(), "SOL VEST");

  //   const vesmentEndUnix = dayjs().add(3, "minutes").unix();
  //   const initializeSolVestmentIx = program.instruction.initializeVestmet(
  //     new BN(8),
  //     new BN(3),
  //     new BN(vestmentStartUnix),
  //     new BN(vesmentEndUnix),
  //     new BN(2),
  //     null,
  //     null,
  //     {
  //       accounts: {
  //         consumer: consumer.publicKey,
  //         sourceTokenAccount: solSourceTa.address,
  //         vestmentMint: NATIVE_MINT,
  //         vestor: solVestor.publicKey,
  //         vestedTokens: vestedTokens,
  //         vestmentData: vestmentData,
  //         solTokenAccount: solVestedTokens,
  //         clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
  //         rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //         systemProgram: anchor.web3.SystemProgram.programId,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //       },
  //       remainingAccounts,
  //     }
  //   );
  //   try {
  //     await sendTransaction(
  //       connection,
  //       [initializeSolVestmentIx],
  //       [solVestor],
  //       solVestor
  //     );
  //   } catch (error) {
  //     console.log(error);
  //   }
  //   const vestedTokensBalance = await connection.getBalance(solVestedTokens);
  //   console.log(
  //     vestedTokensBalance / LAMPORTS_PER_SOL,
  //     "VESTED TOKENS BALANCE"
  //   );

  //   assert.isAtLeast(vestedTokensBalance / LAMPORTS_PER_SOL, 8);
  // });

  // it("should claim sol tokens", async () => {
  //   const airdropIx = await connection.requestAirdrop(
  //     consumer.publicKey,
  //     5000000000
  //   );
  //   await connection.confirmTransaction(airdropIx);
  //   const [vestmentData] = await PublicKey.findProgramAddress(
  //     [
  //       Buffer.from("vestment"),
  //       solVestor.publicKey.toBuffer(),
  //       consumer.publicKey.toBuffer(),
  //     ],
  //     program.programId
  //   );

  //   const [solVestedTokens] = await PublicKey.findProgramAddress(
  //     [Buffer.from("sol"), vestmentData.toBuffer()],
  //     program.programId
  //   );

  //   const [vestedTokens] = await PublicKey.findProgramAddress(
  //     [Buffer.from("vestment"), NATIVE_MINT.toBuffer()],
  //     program.programId
  //   );
  //   const solTokenAcc = await getOrCreateAssociatedTokenAccount(
  //     connection,
  //     consumer,
  //     NATIVE_MINT,
  //     consumer.publicKey
  //   );

  //   const claimSolIx = program.instruction.claimVestedTokens({
  //     accounts: {
  //       clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
  //       consumer: consumer.publicKey,
  //       destinationTokenAccount: solTokenAcc.address,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //       vestedTokens: vestedTokens,
  //       vestmentData: vestmentData,
  //       vestmentMint: NATIVE_MINT,
  //       vestor: solVestor.publicKey,
  //       solTokenAccount: solVestedTokens,
  //       rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //       systemProgram: anchor.web3.SystemProgram.programId,
  //     },
  //   });
  //   try {
  //     await sendTransaction(connection, [claimSolIx], [consumer], consumer);
  //     console.log("TRANSACTION SENT");
  //   } catch (error) {
  //     console.log(error);
  //   }

  //   const consumerBalance =
  //     (await connection.getBalance(consumer.publicKey)) / LAMPORTS_PER_SOL;
  //   console.log(consumerBalance, "CONSUMER BALANCE");
  //   assert.isAbove(consumerBalance, 10);
  // });

  // it("should cancel sol vesting", async () => {
  //   const [vestmentData] = await PublicKey.findProgramAddress(
  //     [
  //       Buffer.from("vestment"),
  //       solVestor.publicKey.toBuffer(),
  //       consumer.publicKey.toBuffer(),
  //     ],
  //     program.programId
  //   );

  //   const [solVestedTokens] = await PublicKey.findProgramAddress(
  //     [Buffer.from("sol"), vestmentData.toBuffer()],
  //     program.programId
  //   );

  //   const [vestedTokens] = await PublicKey.findProgramAddress(
  //     [Buffer.from("vestment"), NATIVE_MINT.toBuffer()],
  //     program.programId
  //   );
  //   const solSourceTa = await getOrCreateAssociatedTokenAccount(
  //     connection,
  //     solVestor,
  //     NATIVE_MINT,
  //     solVestor.publicKey
  //   );
  //   const cancelSolVest = program.instruction.cancelVestment({
  //     accounts: {
  //       payer: solVestor.publicKey,
  //       solTokenAccount: solVestedTokens,
  //       sourceTokenAccount: solSourceTa.address,
  //       vestedTokens: vestedTokens,
  //       vestmentData: vestmentData,
  //       vestmentMint: NATIVE_MINT,
  //       vestor: solVestor.publicKey,
  //       systemProgam: anchor.web3.SystemProgram.programId,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //     },
  //   });
  //   try {
  //     await sendTransaction(
  //       connection,
  //       [cancelSolVest],
  //       [solVestor],
  //       solVestor
  //     );
  //   } catch (error) {
  //     console.log(error);
  //   }
  //   const solVestorBalance = await connection.getBalance(solVestor.publicKey);
  //   const solTaBalance = await connection.getBalance(solVestedTokens);
  //   console.log(solTaBalance, "SOL VESTED BALANCE");

  //   console.log(solVestorBalance / LAMPORTS_PER_SOL, "SOL VESTOR BAL");
  //   assert.isAbove(solVestorBalance, 2);
  // });
  let acceptor: Keypair | undefined;
  let wantedMint: PublicKey | undefined;
  let acceptorTa: PublicKey | undefined;
  before(async () => {
    const secretWalletArray = new Uint8Array(walletSecret);
    wallet = Keypair.fromSecretKey(secretWalletArray);
    const secondSecretWalletArray = new Uint8Array(secondWalletSecret);
    acceptor = Keypair.fromSecretKey(secondSecretWalletArray);

    const airdropIx = await connection.requestAirdrop(
      acceptor.publicKey,
      5000000000
    );
    await connection.confirmTransaction(airdropIx);

    const airdropIx2 = await connection.requestAirdrop(
      wallet.publicKey,
      5000000000
    );
    await connection.confirmTransaction(airdropIx2);

    // wantedMint = await createMint(
    //   connection,
    //   acceptor,
    //   acceptor.publicKey,
    //   acceptor.publicKey,
    //   0
    // );
  });
  // it("should initialize buy escrow", async () => {
  //   // const airdropIx = await connection.requestAirdrop(
  //   //   wallet.publicKey,
  //   //   5000000000
  //   // );
  //   // await connection.confirmTransaction(airdropIx);
  //   console.log(wallet.publicKey.toString(), "WALLET");

  //   const nativeTokenAcc = await getOrCreateAssociatedTokenAccount(
  //     connection,
  //     wallet,
  //     NATIVE_MINT,
  //     wallet.publicKey
  //   );
  //   const [escrowData] = await PublicKey.findProgramAddress(
  //     [Buffer.from("escrow"), NATIVE_MINT.toBuffer(), wantedMint.toBuffer()],
  //     program.programId
  //   );
  //   const [escrowTa] = await PublicKey.findProgramAddress(
  //     [Buffer.from("escrow"), escrowData.toBuffer()],
  //     program.programId
  //   );

  //   const initializeBuyEscrow = program.instruction.initializeEscrow(
  //     new BN(0.0000001 * LAMPORTS_PER_SOL),
  //     new BN(1),
  //     {
  //       accounts: {
  //         escrowData: escrowData,
  //         escrowTokenAccount: escrowTa,
  //         escrowInitializer: wallet.publicKey,
  //         offeredMint: NATIVE_MINT,
  //         wantedMint: wantedMint,
  //         sourceTokenAccount: nativeTokenAcc.address,
  //         rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //         systemProgram: anchor.web3.SystemProgram.programId,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //         clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
  //       },
  //     }
  //   );
  //   try {
  //     await sendTransaction(
  //       connection,
  //       [initializeBuyEscrow],
  //       [wallet],
  //       wallet
  //     );
  //   } catch (error) {
  //     console.log(error);
  //   }
  //   const escrowBalance = await connection.getBalance(escrowTa);

  //   console.log(escrowBalance / LAMPORTS_PER_SOL);

  //   assert.isAbove(escrowBalance, 2 * LAMPORTS_PER_SOL, "Escrow lamports");
  // });

  // it("should execute escrow", async () => {
  //   const [escrowData] = await PublicKey.findProgramAddress(
  //     [Buffer.from("escrow"), NATIVE_MINT.toBuffer(), wantedMint.toBuffer()],
  //     program.programId
  //   );
  //   const [escrowTa] = await PublicKey.findProgramAddress(
  //     [Buffer.from("escrow"), escrowData.toBuffer()],
  //     program.programId
  //   );
  //   console.log(await connection.getBalance(acceptor.publicKey), "ACCEPTOR");
  //   console.log(program.programId.toString(), "AASDAS");

  //   const escrowDataAcc = await program.account.escrowData.fetch(escrowData);
  //   const acceptorTa = await createAssociatedTokenAccount(
  //     connection,
  //     acceptor,
  //     escrowDataAcc.wantedMint,
  //     acceptor.publicKey
  //   );
  //   const initializerTokenAccount = await createAssociatedTokenAccount(
  //     connection,
  //     acceptor,
  //     wantedMint,
  //     wallet.publicKey
  //   );
  //   const mintTo = createMintToCheckedInstruction(
  //     escrowDataAcc.wantedMint,
  //     acceptorTa,
  //     acceptor.publicKey,
  //     1,
  //     0
  //   );
  //   const accpetOffer = program.instruction.acceptEscrowOffer({
  //     accounts: {
  //       acceptor: acceptor.publicKey,
  //       acceptorTokens: acceptorTa,
  //       escrowData: escrowData,
  //       escrowInitializer: escrowDataAcc.escrowInitializer,
  //       escrowTokenAccount: escrowTa,
  //       initializerTokenAccount: initializerTokenAccount,
  //       offeredMint: escrowDataAcc.offeredMint,
  //       wantedMint: escrowDataAcc.wantedMint,
  //       rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //       systemProgram: anchor.web3.SystemProgram.programId,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //     },
  //   });
  //   try {
  //     await sendTransaction(connection, [mintTo], [acceptor], acceptor);
  //     await sendTransaction(connection, [accpetOffer], [acceptor], acceptor);
  //   } catch (error) {
  //     console.log(error);
  //   }
  //   const initTa = await connection.getParsedTokenAccountsByOwner(
  //     wallet.publicKey,
  //     { mint: wantedMint }
  //   );
  //   const accTa = await connection.getParsedTokenAccountsByOwner(
  //     acceptor.publicKey,
  //     {
  //       mint: wantedMint,
  //     }
  //   );
  //   console.log(initTa.value[0].account.data.parsed.info);
  //   console.log(accTa.value[0].account.data.parsed.info);
  //   assert.equal(initTa.value.length, 1, "NFT successfully transfered");
  //   const acceptorBalance = await connection.getBalance(acceptor.publicKey);
  //   assert.isAbove(
  //     acceptorBalance,
  //     7 * LAMPORTS_PER_SOL,
  //     "Lamports transfered to acceptor"
  //   );
  // });

  // it("should mint nft to a wallet", async () => {
  //   const mint = await createMint(
  //     connection,
  //     acceptor,
  //     acceptor.publicKey,
  //     acceptor.publicKey,
  //     0
  //   );
  //   const createMintIx = createInitializeMintInstruction(
  //     mint,
  //     0,
  //     acceptor.publicKey,
  //     acceptor.publicKey
  //   );
  //   const [metadataAddress] = await PublicKey.findProgramAddress(
  //     [Buffer.from("metadata"), mint.toBuffer()],
  //     new PublicKey(PROGRAM_ADDRESS)
  //   );
  //   const [edition] = await PublicKey.findProgramAddress(
  //     [Buffer.from("metadata"), Buffer.from("edition"), mint.toBuffer()],
  //     TOKEN_PROGRAM_ID
  //   );
  //   const createMasterEdition = createCreateMasterEditionInstruction(
  //     {
  //       edition,
  //       mint,
  //       mintAuthority: acceptor.publicKey,
  //       payer: acceptor.publicKey,
  //       updateAuthority: acceptor.publicKey,
  //       metadata: metadataAddress,
  //     },
  //     {
  //       createMasterEditionArgs: {
  //         maxSupply: 1,
  //       },
  //     }
  //   );

  //   const metadataAccounts: CreateMetadataAccountV2InstructionAccounts = {
  //     mint,
  //     mintAuthority: acceptor.publicKey,
  //     payer: consumer.publicKey,
  //     updateAuthority: consumer.publicKey,
  //     metadata: metadataAddress,
  //   };
  //   const collectionMint = await createMint(
  //     connection,
  //     consumer,
  //     consumer.publicKey,
  //     consumer.publicKey,
  //     0
  //   );
  //   const initializeCollectionMint = createInitializeMintInstruction(
  //     collectionMint,
  //     0,
  //     consumer.publicKey,
  //     consumer.publicKey
  //   );
  //   const metadataArgs: CreateMetadataAccountV2InstructionArgs = {
  //     createMetadataAccountArgsV2: {
  //       data: {
  //         creators: [
  //           {
  //             address: acceptor.publicKey,
  //             share: 100,
  //             verified: false,
  //           },
  //         ],
  //         name: "UNQ NFT #0001",
  //         sellerFeeBasisPoints: 10,
  //         symbol: "UNQ",
  //         collection: {
  //           key: collectionMint,
  //           verified: false,
  //         },
  //         uri: "https://arweave.net/3LIAeaGAex_-REAsrLaTbY8IyB_LAXwkdvC7kN6GUJo",
  //         uses: null,
  //       },
  //       isMutable: false,
  //     },
  //   };
  //   const createMetadataIx = createCreateMetadataAccountV2Instruction(
  //     metadataAccounts,
  //     metadataArgs
  //   );
  //   console.log(mint.toBuffer(), "NFT MINT");

  //   try {
  //     await sendTransaction(
  //       connection,
  //       [
  //         createMintIx,
  //         initializeCollectionMint,
  //         createMasterEdition,
  //         createMetadataIx,
  //       ],
  //       [acceptor],
  //       acceptor
  //     );
  //   } catch (error) {
  //     console.log(error);
  //   }
  // });

  // let assTokenAcc: PublicKey | undefined;
  // let nftMint: PublicKey | undefined;
  // it("should mint nft to wallet", async () => {
  //   nftMint = await createMint(
  //     connection,
  //     wallet,
  //     wallet.publicKey,
  //     wallet.publicKey,
  //     0
  //   );

  //   assTokenAcc = await createAssociatedTokenAccount(
  //     connection,
  //     wallet,
  //     nftMint,
  //     wallet.publicKey
  //   );

  //   const initMint = createInitializeMintInstruction(
  //     nftMint,
  //     0,
  //     wallet.publicKey,
  //     wallet.publicKey
  //   );

  //   // const initializeMint = createMintToInstruction(
  //   //   nftMint,
  //   //   assTokenAcc,
  //   //   wallet.publicKey,
  //   //   1
  //   // );
  //   const creator: Creator = {
  //     address: wallet.publicKey,
  //     share: 100,
  //     verified: false,
  //   };
  //   const [metadata] = await PublicKey.findProgramAddress(
  //     [Buffer.from("metadata"), nftMint.toBuffer()],
  //     PROGRAM_ID
  //   );

  //   const args: CreateMetadataAccountV2InstructionArgs = {
  //     createMetadataAccountArgsV2: {
  //       data: {
  //         collection: null,
  //         creators: [creator],
  //         name: "UNQ Universe NFT #0001",
  //         sellerFeeBasisPoints: 15,
  //         symbol: "UNQ",
  //         uri: "",
  //         uses: null,
  //       },
  //       isMutable: false,
  //     },
  //   };

  //   const account: CreateMetadataAccountInstructionAccounts = {
  //     mint: nftMint,
  //     mintAuthority: wallet.publicKey,
  //     payer: wallet.publicKey,
  //     updateAuthority: wallet.publicKey,
  //     metadata,
  //   };

  //   const createMetadataIx = createCreateMetadataAccountV2Instruction(
  //     account,
  //     args
  //   );
  //   try {
  //     //await sendTransaction(connection, [initMint], [wallet], wallet);
  //     await sendTransaction(connection, [createMetadataIx], [wallet], wallet);
  //   } catch (error) {
  //     console.log(error);
  //   }
  //   const tokenAccs = await connection.getParsedTokenAccountsByOwner(
  //     wallet.publicKey,
  //     { mint: nftMint }
  //   );
  //   console.log(tokenAccs.value[0]);
  //   assert.equal(tokenAccs.value.length, 1, "Nft successfully minted");
  // });

  // it("should escrow nft", async () => {
  //   const [escrowData] = await PublicKey.findProgramAddress(
  //     [Buffer.from("escrow"), nftMint.toBuffer(), NATIVE_MINT.toBuffer()],
  //     program.programId
  //   );
  //   const [escrowTa] = await PublicKey.findProgramAddress(
  //     [Buffer.from("escrow"), escrowData.toBuffer()],
  //     program.programId
  //   );
  //   const initializeBuyEscrow = program.instruction.initializeEscrow(
  //     new BN(1),
  //     new BN(4 * LAMPORTS_PER_SOL),
  //     {
  //       accounts: {
  //         escrowData: escrowData,
  //         escrowTokenAccount: escrowTa,
  //         escrowInitializer: wallet.publicKey,
  //         offeredMint: nftMint,
  //         wantedMint: NATIVE_MINT,
  //         sourceTokenAccount: assTokenAcc,
  //         rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //         systemProgram: anchor.web3.SystemProgram.programId,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //         clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
  //       },
  //     }
  //   );
  //   try {
  //     await sendTransaction(
  //       connection,
  //       [initializeBuyEscrow],
  //       [wallet],
  //       wallet
  //     );
  //   } catch (error) {
  //     console.log(error);
  //   }
  //   const escrowNft = await connection.getParsedTokenAccountsByOwner(escrowTa, {
  //     mint: nftMint,
  //   });
  //   console.log(escrowNft.value[0].account.data.parsed.info);
  //   assert.equal(escrowNft.value.length, 1);
  // });

  it("should vest multiple nfts", async () => {
    const { mints, tokenAccs } = await mintMultipleNftsToWallet(
      wallet,
      1,
      connection
    );
    const nftRecordPdas: PublicKey[] = [];
    const remainingAccounts: AccountMeta[] = [];
    const [nftVestingData] = await PublicKey.findProgramAddress(
      [Buffer.from("nft-vesting"), wallet.publicKey.toBuffer()],
      program.programId
    );
    const [vestedNftsOwner] = await PublicKey.findProgramAddress(
      [
        Buffer.from("nft-vesting"),
        Buffer.from("vested-nfts"),
        nftVestingData.toBuffer(),
      ],
      program.programId
    );

    const dedicatedConsumers: PublicKey[] = [];
    for (const [index, mint] of mints.entries()) {
      dedicatedConsumers.push(
        new PublicKey("85sBfyenoRBuw5rzgRBkw3EHeXDB1oc34sqrMKHYe9MM")
      );

      const [nftVestingRecord] = await PublicKey.findProgramAddress(
        [Buffer.from("nft-record"), mint.toBuffer(), nftVestingData.toBuffer()],
        program.programId
      );

      nftRecordPdas.push(nftVestingRecord);

      const newAccountPubkey = await getOrCreateAssociatedTokenAccount(
        connection,
        wallet,
        mint,
        vestedNftsOwner,
        true
      );
      remainingAccounts.push({
        isSigner: false,
        isWritable: true,
        pubkey: tokenAccs[index],
      });
      remainingAccounts.push({
        isSigner: false,
        isWritable: true,
        pubkey: mint,
      });
      remainingAccounts.push({
        isSigner: false,
        isWritable: true,
        pubkey: newAccountPubkey.address,
      });
      remainingAccounts.push({
        isSigner: false,
        isWritable: true,
        pubkey: nftVestingRecord,
      });
    }

    const walletTokenAccs = await connection.getParsedTokenAccountsByOwner(
      wallet.publicKey,
      { programId: TOKEN_PROGRAM_ID }
    );
    walletTokenAccs.value.forEach((v) =>
      console.log(v.account.data.parsed.info)
    );
    const vestNfts = program.instruction.vestNfts(
      dedicatedConsumers,
      1,
      null,
      [null],
      {
        accounts: {
          nftVestingData,
          vestedNftsOwner,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          nftVestor: wallet.publicKey,
        },
        remainingAccounts,
      }
    );
    try {
      await sendTransaction(connection, [vestNfts], [wallet], wallet);
    } catch (error) {
      console.log(error);
    }
    const vestedNftsTa = await connection.getParsedTokenAccountsByOwner(
      vestedNftsOwner,
      { programId: TOKEN_PROGRAM_ID }
    );
    vestedNftsTa.value.forEach((v) => console.log(v.account.data.parsed.info));
    const nftRecordAccs = await program.account.nftVestmentRecord.fetch(
      nftRecordPdas[0]
    );
    console.log(nftRecordAccs);
    console.log(nftRecordAccs.dedicatedConsumer.toString());

    // const nftRecordAccs = await connection.getAccountInfo(nftRecordPdas[0]);

    // console.log(nftRecordAccs);

    // const deserializedData = deserialize(
    //   createNftRecordSchema(),
    //   NftVestmentRecord,
    //   nftRecordAccs.data
    // );
    // console.log(deserializedData);
  });
});
