use anchor_lang::prelude::*;
use squads_multisig_program::cpi::accounts::ProposalVote;
use squads_multisig_program::program::SquadsMultisigProgram;
use squads_multisig_program::state::Multisig;
use squads_multisig_program::ProposalVoteArgs;

pub fn approve_proposal(ctx: Context<ApproveProposal>) -> Result<()> {
    let vault_transaction_create_cpi_accounts = ProposalVote {
        member: ctx.accounts.signer.to_account_info(),
        multisig: ctx.accounts.multisig.to_account_info(),
        proposal: ctx.accounts.proposal.to_account_info(),
    };

    let vault_transaction_create_cpi_context = CpiContext::new(
        ctx.accounts.sqauds_multisig_program.to_account_info(),
        vault_transaction_create_cpi_accounts,
    );

    let vault_transaction_create_args = ProposalVoteArgs {
        memo: Some("approving proposal".to_string()),
    };

    squads_multisig_program::cpi::proposal_approve(
        vault_transaction_create_cpi_context,
        vault_transaction_create_args,
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct ApproveProposal<'info> {
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
