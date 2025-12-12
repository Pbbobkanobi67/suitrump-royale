/// SUITRUMP Royale - Raffle System
/// Buy tickets for a chance to win the prize pool
module suitrump_royale::suitrump_raffle {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::event;
    use sui::random::{Self, Random};
    use sui::table::{Self, Table};
    use sui::clock::{Self, Clock};

    // ===== Error Codes =====
    const EInsufficientFunds: u64 = 0;
    const ERoundNotActive: u64 = 1;
    const ERoundNotEnded: u64 = 2;
    const ENoTickets: u64 = 3;
    const EAlreadyDrawn: u64 = 4;

    // ===== Game Constants =====
    const TICKET_PRICE: u64 = 5_000_000_000; // 5 SUIT per ticket
    const WINNER_SHARE: u64 = 940; // 94% to winner
    const HOUSE_SHARE: u64 = 60;   // 6% house fee
    const ROUND_DURATION_MS: u64 = 3600000; // 1 hour

    // ===== Round Status =====
    const STATUS_ACTIVE: u8 = 0;
    const STATUS_DRAWING: u8 = 1;
    const STATUS_COMPLETE: u8 = 2;

    // ===== Structs =====

    public struct AdminCap has key, store {
        id: UID
    }

    public struct RaffleHouse<phantom T> has key {
        id: UID,
        house_balance: Balance<T>,
        prize_pool: Balance<T>,
        round_id: u64,
        status: u8,
        total_tickets: u64,
        ticket_holders: Table<address, u64>,
        participants: vector<address>,
        end_time: u64,
        winner: address,
        total_rounds: u64,
        total_distributed: u64
    }

    public struct TicketPurchase has copy, drop {
        player: address,
        round_id: u64,
        tickets: u64,
        total_tickets: u64,
        prize_pool: u64
    }

    public struct RaffleDrawn has copy, drop {
        round_id: u64,
        winner: address,
        prize: u64,
        total_tickets: u64
    }

    // ===== Init =====

    fun init(ctx: &mut TxContext) {
        let admin_cap = AdminCap {
            id: object::new(ctx)
        };
        transfer::transfer(admin_cap, tx_context::sender(ctx));
    }

    public fun create_house<T>(clock: &Clock, ctx: &mut TxContext) {
        let house = RaffleHouse<T> {
            id: object::new(ctx),
            house_balance: balance::zero(),
            prize_pool: balance::zero(),
            round_id: 1,
            status: STATUS_ACTIVE,
            total_tickets: 0,
            ticket_holders: table::new(ctx),
            participants: vector::empty(),
            end_time: clock::timestamp_ms(clock) + ROUND_DURATION_MS,
            winner: @0x0,
            total_rounds: 0,
            total_distributed: 0
        };
        transfer::share_object(house);
    }

    // ===== Game Functions =====

    public entry fun buy_tickets<T>(
        house: &mut RaffleHouse<T>,
        payment: Coin<T>,
        num_tickets: u64,
        ctx: &mut TxContext
    ) {
        assert!(house.status == STATUS_ACTIVE, ERoundNotActive);
        assert!(num_tickets > 0, ENoTickets);

        let cost = num_tickets * TICKET_PRICE;
        assert!(coin::value(&payment) >= cost, EInsufficientFunds);

        // Add payment to prize pool
        let payment_balance = coin::into_balance(payment);
        balance::join(&mut house.prize_pool, payment_balance);

        // Update ticket count for player
        let player = tx_context::sender(ctx);
        if (table::contains(&house.ticket_holders, player)) {
            let current = table::remove(&mut house.ticket_holders, player);
            table::add(&mut house.ticket_holders, player, current + num_tickets);
        } else {
            table::add(&mut house.ticket_holders, player, num_tickets);
            std::vector::push_back(&mut house.participants, player);
        };

        house.total_tickets = house.total_tickets + num_tickets;

        // Emit event
        event::emit(TicketPurchase {
            player,
            round_id: house.round_id,
            tickets: num_tickets,
            total_tickets: house.total_tickets,
            prize_pool: balance::value(&house.prize_pool)
        });
    }

