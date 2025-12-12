import { useState, useCallback, useEffect } from 'react';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_CONFIG, MODULES, RANDOM_OBJECT_ID, parseSuit, formatSuit } from '../config/sui-config.js';

// Bet type constants matching Move contract
export const BET_TYPE = {
  STRAIGHT: 0,   // Single number (35:1)
  RED: 1,        // Red numbers (1:1)
  BLACK: 2,      // Black numbers (1:1)
  ODD: 3,        // Odd numbers (1:1)
  EVEN: 4,       // Even numbers (1:1)
  LOW: 5,        // 1-18 (1:1)
  HIGH: 6,       // 19-36 (1:1)
  DOZEN_1: 7,    // 1-12 (2:1)
  DOZEN_2: 8,    // 13-24 (2:1)
  DOZEN_3: 9     // 25-36 (2:1)
};

export const BET_LABELS = {
  [BET_TYPE.STRAIGHT]: 'Straight Up',
  [BET_TYPE.RED]: 'Red',
  [BET_TYPE.BLACK]: 'Black',
  [BET_TYPE.ODD]: 'Odd',
  [BET_TYPE.EVEN]: 'Even',
  [BET_TYPE.LOW]: '1-18',
  [BET_TYPE.HIGH]: '19-36',
  [BET_TYPE.DOZEN_1]: '1st Dozen',
  [BET_TYPE.DOZEN_2]: '2nd Dozen',
  [BET_TYPE.DOZEN_3]: '3rd Dozen'
};

export const BET_PAYOUTS = {
  [BET_TYPE.STRAIGHT]: 35,
  [BET_TYPE.RED]: 1,
  [BET_TYPE.BLACK]: 1,
  [BET_TYPE.ODD]: 1,
  [BET_TYPE.EVEN]: 1,
  [BET_TYPE.LOW]: 1,
  [BET_TYPE.HIGH]: 1,
  [BET_TYPE.DOZEN_1]: 2,
  [BET_TYPE.DOZEN_2]: 2,
  [BET_TYPE.DOZEN_3]: 2
};

// Red numbers on European roulette wheel
export const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

// Hook for SUITRUMP Roulette game
export function useRoulette(account) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalSpins: 0,
    totalWagered: '0',
    totalPaidOut: '0',
    houseBalance: '0',
    isPaused: false
  });
  const [limits, setLimits] = useState({
    minBet: '1',
    maxBet: '500'
  });
  const [lastResult, setLastResult] = useState(null);
  const [history, setHistory] = useState([]);

  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  // Check if number is red
  const isRed = useCallback((num) => {
    return RED_NUMBERS.includes(num);
  }, []);

  // Fetch house stats
  const fetchStats = useCallback(async () => {
    if (!SUI_CONFIG.games.roulette || SUI_CONFIG.games.roulette.startsWith('0x_')) {
      console.log('Roulette contract not deployed yet');
      return;
    }

    try {
      const houseObject = await suiClient.getObject({
        id: SUI_CONFIG.games.roulette,
        options: { showContent: true }
      });

      if (houseObject.data?.content?.fields) {
        const fields = houseObject.data.content.fields;
        setStats({
          totalSpins: Number(fields.total_spins || 0),
          totalWagered: formatSuit(fields.total_wagered || '0'),
          totalPaidOut: formatSuit(fields.total_paid_out || '0'),
          houseBalance: formatSuit(fields.balance || '0'),
          isPaused: fields.is_paused || false
        });
        setLimits({
          minBet: formatSuit(fields.min_bet || '1000000000'),
          maxBet: formatSuit(fields.max_bet || '500000000000')
        });
      }
    } catch (err) {
      console.error('Error fetching roulette stats:', err);
    }
  }, [suiClient]);

  // Place a bet
  const play = useCallback(async (amount, betType, betNumber = 0) => {
    if (!account) {
      setError('Please connect your wallet');
      return null;
    }

    if (!SUI_CONFIG.games.roulette || SUI_CONFIG.games.roulette.startsWith('0x_')) {
      setError('Roulette contract not deployed yet');
      return null;
    }

    // Validate bet type
    if (betType > BET_TYPE.DOZEN_3) {
      setError('Invalid bet type');
      return null;
    }

    // Validate bet number for straight bets
    if (betType === BET_TYPE.STRAIGHT && (betNumber < 0 || betNumber > 36)) {
      setError('Number must be 0-36');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const betAmount = parseSuit(amount);

      const tx = new Transaction();
      const [betCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(betAmount)]);

      tx.moveCall({
        target: `${SUI_CONFIG.packageId}::${MODULES.roulette}::play`,
        arguments: [
          tx.object(SUI_CONFIG.games.roulette),
          betCoin,
          tx.pure.u8(betType),
          tx.pure.u8(betNumber),
          tx.object(RANDOM_OBJECT_ID)
        ],
        typeArguments: [SUI_CONFIG.suitrumpToken]
      });

      const result = await signAndExecute({
        transaction: tx,
        options: { showEvents: true }
      });

      // Parse SpinResult event
      if (result.events?.length > 0) {
        const spinEvent = result.events.find(e =>
          e.type.includes('SpinResult')
        );
        if (spinEvent?.parsedJson) {
          const eventData = spinEvent.parsedJson;
          const resultNumber = Number(eventData.result_number);
          const resultData = {
            number: resultNumber,
            isRed: isRed(resultNumber),
            isGreen: resultNumber === 0,
            betType: eventData.bet_type,
            betNumber: eventData.bet_number,
            won: eventData.won,
            payout: formatSuit(eventData.payout)
          };
          setLastResult(resultData);
          setHistory(prev => [resultNumber, ...prev.slice(0, 19)]); // Keep last 20
        }
      }

      await fetchStats();
      setLoading(false);
      return result;
    } catch (err) {
      console.error('Error playing roulette:', err);
      setError(err.message || 'Failed to play');
      setLoading(false);
      return null;
    }
  }, [account, signAndExecute, fetchStats, isRed]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, account]);

  return {
    loading,
    error,
    stats,
    limits,
    lastResult,
    history,
    play,
    isRed,
    fetchStats,
    BET_TYPE,
    BET_LABELS,
    BET_PAYOUTS,
    RED_NUMBERS
  };
}

export default useRoulette;
