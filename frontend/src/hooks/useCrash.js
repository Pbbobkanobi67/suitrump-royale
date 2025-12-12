import { useState, useCallback, useEffect } from 'react';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_CONFIG, MODULES, RANDOM_OBJECT_ID, parseSuit, formatSuit } from '../config/sui-config.js';

// Game status constants
export const GAME_STATUS = {
  BETTING: 0,
  RUNNING: 1,
  CRASHED: 2
};

// Hook for SUITRUMP Crash game
export function useCrash(account) {
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
    maxBet: '500'
  });
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [lastResult, setLastResult] = useState(null);
  const [activeBet, setActiveBet] = useState(null);

  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  // Fetch house stats
  const fetchStats = useCallback(async () => {
    if (!SUI_CONFIG.games.crash || SUI_CONFIG.games.crash.startsWith('0x_')) {
      console.log('Crash contract not deployed yet');
      return;
    }

    try {
      const houseObject = await suiClient.getObject({
        id: SUI_CONFIG.games.crash,
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
          maxBet: formatSuit(fields.max_bet || '500000000000')
        });
      }
    } catch (err) {
      console.error('Error fetching crash stats:', err);
    }
  }, [suiClient]);

  // Place bet with auto-cashout multiplier
  const placeBet = useCallback(async (amount, autoCashout) => {
    if (!account) {
      setError('Please connect your wallet');
      return null;
    }

    if (!SUI_CONFIG.games.crash || SUI_CONFIG.games.crash.startsWith('0x_')) {
      setError('Crash contract not deployed yet');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const betAmount = parseSuit(amount);
      // Auto-cashout in basis points (2.0x = 200)
      const autoCashoutBps = Math.floor(autoCashout * 100);

      const tx = new Transaction();
      const [betCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(betAmount)]);

      tx.moveCall({
        target: `${SUI_CONFIG.packageId}::${MODULES.crash}::play`,
        arguments: [
          tx.object(SUI_CONFIG.games.crash),
          betCoin,
          tx.pure.u64(autoCashoutBps),
          tx.object(RANDOM_OBJECT_ID)
        ],
        typeArguments: [SUI_CONFIG.suitrumpToken]
      });

      const result = await signAndExecute({
        transaction: tx,
        options: { showEvents: true }
      });

      // Parse CrashResult event
      if (result.events?.length > 0) {
        const crashEvent = result.events.find(e =>
          e.type.includes('CrashResult')
        );
        if (crashEvent?.parsedJson) {
          const eventData = crashEvent.parsedJson;
          setLastResult({
            crashPoint: Number(eventData.crash_point) / 100,
            cashedOutAt: Number(eventData.cashed_out_at) / 100,
            won: eventData.won,
            payout: formatSuit(eventData.payout)
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
  }, [account, signAndExecute, fetchStats]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, account]);

  return {
    loading,
    error,
    stats,
    limits,
    currentMultiplier,
    lastResult,
    activeBet,
    placeBet,
    fetchStats,
    GAME_STATUS
  };
}

export default useCrash;
