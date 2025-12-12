/// SUITRUMP Royale - Classic Dice Game
/// A provably fair dice game on Sui blockchain
#[allow(unused_const, unused_variable, unused_use, unused_mut_parameter, duplicate_alias, lint(public_random, public_entry))]
module suitrump_royale::suitrump_dice {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::event;
    use sui::random::{Self, Random};

    // ===== Error Codes =====
    const EInsufficientBalance: u64 = 0;
    const EInvalidBetType: u64 = 1;
    const EBetTooSmall: u64 = 2;
    const EBetTooLarge: u64 = 3;
    const EGamePaused: u64 = 4;
    const EInvalidNumber: u64 = 5;
    const ENotAdmin: u64 = 6;

    // ===== Bet Types =====
    const BET_EXACT: u8 = 0;      // Guess exact number (6x payout)
    const BET_OVER: u8 = 1;       // Over chosen number
    const BET_UNDER: u8 = 2;      // Under chosen number
    const BET_ODD: u8 = 3;        // Odd number (1, 3, 5)
    const BET_EVEN: u8 = 4;       // Even number (2, 4, 6)

    // ===== Game Constants =====
    const HOUSE_EDGE_BPS: u64 = 300; // 3% house edge (basis points)
    const MIN_BET: u64 = 1_000_000_000; // 1 SUIT (9 decimals)
    const MAX_BET: u64 = 1000_000_000_000; // 1000 SUIT

    // ===== Structs =====

    /// Admin capability for managing the game
    public struct AdminCap has key, store {
        id: UID
    }

    /// The main game house/treasury
    public struct DiceHouse<phantom T> has key {
        id: UID,
        balance: Balance<T>,
        total_bets: u64,
        total_wagered: u64,
        total_paid_out: u64,
        is_paused: bool,
        min_bet: u64,
        max_bet: u64
    }

    /// Event emitted when a bet is placed and resolved
    public struct BetResult has copy, drop {
        player: address,
        bet_type: u8,
        chosen_number: u8,
        bet_amount: u64,
        rolled_number: u8,
        won: bool,
        payout: u64
    }

    // ===== Init =====

    /// Initialize the dice game
    fun init(ctx: &mut TxContext) {
        // Create admin capability and transfer to deployer
        let admin_cap = AdminCap {
            id: object::new(ctx)
        };
        transfer::transfer(admin_cap, tx_context::sender(ctx));
    }

    /// Create a new dice house for a specific token type
    public fun create_house<T>(ctx: &mut TxContext) {
        let house = DiceHouse<T> {
            id: object::new(ctx),
            balance: balance::zero(),
            total_bets: 0,
            total_wagered: 0,
            total_paid_out: 0,
            is_paused: false,
            min_bet: MIN_BET,
            max_bet: MAX_BET
        };
        transfer::share_object(house);
    }

    // ===== Game Functions =====

    /// Place a bet and roll the dice
    public entry fun play<T>(
        house: &mut DiceHouse<T>,
        bet_coin: Coin<T>,
        bet_type: u8,
        chosen_number: u8,
        random: &Random,
        ctx: &mut TxContext
    ) {
        // Validate game state
        assert!(!house.is_paused, EGamePaused);

        // Validate bet type
        assert!(bet_type <= BET_EVEN, EInvalidBetType);

        // Validate chosen number for applicable bet types
        if (bet_type == BET_EXACT || bet_type == BET_OVER || bet_type == BET_UNDER) {
            assert!(chosen_number >= 1 && chosen_number <= 6, EInvalidNumber);
        };

        // Validate bet amount
        let bet_amount = coin::value(&bet_coin);
        assert!(bet_amount >= house.min_bet, EBetTooSmall);
        assert!(bet_amount <= house.max_bet, EBetTooLarge);

        // Calculate potential payout to ensure house can pay
        let potential_payout = calculate_payout(bet_type, bet_amount);
        assert!(balance::value(&house.balance) >= potential_payout, EInsufficientBalance);

        // Add bet to house balance
        let bet_balance = coin::into_balance(bet_coin);
        balance::join(&mut house.balance, bet_balance);

        // Generate random dice roll (1-6)
        let mut generator = random::new_generator(random, ctx);
        let rolled_number = (random::generate_u8_in_range(&mut generator, 1, 7) as u8);

        // Check if player won
        let won = check_win(bet_type, chosen_number, rolled_number);

        // Calculate and pay out winnings
        let payout = if (won) {
            let payout_amount = calculate_payout(bet_type, bet_amount);
            let payout_balance = balance::split(&mut house.balance, payout_amount);
            let payout_coin = coin::from_balance(payout_balance, ctx);
            transfer::public_transfer(payout_coin, tx_context::sender(ctx));
            house.total_paid_out = house.total_paid_out + payout_amount;
            payout_amount
        } else {
            0
        };

        // Update stats
        house.total_bets = house.total_bets + 1;
        house.total_wagered = house.total_wagered + bet_amount;

        // Emit event
        event::emit(BetResult {
            player: tx_context::sender(ctx),
            bet_type,
            chosen_number,
            bet_amount,
            rolled_number,
            won,
            payout
        });
    }

