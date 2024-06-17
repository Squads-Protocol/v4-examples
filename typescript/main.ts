import * as multisig from "@sqds/multisig";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { readFileSync } from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const { Permission, Permissions } = multisig.types;

const RPC = process.env.RPC;
const connection = new Connection(RPC, "confirmed");

const createKey = Keypair.generate();
// Derive the multisig account PDA
const [multisigPda] = multisig.getMultisigPda({
  createKey: createKey.publicKey,
});

const keyFileContents = JSON.parse(
  readFileSync(path.join(process.env.HOME, ".config/solana/id.json")).toString()
);

const creator = Keypair.fromSecretKey(new Uint8Array(keyFileContents));
const secondMember = Keypair.generate();

describe("Interacting with the Squads V4 SDK", () => {
  // This script uses devnet for the sake of us having everything we need (like program config PDA)
  // Will require a devnet RPC endpoint be added to a .env file. If using localnet, airdrops will work correctly, 
  // and can be used instead of a transfer from the user's default wallet. 

  // Be sure you have at least 2 devnet SOL to run this script fully
  it("Create a new multisig", async () => {
    try {
      await connection.requestAirdrop(
        secondMember.publicKey,
        1 * LAMPORTS_PER_SOL
      );
    } catch (e) {
      console.log("airdrop failed");

      const tx = new VersionedTransaction(
        new TransactionMessage({
          payerKey: creator.publicKey,
          recentBlockhash: await (
            await connection.getLatestBlockhash()
          ).blockhash,
          instructions: [
            SystemProgram.transfer({
              fromPubkey: creator.publicKey,
              toPubkey: secondMember.publicKey,
              lamports: 1_000_000,
            }),
          ],
        }).compileToV0Message()
      );

      tx.sign([creator]);

      console.log("✨ Sending SOL...");
      await connection.sendTransaction(tx);
      console.log("✅ SOL sent.");
    }

    try {
      const programConfigPda = multisig.getProgramConfigPda({})[0];

      console.log("✨ Program Config PDA:", programConfigPda.toBase58());

      const programConfig =
        await multisig.accounts.ProgramConfig.fromAccountAddress(
          connection,
          programConfigPda
        );

      const configTreasury = programConfig.treasury;
      // Create the multisig
      console.log("✨ Creating Squad...");
      const signature = await multisig.rpc.multisigCreateV2({
        connection,
        // One time random Key
        createKey,
        // The creator & fee payer
        creator,
        multisigPda,
        configAuthority: null,
        timeLock: 0,
        members: [
          {
            key: creator.publicKey,
            permissions: Permissions.all(),
          },
          {
            key: secondMember.publicKey,
            // This permission means that the user will only be able to vote on transactions
            permissions: Permissions.fromPermissions([Permission.Vote]),
          },
        ],
        // This means that there needs to be 2 votes for a transaction proposal to be approved
        threshold: 2,
        rentCollector: null,
        treasury: configTreasury,
        sendOptions: { skipPreflight: true },
      });

      const block = await connection.getLatestBlockhash("confirmed");
      const result = await connection.confirmTransaction(
        {
          signature,
          ...block,
        },
        "confirmed"
      );

      const error = result.value.err;
      if (error) {
        throw Error(error.toString());
      }

      console.log("✅ Squad Created:", signature);
    } catch (err) {
      throw new Error(err);
    }
  });

  it("Create and execute a vault transaction proposal", async () => {
    const [vaultPda] = multisig.getVaultPda({
      multisigPda,
      index: 0,
    });

    const tx = new VersionedTransaction(
      new TransactionMessage({
        payerKey: creator.publicKey,
        recentBlockhash: await (
          await connection.getLatestBlockhash()
        ).blockhash,
        instructions: [
          SystemProgram.transfer({
            fromPubkey: creator.publicKey,
            toPubkey: vaultPda,
            lamports: 1_000_000_000,
          }),
        ],
      }).compileToV0Message()
    );

    tx.sign([creator]);

    console.log("✨ Sending transaction...");
    const sendSig = await connection.sendTransaction(tx);
    console.log("✅ SOL sent to vault:", sendSig);

    const instruction = SystemProgram.transfer({
      // The transfer is being signed from the Squads Vault, that is why we use the VaultPda
      fromPubkey: vaultPda,
      toPubkey: creator.publicKey,
      lamports: 1 * LAMPORTS_PER_SOL,
    });
    // This message contains the instructions that the transaction is going to execute
    const transferMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [instruction],
    });

    // Get the current multisig transaction index
    const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
      connection,
      multisigPda
    );

    const currentTransactionIndex = Number(multisigInfo.transactionIndex);

    const newTransactionIndex = BigInt(currentTransactionIndex + 1);

    console.log("✨ Creating vault transaction...");
    const signature1 = await multisig.rpc.vaultTransactionCreate({
      connection,
      feePayer: creator,
      multisigPda,
      transactionIndex: newTransactionIndex,
      creator: creator.publicKey,
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage: transferMessage,
      memo: "Transfer 0.1 SOL to creator",
    });

    await connection.confirmTransaction(signature1);
    console.log("✅ Transaction created:", signature1);

    console.log("✨ Creating proposal...");
    const signature2 = await multisig.rpc.proposalCreate({
      connection,
      feePayer: creator,
      multisigPda,
      transactionIndex: newTransactionIndex,
      creator,
    });

    await connection.confirmTransaction(signature2);
    console.log("✅ Proposal created:", signature2);

    const transactionIndex =
      await multisig.accounts.Multisig.fromAccountAddress(
        connection,
        multisigPda
      ).then((info) => info.transactionIndex);

    console.log("✨ Wallet 1 approving...");
    const approvalSig1 = await multisig.rpc.proposalApprove({
      connection,
      feePayer: creator,
      multisigPda,
      transactionIndex: BigInt(transactionIndex.toString()),
      member: creator,
    });

    await connection.confirmTransaction(approvalSig1);
    console.log("✅ Wallet 1 approved:", approvalSig1);

    console.log("✨ Wallet 2 approving...");
    const approvalSig2 = await multisig.rpc.proposalApprove({
      connection,
      feePayer: creator,
      multisigPda,
      transactionIndex: BigInt(transactionIndex.toString()),
      member: secondMember,
    });

    await connection.confirmTransaction(approvalSig2);
    console.log("✅ Wallet 2 approved:", approvalSig2);

    try {
      const transactionIndex =
        await multisig.accounts.Multisig.fromAccountAddress(
          connection,
          multisigPda
        ).then((info) => Number(info.transactionIndex));

      const [proposalPda] = multisig.getProposalPda({
        multisigPda,
        transactionIndex: BigInt(transactionIndex),
      });

      console.log(`✨ Executing ${proposalPda.toBase58()}...`);
      const signature = await multisig.rpc.vaultTransactionExecute({
        connection,
        feePayer: creator,
        multisigPda,
        transactionIndex: BigInt(transactionIndex),
        member: creator.publicKey,
        signers: [creator],
        sendOptions: { skipPreflight: true },
      });

      await connection.confirmTransaction(signature, "confirmed");
      console.log("✅ Transaction executed:", signature);
    } catch (err) {
      console.log(JSON.stringify(err));
      throw err;
    }
  });

  describe("Working with batches in v4 SDK", () => {
    // STEPS FOR WORKING WITH BATCHES
    // 1. Create a batch
    // 2. Create a proposal as a draft
    // 3. Add the proposal to the batch
    // 4. Activate the proposal
    // 5. Vote on the proposal
    // 6. Execute the proposal
    it("Create a batch & add messages", async () => {
      const [vaultPda] = multisig.getVaultPda({
        multisigPda,
        index: 0,
      });

      const instruction = SystemProgram.transfer({
        // The transfer is being signed from the Squads Vault, that is why we use the VaultPda
        fromPubkey: vaultPda,
        toPubkey: creator.publicKey,
        lamports: 1,
      });
      // This message contains the instructions that the transaction is going to execute
      const transferMessage = new TransactionMessage({
        payerKey: vaultPda,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        instructions: [instruction],
      });

      // Get the current multisig transaction index
      const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
        connection,
        multisigPda
      );

      const currentTransactionIndex = Number(multisigInfo.transactionIndex);

      const newTransactionIndex = BigInt(currentTransactionIndex + 1);

      console.log("✨ Creating a batch...");
      const batchSignature = await multisig.rpc.batchCreate({
        connection,
        feePayer: creator,
        batchIndex: newTransactionIndex,
        creator: creator,
        rentPayer: creator,
        multisigPda,
        vaultIndex: 0,
        memo: "This is a batch with one message",
      });

      await connection.confirmTransaction(batchSignature, "confirmed");
      console.log("✅ Batch created:", batchSignature);

      console.log("✨ Creating transfer proposal...");
      const signature = await multisig.rpc.proposalCreate({
        connection,
        feePayer: creator,
        multisigPda,
        transactionIndex: newTransactionIndex,
        creator,
        isDraft: true,
      });

      await connection.confirmTransaction(signature, "confirmed");
      console.log("✅ Proposal created:", signature);

      console.log("✨ Adding transaction to batch...");
      const batchTx = await multisig.rpc.batchAddTransaction({
        connection,
        feePayer: creator,
        // Index of the batch globally, like any other transaction
        batchIndex: BigInt(newTransactionIndex),
        multisigPda,
        vaultIndex: 0,
        transactionMessage: transferMessage,
        // Index of the transaction inside of the batch! Not globally. Starts at 1
        transactionIndex: 1,
        ephemeralSigners: 0,
        member: creator,
      });

      await connection.confirmTransaction(batchTx, "confirmed");
      console.log("✅ Message added to batch:", batchTx);

      console.log("✨ Activating proposal...");
      const activate = await multisig.rpc.proposalActivate({
        connection,
        feePayer: creator,
        member: creator,
        multisigPda,
        transactionIndex: newTransactionIndex,
      });

      await connection.confirmTransaction(activate, "confirmed");
      console.log("✅ Proposal activated:", activate);

      console.log("✨ Wallet 1 approving...");
      const signature1 = await multisig.rpc.proposalApprove({
        connection,
        feePayer: creator,
        multisigPda,
        transactionIndex: BigInt(newTransactionIndex),
        member: creator,
      });

      await connection.confirmTransaction(signature1, "confirmed");
      console.log("✅ Vote cast:", signature1);

      console.log("✨ Wallet 2 approving...");
      const signature2 = await multisig.rpc.proposalApprove({
        connection,
        feePayer: creator,
        multisigPda,
        transactionIndex: BigInt(newTransactionIndex),
        member: secondMember,
      });

      await connection.confirmTransaction(signature2, "confirmed");
      console.log("✅ Second vote cast:", signature2);

      const tx = new VersionedTransaction(
        new TransactionMessage({
          payerKey: creator.publicKey,
          recentBlockhash: await (
            await connection.getLatestBlockhash()
          ).blockhash,
          instructions: [
            SystemProgram.transfer({
              fromPubkey: creator.publicKey,
              toPubkey: vaultPda,
              lamports: 1_000_000_000,
            }),
          ],
        }).compileToV0Message()
      );
  
      tx.sign([creator]);
  
      console.log("✨ Sending more SOL to vault...");
      const sendSig = await connection.sendTransaction(tx);
      console.log("✅ SOL sent to vault:", sendSig);

      console.log("✨ Executing batch...");
      const batchExec = await multisig.rpc.batchExecuteTransaction({
        connection,
        feePayer: creator,
        // Index of the batch globally
        batchIndex: newTransactionIndex,
        multisigPda,
        // Index of targeted transaction in the batch
        transactionIndex: 1,
        member: creator,
        sendOptions: { skipPreflight: true },
      });

      await connection.confirmTransaction(batchExec);
      console.log("✅ Batch Executed:", batchExec);
    });
  });
});
