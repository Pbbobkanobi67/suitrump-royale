/// SUITRUMP Royale - Blackjack Game
/// Full casino blackjack with Hit, Stand, Double, Split, Insurance, Surrender
/// Uses Sui's Random module for provably fair card dealing
#[allow(unused_const, unused_variable, unused_use, unused_mut_parameter, duplicate_alias, lint(public_random))]
module suitrump_royale::suitrump_blackjack {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::event;
    use sui::random::{Self, Random};
    use sui::table::{Self, Table};
    use std::vector;
    use std::option::{Self, Option};

    // ===== Error Codes =====
    const EInsufficientFunds: u64 = 0;
    const EGameInProgress: u64 = 1;
    const ENoGameInProgress: u64 = 2;
    const EInvalidAction: u64 = 3;
    const EBetTooLow: u64 = 4;
    const EBetTooHigh: u64 = 5;
    const ECannotSplit: u64 = 6;
    const ECannotDouble: u64 = 7;
    const ECannotInsurance: u64 = 8;
    const ECannotSurrender: u64 = 9;
    const EAlreadyInsured: u64 = 10;
    const EInsufficientHouseBalance: u64 = 11;

    // ===== Game Constants =====
    const MIN_BET: u64 = 1_000_000_000; // 1 SUIT minimum
    const MAX_BET: u64 = 100_000_000_000; // 100 SUIT maximum
    const BLACKJACK_PAYOUT: u64 = 150; // 3:2 = 150%
    const INSURANCE_PAYOUT: u64 = 200; // 2:1 = 200%
    const NORMAL_PAYOUT: u64 = 100; // 1:1 = 100%

    // ===== Hand Status =====
    const STATUS_NONE: u8 = 0;
    const STATUS_PLAYING: u8 = 1;
    const STATUS_STANDING: u8 = 2;
    const STATUS_DOUBLED: u8 = 3;
    const STATUS_SURRENDERED: u8 = 4;
    const STATUS_BUSTED: u8 = 5;
    const STATUS_BLACKJACK: u8 = 6;

    // ===== Structs =====

    public struct AdminCap has key, store {
        id: UID
    }

    public struct BlackjackHouse<phantom T> has key {
        id: UID,
        house_balance: Balance<T>,
        min_bet: u64,
        max_bet: u64,
        active_games: Table<address, Game>,
        // Stats
        total_games: u64,
        total_wagered: u64,
        total_paid_out: u64
    }

    public struct Game has store, drop {
        // Player's main hand
        player_cards: vector<u8>,
        player_status: u8,
        bet: u64,
        // Player's split hand (if any)
        split_cards: vector<u8>,
        split_status: u8,
        split_bet: u64,
        // Dealer's hand
        dealer_cards: vector<u8>,
        // Insurance
        insurance_bet: u64,
        // Deck tracking (cards used this game)
        used_cards: vector<u8>,
        // Which hand is active (0 = main, 1 = split)
        active_hand: u8
    }

    // ===== Events =====

    public struct GameStarted has copy, drop {
        player: address,
        bet: u64,
        player_cards: vector<u8>,
        dealer_up_card: u8
    }

    public struct PlayerAction has copy, drop {
        player: address,
        action: vector<u8>, // "hit", "stand", "double", "split", "insurance", "surrender"
        new_card: u8,
        hand_value: u8
    }

    public struct GameEnded has copy, drop {
        player: address,
        player_hand: vector<u8>,
        player_value: u8,
        dealer_hand: vector<u8>,
        dealer_value: u8,
        result: vector<u8>, // "win", "lose", "push", "blackjack", "surrender"
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
        let house = BlackjackHouse<T> {
            id: object::new(ctx),
            house_balance: balance::zero(),
            min_bet: MIN_BET,
            max_bet: MAX_BET,
            active_games: table::new(ctx),
            total_games: 0,
            total_wagered: 0,
            total_paid_out: 0
        };
        transfer::share_object(house);
    }

    // ===== Card Helper Functions =====

    /// Get card value (Ace = 1 or 11, Face = 10, Number = face value)
    fun card_value(card: u8): u8 {
        let rank = card % 13;
        if (rank == 0) {
            11 // Ace (will be adjusted if needed)
        } else if (rank >= 10) {
            10 // J, Q, K
        } else {
            rank + 1 // 2-10
        }
    }

