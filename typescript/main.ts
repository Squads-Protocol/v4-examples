import * as multisig from "@sqds/multisig";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionMessage,
} from "@solana/web3.js";

const { Permission, Permissions } = multisig.types;
const connection = new Connection("http://localhost:8899", "confirmed");

describe("Interacting with the Squads V4 SDK", () => {
  const creator = Keypair.generate();
  const secondMember = Keypair.generate();
  before(async () => {
    const airdropSignature = await connection.requestAirdrop(
      creator.publicKey,
      1 * LAMPORTS_PER_SOL
    );

    console.log("Confirming Airdrop...");
    await connection.confirmTransaction(airdropSignature);
  });

  const createKey = Keypair.generate();

  // Derive the multisig account PDA
  const [multisigPda] = multisig.getMultisigPda({
    createKey: createKey.publicKey,
  });

  it("Create a new multisig", async () => {
    const programConfigPda = multisig.getProgramConfigPda({})[0];

    console.log("Program Config PDA: ", programConfigPda.toBase58());

    const programConfig =
      await multisig.accounts.ProgramConfig.fromAccountAddress(
        connection,
        programConfigPda
      );

    const configTreasury = programConfig.treasury;

    // Create the multisig
    console.log("Creating Multisig");
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

    console.log("Confirming Transaction...");
    const block = await connection.getLatestBlockhash("confirmed");
    
    const result = await connection.confirmTransaction(
      {
        signature,
        ...block,
      },
      "confirmed",
    );

    const error = result.value.err;
    if (error) {
      throw Error(error.toString());
    }

    console.log("Transaction confirmed.");
  });

  it("Create a transaction proposal", async () => {
    const [vaultPda] = multisig.getVaultPda({
      multisigPda,
      index: 0,
    });
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

    console.log("Confirming Transaction...");
    await connection.confirmTransaction(signature1);

    console.log("Transaction created: ", signature1);

    const signature2 = await multisig.rpc.proposalCreate({
      connection,
      feePayer: creator,
      multisigPda,
      transactionIndex: newTransactionIndex,
      creator,
    });

    console.log("Confirming Transaction...");
    await connection.confirmTransaction(signature2);

    console.log("Transaction proposal created: ", signature2);
  });

  it("Vote on the created proposal", async () => {
    const transactionIndex =
      await multisig.accounts.Multisig.fromAccountAddress(
        connection,
        multisigPda
      ).then((info) => Number(info.transactionIndex));

    const signature1 = await multisig.rpc.proposalApprove({
      connection,
      feePayer: creator,
      multisigPda,
      transactionIndex: BigInt(transactionIndex),
      member: creator,
    });

    console.log("Confirming Transaction...");
    await connection.confirmTransaction(signature1);

    const signature2 = await multisig.rpc.proposalApprove({
      connection,
      feePayer: creator,
      multisigPda,
      transactionIndex: BigInt(transactionIndex),
      member: secondMember,
    });

    console.log("Confirming Transaction...");
    await connection.confirmTransaction(signature2);
  });

  it("Execute the proposal", async () => {
    const transactionIndex =
      await multisig.accounts.Multisig.fromAccountAddress(
        connection,
        multisigPda
      ).then((info) => Number(info.transactionIndex));

    const [proposalPda] = multisig.getProposalPda({
      multisigPda,
      transactionIndex: BigInt(transactionIndex),
    });
    const signature = await multisig.rpc.vaultTransactionExecute({
      connection,
      feePayer: creator,
      multisigPda,
      transactionIndex: BigInt(transactionIndex),
      member: creator.publicKey,
      signers: [creator],
      sendOptions: { skipPreflight: true },
    });

    console.log("Confirming Transaction...");
    await connection.confirmTransaction(signature);
    console.log("Transaction executed: ", signature);
  });
});
