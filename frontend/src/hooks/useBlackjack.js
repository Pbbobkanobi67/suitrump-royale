import { useState, useCallback, useEffect } from 'react';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_CONFIG, MODULES, RANDOM_OBJECT_ID, parseSuit, formatSuit, getTokenType } from '../config/sui-config.js';

// Get the full token type path for TEST_SUITRUMP
const SUITRUMP_TOKEN_TYPE = getTokenType('SUITRUMP');

// Game status constants
export const GAME_STATUS = {
  BETTING: 'betting',
  PLAYING: 'playing',
  DEALER_TURN: 'dealer_turn',
  COMPLETE: 'complete'
};

// Hand status constants
export const HAND_STATUS = {
  NONE: 0,
  PLAYING: 1,
  STANDING: 2,
  DOUBLED: 3,
  SURRENDERED: 4,
  BUSTED: 5,
  BLACKJACK: 6
};

// Card suits and ranks for display
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const SUIT_SYMBOLS = { hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663', spades: '\u2660' };
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Check demo mode from localStorage
function checkDemoMode() {
  try {
    const saved = localStorage.getItem('suitrumpRoyale_demoMode');
    return saved === 'true';
  } catch {
    return false;
  }
}

// Card helper functions
export function cardToDisplay(cardIndex) {
  const rank = cardIndex % 13;
  const suit = Math.floor(cardIndex / 13);
  return {
    rank: RANKS[rank],
    suit: SUITS[suit],
    symbol: SUIT_SYMBOLS[SUITS[suit]],
    isRed: suit < 2, // hearts and diamonds are red
    value: rank === 0 ? 11 : (rank >= 10 ? 10 : rank + 1)
  };
}

export function calculateHandValue(cards) {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    const rank = card % 13;
    if (rank === 0) {
      total += 11;
      aces++;
    } else if (rank >= 10) {
      total += 10;
    } else {
      total += rank + 1;
    }
  }

  // Adjust aces from 11 to 1 if busting
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
}

export function isBlackjack(cards) {
  return cards.length === 2 && calculateHandValue(cards) === 21;
}

export function isBusted(cards) {
  return calculateHandValue(cards) > 21;
}

export function canSplit(cards) {
  if (cards.length !== 2) return false;
  const rank1 = cards[0] % 13;
  const rank2 = cards[1] % 13;
  return rank1 === rank2;
}

export function dealerShowsAce(dealerCards) {
  if (dealerCards.length === 0) return false;
  return (dealerCards[0] % 13) === 0;
}

