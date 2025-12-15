/// Test SUITRUMP Token for Testnet
/// This is a fake token for testing the casino on testnet.
/// DO NOT use in production - replace with real SUITRUMP token address.
module suitrump_royale::test_suitrump {
    use sui::coin::{Self, TreasuryCap, Coin};
    use sui::url;

    /// The TEST_SUITRUMP token type
    public struct TEST_SUITRUMP has drop {}

    /// Admin capability for minting
    public struct MintCap has key, store {
        id: UID
    }

    /// Initialize the token
    fun init(witness: TEST_SUITRUMP, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency(
            witness,
            9, // 9 decimals like SUI
            b"tSUIT",
            b"Test SUITRUMP",
            b"Test SUITRUMP token for casino testing on testnet",
            option::some(url::new_unsafe_from_bytes(b"https://sui-trump.com/logo.png")),
            ctx
        );

        // Transfer treasury cap to deployer for minting
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));

        // Create mint cap for admin
        let mint_cap = MintCap {
            id: object::new(ctx)
        };
        transfer::public_transfer(mint_cap, tx_context::sender(ctx));

        // Freeze metadata
        transfer::public_freeze_object(metadata);
    }

    /// Mint tokens (admin only - requires TreasuryCap)
    public entry fun mint(
        treasury_cap: &mut TreasuryCap<TEST_SUITRUMP>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let coins = coin::mint(treasury_cap, amount, ctx);
        transfer::public_transfer(coins, recipient);
    }

    /// Mint tokens to self (convenience function)
    public entry fun mint_to_self(
        treasury_cap: &mut TreasuryCap<TEST_SUITRUMP>,
        amount: u64,
        ctx: &mut TxContext
    ) {
        let coins = coin::mint(treasury_cap, amount, ctx);
        transfer::public_transfer(coins, tx_context::sender(ctx));
    }

    /// Burn tokens
    public entry fun burn(
        treasury_cap: &mut TreasuryCap<TEST_SUITRUMP>,
        coins: Coin<TEST_SUITRUMP>
    ) {
        coin::burn(treasury_cap, coins);
    }

    /// Faucet function - anyone can mint small amounts for testing
    /// Mints 10,000 tokens (10,000 * 10^9 = 10 trillion smallest units)
    public entry fun faucet(
        treasury_cap: &mut TreasuryCap<TEST_SUITRUMP>,
        ctx: &mut TxContext
    ) {
        let amount = 10_000_000_000_000u64; // 10,000 tokens with 9 decimals
        let coins = coin::mint(treasury_cap, amount, ctx);
        transfer::public_transfer(coins, tx_context::sender(ctx));
    }
}
