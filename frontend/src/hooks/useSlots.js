import { useState, useCallback, useEffect } from 'react';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_CONFIG, MODULES, RANDOM_OBJECT_ID, parseSuit, formatSuit } from '../config/sui-config.js';

// Symbol constants matching Move contract
export const SYMBOLS = {
  SUIT: 0,    // SUITRUMP logo - highest payout
  SEVEN: 1,   // Lucky 7
  BAR: 2,     // BAR
  CHERRY: 3,  // Cherry
  BELL: 4,    // Bell
  LEMON: 5    // Lemon - lowest payout
};

export const SYMBOL_NAMES = {
  [SYMBOLS.SUIT]: 'SUIT',
  [SYMBOLS.SEVEN]: '7',
  [SYMBOLS.BAR]: 'BAR',
  [SYMBOLS.CHERRY]: 'Cherry',
  [SYMBOLS.BELL]: 'Bell',
  [SYMBOLS.LEMON]: 'Lemon'
};

export const SYMBOL_EMOJIS = {
  [SYMBOLS.SUIT]: '🎰',
  [SYMBOLS.SEVEN]: '7️⃣',
  [SYMBOLS.BAR]: '🎲',
  [SYMBOLS.CHERRY]: '🍒',
  [SYMBOLS.BELL]: '🔔',
  [SYMBOLS.LEMON]: '🍋'
};

// Hook for SUITRUMP Slots game
export function useSlots(account) {
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
    maxBet: '100'
  });
  const [lastResult, setLastResult] = useState(null);

  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  // Fetch house stats
  const fetchStats = useCallback(async () => {
    if (!SUI_CONFIG.games.slots || SUI_CONFIG.games.slots.startsWith('0x_')) {
      console.log('Slots contract not deployed yet');
      return;
    }

    try {
      const houseObject = await suiClient.getObject({
        id: SUI_CONFIG.games.slots,
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
          maxBet: formatSuit(fields.max_bet || '100000000000')
        });
      }
    } catch (err) {
      console.error('Error fetching slots stats:', err);
    }
  }, [suiClient]);

  // Spin the slots
  const spin = useCallback(async (amount) => {
    if (!account) {
      setError('Please connect your wallet');
      return null;
    }

    if (!SUI_CONFIG.games.slots || SUI_CONFIG.games.slots.startsWith('0x_')) {
      setError('Slots contract not deployed yet');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const betAmount = parseSuit(amount);

      const tx = new Transaction();
      const [betCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(betAmount)]);

      tx.moveCall({
        target: `${SUI_CONFIG.packageId}::${MODULES.slots}::spin`,
        arguments: [
          tx.object(SUI_CONFIG.games.slots),
          betCoin,
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
          setLastResult({
            reels: eventData.reels,
            multiplier: Number(eventData.multiplier) / 100,
            payout: formatSuit(eventData.payout),
            isJackpot: eventData.multiplier === 5000 // 50x jackpot
          });
        }
      }

      await fetchStats();
      setLoading(false);
      return result;
    } catch (err) {
      console.error('Error spinning:', err);
      setError(err.message || 'Failed to spin');
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
    lastResult,
    spin,
    fetchStats,
    SYMBOLS,
    SYMBOL_NAMES,
    SYMBOL_EMOJIS
  };
}

export default useSlots;
