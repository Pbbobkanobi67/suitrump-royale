/// SUITRUMP Royale - Progressive Jackpot
/// Match 4 dice to win the growing jackpot pool
module suitrump_royale::suitrump_progressive {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::event;
    use sui::random::{Self, Random};

    // ===== Error Codes =====
    const EInsufficientBalance: u64 = 0;
    const EGamePaused: u64 = 1;

    // ===== Game Constants =====
    const TICKET_PRICE: u64 = 1_000_000_000; // 1 SUIT per roll
    const JACKPOT_CONTRIBUTION: u64 = 800; // 80% goes to jackpot pool
    const HOUSE_TAKE: u64 = 200; // 20% house edge

    // Payouts for matches (in SUIT, with 9 decimals)
    const MATCH_2_PAYOUT: u64 = 2_000_000_000;  // 2 SUIT
    const MATCH_3_PAYOUT: u64 = 10_000_000_000; // 10 SUIT

    // ===== Structs =====

    public struct AdminCap has key, store {
        id: UID
    }

    public struct ProgressiveHouse<phantom T> has key {
        id: UID,
        house_balance: Balance<T>,
        jackpot_pool: Balance<T>,
        target_dice: vector<u8>,  // 4 target numbers to match
        total_rolls: u64,
        total_wagered: u64,
        jackpots_won: u64,
        is_paused: bool
    }

    public struct RollResult has copy, drop {
        player: address,
        rolled_dice: vector<u8>,
        target_dice: vector<u8>,
        matches: u8,
        payout: u64,
        jackpot_won: bool,
        new_jackpot: u64
    }

    // ===== Init =====

    fun init(ctx: &mut TxContext) {
        let admin_cap = AdminCap {
            id: object::new(ctx)
        };
        transfer::transfer(admin_cap, tx_context::sender(ctx));
    }

    public fun create_house<T>(ctx: &mut TxContext) {
        // Initialize with random target dice
        let target = vector[1u8, 2u8, 3u8, 4u8]; // Will be set by admin

        let house = ProgressiveHouse<T> {
            id: object::new(ctx),
            house_balance: balance::zero(),
            jackpot_pool: balance::zero(),
            target_dice: target,
            total_rolls: 0,
            total_wagered: 0,
            jackpots_won: 0,
            is_paused: false
        };
        transfer::share_object(house);
    }

    // ===== Game Functions =====

    public entry fun roll<T>(
        house: &mut ProgressiveHouse<T>,
        payment: Coin<T>,
        random: &Random,
        ctx: &mut TxContext
    ) {
        assert!(!house.is_paused, EGamePaused);

        let payment_amount = coin::value(&payment);
        assert!(payment_amount >= TICKET_PRICE, EInsufficientBalance);

        // Split payment: 80% to jackpot, 20% to house
        let payment_balance = coin::into_balance(payment);
        let jackpot_amount = (TICKET_PRICE * JACKPOT_CONTRIBUTION) / 1000;
        let house_amount = TICKET_PRICE - jackpot_amount;

        let jackpot_contribution = balance::split(&mut payment_balance, jackpot_amount);
        balance::join(&mut house.jackpot_pool, jackpot_contribution);

        // Rest goes to house (including any overpayment)
        balance::join(&mut house.house_balance, payment_balance);

        // Roll 4 dice
        let mut generator = random::new_generator(random, ctx);
        let d1 = random::generate_u8_in_range(&mut generator, 1, 7);
        let d2 = random::generate_u8_in_range(&mut generator, 1, 7);
        let d3 = random::generate_u8_in_range(&mut generator, 1, 7);
        let d4 = random::generate_u8_in_range(&mut generator, 1, 7);

        let rolled = vector[d1, d2, d3, d4];

        // Count matches
        let matches = count_matches(&rolled, &house.target_dice);

        // Calculate payout
        let (payout, jackpot_won) = if (matches == 4) {
            // JACKPOT!
            let jackpot = balance::value(&house.jackpot_pool);
            (jackpot, true)
        } else if (matches == 3) {
            (MATCH_3_PAYOUT, false)
        } else if (matches == 2) {
            (MATCH_2_PAYOUT, false)
        } else {
            (0, false)
        };

        // Pay out winnings
        if (payout > 0) {
            let payout_balance = if (jackpot_won) {
                // Drain jackpot pool
                let all_jackpot = balance::withdraw_all(&mut house.jackpot_pool);
                house.jackpots_won = house.jackpots_won + 1;
                all_jackpot
            } else {
                // Pay from house balance
                assert!(balance::value(&house.house_balance) >= payout, EInsufficientBalance);
                balance::split(&mut house.house_balance, payout)
            };

            let payout_coin = coin::from_balance(payout_balance, ctx);
            transfer::public_transfer(payout_coin, tx_context::sender(ctx));
        };

        // Update stats
        house.total_rolls = house.total_rolls + 1;
        house.total_wagered = house.total_wagered + TICKET_PRICE;

        // Emit event
        event::emit(RollResult {
            player: tx_context::sender(ctx),
            rolled_dice: rolled,
            target_dice: house.target_dice,
            matches,
            payout,
            jackpot_won,
            new_jackpot: balance::value(&house.jackpot_pool)
        });
    }

    // ===== Helper Functions =====

    fun count_matches(rolled: &vector<u8>, target: &vector<u8>): u8 {
        let mut matches = 0u8;
        let mut i = 0;
        while (i < 4) {
            if (*std::vector::borrow(rolled, i) == *std::vector::borrow(target, i)) {
                matches = matches + 1;
            };
            i = i + 1;
        };
        matches
    }

    // ===== Admin Functions =====

    public entry fun set_target_dice<T>(
        house: &mut ProgressiveHouse<T>,
        d1: u8, d2: u8, d3: u8, d4: u8,
        _admin: &AdminCap
    ) {
        house.target_dice = vector[d1, d2, d3, d4];
    }

    public entry fun fund_house<T>(
        house: &mut ProgressiveHouse<T>,
        funds: Coin<T>,
        _admin: &AdminCap
    ) {
        let fund_balance = coin::into_balance(funds);
        balance::join(&mut house.house_balance, fund_balance);
    }

    public entry fun seed_jackpot<T>(
        house: &mut ProgressiveHouse<T>,
        funds: Coin<T>,
        _admin: &AdminCap
    ) {
        let fund_balance = coin::into_balance(funds);
        balance::join(&mut house.jackpot_pool, fund_balance);
    }

    public entry fun withdraw<T>(
        house: &mut ProgressiveHouse<T>,
        amount: u64,
        _admin: &AdminCap,
        ctx: &mut TxContext
    ) {
        let withdraw_balance = balance::split(&mut house.house_balance, amount);
        let withdraw_coin = coin::from_balance(withdraw_balance, ctx);
        transfer::public_transfer(withdraw_coin, tx_context::sender(ctx));
    }

    public entry fun pause<T>(house: &mut ProgressiveHouse<T>, _admin: &AdminCap) {
        house.is_paused = true;
    }

    public entry fun unpause<T>(house: &mut ProgressiveHouse<T>, _admin: &AdminCap) {
        house.is_paused = false;
    }

    // ===== View Functions =====

    public fun get_jackpot<T>(house: &ProgressiveHouse<T>): u64 {
        balance::value(&house.jackpot_pool)
    }

    public fun get_target_dice<T>(house: &ProgressiveHouse<T>): vector<u8> {
        house.target_dice
    }

    public fun get_stats<T>(house: &ProgressiveHouse<T>): (u64, u64, u64, bool) {
        (house.total_rolls, house.total_wagered, house.jackpots_won, house.is_paused)
    }
}
