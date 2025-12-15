/// Test SUITRUMP Token for Testnet
/// This is a fake token for testing the casino on testnet.
/// DO NOT use in production - replace with real SUITRUMP token address.
module suitrump_tokens::test_suitrump {
    use sui::coin::{Self, TreasuryCap, Coin};
    use sui::url;

    /// The TEST_SUITRUMP token type
    public struct TEST_SUITRUMP has drop {}

    /// Admin capability for minting
    public struct MintCap has key, store {
        id: UID
    }

    /// Public faucet - shared object that anyone can use to mint test tokens
    public struct PublicFaucet has key {
        id: UID,
        treasury_cap: TreasuryCap<TEST_SUITRUMP>,
        faucet_amount: u64,  // Amount per claim (10,000 tokens)
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

        // Create a shared PublicFaucet that anyone can use
        let public_faucet = PublicFaucet {
            id: object::new(ctx),
            treasury_cap,
            faucet_amount: 10_000_000_000_000u64, // 10,000 tokens with 9 decimals
        };
        transfer::share_object(public_faucet);

        // Create mint cap for admin (for manual minting if needed)
        let mint_cap = MintCap {
            id: object::new(ctx)
        };
        transfer::public_transfer(mint_cap, tx_context::sender(ctx));

        // Freeze metadata
        transfer::public_freeze_object(metadata);
    }

    /// Mint tokens (admin only - requires access to PublicFaucet)
    public entry fun mint(
        faucet: &mut PublicFaucet,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let coins = coin::mint(&mut faucet.treasury_cap, amount, ctx);
        transfer::public_transfer(coins, recipient);
    }

    /// Public faucet function - ANYONE can mint test tokens
    /// Mints 10,000 tokens (10,000 * 10^9 = 10 trillion smallest units)
    public entry fun faucet(
        public_faucet: &mut PublicFaucet,
        ctx: &mut TxContext
    ) {
        let coins = coin::mint(&mut public_faucet.treasury_cap, public_faucet.faucet_amount, ctx);
        transfer::public_transfer(coins, tx_context::sender(ctx));
    }

    /// Burn tokens
    public entry fun burn(
        faucet: &mut PublicFaucet,
        coins: Coin<TEST_SUITRUMP>
    ) {
        coin::burn(&mut faucet.treasury_cap, coins);
    }
}