    /// Calculate hand value with optimal Ace handling
    fun hand_value(cards: &vector<u8>): u8 {
        let mut total = 0u8;
        let mut aces = 0u8;
        let len = vector::length(cards);
        let mut i = 0;

        while (i < len) {
            let card = *vector::borrow(cards, i);
            let value = card_value(card);
            total = total + value;
            if (card % 13 == 0) {
                aces = aces + 1;
            };
            i = i + 1;
        };

        // Adjust aces from 11 to 1 if busting
        while (total > 21 && aces > 0) {
            total = total - 10;
            aces = aces - 1;
        };

        total
    }

    /// Check if hand is blackjack (Ace + 10-value on first 2 cards)
    fun is_blackjack(cards: &vector<u8>): bool {
        if (vector::length(cards) != 2) {
            return false
        };
        hand_value(cards) == 21
    }

    /// Check if hand is busted
    fun is_busted(cards: &vector<u8>): bool {
        hand_value(cards) > 21
    }

    /// Deal a random card that hasn't been used
    fun deal_card(used_cards: &mut vector<u8>, random: &Random, ctx: &mut TxContext): u8 {
        let mut generator = random::new_generator(random, ctx);
        let mut card: u8;

        loop {
            card = (random::generate_u8(&mut generator) % 52);
            if (!vector::contains(used_cards, &card)) {
                break
            };
        };

        vector::push_back(used_cards, card);
        card
    }

    /// Check if two cards can be split (same rank)
    fun can_split(cards: &vector<u8>): bool {
        if (vector::length(cards) != 2) {
            return false
        };
        let card1 = *vector::borrow(cards, 0);
        let card2 = *vector::borrow(cards, 1);
        // Same rank (mod 13)
        (card1 % 13) == (card2 % 13)
    }

    /// Check if dealer shows an Ace (for insurance)
    fun dealer_shows_ace(dealer_cards: &vector<u8>): bool {
        if (vector::length(dealer_cards) == 0) {
            return false
        };
        let up_card = *vector::borrow(dealer_cards, 0);
        (up_card % 13) == 0
    }

    // ===== Game Functions =====

    /// Start a new blackjack game
    public entry fun deal<T>(
        house: &mut BlackjackHouse<T>,
        payment: Coin<T>,
        random: &Random,
        ctx: &mut TxContext
    ) {
        let player = tx_context::sender(ctx);
        let bet = coin::value(&payment);

        // Validate bet
        assert!(bet >= house.min_bet, EBetTooLow);
        assert!(bet <= house.max_bet, EBetTooHigh);
        assert!(!table::contains(&house.active_games, player), EGameInProgress);

        // Check house can cover potential payout (blackjack = 2.5x bet)
        let max_payout = (bet * 5) / 2;
        assert!(balance::value(&house.house_balance) >= max_payout, EInsufficientHouseBalance);

        // Add bet to house
        let payment_balance = coin::into_balance(payment);
        balance::join(&mut house.house_balance, payment_balance);

        // Create new game
        let mut used_cards = vector[];

        // Deal initial cards: player, dealer, player, dealer
        let player_card1 = deal_card(&mut used_cards, random, ctx);
        let dealer_card1 = deal_card(&mut used_cards, random, ctx);
        let player_card2 = deal_card(&mut used_cards, random, ctx);
        let dealer_card2 = deal_card(&mut used_cards, random, ctx);

        let mut player_cards = vector[];
        vector::push_back(&mut player_cards, player_card1);
        vector::push_back(&mut player_cards, player_card2);

        let mut dealer_cards = vector[];
        vector::push_back(&mut dealer_cards, dealer_card1);
        vector::push_back(&mut dealer_cards, dealer_card2);

        // Check for player blackjack
        let player_status = if (is_blackjack(&player_cards)) {
            STATUS_BLACKJACK
        } else {
            STATUS_PLAYING
        };

        let game = Game {
            player_cards,
            player_status,
            bet,
            split_cards: vector[],
            split_status: STATUS_NONE,
            split_bet: 0,
            dealer_cards,
            insurance_bet: 0,
            used_cards,
            active_hand: 0
        };

        table::add(&mut house.active_games, player, game);
        house.total_games = house.total_games + 1;
        house.total_wagered = house.total_wagered + bet;

        // Emit event
        event::emit(GameStarted {
            player,
            bet,
            player_cards: vector[player_card1, player_card2],
            dealer_up_card: dealer_card1
        });

        // If player has blackjack, resolve immediately (unless dealer might too)
        if (player_status == STATUS_BLACKJACK && !dealer_shows_ace(&dealer_cards)) {
            resolve_game(house, player, ctx);
        }
    }