    public entry fun draw_winner<T>(
        house: &mut RaffleHouse<T>,
        random: &Random,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(house.status == STATUS_ACTIVE, ERoundNotActive);
        assert!(clock::timestamp_ms(clock) >= house.end_time, ERoundNotEnded);
        assert!(house.total_tickets > 0, ENoTickets);

        house.status = STATUS_DRAWING;

        // Generate random ticket number
        let mut generator = random::new_generator(random, ctx);
        let winning_ticket = random::generate_u64(&mut generator) % house.total_tickets;

        // Find winner
        let mut ticket_count = 0u64;
        let mut winner = @0x0;
        let participants_len = std::vector::length(&house.participants);
        let mut i = 0;

        while (i < participants_len) {
            let participant = *std::vector::borrow(&house.participants, i);
            let tickets = *table::borrow(&house.ticket_holders, participant);
            ticket_count = ticket_count + tickets;

            if (winning_ticket < ticket_count) {
                winner = participant;
                break
            };
            i = i + 1;
        };

        house.winner = winner;

        // Calculate payouts
        let total_pool = balance::value(&house.prize_pool);
        let winner_prize = (total_pool * WINNER_SHARE) / 1000;
        let house_fee = total_pool - winner_prize;

        // Pay winner
        let winner_balance = balance::split(&mut house.prize_pool, winner_prize);
        let winner_coin = coin::from_balance(winner_balance, ctx);
        transfer::public_transfer(winner_coin, winner);

        // Move remaining to house balance
        let remaining = balance::withdraw_all(&mut house.prize_pool);
        balance::join(&mut house.house_balance, remaining);

        // Update stats
        house.status = STATUS_COMPLETE;
        house.total_rounds = house.total_rounds + 1;
        house.total_distributed = house.total_distributed + winner_prize;

        // Emit event
        event::emit(RaffleDrawn {
            round_id: house.round_id,
            winner,
            prize: winner_prize,
            total_tickets: house.total_tickets
        });
    }

    public entry fun start_new_round<T>(
        house: &mut RaffleHouse<T>,
        clock: &Clock,
        _admin: &AdminCap,
        ctx: &mut TxContext
    ) {
        assert!(house.status == STATUS_COMPLETE, EAlreadyDrawn);

        // Clear ticket holders
        let participants_len = std::vector::length(&house.participants);
        let mut i = 0;
        while (i < participants_len) {
            let participant = *std::vector::borrow(&house.participants, i);
            table::remove(&mut house.ticket_holders, participant);
            i = i + 1;
        };

        // Reset state
        house.participants = vector::empty();
        house.total_tickets = 0;
        house.round_id = house.round_id + 1;
        house.status = STATUS_ACTIVE;
        house.end_time = clock::timestamp_ms(clock) + ROUND_DURATION_MS;
        house.winner = @0x0;
    }

    // ===== Admin Functions =====

    public entry fun fund_house<T>(
        house: &mut RaffleHouse<T>,
        funds: Coin<T>,
        _admin: &AdminCap
    ) {
        let fund_balance = coin::into_balance(funds);
        balance::join(&mut house.house_balance, fund_balance);
    }

    public entry fun withdraw<T>(
        house: &mut RaffleHouse<T>,
        amount: u64,
        _admin: &AdminCap,
        ctx: &mut TxContext
    ) {
        let withdraw_balance = balance::split(&mut house.house_balance, amount);
        let withdraw_coin = coin::from_balance(withdraw_balance, ctx);
        transfer::public_transfer(withdraw_coin, tx_context::sender(ctx));
    }

    // ===== View Functions =====

    public fun get_round_info<T>(house: &RaffleHouse<T>): (u64, u8, u64, u64, u64) {
        (
            house.round_id,
            house.status,
            house.total_tickets,
            balance::value(&house.prize_pool),
            house.end_time
        )
    }

    public fun get_player_tickets<T>(house: &RaffleHouse<T>, player: address): u64 {
        if (table::contains(&house.ticket_holders, player)) {
            *table::borrow(&house.ticket_holders, player)
        } else {
            0
        }
    }
}
