/// SUITRUMP Royale - Plinko Game
/// Drop a ball through pegs to land on multipliers
#[allow(unused_const, unused_variable, unused_use, unused_mut_parameter, duplicate_alias, lint(public_random, public_entry))]
module suitrump_royale::suitrump_plinko {
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
    const EInvalidRows: u64 = 4;
    const EInvalidRisk: u64 = 5;

    // ===== Risk Levels =====
    const RISK_LOW: u8 = 0;
    const RISK_MEDIUM: u8 = 1;
    const RISK_HIGH: u8 = 2;

    // ===== Game Constants =====
    const MIN_BET: u64 = 1_000_000_000; // 1 SUIT
    const MAX_BET: u64 = 500_000_000_000; // 500 SUIT
    const HOUSE_EDGE_BPS: u64 = 300; // 3%

    // ===== Structs =====

    public struct AdminCap has key, store {
        id: UID
    }

    public struct PlinkoHouse<phantom T> has key {
        id: UID,
        balance: Balance<T>,
        total_drops: u64,
        total_wagered: u64,
        total_paid_out: u64,
        is_paused: bool,
        min_bet: u64,
        max_bet: u64
    }

    public struct DropResult has copy, drop {
        player: address,
        bet_amount: u64,
        rows: u8,
        risk: u8,
        path: vector<bool>,  // Left = false, Right = true
        slot: u8,            // Final slot (0 to rows)
        multiplier: u64,     // In basis points (100 = 1x)
        payout: u64
    }

    // ===== Init =====

    fun init(ctx: &mut TxContext) {
        let admin_cap = AdminCap {
            id: object::new(ctx)
        };
        transfer::transfer(admin_cap, tx_context::sender(ctx));
    }

    public fun create_house<T>(ctx: &mut TxContext) {
        let house = PlinkoHouse<T> {
            id: object::new(ctx),
            balance: balance::zero(),
            total_drops: 0,
            total_wagered: 0,
            total_paid_out: 0,
            is_paused: false,
            min_bet: MIN_BET,
            max_bet: MAX_BET
        };
        transfer::share_object(house);
    }

    // ===== Game Functions =====

    public entry fun drop<T>(
        house: &mut PlinkoHouse<T>,
        bet_coin: Coin<T>,
        rows: u8,
        risk: u8,
        random: &Random,
        ctx: &mut TxContext
    ) {
        assert!(!house.is_paused, EGamePaused);
        assert!(rows >= 8 && rows <= 16, EInvalidRows);
        assert!(risk <= RISK_HIGH, EInvalidRisk);

        let bet_amount = coin::value(&bet_coin);
        assert!(bet_amount >= house.min_bet, EBetTooSmall);
        assert!(bet_amount <= house.max_bet, EBetTooLarge);

        // Check max possible payout
        let max_mult = get_max_multiplier(rows, risk);
        let max_payout = (bet_amount * max_mult) / 100;
        assert!(balance::value(&house.balance) >= max_payout, EInsufficientBalance);

        // Add bet to house
        let bet_balance = coin::into_balance(bet_coin);
        balance::join(&mut house.balance, bet_balance);

        // Simulate ball drop
        let mut generator = random::new_generator(random, ctx);
        let mut path = vector::empty<bool>();
        let mut position = 0u8;

        let mut i = 0u8;
        while (i < rows) {
            let goes_right = random::generate_bool(&mut generator);
            std::vector::push_back(&mut path, goes_right);
            if (goes_right) {
                position = position + 1;
            };
            i = i + 1;
        };

        // Get multiplier for final slot
        let multiplier = get_multiplier(rows, risk, position);
        let payout = (bet_amount * multiplier) / 100;

        // Pay out
        if (payout > 0) {
            let payout_balance = balance::split(&mut house.balance, payout);
            let payout_coin = coin::from_balance(payout_balance, ctx);
            transfer::public_transfer(payout_coin, tx_context::sender(ctx));
            house.total_paid_out = house.total_paid_out + payout;
        };

        // Update stats
        house.total_drops = house.total_drops + 1;
        house.total_wagered = house.total_wagered + bet_amount;

        // Emit event
        event::emit(DropResult {
            player: tx_context::sender(ctx),
            bet_amount,
            rows,
            risk,
            path,
            slot: position,
            multiplier,
            payout
        });
    }

    // ===== Helper Functions =====

    /// Get multiplier for a slot position
    /// Returns value in basis points (100 = 1x, 1000 = 10x)
    fun get_multiplier(rows: u8, risk: u8, slot: u8): u64 {
        // Simplified multiplier table for 8-16 rows
        // Edge slots have higher multipliers, middle has lower

        let center = rows / 2;
        let distance_from_center = if (slot > center) {
            slot - center
        } else {
            center - slot
        };

        // Base multipliers by distance from center
        let base = if (distance_from_center == 0) {
            // Center slot
            if (risk == RISK_LOW) { 50 }        // 0.5x
            else if (risk == RISK_MEDIUM) { 30 } // 0.3x
            else { 10 }                          // 0.1x (high risk)
        } else if (distance_from_center == 1) {
            if (risk == RISK_LOW) { 80 }
            else if (risk == RISK_MEDIUM) { 60 }
            else { 30 }
        } else if (distance_from_center == 2) {
            if (risk == RISK_LOW) { 110 }
            else if (risk == RISK_MEDIUM) { 100 }
            else { 80 }
        } else if (distance_from_center == 3) {
            if (risk == RISK_LOW) { 150 }
            else if (risk == RISK_MEDIUM) { 200 }
            else { 300 }
        } else if (distance_from_center == 4) {
            if (risk == RISK_LOW) { 300 }
            else if (risk == RISK_MEDIUM) { 500 }
            else { 1000 }
        } else {
            // Edge slots
            if (risk == RISK_LOW) { 500 }
            else if (risk == RISK_MEDIUM) { 1000 }
            else { 2600 }  // 26x max for high risk
        };

        base
    }

    fun get_max_multiplier(rows: u8, risk: u8): u64 {
        // Maximum possible multiplier
        if (risk == RISK_LOW) { 500 }
        else if (risk == RISK_MEDIUM) { 1000 }
        else { 2600 }
    }

    // ===== Admin Functions =====

    public entry fun fund_house<T>(
        house: &mut PlinkoHouse<T>,
        funds: Coin<T>,
        _admin: &AdminCap
    ) {
        let fund_balance = coin::into_balance(funds);
        balance::join(&mut house.balance, fund_balance);
    }

    public entry fun withdraw<T>(
        house: &mut PlinkoHouse<T>,
        amount: u64,
        _admin: &AdminCap,
        ctx: &mut TxContext
    ) {
        let withdraw_balance = balance::split(&mut house.balance, amount);
        let withdraw_coin = coin::from_balance(withdraw_balance, ctx);
        transfer::public_transfer(withdraw_coin, tx_context::sender(ctx));
    }

    public entry fun pause<T>(house: &mut PlinkoHouse<T>, _admin: &AdminCap) {
        house.is_paused = true;
    }

    public entry fun unpause<T>(house: &mut PlinkoHouse<T>, _admin: &AdminCap) {
        house.is_paused = false;
    }

    // ===== View Functions =====

    public fun get_house_balance<T>(house: &PlinkoHouse<T>): u64 {
        balance::value(&house.balance)
    }

    public fun get_stats<T>(house: &PlinkoHouse<T>): (u64, u64, u64, bool) {
        (house.total_drops, house.total_wagered, house.total_paid_out, house.is_paused)
    }
}
