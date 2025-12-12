import { useState, useCallback, useEffect } from 'react';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_CONFIG, MODULES, RANDOM_OBJECT_ID, parseSuit, formatSuit } from '../config/sui-config.js';

// Keno payout table for reference
export const PAYOUT_TABLE = {
  1: { 1: 3 },
  2: { 2: 9 },
  3: { 2: 2, 3: 26 },
  4: { 2: 1, 3: 5, 4: 72 },
  5: { 3: 3, 4: 12, 5: 82 },
  6: { 3: 1, 4: 4, 5: 39, 6: 160 },
  7: { 4: 2, 5: 7, 6: 89, 7: 420 },
  8: { 4: 1, 5: 4, 6: 15, 7: 180, 8: 1000 },
  9: { 5: 2, 6: 6, 7: 35, 8: 440, 9: 1000 },
  10: { 5: 1, 6: 4, 7: 14, 8: 72, 9: 480, 10: 1000 }
};

// Hook for SUITRUMP Keno game
export function useKeno(account) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalGames: 0,
    totalWagered: '0',
    totalPaidOut: '0',
    houseBalance: '0',
    isPaused: false
  });
  const [limits, setLimits] = useState({
    minBet: '1',
    maxBet: '100'
  });
  const [lastResult, setLastResult] = useState(null);
  const [selectedNumbers, setSelectedNumbers] = useState([]);

  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  // Fetch house stats
  const fetchStats = useCallback(async () => {
    if (!SUI_CONFIG.games.keno || SUI_CONFIG.games.keno.startsWith('0x_')) {
      console.log('Keno contract not deployed yet');
      return;
    }

    try {
      const houseObject = await suiClient.getObject({
        id: SUI_CONFIG.games.keno,
        options: { showContent: true }
      });

      if (houseObject.data?.content?.fields) {
        const fields = houseObject.data.content.fields;
        setStats({
          totalGames: Number(fields.total_games || 0),
          totalWagered: formatSuit(fields.total_wagered || '0'),
          totalPaidOut: formatSuit(fields.total_paid_out || '0'),
          houseBalance: formatSuit(fields.balance || '0'),
          isPaused: fields.is_paused || false
        });
        setLimits({
          minBet: formatSuit(fields.min_bet || '1000000000'),
          maxBet: formatSuit(fields.max_bet || '100000000000')
        });
      }
    } catch (err) {
      console.error('Error fetching keno stats:', err);
    }
  }, [suiClient]);

  // Play keno with selected numbers
  const play = useCallback(async (amount, picks) => {
    if (!account) {
      setError('Please connect your wallet');
      return null;
    }

    if (!SUI_CONFIG.games.keno || SUI_CONFIG.games.keno.startsWith('0x_')) {
      setError('Keno contract not deployed yet');
      return null;
    }

    // Validate picks
    if (!picks || picks.length < 1 || picks.length > 10) {
      setError('Pick 1-10 numbers');
      return null;
    }

    // Validate each number is 1-80 and unique
    const uniquePicks = [...new Set(picks)];
    if (uniquePicks.length !== picks.length) {
      setError('Numbers must be unique');
      return null;
    }
    if (picks.some(n => n < 1 || n > 80)) {
      setError('Numbers must be between 1 and 80');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const betAmount = parseSuit(amount);

      const tx = new Transaction();
      const [betCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(betAmount)]);

      // Convert picks to u8 array
      const picksU8 = picks.map(n => n);

      tx.moveCall({
        target: `${SUI_CONFIG.packageId}::${MODULES.keno}::play`,
        arguments: [
          tx.object(SUI_CONFIG.games.keno),
          betCoin,
          tx.pure.vector('u8', picksU8),
          tx.object(RANDOM_OBJECT_ID)
        ],
        typeArguments: [SUI_CONFIG.suitrumpToken]
      });

      const result = await signAndExecute({
        transaction: tx,
        options: { showEvents: true }
      });

      // Parse KenoResult event
      if (result.events?.length > 0) {
        const kenoEvent = result.events.find(e =>
          e.type.includes('KenoResult')
        );
        if (kenoEvent?.parsedJson) {
          const eventData = kenoEvent.parsedJson;
          setLastResult({
            picks: eventData.picks,
            drawn: eventData.drawn,
            hits: eventData.hits,
            multiplier: Number(eventData.multiplier) / 100,
            payout: formatSuit(eventData.payout)
          });
        }
      }

      await fetchStats();
      setLoading(false);
      return result;
    } catch (err) {
      console.error('Error playing keno:', err);
      setError(err.message || 'Failed to play');
      setLoading(false);
      return null;
    }
  }, [account, signAndExecute, fetchStats]);

  // Toggle number selection
  const toggleNumber = useCallback((num) => {
    setSelectedNumbers(prev => {
      if (prev.includes(num)) {
        return prev.filter(n => n !== num);
      }
      if (prev.length >= 10) {
        return prev; // Max 10 picks
      }
      return [...prev, num].sort((a, b) => a - b);
    });
  }, []);

  // Clear selections
  const clearSelections = useCallback(() => {
    setSelectedNumbers([]);
  }, []);

  // Quick pick random numbers
  const quickPick = useCallback((count) => {
    const numbers = [];
    while (numbers.length < count) {
      const num = Math.floor(Math.random() * 80) + 1;
      if (!numbers.includes(num)) {
        numbers.push(num);
      }
    }
    setSelectedNumbers(numbers.sort((a, b) => a - b));
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, account]);

  return {
    loading,
    error,
    stats,
    limits,
    lastResult,
    selectedNumbers,
    play,
    toggleNumber,
    clearSelections,
    quickPick,
    fetchStats,
    PAYOUT_TABLE
  };
}

export default useKeno;
