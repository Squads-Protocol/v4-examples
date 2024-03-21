use anchor_lang::prelude::*;
use squads_multisig_program::cpi::accounts::MultisigCreateV2;
use squads_multisig_program::program::SquadsMultisigProgram;
use squads_multisig_program::state::ProgramConfig;
use squads_multisig_program::{Member, Multisig, MultisigCreateArgsV2, Permission, Permissions};

pub fn create_multisig(ctx: Context<CreateMultisig>) -> Result<()> {
    let multisig_create_cpi_accounts = MultisigCreateV2 {
        create_key: ctx.accounts.create_key.to_account_info(),
        multisig: ctx.accounts.multisig.to_account_info(),
        creator: ctx.accounts.signer.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        program_config: ctx.accounts.program_config.to_account_info(),
        treasury: ctx.accounts.sqauds_program_treasury.to_account_info(),
    };

    let multisig_create_cpi_context = CpiContext::new(
        ctx.accounts.squads_multisig_program.to_account_info(),
        multisig_create_cpi_accounts,
    );

    let multisig_create_args = MultisigCreateArgsV2 {
        config_authority: None,
        members: vec![Member {
            key: ctx.accounts.signer.key(),
            permissions: Permissions::from_vec(&[
                Permission::Initiate,
                Permission::Vote,
                Permission::Execute,
            ]),
        }],
        memo: Some("Json serialized metadata can be used here.".to_string()),
        rent_collector: Some(ctx.accounts.signer.key()),
        threshold: 1,
        time_lock: 0,
    };

    squads_multisig_program::cpi::multisig_create_v2(
        multisig_create_cpi_context,
        multisig_create_args,
    )?;
    Ok(())
}

#[derive(Accounts)]
pub struct CreateMultisig<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub multisig: Account<'info, Multisig>,

    pub create_key: Signer<'info>,

    pub system_program: Program<'info, System>,

    pub program_config: Account<'info, ProgramConfig>,

    #[account(mut)]
    pub sqauds_program_treasury: SystemAccount<'info>,

    pub squads_multisig_program: Program<'info, SquadsMultisigProgram>,
}