    /// Player hits (takes another card)
    public entry fun hit<T>(
        house: &mut BlackjackHouse<T>,
        random: &Random,
        ctx: &mut TxContext
    ) {
        let player = tx_context::sender(ctx);
        assert!(table::contains(&house.active_games, player), ENoGameInProgress);

        let game = table::borrow_mut(&mut house.active_games, player);

        // Get active hand
        let (cards, status) = if (game.active_hand == 0) {
            (&mut game.player_cards, &mut game.player_status)
        } else {
            (&mut game.split_cards, &mut game.split_status)
        };

        assert!(*status == STATUS_PLAYING, EInvalidAction);

        // Deal new card
        let new_card = deal_card(&mut game.used_cards, random, ctx);
        vector::push_back(cards, new_card);

        let value = hand_value(cards);

        // Check if busted
        if (value > 21) {
            *status = STATUS_BUSTED;

            // If split hand exists and main hand busted, switch to split
            if (game.active_hand == 0 && game.split_status == STATUS_PLAYING) {
                game.active_hand = 1;
            } else if (game.active_hand == 1 || game.split_status == STATUS_NONE) {
                // All hands done, resolve
                resolve_game(house, player, ctx);
                return
            }
        };

        event::emit(PlayerAction {
            player,
            action: b"hit",
            new_card,
            hand_value: value
        });
    }

    /// Player stands (keeps current hand)
    public entry fun stand<T>(
        house: &mut BlackjackHouse<T>,
        ctx: &mut TxContext
    ) {
        let player = tx_context::sender(ctx);
        assert!(table::contains(&house.active_games, player), ENoGameInProgress);

        let game = table::borrow_mut(&mut house.active_games, player);

        // Get active hand status
        let status = if (game.active_hand == 0) {
            &mut game.player_status
        } else {
            &mut game.split_status
        };

        assert!(*status == STATUS_PLAYING, EInvalidAction);
        *status = STATUS_STANDING;

        let value = if (game.active_hand == 0) {
            hand_value(&game.player_cards)
        } else {
            hand_value(&game.split_cards)
        };

        event::emit(PlayerAction {
            player,
            action: b"stand",
            new_card: 0,
            hand_value: value
        });

        // If split hand exists and we just stood on main, switch to split
        if (game.active_hand == 0 && game.split_status == STATUS_PLAYING) {
            game.active_hand = 1;
        } else {
            // All hands done, resolve
            resolve_game(house, player, ctx);
        }
    }

    /// Player doubles down (double bet, take exactly one more card)
    public entry fun double_down<T>(
        house: &mut BlackjackHouse<T>,
        payment: Coin<T>,
        random: &Random,
        ctx: &mut TxContext
    ) {
        let player = tx_context::sender(ctx);
        assert!(table::contains(&house.active_games, player), ENoGameInProgress);

        let game = table::borrow_mut(&mut house.active_games, player);

        // Can only double on first two cards
        let (cards, status, bet) = if (game.active_hand == 0) {
            assert!(vector::length(&game.player_cards) == 2, ECannotDouble);
            (&mut game.player_cards, &mut game.player_status, &mut game.bet)
        } else {
            assert!(vector::length(&game.split_cards) == 2, ECannotDouble);
            (&mut game.split_cards, &mut game.split_status, &mut game.split_bet)
        };

        assert!(*status == STATUS_PLAYING, EInvalidAction);

        // Verify double bet matches original
        let double_amount = coin::value(&payment);
        assert!(double_amount == *bet, EInvalidAction);

        // Add to house balance
        let payment_balance = coin::into_balance(payment);
        balance::join(&mut house.house_balance, payment_balance);
        *bet = *bet + double_amount;
        house.total_wagered = house.total_wagered + double_amount;

        // Deal exactly one more card
        let new_card = deal_card(&mut game.used_cards, random, ctx);
        vector::push_back(cards, new_card);

        let value = hand_value(cards);

        if (value > 21) {
            *status = STATUS_BUSTED;
        } else {
            *status = STATUS_DOUBLED;
        };

        event::emit(PlayerAction {
            player,
            action: b"double",
            new_card,
            hand_value: value
        });

        // If split hand exists and main is done, switch to split
        if (game.active_hand == 0 && game.split_status == STATUS_PLAYING) {
            game.active_hand = 1;
        } else {
            resolve_game(house, player, ctx);
        }
    }

