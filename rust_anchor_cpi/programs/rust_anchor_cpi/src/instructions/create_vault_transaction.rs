use anchor_lang::{prelude::*, solana_program::message::Message};
use squads_multisig_program::cpi::accounts::VaultTransactionCreate;
use squads_multisig_program::program::SquadsMultisigProgram;
use squads_multisig_program::state::Multisig;
use squads_multisig_program::VaultTransactionCreateArgs;

pub fn create_vault_transaction(ctx: Context<CreateVaultTransaction>) -> Result<()> {
    let transfer_instruction = anchor_lang::solana_program::system_instruction::transfer(
        &ctx.accounts.multisig_vault.key(),
        &ctx.accounts.signer.key(),
        1 * 10u64.pow(9),
    );
    let transaction_message = Message::new(
        &[transfer_instruction],
        Some(&ctx.accounts.multisig_vault.key()),
    );

    let vault_transaction_create_cpi_accounts = VaultTransactionCreate {
        creator: ctx.accounts.signer.to_account_info(),
        multisig: ctx.accounts.multisig.to_account_info(),
        rent_payer: ctx.accounts.signer.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        transaction: ctx.accounts.vault_transaction.to_account_info(),
    };

    let vault_transaction_create_cpi_context = CpiContext::new(
        ctx.accounts.sqauds_multisig_program.to_account_info(),
        vault_transaction_create_cpi_accounts,
    );

    let vault_transaction_create_args = VaultTransactionCreateArgs {
        ephemeral_signers: 0,
        memo: Some("send 1 SOL".to_string()),
        transaction_message: transaction_message.serialize().to_vec(),
        vault_index: 0,
    };

    squads_multisig_program::cpi::vault_transaction_create(
        vault_transaction_create_cpi_context,
        vault_transaction_create_args,
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct CreateVaultTransaction<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    /// CHECK: This account is not yet initialized
    pub vault_transaction: AccountInfo<'info>,

    pub create_key: Signer<'info>,

    pub system_program: Program<'info, System>,

    #[account(mut)]
    pub multisig: Account<'info, Multisig>,

    /// CHECK:
    #[account(mut)]
    pub multisig_vault: AccountInfo<'info>,

    pub sqauds_multisig_program: Program<'info, SquadsMultisigProgram>,
}