// Hook for SUITRUMP Blackjack game
export function useBlackjack(account) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gameState, setGameState] = useState({
    status: GAME_STATUS.BETTING,
    playerCards: [],
    playerStatus: HAND_STATUS.NONE,
    splitCards: [],
    splitStatus: HAND_STATUS.NONE,
    dealerCards: [],
    bet: 0,
    splitBet: 0,
    insuranceBet: 0,
    activeHand: 0, // 0 = main, 1 = split
    usedCards: [],
    result: null,
    payout: 0
  });
  const [stats, setStats] = useState({
    totalGames: 0,
    totalWagered: '0',
    houseBankroll: '10000',
    totalPaidOut: '0'
  });
  const [limits, setLimits] = useState({
    minBet: 1,
    maxBet: 1000
  });

  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const isContractDeployed = SUI_CONFIG.games?.blackjack &&
    !SUI_CONFIG.games.blackjack.startsWith('0x_');

  // Deal a random card (for demo mode)
  const dealCard = useCallback((usedCards) => {
    let card;
    do {
      card = Math.floor(Math.random() * 52);
    } while (usedCards.includes(card));
    return card;
  }, []);

  // Start a new game (demo mode)
  const dealDemo = useCallback((betAmount) => {
    const usedCards = [];

    // Deal initial cards: player, dealer, player, dealer
    const playerCard1 = dealCard(usedCards);
    usedCards.push(playerCard1);
    const dealerCard1 = dealCard(usedCards);
    usedCards.push(dealerCard1);
    const playerCard2 = dealCard(usedCards);
    usedCards.push(playerCard2);
    const dealerCard2 = dealCard(usedCards);
    usedCards.push(dealerCard2);

    const playerCards = [playerCard1, playerCard2];
    const dealerCards = [dealerCard1, dealerCard2];

    const playerHasBlackjack = isBlackjack(playerCards);
    const dealerHasBlackjack = isBlackjack(dealerCards);

    // If player has blackjack and dealer doesn't show ace, resolve immediately
    if (playerHasBlackjack && !dealerShowsAce(dealerCards)) {
      const payout = dealerHasBlackjack ? betAmount : betAmount + Math.floor(betAmount * 1.5);
      const result = dealerHasBlackjack ? 'push' : 'blackjack';

      setGameState({
        status: GAME_STATUS.COMPLETE,
        playerCards,
        playerStatus: HAND_STATUS.BLACKJACK,
        splitCards: [],
        splitStatus: HAND_STATUS.NONE,
        dealerCards,
        bet: betAmount,
        splitBet: 0,
        insuranceBet: 0,
        activeHand: 0,
        usedCards,
        result,
        payout
      });
      return { won: result !== 'lose', payout, result };
    }

    setGameState({
      status: GAME_STATUS.PLAYING,
      playerCards,
      playerStatus: playerHasBlackjack ? HAND_STATUS.BLACKJACK : HAND_STATUS.PLAYING,
      splitCards: [],
      splitStatus: HAND_STATUS.NONE,
      dealerCards,
      bet: betAmount,
      splitBet: 0,
      insuranceBet: 0,
      activeHand: 0,
      usedCards,
      result: null,
      payout: 0
    });

    return null; // Game in progress
  }, [dealCard]);

  // Dealer plays their hand (demo mode)
  const dealerPlay = useCallback((currentState) => {
    let { dealerCards, usedCards } = currentState;
    dealerCards = [...dealerCards];
    usedCards = [...usedCards];

    // Dealer hits on 16 or less, stands on 17+
    while (calculateHandValue(dealerCards) < 17) {
      const newCard = dealCard(usedCards);
      usedCards.push(newCard);
      dealerCards.push(newCard);
    }

    return { dealerCards, usedCards };
  }, [dealCard]);

  // Resolve game and calculate payout (demo mode)
  const resolveGame = useCallback((state) => {
    const { dealerCards, usedCards } = dealerPlay(state);

    const playerValue = calculateHandValue(state.playerCards);
    const dealerValue = calculateHandValue(dealerCards);
    const dealerBlackjack = isBlackjack(dealerCards);
    const dealerBusted = isBusted(dealerCards);

    let totalPayout = 0;
    let result = 'lose';

    // Handle insurance
    if (state.insuranceBet > 0 && dealerBlackjack) {
      totalPayout += state.insuranceBet * 3; // Insurance pays 2:1 + return bet
    }

    // Resolve main hand
    if (state.playerStatus === HAND_STATUS.SURRENDERED) {
      totalPayout += Math.floor(state.bet / 2);
      result = 'surrender';
    } else if (state.playerStatus === HAND_STATUS.BUSTED) {
      result = 'lose';
    } else if (state.playerStatus === HAND_STATUS.BLACKJACK) {
      if (dealerBlackjack) {
        totalPayout += state.bet;
        result = 'push';
      } else {
        totalPayout += state.bet + Math.floor(state.bet * 1.5);
        result = 'blackjack';
      }
    } else if (dealerBlackjack) {
      result = 'lose';
    } else if (dealerBusted) {
      totalPayout += state.bet * 2;
      result = 'win';
    } else if (playerValue > dealerValue) {
      totalPayout += state.bet * 2;
      result = 'win';
    } else if (playerValue === dealerValue) {
      totalPayout += state.bet;
      result = 'push';
    }

    // Resolve split hand if exists
    if (state.splitStatus !== HAND_STATUS.NONE && state.splitStatus !== HAND_STATUS.BUSTED) {
      const splitValue = calculateHandValue(state.splitCards);

      if (!dealerBlackjack) {
        if (dealerBusted) {
          totalPayout += state.splitBet * 2;
        } else if (splitValue > dealerValue) {
          totalPayout += state.splitBet * 2;
        } else if (splitValue === dealerValue) {
          totalPayout += state.splitBet;
        }
      }
    }

    setGameState(prev => ({
      ...prev,
      status: GAME_STATUS.COMPLETE,
      dealerCards,
      usedCards,
      result,
      payout: totalPayout
    }));

    return { won: totalPayout > 0, payout: totalPayout, result };
  }, [dealerPlay]);

  // Hit action (demo mode)
  const hitDemo = useCallback(() => {
    setGameState(prev => {
      const isMainHand = prev.activeHand === 0;
      const cards = isMainHand ? [...prev.playerCards] : [...prev.splitCards];
      const usedCards = [...prev.usedCards];

      const newCard = dealCard(usedCards);
      usedCards.push(newCard);
      cards.push(newCard);

      const busted = isBusted(cards);
      const newStatus = busted ? HAND_STATUS.BUSTED : HAND_STATUS.PLAYING;

      const newState = {
        ...prev,
        usedCards,
        [isMainHand ? 'playerCards' : 'splitCards']: cards,
        [isMainHand ? 'playerStatus' : 'splitStatus']: newStatus
      };

      // If busted and has split hand to play, switch to split
      if (busted && isMainHand && prev.splitStatus === HAND_STATUS.PLAYING) {
        newState.activeHand = 1;
        return newState;
      }

      // If all hands done, resolve
      if (busted && (!isMainHand || prev.splitStatus === HAND_STATUS.NONE)) {
        setTimeout(() => resolveGame(newState), 500);
      }

      return newState;
    });
  }, [dealCard, resolveGame]);

  // Stand action (demo mode)
  const standDemo = useCallback(() => {
    setGameState(prev => {
      const isMainHand = prev.activeHand === 0;

      const newState = {
        ...prev,
        [isMainHand ? 'playerStatus' : 'splitStatus']: HAND_STATUS.STANDING
      };

      // If has split hand to play, switch to split
      if (isMainHand && prev.splitStatus === HAND_STATUS.PLAYING) {
        newState.activeHand = 1;
        return newState;
      }

      // All hands done, resolve
      setTimeout(() => resolveGame(newState), 500);
      return newState;
    });
  }, [resolveGame]);

  // Double down action (demo mode)
  const doubleDemo = useCallback(() => {
    setGameState(prev => {
      const isMainHand = prev.activeHand === 0;
      const cards = isMainHand ? [...prev.playerCards] : [...prev.splitCards];
      const currentBet = isMainHand ? prev.bet : prev.splitBet;
      const usedCards = [...prev.usedCards];

      // Can only double on first two cards
      if (cards.length !== 2) return prev;

      // Deal one more card
      const newCard = dealCard(usedCards);
      usedCards.push(newCard);
      cards.push(newCard);

      const busted = isBusted(cards);
      const newStatus = busted ? HAND_STATUS.BUSTED : HAND_STATUS.DOUBLED;

      const newState = {
        ...prev,
        usedCards,
        [isMainHand ? 'playerCards' : 'splitCards']: cards,
        [isMainHand ? 'playerStatus' : 'splitStatus']: newStatus,
        [isMainHand ? 'bet' : 'splitBet']: currentBet * 2
      };

      // If has split hand to play, switch to split
      if (isMainHand && prev.splitStatus === HAND_STATUS.PLAYING) {
        newState.activeHand = 1;
        return newState;
      }

      // Resolve after double
      setTimeout(() => resolveGame(newState), 500);
      return newState;
    });
  }, [dealCard, resolveGame]);

  // Split action (demo mode)
  const splitDemo = useCallback(() => {
    setGameState(prev => {
      // Can only split main hand with pair
      if (prev.activeHand !== 0 || !canSplit(prev.playerCards)) return prev;
      if (prev.splitStatus !== HAND_STATUS.NONE) return prev;

      const playerCards = [prev.playerCards[0]];
      const splitCards = [prev.playerCards[1]];
      const usedCards = [...prev.usedCards];

      // Deal new card to each hand
      const newMainCard = dealCard(usedCards);
      usedCards.push(newMainCard);
      playerCards.push(newMainCard);

      const newSplitCard = dealCard(usedCards);
      usedCards.push(newSplitCard);
      splitCards.push(newSplitCard);

      return {
        ...prev,
        playerCards,
        splitCards,
        splitStatus: HAND_STATUS.PLAYING,
        splitBet: prev.bet,
        usedCards
      };
    });
  }, [dealCard]);

  // Insurance action (demo mode)
  const insuranceDemo = useCallback(() => {
    setGameState(prev => {
      if (!dealerShowsAce(prev.dealerCards)) return prev;
      if (prev.insuranceBet > 0) return prev;

      return {
        ...prev,
        insuranceBet: Math.floor(prev.bet / 2)
      };
    });
  }, []);

  // Surrender action (demo mode)
  const surrenderDemo = useCallback(() => {
    setGameState(prev => {
      // Can only surrender on first two cards, main hand only
      if (prev.activeHand !== 0) return prev;
      if (prev.playerCards.length !== 2) return prev;
      if (prev.splitStatus !== HAND_STATUS.NONE) return prev;

      const newState = {
        ...prev,
        playerStatus: HAND_STATUS.SURRENDERED
      };

      setTimeout(() => resolveGame(newState), 500);
      return newState;
    });
  }, [resolveGame]);

  // Reset game to betting state
  const resetGame = useCallback(() => {
    setGameState({
      status: GAME_STATUS.BETTING,
      playerCards: [],
      playerStatus: HAND_STATUS.NONE,
      splitCards: [],
      splitStatus: HAND_STATUS.NONE,
      dealerCards: [],
      bet: 0,
      splitBet: 0,
      insuranceBet: 0,
      activeHand: 0,
      usedCards: [],
      result: null,
      payout: 0
    });
    setError(null);
  }, []);

  // Main deal function
  const deal = useCallback(async (betAmount) => {
    const isDemoMode = checkDemoMode();

    if (isDemoMode || !isContractDeployed) {
      return dealDemo(betAmount);
    }

    // Real mode - contract interaction
    if (!account) {
      setError('Please connect your wallet');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const betAmountRaw = parseSuit(betAmount.toString());

      // Fetch user's SUITRUMP coins
      const coins = await suiClient.getCoins({
        owner: account.address,
        coinType: SUITRUMP_TOKEN_TYPE
      });

      if (!coins.data || coins.data.length === 0) {
        setError('No SUITRUMP tokens found');
        setLoading(false);
        return null;
      }

      const tx = new Transaction();

      // Handle coin merging/splitting
      let paymentCoin;
      if (coins.data.length === 1) {
        const coinBalance = BigInt(coins.data[0].balance);
        if (coinBalance === betAmountRaw) {
          paymentCoin = tx.object(coins.data[0].coinObjectId);
        } else {
          [paymentCoin] = tx.splitCoins(tx.object(coins.data[0].coinObjectId), [tx.pure.u64(betAmountRaw)]);
        }
      } else {
        const primaryCoin = tx.object(coins.data[0].coinObjectId);
        const otherCoins = coins.data.slice(1).map(c => tx.object(c.coinObjectId));
        tx.mergeCoins(primaryCoin, otherCoins);
        [paymentCoin] = tx.splitCoins(primaryCoin, [tx.pure.u64(betAmountRaw)]);
      }

      tx.moveCall({
        target: `${SUI_CONFIG.packageIds.blackjack}::${MODULES.blackjack}::deal`,
        arguments: [
          tx.object(SUI_CONFIG.games.blackjack),
          paymentCoin,
          tx.object(RANDOM_OBJECT_ID)
        ],
        typeArguments: [SUITRUMP_TOKEN_TYPE]
      });

      const result = await signAndExecute({
        transaction: tx,
        options: { showEvents: true }
      });

      // Parse events to update game state
      if (result.events?.length > 0) {
        const startEvent = result.events.find(e => e.type.includes('GameStarted'));
        if (startEvent?.parsedJson) {
          const data = startEvent.parsedJson;
          setGameState({
            status: GAME_STATUS.PLAYING,
            playerCards: data.player_cards,
            playerStatus: isBlackjack(data.player_cards) ? HAND_STATUS.BLACKJACK : HAND_STATUS.PLAYING,
            splitCards: [],
            splitStatus: HAND_STATUS.NONE,
            dealerCards: [data.dealer_up_card],
            bet: betAmount,
            splitBet: 0,
            insuranceBet: 0,
            activeHand: 0,
            usedCards: [...data.player_cards, data.dealer_up_card],
            result: null,
            payout: 0
          });
        }
      }

      setLoading(false);
      return result;
    } catch (err) {
      console.error('Error dealing:', err);
      setError(err.message || 'Failed to deal');
      setLoading(false);
      return null;
    }
  }, [account, suiClient, signAndExecute, isContractDeployed, dealDemo]);

  // Action wrappers that check mode
  const hit = useCallback(async () => {
    const isDemoMode = checkDemoMode();
    if (isDemoMode || !isContractDeployed) {
      hitDemo();
      return;
    }
    // Contract interaction for hit
    // TODO: Implement when contract is deployed
  }, [isContractDeployed, hitDemo]);

  const stand = useCallback(async () => {
    const isDemoMode = checkDemoMode();
    if (isDemoMode || !isContractDeployed) {
      standDemo();
      return;
    }
    // Contract interaction for stand
  }, [isContractDeployed, standDemo]);

  const double = useCallback(async () => {
    const isDemoMode = checkDemoMode();
    if (isDemoMode || !isContractDeployed) {
      doubleDemo();
      return;
    }
    // Contract interaction for double
  }, [isContractDeployed, doubleDemo]);

  const split = useCallback(async () => {
    const isDemoMode = checkDemoMode();
    if (isDemoMode || !isContractDeployed) {
      splitDemo();
      return;
    }
    // Contract interaction for split
  }, [isContractDeployed, splitDemo]);

  const insurance = useCallback(async () => {
    const isDemoMode = checkDemoMode();
    if (isDemoMode || !isContractDeployed) {
      insuranceDemo();
      return;
    }
    // Contract interaction for insurance
  }, [isContractDeployed, insuranceDemo]);

  const surrender = useCallback(async () => {
    const isDemoMode = checkDemoMode();
    if (isDemoMode || !isContractDeployed) {
      surrenderDemo();
      return;
    }
    // Contract interaction for surrender
  }, [isContractDeployed, surrenderDemo]);

  // Fetch stats from contract
  const fetchStats = useCallback(async () => {
    if (!isContractDeployed) {
      setStats({ totalGames: 0, totalWagered: '0', houseBankroll: '10000', totalPaidOut: '0' });
      return;
    }

    try {
      const houseObject = await suiClient.getObject({
        id: SUI_CONFIG.games.blackjack,
        options: { showContent: true }
      });

      if (houseObject.data?.content?.fields) {
        const fields = houseObject.data.content.fields;
        setStats({
          totalGames: Number(fields.total_games || 0),
          totalWagered: formatSuit(fields.total_wagered || '0'),
          houseBankroll: formatSuit(fields.house_balance || '0'),
          totalPaidOut: formatSuit(fields.total_paid_out || '0')
        });
        setLimits({
          minBet: Number(formatSuit(fields.min_bet || '1000000000')),
          maxBet: Number(formatSuit(fields.max_bet || '100000000000'))
        });
      }
    } catch (err) {
      console.error('Error fetching blackjack stats:', err);
    }
  }, [suiClient, isContractDeployed]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, account]);

  // Available actions based on current state
  const availableActions = {
    canHit: gameState.status === GAME_STATUS.PLAYING &&
            (gameState.activeHand === 0 ? gameState.playerStatus : gameState.splitStatus) === HAND_STATUS.PLAYING,
    canStand: gameState.status === GAME_STATUS.PLAYING &&
              (gameState.activeHand === 0 ? gameState.playerStatus : gameState.splitStatus) === HAND_STATUS.PLAYING,
    canDouble: gameState.status === GAME_STATUS.PLAYING &&
               gameState.activeHand === 0 &&
               gameState.playerCards.length === 2 &&
               gameState.playerStatus === HAND_STATUS.PLAYING,
    canSplit: gameState.status === GAME_STATUS.PLAYING &&
              gameState.activeHand === 0 &&
              gameState.splitStatus === HAND_STATUS.NONE &&
              canSplit(gameState.playerCards) &&
              gameState.playerStatus === HAND_STATUS.PLAYING,
    canInsurance: gameState.status === GAME_STATUS.PLAYING &&
                  gameState.insuranceBet === 0 &&
                  dealerShowsAce(gameState.dealerCards) &&
                  (gameState.playerStatus === HAND_STATUS.PLAYING || gameState.playerStatus === HAND_STATUS.BLACKJACK),
    canSurrender: gameState.status === GAME_STATUS.PLAYING &&
                  gameState.activeHand === 0 &&
                  gameState.playerCards.length === 2 &&
                  gameState.splitStatus === HAND_STATUS.NONE &&
                  gameState.playerStatus === HAND_STATUS.PLAYING
  };

  return {
    loading,
    error,
    gameState,
    stats,
    limits,
    isContractDeployed,
    availableActions,
    // Actions
    deal,
    hit,
    stand,
    double,
    split,
    insurance,
    surrender,
    resetGame,
    // Helpers
    fetchStats,
    clearError: () => setError(null),
    // Constants
    GAME_STATUS,
    HAND_STATUS,
    // Utilities
    cardToDisplay,
    calculateHandValue,
    isBlackjack,
    isBusted
  };
}

export default useBlackjack;
