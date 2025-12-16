/// SUITRUMP Royale - Raffle System with Escrow
/// Players deposit to escrow, round only starts when 2+ players join
/// Players can withdraw from escrow anytime before round starts (100% refund)
#[allow(unused_const, unused_variable, unused_use, unused_mut_parameter, duplicate_alias, lint(public_random, public_entry))]
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
    use std::vector;

    // ===== Error Codes =====
    const EInsufficientFunds: u64 = 0;
    const ERoundNotActive: u64 = 1;
    const ERoundNotEnded: u64 = 2;
    const ENoTickets: u64 = 3;
    const EAlreadyDrawn: u64 = 4;
    const ENotInEscrow: u64 = 5;
    const ECannotWithdrawActiveRound: u64 = 6;
    const ENotEnoughParticipants: u64 = 7;
    const EAlreadyInEscrow: u64 = 8;

    // ===== Game Constants =====
    const TICKET_PRICE: u64 = 1_000_000_000; // 1 SUIT per ticket (changed from 5)
    const WINNER_SHARE: u64 = 940; // 94% to winner
    const HOUSE_SHARE: u64 = 60;   // 6% house fee
    const DEFAULT_ROUND_DURATION_MS: u64 = 21600000; // 6 hours default (6 * 60 * 60 * 1000)
    const MIN_PARTICIPANTS: u64 = 2;

    // ===== Round Status =====
    const STATUS_WAITING: u8 = 0;   // Escrow phase - waiting for 2+ players
    const STATUS_ACTIVE: u8 = 1;    // Round is live, timer running
    const STATUS_DRAWING: u8 = 2;   // Draw in progress
    const STATUS_COMPLETE: u8 = 3;  // Round finished

    // ===== Structs =====

    public struct AdminCap has key, store {
        id: UID
    }

    public struct RaffleHouse<phantom T> has key {
        id: UID,
        house_balance: Balance<T>,
        // Escrow - holds funds while waiting for 2+ players
        escrow_pool: Balance<T>,
        escrow_tickets: Table<address, u64>,
        escrow_participants: vector<address>,
        // Active round
        prize_pool: Balance<T>,
        round_id: u64,
        status: u8,
        total_tickets: u64,
        ticket_holders: Table<address, u64>,
        participants: vector<address>,
        end_time: u64,
        winner: address,
        // Config
        round_duration_ms: u64,
        // Stats
        total_rounds: u64,
        total_distributed: u64
    }

    // ===== Events =====

    public struct EscrowDeposit has copy, drop {
        player: address,
        tickets: u64,
        escrow_total: u64,
        escrow_participants: u64
    }

    public struct EscrowWithdraw has copy, drop {
        player: address,
        tickets: u64,
        refund_amount: u64
    }

    public struct RoundStarted has copy, drop {
        round_id: u64,
        participants: u64,
        total_tickets: u64,
        prize_pool: u64,
        end_time: u64
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

    public fun create_house<T>(ctx: &mut TxContext) {
        let house = RaffleHouse<T> {
            id: object::new(ctx),
            house_balance: balance::zero(),
            // Escrow
            escrow_pool: balance::zero(),
            escrow_tickets: table::new(ctx),
            escrow_participants: vector[],
            // Active round (empty initially)
            prize_pool: balance::zero(),
            round_id: 1,
            status: STATUS_WAITING,
            total_tickets: 0,
            ticket_holders: table::new(ctx),
            participants: vector[],
            end_time: 0,
            winner: @0x0,
            // Config
            round_duration_ms: DEFAULT_ROUND_DURATION_MS,
            // Stats
            total_rounds: 0,
            total_distributed: 0
        };
        transfer::share_object(house);
    }

    // ===== Escrow Functions =====

    /// Deposit tokens to escrow (waiting room)
    /// If this is the 2nd+ unique player, round automatically starts
    public entry fun deposit_escrow<T>(
        house: &mut RaffleHouse<T>,
        payment: Coin<T>,
        num_tickets: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Can only deposit during WAITING status
        assert!(house.status == STATUS_WAITING, ERoundNotActive);
        assert!(num_tickets > 0, ENoTickets);

        let cost = num_tickets * TICKET_PRICE;
        assert!(coin::value(&payment) >= cost, EInsufficientFunds);

        let player = tx_context::sender(ctx);

        // Add to escrow
        let payment_balance = coin::into_balance(payment);
        balance::join(&mut house.escrow_pool, payment_balance);

        // Track tickets
        if (table::contains(&house.escrow_tickets, player)) {
            // Player adding more tickets
            let current = table::remove(&mut house.escrow_tickets, player);
            table::add(&mut house.escrow_tickets, player, current + num_tickets);
        } else {
            // New player
            table::add(&mut house.escrow_tickets, player, num_tickets);
            vector::push_back(&mut house.escrow_participants, player);
        };

        let escrow_participant_count = vector::length(&house.escrow_participants);
        let escrow_total_tickets = get_escrow_total_tickets(house);

        // Emit escrow deposit event
        event::emit(EscrowDeposit {
            player,
            tickets: num_tickets,
            escrow_total: escrow_total_tickets,
            escrow_participants: escrow_participant_count
        });

        // Check if we have enough participants to start the round
        if (escrow_participant_count >= MIN_PARTICIPANTS) {
            start_round_from_escrow(house, clock);
        }
    }

    /// Withdraw from escrow before round starts (100% refund)
    public entry fun withdraw_escrow<T>(
        house: &mut RaffleHouse<T>,
        ctx: &mut TxContext
    ) {
        // Can only withdraw during WAITING status
        assert!(house.status == STATUS_WAITING, ECannotWithdrawActiveRound);

        let player = tx_context::sender(ctx);
        assert!(table::contains(&house.escrow_tickets, player), ENotInEscrow);

        // Get player's tickets
        let tickets = table::remove(&mut house.escrow_tickets, player);
        let refund_amount = tickets * TICKET_PRICE;

        // Remove from participants list
        let (found, index) = vector::index_of(&house.escrow_participants, &player);
        if (found) {
            vector::remove(&mut house.escrow_participants, index);
        };

        // Refund 100%
        let refund_balance = balance::split(&mut house.escrow_pool, refund_amount);
        let refund_coin = coin::from_balance(refund_balance, ctx);
        transfer::public_transfer(refund_coin, player);

        // Emit withdraw event
        event::emit(EscrowWithdraw {
            player,
            tickets,
            refund_amount
        });
    }

    /// Internal: Convert escrow to active round
    fun start_round_from_escrow<T>(
        house: &mut RaffleHouse<T>,
        clock: &Clock
    ) {
        // Move escrow funds to prize pool
        let escrow_funds = balance::withdraw_all(&mut house.escrow_pool);
        balance::join(&mut house.prize_pool, escrow_funds);

        // Move escrow participants to active round
        let escrow_len = vector::length(&house.escrow_participants);
        let mut i = 0;
        let mut total_tickets = 0u64;

        while (i < escrow_len) {
            let participant = *vector::borrow(&house.escrow_participants, i);
            let tickets = table::remove(&mut house.escrow_tickets, participant);

            // Add to active round
            table::add(&mut house.ticket_holders, participant, tickets);
            vector::push_back(&mut house.participants, participant);
            total_tickets = total_tickets + tickets;

            i = i + 1;
        };

        // Clear escrow participants
        house.escrow_participants = vector[];

        // Start the round
        house.status = STATUS_ACTIVE;
        house.total_tickets = total_tickets;
        house.end_time = clock::timestamp_ms(clock) + house.round_duration_ms;

        // Emit round started event
        event::emit(RoundStarted {
            round_id: house.round_id,
            participants: vector::length(&house.participants),
            total_tickets,
            prize_pool: balance::value(&house.prize_pool),
            end_time: house.end_time
        });
    }

    // ===== Active Round Functions =====

    /// Buy additional tickets during active round
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
            vector::push_back(&mut house.participants, player);
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

    /// Draw winner after round ends
    public entry fun draw_winner<T>(
        house: &mut RaffleHouse<T>,
        random: &Random,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(house.status == STATUS_ACTIVE, ERoundNotActive);
        assert!(clock::timestamp_ms(clock) >= house.end_time, ERoundNotEnded);
        assert!(house.total_tickets > 0, ENoTickets);
        assert!(vector::length(&house.participants) >= MIN_PARTICIPANTS, ENotEnoughParticipants);

        house.status = STATUS_DRAWING;

        // Generate random ticket number
        let mut generator = random::new_generator(random, ctx);
        let winning_ticket = random::generate_u64(&mut generator) % house.total_tickets;

        // Find winner
        let mut ticket_count = 0u64;
        let mut winner = @0x0;
        let participants_len = vector::length(&house.participants);
        let mut i = 0;

        while (i < participants_len) {
            let participant = *vector::borrow(&house.participants, i);
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

    /// Start a new round (admin only, after previous round completes)
    public entry fun start_new_round<T>(
        house: &mut RaffleHouse<T>,
        _admin: &AdminCap,
        ctx: &mut TxContext
    ) {
        assert!(house.status == STATUS_COMPLETE, EAlreadyDrawn);

        // Clear ticket holders from previous round
        let participants_len = vector::length(&house.participants);
        let mut i = 0;
        while (i < participants_len) {
            let participant = *vector::borrow(&house.participants, i);
            table::remove(&mut house.ticket_holders, participant);
            i = i + 1;
        };

        // Reset state to WAITING (escrow phase)
        house.participants = vector[];
        house.total_tickets = 0;
        house.round_id = house.round_id + 1;
        house.status = STATUS_WAITING;
        house.end_time = 0;
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

    public entry fun withdraw_house<T>(
        house: &mut RaffleHouse<T>,
        amount: u64,
        _admin: &AdminCap,
        ctx: &mut TxContext
    ) {
        let withdraw_balance = balance::split(&mut house.house_balance, amount);
        let withdraw_coin = coin::from_balance(withdraw_balance, ctx);
        transfer::public_transfer(withdraw_coin, tx_context::sender(ctx));
    }

    /// Set round duration in milliseconds (admin only)
    /// Can only be changed during WAITING status (before round starts)
    public entry fun set_round_duration<T>(
        house: &mut RaffleHouse<T>,
        duration_ms: u64,
        _admin: &AdminCap
    ) {
        // Only allow changing during waiting phase
        assert!(house.status == STATUS_WAITING, ERoundNotActive);
        house.round_duration_ms = duration_ms;
    }

    // ===== View Functions =====

    fun get_escrow_total_tickets<T>(house: &RaffleHouse<T>): u64 {
        let mut total = 0u64;
        let len = vector::length(&house.escrow_participants);
        let mut i = 0;
        while (i < len) {
            let participant = *vector::borrow(&house.escrow_participants, i);
            total = total + *table::borrow(&house.escrow_tickets, participant);
            i = i + 1;
        };
        total
    }

    public fun get_round_info<T>(house: &RaffleHouse<T>): (u64, u8, u64, u64, u64) {
        (
            house.round_id,
            house.status,
            house.total_tickets,
            balance::value(&house.prize_pool),
            house.end_time
        )
    }

    public fun get_escrow_info<T>(house: &RaffleHouse<T>): (u64, u64) {
        (
            vector::length(&house.escrow_participants),
            balance::value(&house.escrow_pool)
        )
    }

    public fun get_player_tickets<T>(house: &RaffleHouse<T>, player: address): u64 {
        if (table::contains(&house.ticket_holders, player)) {
            *table::borrow(&house.ticket_holders, player)
        } else {
            0
        }
    }

    public fun get_player_escrow<T>(house: &RaffleHouse<T>, player: address): u64 {
        if (table::contains(&house.escrow_tickets, player)) {
            *table::borrow(&house.escrow_tickets, player)
        } else {
            0
        }
    }

    public fun get_round_duration<T>(house: &RaffleHouse<T>): u64 {
        house.round_duration_ms
    }
}
