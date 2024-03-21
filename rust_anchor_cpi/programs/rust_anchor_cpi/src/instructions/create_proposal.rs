use anchor_lang::prelude::*;
use squads_multisig_program::cpi::accounts::ProposalCreate;
use squads_multisig_program::program::SquadsMultisigProgram;
use squads_multisig_program::state::Multisig;
use squads_multisig_program::ProposalCreateArgs;

pub fn create_proposal(ctx: Context<CreateProposal>) -> Result<()> {
    let vault_transaction_create_cpi_accounts = ProposalCreate {
        creator: ctx.accounts.signer.to_account_info(),
        multisig: ctx.accounts.multisig.to_account_info(),
        rent_payer: ctx.accounts.signer.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        proposal: ctx.accounts.proposal.to_account_info(),
    };

    let vault_transaction_create_cpi_context = CpiContext::new(
        ctx.accounts.sqauds_multisig_program.to_account_info(),
        vault_transaction_create_cpi_accounts,
    );

    let transaction_index = ctx.accounts.multisig.transaction_index;

    let vault_transaction_create_args = ProposalCreateArgs {
        draft: false,
        transaction_index,
    };

    squads_multisig_program::cpi::proposal_create(
        vault_transaction_create_cpi_context,
        vault_transaction_create_args,
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct CreateProposal<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    /// CHECK: This account is not yet initialized
    pub proposal: AccountInfo<'info>,

    pub system_program: Program<'info, System>,

    #[account(mut)]
    pub multisig: Account<'info, Multisig>,

    /// CHECK:
    #[account(mut)]
    pub multisig_vault: AccountInfo<'info>,

    pub sqauds_multisig_program: Program<'info, SquadsMultisigProgram>,
}
