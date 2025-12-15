import { useState, useCallback, useEffect } from 'react';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_CONFIG, MODULES, RANDOM_OBJECT_ID, parseSuit, formatSuit } from '../config/sui-config.js';

// Hook for SUITRUMP Progressive Jackpot game
export function useProgressive(account) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    jackpotPool: '0',
    totalRolls: 0,
    totalWagered: '0',
    jackpotsWon: 0,
    isPaused: false
  });
  const [targetDice, setTargetDice] = useState([1, 2, 3, 4]);
  const [lastResult, setLastResult] = useState(null);

  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const isContractDeployed = SUI_CONFIG.games?.progressive && !SUI_CONFIG.games.progressive.startsWith('0x_');

  // Fetch house stats
  const fetchStats = useCallback(async () => {
    if (!isContractDeployed) {
      return;
    }

    try {
      const houseObject = await suiClient.getObject({
        id: SUI_CONFIG.games.progressive,
        options: { showContent: true }
      });

      if (houseObject.data?.content?.fields) {
        const fields = houseObject.data.content.fields;
        setStats({
          jackpotPool: formatSuit(fields.jackpot_pool || '0'),
          totalRolls: Number(fields.total_rolls || 0),
          totalWagered: formatSuit(fields.total_wagered || '0'),
          jackpotsWon: Number(fields.jackpots_won || 0),
          isPaused: fields.is_paused || false
        });
        if (fields.target_dice) {
          setTargetDice(fields.target_dice);
        }
      }
    } catch (err) {
      console.error('Error fetching progressive stats:', err);
    }
  }, [suiClient, isContractDeployed]);

  // Roll for jackpot
  const roll = useCallback(async () => {
    if (!account) {
      setError('Please connect your wallet');
      return null;
    }

    if (!isContractDeployed) {
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const ticketPrice = parseSuit('1');
      const tx = new Transaction();
      const [paymentCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(ticketPrice)]);

      tx.moveCall({
        target: `${SUI_CONFIG.packageId}::${MODULES.progressive}::roll`,
        arguments: [
          tx.object(SUI_CONFIG.games.progressive),
          paymentCoin,
          tx.object(RANDOM_OBJECT_ID)
        ],
        typeArguments: [SUI_CONFIG.suitrumpToken]
      });

      const result = await signAndExecute({
        transaction: tx,
        options: { showEvents: true }
      });

      if (result.events?.length > 0) {
        const rollEvent = result.events.find(e => e.type.includes('RollResult'));
        if (rollEvent?.parsedJson) {
          const eventData = rollEvent.parsedJson;
          setLastResult({
            rolledDice: eventData.rolled_dice,
            targetDice: eventData.target_dice,
            matches: eventData.matches,
            payout: formatSuit(eventData.payout),
            jackpotWon: eventData.jackpot_won,
            newJackpot: formatSuit(eventData.new_jackpot)
          });
        }
      }

      await fetchStats();
      setLoading(false);
      return result;
    } catch (err) {
      console.error('Error rolling:', err);
      setError(err.message || 'Failed to roll');
      setLoading(false);
      return null;
    }
  }, [account, signAndExecute, fetchStats, isContractDeployed]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, account]);

  return {
    loading,
    error,
    stats,
    targetDice,
    lastResult,
    roll,
    fetchStats,
    isContractDeployed
  };
}

export default useProgressive;
