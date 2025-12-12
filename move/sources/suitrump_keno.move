/// SUITRUMP Royale - Keno Game
/// Pick numbers and match draws to win up to 100x
#[allow(unused_const, unused_variable, unused_use, unused_mut_parameter, duplicate_alias, lint(public_random, public_entry))]
module suitrump_royale::suitrump_keno {
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
    const EInvalidPicks: u64 = 4;
    const EInvalidNumber: u64 = 5;
    const EDuplicateNumber: u64 = 6;

    // ===== Game Constants =====
    const MIN_BET: u64 = 1_000_000_000; // 1 SUIT
    const MAX_BET: u64 = 100_000_000_000; // 100 SUIT
    const MIN_PICKS: u64 = 1;
    const MAX_PICKS: u64 = 10;
    const DRAW_COUNT: u64 = 20;  // 20 numbers drawn
    const BOARD_SIZE: u64 = 80;  // Numbers 1-80

    // ===== Structs =====

    public struct AdminCap has key, store {
        id: UID
    }

    public struct KenoHouse<phantom T> has key {
        id: UID,
        balance: Balance<T>,
        total_games: u64,
        total_wagered: u64,
        total_paid_out: u64,
        is_paused: bool,
        min_bet: u64,
        max_bet: u64
    }

    public struct KenoResult has copy, drop {
        player: address,
        bet_amount: u64,
        picks: vector<u8>,
        drawn: vector<u8>,
        hits: u8,
        multiplier: u64,
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
        let house = KenoHouse<T> {
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

    public entry fun play<T>(
        house: &mut KenoHouse<T>,
        bet_coin: Coin<T>,
        picks: vector<u8>,
        random: &Random,
        ctx: &mut TxContext
    ) {
        assert!(!house.is_paused, EGamePaused);

        let num_picks = std::vector::length(&picks);
        assert!(num_picks >= MIN_PICKS && num_picks <= MAX_PICKS, EInvalidPicks);

        // Validate picks are 1-80 and unique
        let mut i = 0;
        while (i < num_picks) {
            let pick = *std::vector::borrow(&picks, i);
            assert!(pick >= 1 && pick <= 80, EInvalidNumber);

            // Check for duplicates
            let mut j = i + 1;
            while (j < num_picks) {
                assert!(pick != *std::vector::borrow(&picks, j), EDuplicateNumber);
                j = j + 1;
            };
            i = i + 1;
        };

        let bet_amount = coin::value(&bet_coin);
        assert!(bet_amount >= house.min_bet, EBetTooSmall);
        assert!(bet_amount <= house.max_bet, EBetTooLarge);

        // Check max payout
        let max_mult = get_max_multiplier((num_picks as u8));
        let max_payout = (bet_amount * max_mult) / 100;
        assert!(balance::value(&house.balance) >= max_payout, EInsufficientBalance);

        // Add bet to house
        let bet_balance = coin::into_balance(bet_coin);
        balance::join(&mut house.balance, bet_balance);

        // Draw 20 unique random numbers
        let mut generator = random::new_generator(random, ctx);
        let drawn = draw_numbers(&mut generator);

        // Count hits
        let hits = count_hits(&picks, &drawn);

        // Calculate payout
        let multiplier = get_multiplier((num_picks as u8), hits);
        let payout = (bet_amount * multiplier) / 100;

        // Pay out
        if (payout > 0) {
            let payout_balance = balance::split(&mut house.balance, payout);
            let payout_coin = coin::from_balance(payout_balance, ctx);
            transfer::public_transfer(payout_coin, tx_context::sender(ctx));
            house.total_paid_out = house.total_paid_out + payout;
        };

        // Update stats
        house.total_games = house.total_games + 1;
        house.total_wagered = house.total_wagered + bet_amount;

        // Emit event
        event::emit(KenoResult {
            player: tx_context::sender(ctx),
            bet_amount,
            picks,
            drawn,
            hits,
            multiplier,
            payout
        });
    }

    // ===== Helper Functions =====

    fun draw_numbers(generator: &mut random::RandomGenerator): vector<u8> {
        let mut drawn = vector::empty<u8>();
        let mut count = 0u64;

        while (count < DRAW_COUNT) {
            let num = (random::generate_u8_in_range(generator, 1, 81) as u8);

            // Check if already drawn
            let mut is_dup = false;
            let mut i = 0;
            while (i < count) {
                if (*std::vector::borrow(&drawn, i) == num) {
                    is_dup = true;
                    break
                };
                i = i + 1;
            };

            if (!is_dup) {
                std::vector::push_back(&mut drawn, num);
                count = count + 1;
            };
        };

        drawn
    }

    fun count_hits(picks: &vector<u8>, drawn: &vector<u8>): u8 {
        let mut hits = 0u8;
        let picks_len = std::vector::length(picks);
        let drawn_len = std::vector::length(drawn);

        let mut i = 0;
        while (i < picks_len) {
            let pick = *std::vector::borrow(picks, i);
            let mut j = 0;
            while (j < drawn_len) {
                if (pick == *std::vector::borrow(drawn, j)) {
                    hits = hits + 1;
                    break
                };
                j = j + 1;
            };
            i = i + 1;
        };

        hits
    }

    /// Get multiplier based on picks and hits
    /// Returns value in basis points (100 = 1x)
    fun get_multiplier(picks: u8, hits: u8): u64 {
        // Payout table - simplified for common pick counts
        if (picks == 1) {
            if (hits == 1) { 300 } else { 0 }  // 3x for 1/1
        } else if (picks == 2) {
            if (hits == 2) { 900 } else { 0 }  // 9x for 2/2
        } else if (picks == 3) {
            if (hits == 3) { 2600 }
            else if (hits == 2) { 200 }
            else { 0 }
        } else if (picks == 4) {
            if (hits == 4) { 7200 }
            else if (hits == 3) { 500 }
            else if (hits == 2) { 100 }
            else { 0 }
        } else if (picks == 5) {
            if (hits == 5) { 8200 }
            else if (hits == 4) { 1200 }
            else if (hits == 3) { 300 }
            else { 0 }
        } else if (picks == 6) {
            if (hits == 6) { 16000 }
            else if (hits == 5) { 3900 }
            else if (hits == 4) { 400 }
            else if (hits == 3) { 100 }
            else { 0 }
        } else if (picks == 7) {
            if (hits == 7) { 42000 }
            else if (hits == 6) { 8900 }
            else if (hits == 5) { 700 }
            else if (hits == 4) { 200 }
            else { 0 }
        } else if (picks == 8) {
            if (hits == 8) { 100000 }  // 1000x JACKPOT!
            else if (hits == 7) { 18000 }
            else if (hits == 6) { 1500 }
            else if (hits == 5) { 400 }
            else if (hits == 4) { 100 }
            else { 0 }
        } else if (picks == 9) {
            if (hits == 9) { 100000 }
            else if (hits == 8) { 44000 }
            else if (hits == 7) { 3500 }
            else if (hits == 6) { 600 }
            else if (hits == 5) { 200 }
            else { 0 }
        } else {
            // 10 picks
            if (hits == 10) { 100000 }  // 1000x
            else if (hits == 9) { 48000 }
            else if (hits == 8) { 7200 }
            else if (hits == 7) { 1400 }
            else if (hits == 6) { 400 }
            else if (hits == 5) { 100 }
            else { 0 }
        }
    }

    fun get_max_multiplier(picks: u8): u64 {
        if (picks <= 2) { 900 }
        else if (picks <= 4) { 7200 }
        else if (picks <= 6) { 16000 }
        else { 100000 }  // 1000x max
    }

    // ===== Admin Functions =====

    public entry fun fund_house<T>(
        house: &mut KenoHouse<T>,
        funds: Coin<T>,
        _admin: &AdminCap
    ) {
        let fund_balance = coin::into_balance(funds);
        balance::join(&mut house.balance, fund_balance);
    }

    public entry fun withdraw<T>(
        house: &mut KenoHouse<T>,
        amount: u64,
        _admin: &AdminCap,
        ctx: &mut TxContext
    ) {
        let withdraw_balance = balance::split(&mut house.balance, amount);
        let withdraw_coin = coin::from_balance(withdraw_balance, ctx);
        transfer::public_transfer(withdraw_coin, tx_context::sender(ctx));
    }

    public entry fun pause<T>(house: &mut KenoHouse<T>, _admin: &AdminCap) {
        house.is_paused = true;
    }

    public entry fun unpause<T>(house: &mut KenoHouse<T>, _admin: &AdminCap) {
        house.is_paused = false;
    }

    // ===== View Functions =====

    public fun get_house_balance<T>(house: &KenoHouse<T>): u64 {
        balance::value(&house.balance)
    }

    public fun get_stats<T>(house: &KenoHouse<T>): (u64, u64, u64, bool) {
        (house.total_games, house.total_wagered, house.total_paid_out, house.is_paused)
    }
}
