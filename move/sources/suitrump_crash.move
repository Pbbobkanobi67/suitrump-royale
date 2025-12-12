/// SUITRUMP Royale - Crash Game
/// Multiplier grows until it crashes - cash out before it does!
#[allow(unused_const, unused_variable, unused_use, unused_mut_parameter, duplicate_alias, lint(public_random, public_entry))]
module suitrump_royale::suitrump_crash {
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
    const EInvalidCashout: u64 = 4;

    // ===== Game Constants =====
    const MIN_BET: u64 = 1_000_000_000; // 1 SUIT
    const MAX_BET: u64 = 1000_000_000_000; // 1000 SUIT
    const HOUSE_EDGE_BPS: u64 = 400; // 4% house edge

    // ===== Structs =====

    public struct AdminCap has key, store {
        id: UID
    }

    public struct CrashHouse<phantom T> has key {
        id: UID,
        balance: Balance<T>,
        total_games: u64,
        total_wagered: u64,
        total_paid_out: u64,
        is_paused: bool,
        min_bet: u64,
        max_bet: u64
    }

    public struct CrashResult has copy, drop {
        player: address,
        bet_amount: u64,
        auto_cashout: u64,  // Target multiplier (in basis points, 100 = 1x)
        crash_point: u64,   // Where it crashed (in basis points)
        cashed_out: bool,
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
        let house = CrashHouse<T> {
            id: object::new(ctx),
            balance: balance::zero(),
            total_games: 0,
            total_wagered: 0,
            total_paid_out: 0,
            is_paused: false,
            min_bet: MIN_BET,
            max_bet: MAX_BET
        };
        transfer::share_object(house);
    }

    // ===== Game Functions =====

    /// Play crash with auto-cashout multiplier (in basis points: 200 = 2x, 150 = 1.5x)
    public entry fun play<T>(
        house: &mut CrashHouse<T>,
        bet_coin: Coin<T>,
        auto_cashout_bps: u64,  // Auto cash-out at this multiplier (e.g., 200 for 2x)
        random: &Random,
        ctx: &mut TxContext
    ) {
        assert!(!house.is_paused, EGamePaused);
        assert!(auto_cashout_bps >= 101, EInvalidCashout); // Must be > 1.01x

        let bet_amount = coin::value(&bet_coin);
        assert!(bet_amount >= house.min_bet, EBetTooSmall);
        assert!(bet_amount <= house.max_bet, EBetTooLarge);

        // Calculate max possible payout
        let max_payout = (bet_amount * auto_cashout_bps) / 100;
        assert!(balance::value(&house.balance) >= max_payout, EInsufficientBalance);

        // Add bet to house
        let bet_balance = coin::into_balance(bet_coin);
        balance::join(&mut house.balance, bet_balance);

        // Generate crash point using exponential distribution
        // Higher numbers are less likely (simulates real crash games)
        let mut generator = random::new_generator(random, ctx);
        let crash_point = generate_crash_point(&mut generator);

        // Check if player cashed out before crash
        let cashed_out = auto_cashout_bps <= crash_point;

        let payout = if (cashed_out) {
            let payout_amount = (bet_amount * auto_cashout_bps) / 100;
            let payout_balance = balance::split(&mut house.balance, payout_amount);
            let payout_coin = coin::from_balance(payout_balance, ctx);
            transfer::public_transfer(payout_coin, tx_context::sender(ctx));
            house.total_paid_out = house.total_paid_out + payout_amount;
            payout_amount
        } else {
            0
        };

        // Update stats
        house.total_games = house.total_games + 1;
        house.total_wagered = house.total_wagered + bet_amount;

        // Emit event
        event::emit(CrashResult {
            player: tx_context::sender(ctx),
            bet_amount,
            auto_cashout: auto_cashout_bps,
            crash_point,
            cashed_out,
            payout
        });
    }

    // ===== Helper Functions =====

    /// Generate crash point with house edge
    /// Returns value in basis points (100 = 1x, 200 = 2x, etc.)
    fun generate_crash_point(generator: &mut random::RandomGenerator): u64 {
        // Generate random number 0-9999
        let r = (random::generate_u64(generator) % 10000) as u64;

        // Apply exponential-like distribution with 4% house edge
        // Lower numbers = higher crash multipliers (rarer)
        if (r < 400) {
            // 4% instant crash (house edge)
            100
        } else if (r < 2000) {
            // 16% crash between 1.01x - 1.5x
            (101 + (random::generate_u64(generator) % 50))
        } else if (r < 5000) {
            // 30% crash between 1.5x - 2x
            (150 + (random::generate_u64(generator) % 50))
        } else if (r < 7500) {
            // 25% crash between 2x - 3x
            (200 + (random::generate_u64(generator) % 100))
        } else if (r < 9000) {
            // 15% crash between 3x - 5x
            (300 + (random::generate_u64(generator) % 200))
        } else if (r < 9800) {
            // 8% crash between 5x - 10x
            (500 + (random::generate_u64(generator) % 500))
        } else {
            // 2% crash between 10x - 50x (moon!)
            (1000 + (random::generate_u64(generator) % 4000))
        }
    }

    // ===== Admin Functions =====

    public entry fun fund_house<T>(
        house: &mut CrashHouse<T>,
        funds: Coin<T>,
        _admin: &AdminCap
    ) {
        let fund_balance = coin::into_balance(funds);
        balance::join(&mut house.balance, fund_balance);
    }

    public entry fun withdraw<T>(
        house: &mut CrashHouse<T>,
        amount: u64,
        _admin: &AdminCap,
        ctx: &mut TxContext
    ) {
        let withdraw_balance = balance::split(&mut house.balance, amount);
        let withdraw_coin = coin::from_balance(withdraw_balance, ctx);
        transfer::public_transfer(withdraw_coin, tx_context::sender(ctx));
    }

    public entry fun pause<T>(house: &mut CrashHouse<T>, _admin: &AdminCap) {
        house.is_paused = true;
    }

    public entry fun unpause<T>(house: &mut CrashHouse<T>, _admin: &AdminCap) {
        house.is_paused = false;
    }

    // ===== View Functions =====

    public fun get_house_balance<T>(house: &CrashHouse<T>): u64 {
        balance::value(&house.balance)
    }

    public fun get_stats<T>(house: &CrashHouse<T>): (u64, u64, u64, bool) {
        (house.total_games, house.total_wagered, house.total_paid_out, house.is_paused)
    }
}