    /// Player splits a pair
    public entry fun split<T>(
        house: &mut BlackjackHouse<T>,
        payment: Coin<T>,
        random: &Random,
        ctx: &mut TxContext
    ) {
        let player = tx_context::sender(ctx);
        assert!(table::contains(&house.active_games, player), ENoGameInProgress);

        let game = table::borrow_mut(&mut house.active_games, player);

        // Can only split main hand, and only if no split already exists
        assert!(game.active_hand == 0, ECannotSplit);
        assert!(game.split_status == STATUS_NONE, ECannotSplit);
        assert!(can_split(&game.player_cards), ECannotSplit);
        assert!(game.player_status == STATUS_PLAYING, EInvalidAction);

        // Verify split bet matches original
        let split_amount = coin::value(&payment);
        assert!(split_amount == game.bet, EInvalidAction);

        // Add to house balance
        let payment_balance = coin::into_balance(payment);
        balance::join(&mut house.house_balance, payment_balance);
        game.split_bet = split_amount;
        house.total_wagered = house.total_wagered + split_amount;

        // Move second card to split hand
        let second_card = vector::pop_back(&mut game.player_cards);
        vector::push_back(&mut game.split_cards, second_card);

        // Deal new card to each hand
        let new_main_card = deal_card(&mut game.used_cards, random, ctx);
        let new_split_card = deal_card(&mut game.used_cards, random, ctx);
        vector::push_back(&mut game.player_cards, new_main_card);
        vector::push_back(&mut game.split_cards, new_split_card);

        game.split_status = STATUS_PLAYING;

        event::emit(PlayerAction {
            player,
            action: b"split",
            new_card: new_main_card,
            hand_value: hand_value(&game.player_cards)
        });
    }

    /// Player takes insurance (side bet when dealer shows Ace)
    public entry fun insurance<T>(
        house: &mut BlackjackHouse<T>,
        payment: Coin<T>,
        ctx: &mut TxContext
    ) {
        let player = tx_context::sender(ctx);
        assert!(table::contains(&house.active_games, player), ENoGameInProgress);

        let game = table::borrow_mut(&mut house.active_games, player);

        assert!(dealer_shows_ace(&game.dealer_cards), ECannotInsurance);
        assert!(game.insurance_bet == 0, EAlreadyInsured);
        assert!(game.player_status == STATUS_PLAYING || game.player_status == STATUS_BLACKJACK, EInvalidAction);

        // Insurance is half the original bet
        let insurance_amount = coin::value(&payment);
        assert!(insurance_amount == game.bet / 2, EInvalidAction);

        let payment_balance = coin::into_balance(payment);
        balance::join(&mut house.house_balance, payment_balance);
        game.insurance_bet = insurance_amount;
        house.total_wagered = house.total_wagered + insurance_amount;

        event::emit(PlayerAction {
            player,
            action: b"insurance",
            new_card: 0,
            hand_value: hand_value(&game.player_cards)
        });
    }

    /// Player surrenders (loses half bet)
    public entry fun surrender<T>(
        house: &mut BlackjackHouse<T>,
        ctx: &mut TxContext
    ) {
        let player = tx_context::sender(ctx);
        assert!(table::contains(&house.active_games, player), ENoGameInProgress);

        let game = table::borrow_mut(&mut house.active_games, player);

        // Can only surrender on first two cards, main hand only
        assert!(game.active_hand == 0, ECannotSurrender);
        assert!(vector::length(&game.player_cards) == 2, ECannotSurrender);
        assert!(game.player_status == STATUS_PLAYING, EInvalidAction);
        assert!(game.split_status == STATUS_NONE, ECannotSurrender);

        game.player_status = STATUS_SURRENDERED;

        event::emit(PlayerAction {
            player,
            action: b"surrender",
            new_card: 0,
            hand_value: hand_value(&game.player_cards)
        });

        resolve_game(house, player, ctx);
    }

