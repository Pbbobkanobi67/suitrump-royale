import { useState, useCallback, useEffect } from 'react';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_CONFIG, MODULES, RANDOM_OBJECT_ID, parseSuit, formatSuit } from '../config/sui-config.js';

// Bet types enum matching Move contract
export const BetType = {
  EXACT: 0,
  OVER: 1,
  UNDER: 2,
  ODD: 3,
  EVEN: 4
};

export const BetTypeLabels = {
  [BetType.EXACT]: 'Exact',
  [BetType.OVER]: 'Roll Over',
  [BetType.UNDER]: 'Roll Under',
  [BetType.ODD]: 'Odd',
  [BetType.EVEN]: 'Even'
};

// Hook for SUITRUMP Dice game
export function useDice(account) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalBets: 0,
    totalWagered: '0',
    houseBalance: '0',
    isPaused: false
  });
  const [limits, setLimits] = useState({
    minBet: '1',
    maxBet: '1000'
  });
  const [lastResult, setLastResult] = useState(null);

  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  // Fetch house stats from contract
  const fetchStats = useCallback(async () => {
    if (!SUI_CONFIG.games.dice || SUI_CONFIG.games.dice.startsWith('0x_')) {
      console.log('Dice contract not deployed yet');
      return;
    }

    try {
      const houseObject = await suiClient.getObject({
        id: SUI_CONFIG.games.dice,
        options: { showContent: true }
      });

      if (houseObject.data?.content?.fields) {
        const fields = houseObject.data.content.fields;
        setStats({
          totalBets: Number(fields.total_bets || 0),
          totalWagered: formatSuit(fields.total_wagered || '0'),
          houseBalance: formatSuit(fields.balance || '0'),
          isPaused: fields.is_paused || false
        });
        setLimits({
          minBet: formatSuit(fields.min_bet || '1000000000'),
          maxBet: formatSuit(fields.max_bet || '1000000000000')
        });
      }
    } catch (err) {
      console.error('Error fetching dice stats:', err);
    }
  }, [suiClient]);

  // Place a bet on the dice game
  const placeBet = useCallback(async (betType, chosenNumber, amount) => {
    if (!account) {
      setError('Please connect your wallet');
      return null;
    }

    if (!SUI_CONFIG.games.dice || SUI_CONFIG.games.dice.startsWith('0x_')) {
      setError('Dice contract not deployed yet');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const betAmount = parseSuit(amount);

      const tx = new Transaction();

      // Split coins for bet amount
      const [betCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(betAmount)]);

      // Call the play function
      tx.moveCall({
        target: `${SUI_CONFIG.packageId}::${MODULES.dice}::play`,
        arguments: [
          tx.object(SUI_CONFIG.games.dice), // house
          betCoin,                           // bet_coin
          tx.pure.u8(betType),               // bet_type
          tx.pure.u8(chosenNumber),          // chosen_number
          tx.object(RANDOM_OBJECT_ID)        // random
        ],
        typeArguments: [SUI_CONFIG.suitrumpToken]
      });

      const result = await signAndExecute({
        transaction: tx,
        options: { showEvents: true }
      });

      // Parse the BetResult event
      if (result.events?.length > 0) {
        const betEvent = result.events.find(e =>
          e.type.includes('BetResult')
        );
        if (betEvent?.parsedJson) {
          const eventData = betEvent.parsedJson;
          setLastResult({
            rolledNumber: eventData.rolled_number,
            won: eventData.won,
            payout: formatSuit(eventData.payout),
            multiplier: eventData.multiplier / 100
          });
        }
      }

      await fetchStats();
      setLoading(false);
      return result;
    } catch (err) {
      console.error('Error placing bet:', err);
      setError(err.message || 'Failed to place bet');
      setLoading(false);
      return null;
    }
  }, [account, signAndExecute, suiClient, fetchStats]);

  // Refresh stats on mount and account change
  useEffect(() => {
    fetchStats();
  }, [fetchStats, account]);

  return {
    // State
    loading,
    error,
    stats,
    limits,
    lastResult,

    // Actions
    placeBet,
    fetchStats,

    // Constants
    BetType,
    BetTypeLabels
  };
}

export default useDice;
