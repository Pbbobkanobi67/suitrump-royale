/// SUITRUMP Royale - European Roulette
/// Classic roulette with 0-36 numbers, multiple bet types
#[allow(unused_const, unused_variable, unused_use, unused_mut_parameter, duplicate_alias, lint(public_random, public_entry))]
module suitrump_royale::suitrump_roulette {
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
    const EInvalidBetType: u64 = 4;
    const EInvalidNumber: u64 = 5;

    // ===== Bet Types =====
    const BET_STRAIGHT: u8 = 0;   // Single number (35:1)
    const BET_RED: u8 = 1;        // Red numbers (1:1)
    const BET_BLACK: u8 = 2;      // Black numbers (1:1)
    const BET_ODD: u8 = 3;        // Odd numbers (1:1)
    const BET_EVEN: u8 = 4;       // Even numbers (1:1)
    const BET_LOW: u8 = 5;        // 1-18 (1:1)
    const BET_HIGH: u8 = 6;       // 19-36 (1:1)
    const BET_DOZEN_1: u8 = 7;    // 1-12 (2:1)
    const BET_DOZEN_2: u8 = 8;    // 13-24 (2:1)
    const BET_DOZEN_3: u8 = 9;    // 25-36 (2:1)

    // ===== Game Constants =====
    const MIN_BET: u64 = 1_000_000_000; // 1 SUIT
    const MAX_BET: u64 = 500_000_000_000; // 500 SUIT

    // Red numbers on European roulette wheel
    // 1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36

    // ===== Structs =====

    public struct AdminCap has key, store {
        id: UID
    }

    public struct RouletteHouse<phantom T> has key {
        id: UID,
        balance: Balance<T>,
        total_spins: u64,
        total_wagered: u64,
        total_paid_out: u64,
        is_paused: bool,
        min_bet: u64,
        max_bet: u64
    }

    public struct SpinResult has copy, drop {
        player: address,
        bet_type: u8,
        bet_number: u8,
        bet_amount: u64,
        result_number: u8,
        won: bool,
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
        let house = RouletteHouse<T> {
            id: object::new(ctx),
            balance: balance::zero(),
            total_spins: 0,
            total_wagered: 0,
            total_paid_out: 0,
            is_paused: false,
            min_bet: MIN_BET,
            max_bet: MAX_BET
        };
        transfer::share_object(house);
    }

    // ===== Game Functions =====

    public entry fun play<T>(
        house: &mut RouletteHouse<T>,
        bet_coin: Coin<T>,
        bet_type: u8,
        bet_number: u8,  // Only used for straight bets
        random: &Random,
        ctx: &mut TxContext
    ) {
        assert!(!house.is_paused, EGamePaused);
        assert!(bet_type <= BET_DOZEN_3, EInvalidBetType);

        if (bet_type == BET_STRAIGHT) {
            assert!(bet_number <= 36, EInvalidNumber);
        };

        let bet_amount = coin::value(&bet_coin);
        assert!(bet_amount >= house.min_bet, EBetTooSmall);
        assert!(bet_amount <= house.max_bet, EBetTooLarge);

        // Max payout is 35x for straight bet
        let max_payout = bet_amount * 36;
        assert!(balance::value(&house.balance) >= max_payout, EInsufficientBalance);

        // Add bet to house
        let bet_balance = coin::into_balance(bet_coin);
        balance::join(&mut house.balance, bet_balance);

        // Spin the wheel (0-36)
        let mut generator = random::new_generator(random, ctx);
        let result_number = random::generate_u8_in_range(&mut generator, 0, 37);

        // Check if player won
        let won = check_win(bet_type, bet_number, result_number);

        // Calculate and pay out winnings
        let payout = if (won) {
            let multiplier = get_payout_multiplier(bet_type);
            let payout_amount = bet_amount * multiplier / 100;
            let payout_balance = balance::split(&mut house.balance, payout_amount);
            let payout_coin = coin::from_balance(payout_balance, ctx);
            transfer::public_transfer(payout_coin, tx_context::sender(ctx));
            house.total_paid_out = house.total_paid_out + payout_amount;
            payout_amount
        } else {
            0
        };

        // Update stats
        house.total_spins = house.total_spins + 1;
        house.total_wagered = house.total_wagered + bet_amount;

        // Emit event
        event::emit(SpinResult {
            player: tx_context::sender(ctx),
            bet_type,
            bet_number,
            bet_amount,
            result_number,
            won,
            payout
        });
    }

    // ===== Helper Functions =====

    fun check_win(bet_type: u8, bet_number: u8, result: u8): bool {
        if (result == 0) {
            // Green zero - only straight bet on 0 wins
            return bet_type == BET_STRAIGHT && bet_number == 0
        };

        if (bet_type == BET_STRAIGHT) {
            result == bet_number
        } else if (bet_type == BET_RED) {
            is_red(result)
        } else if (bet_type == BET_BLACK) {
            !is_red(result)
        } else if (bet_type == BET_ODD) {
            result % 2 == 1
        } else if (bet_type == BET_EVEN) {
            result % 2 == 0
        } else if (bet_type == BET_LOW) {
            result >= 1 && result <= 18
        } else if (bet_type == BET_HIGH) {
            result >= 19 && result <= 36
        } else if (bet_type == BET_DOZEN_1) {
            result >= 1 && result <= 12
        } else if (bet_type == BET_DOZEN_2) {
            result >= 13 && result <= 24
        } else if (bet_type == BET_DOZEN_3) {
            result >= 25 && result <= 36
        } else {
            false
        }
    }

    fun is_red(n: u8): bool {
        // Red numbers: 1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36
        n == 1 || n == 3 || n == 5 || n == 7 || n == 9 ||
        n == 12 || n == 14 || n == 16 || n == 18 ||
        n == 19 || n == 21 || n == 23 || n == 25 || n == 27 ||
        n == 30 || n == 32 || n == 34 || n == 36
    }

    fun get_payout_multiplier(bet_type: u8): u64 {
        if (bet_type == BET_STRAIGHT) {
            3600 // 35:1 + original bet = 36x (in basis points)
        } else if (bet_type >= BET_DOZEN_1) {
            300 // 2:1 + original = 3x
        } else {
            200 // 1:1 + original = 2x
        }
    }

    // ===== Admin Functions =====

    public entry fun fund_house<T>(
        house: &mut RouletteHouse<T>,
        funds: Coin<T>,
        _admin: &AdminCap
    ) {
        let fund_balance = coin::into_balance(funds);
        balance::join(&mut house.balance, fund_balance);
    }

    public entry fun withdraw<T>(
        house: &mut RouletteHouse<T>,
        amount: u64,
        _admin: &AdminCap,
        ctx: &mut TxContext
    ) {
        let withdraw_balance = balance::split(&mut house.balance, amount);
        let withdraw_coin = coin::from_balance(withdraw_balance, ctx);
        transfer::public_transfer(withdraw_coin, tx_context::sender(ctx));
    }

    public entry fun pause<T>(house: &mut RouletteHouse<T>, _admin: &AdminCap) {
        house.is_paused = true;
    }

    public entry fun unpause<T>(house: &mut RouletteHouse<T>, _admin: &AdminCap) {
        house.is_paused = false;
    }

    // ===== View Functions =====

    public fun get_house_balance<T>(house: &RouletteHouse<T>): u64 {
        balance::value(&house.balance)
    }

    public fun get_stats<T>(house: &RouletteHouse<T>): (u64, u64, u64, bool) {
        (house.total_spins, house.total_wagered, house.total_paid_out, house.is_paused)
    }
}
