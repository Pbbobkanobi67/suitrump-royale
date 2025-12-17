import { useState, useCallback } from 'react';

// Hand rankings
export const HandRank = {
  NOTHING: 0,
  JACKS_OR_BETTER: 1,
  TWO_PAIR: 2,
  THREE_OF_A_KIND: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  FOUR_OF_A_KIND: 7,
  STRAIGHT_FLUSH: 8,
  ROYAL_FLUSH: 9
};

export const HandRankNames = {
  [HandRank.NOTHING]: 'Nothing',
  [HandRank.JACKS_OR_BETTER]: 'Jacks or Better',
  [HandRank.TWO_PAIR]: 'Two Pair',
  [HandRank.THREE_OF_A_KIND]: 'Three of a Kind',
  [HandRank.STRAIGHT]: 'Straight',
  [HandRank.FLUSH]: 'Flush',
  [HandRank.FULL_HOUSE]: 'Full House',
  [HandRank.FOUR_OF_A_KIND]: 'Four of a Kind',
  [HandRank.STRAIGHT_FLUSH]: 'Straight Flush',
  [HandRank.ROYAL_FLUSH]: 'Royal Flush'
};

// Payouts for Jacks or Better (multipliers based on 1 coin bet)
export const PayTable = {
  [HandRank.JACKS_OR_BETTER]: 1,
  [HandRank.TWO_PAIR]: 2,
  [HandRank.THREE_OF_A_KIND]: 3,
  [HandRank.STRAIGHT]: 4,
  [HandRank.FLUSH]: 6,
  [HandRank.FULL_HOUSE]: 9,
  [HandRank.FOUR_OF_A_KIND]: 25,
  [HandRank.STRAIGHT_FLUSH]: 50,
  [HandRank.ROYAL_FLUSH]: 800
};

// Game states
export const GameStatus = {
  BETTING: 'betting',
  DEALING: 'dealing',
  HOLDING: 'holding',
  DRAWING: 'drawing',
  COMPLETE: 'complete'
};

