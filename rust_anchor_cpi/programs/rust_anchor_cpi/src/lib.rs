use anchor_lang::prelude::*;

pub mod instructions;

pub use instructions::*;

declare_id!("5L9tCHp2GRqSjKh1SqLdaqKjYdSV9hrs1vFzWFCr5BYq");

#[program]
pub mod rust_anchor_cpi {
    use super::*;

    pub fn create_multisig(ctx: Context<CreateMultisig>) -> Result<()> {
        instructions::create_multisig(ctx)?;
        Ok(())
    }

    pub fn create_vault_transaction(ctx: Context<CreateVaultTransaction>) -> Result<()> {
        instructions::create_vault_transaction(ctx)?;
        Ok(())
    }

    pub fn create_proposal(ctx: Context<CreateProposal>) -> Result<()> {
        instructions::create_proposal(ctx)?;
        Ok(())
    }

    pub fn approve_proposal(ctx: Context<ApproveProposal>) -> Result<()> {
        instructions::approve_proposal(ctx)?;
        Ok(())
    }
}
