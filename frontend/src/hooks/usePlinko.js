import { useState, useCallback, useEffect } from 'react';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_CONFIG, MODULES, RANDOM_OBJECT_ID, parseSuit, formatSuit } from '../config/sui-config.js';

// Risk level constants
export const RISK_LEVEL = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2
};

export const RISK_LABELS = {
  [RISK_LEVEL.LOW]: 'Low Risk',
  [RISK_LEVEL.MEDIUM]: 'Medium Risk',
  [RISK_LEVEL.HIGH]: 'High Risk'
};

// Hook for SUITRUMP Plinko game
export function usePlinko(account) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalDrops: 0,
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

  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  // Fetch house stats
  const fetchStats = useCallback(async () => {
    if (!SUI_CONFIG.games.plinko || SUI_CONFIG.games.plinko.startsWith('0x_')) {
      console.log('Plinko contract not deployed yet');
      return;
    }

    try {
      const houseObject = await suiClient.getObject({
        id: SUI_CONFIG.games.plinko,
        options: { showContent: true }
      });

      if (houseObject.data?.content?.fields) {
        const fields = houseObject.data.content.fields;
        setStats({
          totalDrops: Number(fields.total_drops || 0),
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
      console.error('Error fetching plinko stats:', err);
    }
  }, [suiClient]);

  // Drop a ball
  const drop = useCallback(async (amount, rows, risk) => {
    if (!account) {
      setError('Please connect your wallet');
      return null;
    }

    if (!SUI_CONFIG.games.plinko || SUI_CONFIG.games.plinko.startsWith('0x_')) {
      setError('Plinko contract not deployed yet');
      return null;
    }

    // Validate rows (8-16)
    if (rows < 8 || rows > 16) {
      setError('Rows must be between 8 and 16');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const betAmount = parseSuit(amount);

      const tx = new Transaction();
      const [betCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(betAmount)]);

      tx.moveCall({
        target: `${SUI_CONFIG.packageId}::${MODULES.plinko}::drop`,
        arguments: [
          tx.object(SUI_CONFIG.games.plinko),
          betCoin,
          tx.pure.u8(rows),
          tx.pure.u8(risk),
          tx.object(RANDOM_OBJECT_ID)
        ],
        typeArguments: [SUI_CONFIG.suitrumpToken]
      });

      const result = await signAndExecute({
        transaction: tx,
        options: { showEvents: true }
      });

      // Parse DropResult event
      if (result.events?.length > 0) {
        const dropEvent = result.events.find(e =>
          e.type.includes('DropResult')
        );
        if (dropEvent?.parsedJson) {
          const eventData = dropEvent.parsedJson;
          setLastResult({
            path: eventData.path, // Array of booleans (left=false, right=true)
            slot: eventData.slot,
            multiplier: Number(eventData.multiplier) / 100,
            payout: formatSuit(eventData.payout)
          });
        }
      }

      await fetchStats();
      setLoading(false);
      return result;
    } catch (err) {
      console.error('Error dropping ball:', err);
      setError(err.message || 'Failed to drop ball');
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
    drop,
    fetchStats,
    RISK_LEVEL,
    RISK_LABELS
  };
}

export default usePlinko;