    // ===== Helper Functions =====

    /// Check if a bet is a winner
    fun check_win(bet_type: u8, chosen_number: u8, rolled_number: u8): bool {
        if (bet_type == BET_EXACT) {
            rolled_number == chosen_number
        } else if (bet_type == BET_OVER) {
            rolled_number > chosen_number
        } else if (bet_type == BET_UNDER) {
            rolled_number < chosen_number
        } else if (bet_type == BET_ODD) {
            rolled_number % 2 == 1
        } else if (bet_type == BET_EVEN) {
            rolled_number % 2 == 0
        } else {
            false
        }
    }

    /// Calculate payout based on bet type (includes house edge)
    fun calculate_payout(bet_type: u8, bet_amount: u64): u64 {
        let base_multiplier = if (bet_type == BET_EXACT) {
            582 // ~5.82x (6x - 3% house edge)
        } else if (bet_type == BET_ODD || bet_type == BET_EVEN) {
            194 // ~1.94x (2x - 3% house edge)
        } else {
            // OVER/UNDER payouts vary by chosen number
            // Simplified: average ~2x
            194
        };

        (bet_amount * base_multiplier) / 100
    }

    // ===== Admin Functions =====

    /// Fund the house with tokens
    public entry fun fund_house<T>(
        house: &mut DiceHouse<T>,
        funds: Coin<T>,
        _admin: &AdminCap
    ) {
        let fund_balance = coin::into_balance(funds);
        balance::join(&mut house.balance, fund_balance);
    }

    /// Withdraw funds from the house
    public entry fun withdraw<T>(
        house: &mut DiceHouse<T>,
        amount: u64,
        _admin: &AdminCap,
        ctx: &mut TxContext
    ) {
        let withdraw_balance = balance::split(&mut house.balance, amount);
        let withdraw_coin = coin::from_balance(withdraw_balance, ctx);
        transfer::public_transfer(withdraw_coin, tx_context::sender(ctx));
    }

    /// Pause the game
    public entry fun pause<T>(
        house: &mut DiceHouse<T>,
        _admin: &AdminCap
    ) {
        house.is_paused = true;
    }

    /// Unpause the game
    public entry fun unpause<T>(
        house: &mut DiceHouse<T>,
        _admin: &AdminCap
    ) {
        house.is_paused = false;
    }

    /// Update bet limits
    public entry fun update_limits<T>(
        house: &mut DiceHouse<T>,
        new_min: u64,
        new_max: u64,
        _admin: &AdminCap
    ) {
        house.min_bet = new_min;
        house.max_bet = new_max;
    }

    // ===== View Functions =====

    /// Get house balance
    public fun get_house_balance<T>(house: &DiceHouse<T>): u64 {
        balance::value(&house.balance)
    }

    /// Get game stats
    public fun get_stats<T>(house: &DiceHouse<T>): (u64, u64, u64, bool) {
        (house.total_bets, house.total_wagered, house.total_paid_out, house.is_paused)
    }

    /// Get bet limits
    public fun get_limits<T>(house: &DiceHouse<T>): (u64, u64) {
        (house.min_bet, house.max_bet)
    }
}