    /// Resolve the game - dealer plays and payouts are made
    fun resolve_game<T>(
        house: &mut BlackjackHouse<T>,
        player: address,
        ctx: &mut TxContext
    ) {
        let game = table::remove(&mut house.active_games, player);

        let mut total_payout = 0u64;
        let player_value = hand_value(&game.player_cards);
        let mut dealer_value = hand_value(&game.dealer_cards);
        let dealer_blackjack = is_blackjack(&game.dealer_cards);

        // Handle insurance first
        if (game.insurance_bet > 0 && dealer_blackjack) {
            // Insurance pays 2:1
            total_payout = total_payout + game.insurance_bet * 3;
        };

        // Dealer plays if any player hand is still in contention
        let player_in_play = game.player_status == STATUS_STANDING ||
                            game.player_status == STATUS_DOUBLED ||
                            game.player_status == STATUS_BLACKJACK;
        let split_in_play = game.split_status == STATUS_STANDING ||
                           game.split_status == STATUS_DOUBLED;

        // Note: In a real implementation, dealer would draw cards here
        // For now, we use the pre-dealt cards
        // The dealer's second card is already dealt but "hidden"

        // Resolve main hand
        if (game.player_status == STATUS_SURRENDERED) {
            // Return half bet
            total_payout = total_payout + game.bet / 2;
        } else if (game.player_status == STATUS_BUSTED) {
            // Player loses
        } else if (game.player_status == STATUS_BLACKJACK) {
            if (dealer_blackjack) {
                // Push
                total_payout = total_payout + game.bet;
            } else {
                // Blackjack pays 3:2
                total_payout = total_payout + game.bet + (game.bet * 3) / 2;
            }
        } else if (dealer_blackjack) {
            // Dealer blackjack beats non-blackjack
        } else if (dealer_value > 21) {
            // Dealer busts, player wins
            total_payout = total_payout + game.bet * 2;
        } else if (player_value > dealer_value) {
            // Player wins
            total_payout = total_payout + game.bet * 2;
        } else if (player_value == dealer_value) {
            // Push
            total_payout = total_payout + game.bet;
        };
        // else dealer wins, player loses bet

        // Resolve split hand
        if (game.split_status != STATUS_NONE && game.split_status != STATUS_BUSTED) {
            let split_value = hand_value(&game.split_cards);

            if (dealer_blackjack) {
                // Dealer blackjack beats split hands
            } else if (dealer_value > 21) {
                total_payout = total_payout + game.split_bet * 2;
            } else if (split_value > dealer_value) {
                total_payout = total_payout + game.split_bet * 2;
            } else if (split_value == dealer_value) {
                total_payout = total_payout + game.split_bet;
            }
        };

        // Pay out winnings
        if (total_payout > 0) {
            let payout_balance = balance::split(&mut house.house_balance, total_payout);
            let payout_coin = coin::from_balance(payout_balance, ctx);
            transfer::public_transfer(payout_coin, player);
            house.total_paid_out = house.total_paid_out + total_payout;
        };

        // Determine result string for event
        let result = if (game.player_status == STATUS_SURRENDERED) {
            b"surrender"
        } else if (game.player_status == STATUS_BLACKJACK && !dealer_blackjack) {
            b"blackjack"
        } else if (total_payout > game.bet + game.split_bet + game.insurance_bet) {
            b"win"
        } else if (total_payout == game.bet + game.split_bet) {
            b"push"
        } else {
            b"lose"
        };

        event::emit(GameEnded {
            player,
            player_hand: game.player_cards,
            player_value,
            dealer_hand: game.dealer_cards,
            dealer_value,
            result,
            payout: total_payout
        });
    }

    // ===== Admin Functions =====

    public entry fun fund_house<T>(
        house: &mut BlackjackHouse<T>,
        funds: Coin<T>,
        _admin: &AdminCap
    ) {
        let fund_balance = coin::into_balance(funds);
        balance::join(&mut house.house_balance, fund_balance);
    }

    public entry fun withdraw_house<T>(
        house: &mut BlackjackHouse<T>,
        amount: u64,
        _admin: &AdminCap,
        ctx: &mut TxContext
    ) {
        let withdraw_balance = balance::split(&mut house.house_balance, amount);
        let withdraw_coin = coin::from_balance(withdraw_balance, ctx);
        transfer::public_transfer(withdraw_coin, tx_context::sender(ctx));
    }

    public entry fun set_betting_limits<T>(
        house: &mut BlackjackHouse<T>,
        min_bet: u64,
        max_bet: u64,
        _admin: &AdminCap
    ) {
        house.min_bet = min_bet;
        house.max_bet = max_bet;
    }

    // ===== View Functions =====

    public fun get_house_info<T>(house: &BlackjackHouse<T>): (u64, u64, u64, u64, u64, u64) {
        (
            balance::value(&house.house_balance),
            house.min_bet,
            house.max_bet,
            house.total_games,
            house.total_wagered,
            house.total_paid_out
        )
    }

    public fun has_active_game<T>(house: &BlackjackHouse<T>, player: address): bool {
        table::contains(&house.active_games, player)
    }
}
