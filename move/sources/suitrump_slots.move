/// SUITRUMP Royale - Slot Machine Game
/// A 3-reel slot machine with multiple symbols and payouts
module suitrump_royale::suitrump_slots {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::event;
    use sui::random::{Self, Random};

    // ===== Error Codes =====
    const EInsufficientBalance: u64 = 0;
    const EBetTooSmall: u64 = 1;
    const EBetTooLarge: u64 = 2;
    const EGamePaused: u64 = 3;

    // ===== Symbols (0-5) =====
    const SYMBOL_CHERRY: u8 = 0;    // 2x for pair, 5x for triple
    const SYMBOL_LEMON: u8 = 1;     // 3x for pair, 8x for triple
    const SYMBOL_ORANGE: u8 = 2;    // 4x for pair, 10x for triple
    const SYMBOL_PLUM: u8 = 3;      // 5x for pair, 15x for triple
    const SYMBOL_BELL: u8 = 4;      // 8x for pair, 25x for triple
    const SYMBOL_SEVEN: u8 = 5;     // 10x for pair, 50x for triple (JACKPOT)

    // ===== Game Constants =====
    const MIN_BET: u64 = 1_000_000_000; // 1 SUIT
    const MAX_BET: u64 = 100_000_000_000; // 100 SUIT

    // ===== Structs =====

    public struct AdminCap has key, store {
        id: UID
    }

    public struct SlotsHouse<phantom T> has key {
        id: UID,
        balance: Balance<T>,
        total_spins: u64,
        total_wagered: u64,
        total_paid_out: u64,
        jackpots_hit: u64,
        is_paused: bool,
        min_bet: u64,
        max_bet: u64
    }

    public struct SpinResult has copy, drop {
        player: address,
        bet_amount: u64,
        reel1: u8,
        reel2: u8,
        reel3: u8,
        multiplier: u64,
        payout: u64,
        is_jackpot: bool
    }

    // ===== Init =====

    fun init(ctx: &mut TxContext) {
        let admin_cap = AdminCap {
            id: object::new(ctx)
        };
        transfer::transfer(admin_cap, tx_context::sender(ctx));
    }

    public fun create_house<T>(ctx: &mut TxContext) {
        let house = SlotsHouse<T> {
            id: object::new(ctx),
            balance: balance::zero(),
            total_spins: 0,
            total_wagered: 0,
            total_paid_out: 0,
            jackpots_hit: 0,
            is_paused: false,
            min_bet: MIN_BET,
            max_bet: MAX_BET
        };
        transfer::share_object(house);
    }

    // ===== Game Functions =====

    public entry fun spin<T>(
        house: &mut SlotsHouse<T>,
        bet_coin: Coin<T>,
        random: &Random,
        ctx: &mut TxContext
    ) {
        assert!(!house.is_paused, EGamePaused);

        let bet_amount = coin::value(&bet_coin);
        assert!(bet_amount >= house.min_bet, EBetTooSmall);
        assert!(bet_amount <= house.max_bet, EBetTooLarge);

        // Max payout is 50x for triple sevens
        let max_payout = bet_amount * 50;
        assert!(balance::value(&house.balance) >= max_payout, EInsufficientBalance);

        // Add bet to house
        let bet_balance = coin::into_balance(bet_coin);
        balance::join(&mut house.balance, bet_balance);

        // Generate 3 random reels (0-5)
        let mut generator = random::new_generator(random, ctx);
        let reel1 = random::generate_u8_in_range(&mut generator, 0, 6);
        let reel2 = random::generate_u8_in_range(&mut generator, 0, 6);
        let reel3 = random::generate_u8_in_range(&mut generator, 0, 6);

        // Calculate payout
        let (multiplier, is_jackpot) = calculate_multiplier(reel1, reel2, reel3);
        let payout = bet_amount * multiplier / 100;

        // Pay out winnings
        if (payout > 0) {
            let payout_balance = balance::split(&mut house.balance, payout);
            let payout_coin = coin::from_balance(payout_balance, ctx);
            transfer::public_transfer(payout_coin, tx_context::sender(ctx));
            house.total_paid_out = house.total_paid_out + payout;
        };

        // Update stats
        house.total_spins = house.total_spins + 1;
        house.total_wagered = house.total_wagered + bet_amount;
        if (is_jackpot) {
            house.jackpots_hit = house.jackpots_hit + 1;
        };

        // Emit event
        event::emit(SpinResult {
            player: tx_context::sender(ctx),
            bet_amount,
            reel1,
            reel2,
            reel3,
            multiplier,
            payout,
            is_jackpot
        });
    }

    // ===== Helper Functions =====

    fun calculate_multiplier(r1: u8, r2: u8, r3: u8): (u64, bool) {
        // Triple (all same)
        if (r1 == r2 && r2 == r3) {
            let mult = if (r1 == SYMBOL_CHERRY) { 500 }
                else if (r1 == SYMBOL_LEMON) { 800 }
                else if (r1 == SYMBOL_ORANGE) { 1000 }
                else if (r1 == SYMBOL_PLUM) { 1500 }
                else if (r1 == SYMBOL_BELL) { 2500 }
                else { 5000 }; // SEVEN - JACKPOT

            let is_jackpot = r1 == SYMBOL_SEVEN;
            return (mult, is_jackpot)
        };

        // Pair (any two same)
        if (r1 == r2 || r2 == r3 || r1 == r3) {
            let symbol = if (r1 == r2) { r1 } else if (r2 == r3) { r2 } else { r1 };
            let mult = if (symbol == SYMBOL_CHERRY) { 200 }
                else if (symbol == SYMBOL_LEMON) { 300 }
                else if (symbol == SYMBOL_ORANGE) { 400 }
                else if (symbol == SYMBOL_PLUM) { 500 }
                else if (symbol == SYMBOL_BELL) { 800 }
                else { 1000 }; // SEVEN pair

            return (mult, false)
        };

        // No match
        (0, false)
    }

    // ===== Admin Functions =====

    public entry fun fund_house<T>(
        house: &mut SlotsHouse<T>,
        funds: Coin<T>,
        _admin: &AdminCap
    ) {
        let fund_balance = coin::into_balance(funds);
        balance::join(&mut house.balance, fund_balance);
    }

    public entry fun withdraw<T>(
        house: &mut SlotsHouse<T>,
        amount: u64,
        _admin: &AdminCap,
        ctx: &mut TxContext
    ) {
        let withdraw_balance = balance::split(&mut house.balance, amount);
        let withdraw_coin = coin::from_balance(withdraw_balance, ctx);
        transfer::public_transfer(withdraw_coin, tx_context::sender(ctx));
    }

    public entry fun pause<T>(house: &mut SlotsHouse<T>, _admin: &AdminCap) {
        house.is_paused = true;
    }

    public entry fun unpause<T>(house: &mut SlotsHouse<T>, _admin: &AdminCap) {
        house.is_paused = false;
    }

    // ===== View Functions =====

    public fun get_house_balance<T>(house: &SlotsHouse<T>): u64 {
        balance::value(&house.balance)
    }

    public fun get_stats<T>(house: &SlotsHouse<T>): (u64, u64, u64, u64) {
        (house.total_spins, house.total_wagered, house.total_paid_out, house.jackpots_hit)
    }
}
