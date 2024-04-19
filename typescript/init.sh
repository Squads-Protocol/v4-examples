#!/bin/bash
echo "Initializing..."
echo "➢ Make sure you are running a test-validator!"

if ! command -v squads-multisig-cli &> /dev/null
then
    echo "squads-multisig-cli not found, installing..."
    cargo install squads-multisig-cli
fi

public_key=$(solana address)
balance=$(solana balance)

if (( $(echo "$balance_numeric < 1" | bc -l) ))
then
    echo "Balance is less than 1 SOL. Initiating airdrop..."
    solana airdrop 3
    echo "Airdrop completed."
else
    echo "Balance is sufficient. Skipping airdrop."
fi

keypair_path="/Users/$(whoami)/.config/solana/id.json"

squads-multisig-cli program-config-init --rpc-url http://127.0.0.1:8899 \
    --initializer-keypair "$keypair_path" \
    --program-config-authority "$public_key" \
    --treasury "$public_key" \
    --multisig-creation-fee 0 \

if [ $? -eq 0 ]
then
    echo "Program Config Initialized."
else
    echo "Error: Initialization failed."
fi