export function useVideoPoker() {
  // Game state
  const [gameState, setGameState] = useState({
    status: GameStatus.BETTING,
    cards: [],           // Array of 5 cards (0-51)
    held: [false, false, false, false, false],
    bet: 0,
    handRank: HandRank.NOTHING,
    payout: 0
  });

  const [deck, setDeck] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Stats
  const [stats, setStats] = useState({
    totalGames: 0,
    totalWagered: 0,
    totalWon: 0,
    royalFlushes: 0
  });

  // Betting limits
  const limits = {
    minBet: 1,
    maxBet: 500
  };

  // Create and shuffle a new deck
  const createDeck = useCallback(() => {
    const newDeck = [];
    for (let i = 0; i < 52; i++) {
      newDeck.push(i);
    }
    // Fisher-Yates shuffle
    for (let i = newDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
  }, []);

  // Get card rank (0-12: A,2,3,4,5,6,7,8,9,10,J,Q,K)
  const getCardRank = (card) => card % 13;

  // Get card suit (0-3: hearts, diamonds, clubs, spades)
  const getCardSuit = (card) => Math.floor(card / 13);

  // Evaluate hand and return rank
  const evaluateHand = useCallback((cards) => {
    if (cards.length !== 5) return HandRank.NOTHING;

    const ranks = cards.map(getCardRank).sort((a, b) => a - b);
    const suits = cards.map(getCardSuit);

    // Check flush
    const isFlush = suits.every(s => s === suits[0]);

    // Check straight
    let isStraight = false;
    if (ranks[4] - ranks[0] === 4 && new Set(ranks).size === 5) {
      isStraight = true;
    }
    // Check A-2-3-4-5 straight (wheel)
    if (ranks[0] === 0 && ranks[1] === 1 && ranks[2] === 2 && ranks[3] === 3 && ranks[4] === 12) {
      isStraight = true;
    }
    // Check 10-J-Q-K-A straight (broadway)
    const isRoyal = ranks[0] === 0 && ranks[1] === 9 && ranks[2] === 10 && ranks[3] === 11 && ranks[4] === 12;
    if (isRoyal) {
      isStraight = true;
    }

    // Royal Flush
    if (isFlush && isRoyal) {
      return HandRank.ROYAL_FLUSH;
    }

    // Straight Flush
    if (isFlush && isStraight) {
      return HandRank.STRAIGHT_FLUSH;
    }

    // Count ranks for pairs, trips, quads
    const rankCounts = {};
    ranks.forEach(r => {
      rankCounts[r] = (rankCounts[r] || 0) + 1;
    });
    const counts = Object.values(rankCounts).sort((a, b) => b - a);

    // Four of a Kind
    if (counts[0] === 4) {
      return HandRank.FOUR_OF_A_KIND;
    }

    // Full House
    if (counts[0] === 3 && counts[1] === 2) {
      return HandRank.FULL_HOUSE;
    }

    // Flush
    if (isFlush) {
      return HandRank.FLUSH;
    }

    // Straight
    if (isStraight) {
      return HandRank.STRAIGHT;
    }

    // Three of a Kind
    if (counts[0] === 3) {
      return HandRank.THREE_OF_A_KIND;
    }

    // Two Pair
    if (counts[0] === 2 && counts[1] === 2) {
      return HandRank.TWO_PAIR;
    }

    // Jacks or Better (pair of J, Q, K, or A)
    if (counts[0] === 2) {
      const pairRank = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 2));
      // J=10, Q=11, K=12, A=0
      if (pairRank >= 10 || pairRank === 0) {
        return HandRank.JACKS_OR_BETTER;
      }
    }

    return HandRank.NOTHING;
  }, []);

  // Deal initial 5 cards
  const deal = useCallback(async (betAmount) => {
    if (betAmount < limits.minBet || betAmount > limits.maxBet) {
      setError(`Bet must be between ${limits.minBet} and ${limits.maxBet}`);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // Create fresh shuffled deck
      const newDeck = createDeck();

      // Deal 5 cards
      const dealtCards = newDeck.slice(0, 5);
      const remainingDeck = newDeck.slice(5);

      setDeck(remainingDeck);
      setGameState({
        status: GameStatus.HOLDING,
        cards: dealtCards,
        held: [false, false, false, false, false],
        bet: betAmount,
        handRank: HandRank.NOTHING,
        payout: 0
      });

      setStats(prev => ({
        ...prev,
        totalGames: prev.totalGames + 1,
        totalWagered: prev.totalWagered + betAmount
      }));

      return { cards: dealtCards };
    } catch (err) {
      setError(err.message || 'Failed to deal');
      return null;
    } finally {
      setLoading(false);
    }
  }, [createDeck, limits]);

  // Toggle hold on a card
  const toggleHold = useCallback((index) => {
    if (gameState.status !== GameStatus.HOLDING) return;
    if (index < 0 || index > 4) return;

    setGameState(prev => {
      const newHeld = [...prev.held];
      newHeld[index] = !newHeld[index];
      return { ...prev, held: newHeld };
    });
  }, [gameState.status]);

  // Draw - replace non-held cards
  const draw = useCallback(async () => {
    if (gameState.status !== GameStatus.HOLDING) return null;

    setLoading(true);
    setError(null);

    try {
      let deckIndex = 0;
      const newCards = gameState.cards.map((card, i) => {
        if (gameState.held[i]) {
          return card;
        } else {
          const newCard = deck[deckIndex];
          deckIndex++;
          return newCard;
        }
      });

      // Evaluate final hand
      const handRank = evaluateHand(newCards);
      const payout = PayTable[handRank] ? PayTable[handRank] * gameState.bet : 0;

      setGameState(prev => ({
        ...prev,
        status: GameStatus.COMPLETE,
        cards: newCards,
        handRank,
        payout
      }));

      // Update stats
      if (payout > 0) {
        setStats(prev => ({
          ...prev,
          totalWon: prev.totalWon + payout,
          royalFlushes: handRank === HandRank.ROYAL_FLUSH ? prev.royalFlushes + 1 : prev.royalFlushes
        }));
      }

      return { cards: newCards, handRank, payout };
    } catch (err) {
      setError(err.message || 'Failed to draw');
      return null;
    } finally {
      setLoading(false);
    }
  }, [gameState, deck, evaluateHand]);

  // Reset for new game
  const resetGame = useCallback(() => {
    setGameState({
      status: GameStatus.BETTING,
      cards: [],
      held: [false, false, false, false, false],
      bet: 0,
      handRank: HandRank.NOTHING,
      payout: 0
    });
    setDeck([]);
    setError(null);
  }, []);

  // Get card display info
  const getCardDisplay = useCallback((card) => {
    const rank = getCardRank(card);
    const suit = getCardSuit(card);
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const suits = ['\u2665', '\u2666', '\u2663', '\u2660']; // hearts, diamonds, clubs, spades
    const suitNames = ['hearts', 'diamonds', 'clubs', 'spades'];
    const isRed = suit < 2;

    return {
      rank: ranks[rank],
      suit: suits[suit],
      suitName: suitNames[suit],
      isRed
    };
  }, []);

  return {
    // State
    gameState,
    loading,
    error,
    stats,
    limits,

    // Actions
    deal,
    toggleHold,
    draw,
    resetGame,

    // Helpers
    getCardDisplay,
    evaluateHand,

    // Constants
    GameStatus,
    HandRank,
    HandRankNames,
    PayTable
  };
}

export default useVideoPoker;
