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

// Check demo mode from localStorage (same key as DemoContext)
function checkDemoMode() {
  try {
    const saved = localStorage.getItem('suitrumpRoyale_demoMode');
    return saved === 'true';
  } catch {
    return false;
  }
}

// Hook for SUITRUMP Dice game
export function useDice(account) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalBets: 0,
    totalWagered: '0',
    houseBalance: '10000',
    isPaused: false
  });
  const [limits, setLimits] = useState({
    minBet: '1',
    maxBet: '1000'
  });
  const [lastResult, setLastResult] = useState(null);

  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const isContractDeployed = SUI_CONFIG.games?.dice && !SUI_CONFIG.games.dice.startsWith('0x_');

  // Calculate potential payout based on bet type
  const calculatePayout = useCallback((amount, betType, chosenNumber) => {
    const betAmount = parseFloat(amount) || 0;
    if (betAmount <= 0) return '0';

    switch (betType) {
      case BetType.EXACT:
        return (betAmount * 5.82).toFixed(2);
      case BetType.ODD:
      case BetType.EVEN:
        return (betAmount * 1.94).toFixed(2);
      case BetType.OVER: {
        const winCount = 6 - chosenNumber;
        return winCount > 0 ? (betAmount * (6 / winCount) * 0.97).toFixed(2) : '0';
      }
      case BetType.UNDER: {
        const winCount = chosenNumber - 1;
        return winCount > 0 ? (betAmount * (6 / winCount) * 0.97).toFixed(2) : '0';
      }
      default:
        return '0';
    }
  }, []);

  const fetchStats = useCallback(async () => {
    // Don't show errors in demo mode or when contract isn't deployed
    if (!isContractDeployed) {
      setStats({ totalBets: 0, totalWagered: '0', houseBalance: '10000', isPaused: false });
      setError(null); // Clear any error in demo/undeployed mode
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
  }, [suiClient, isContractDeployed]);

  const placeBet = useCallback(async (betType, chosenNumber, amount) => {
    // In demo mode, don't try to place real bets - let the page handle it
    const isDemoMode = checkDemoMode();
    if (isDemoMode || !isContractDeployed) {
      // Demo mode is handled by the page component
      return null;
    }

    if (!account) {
      setError('Please connect your wallet');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const betAmountRaw = parseSuit(amount);
      const tx = new Transaction();
      const [betCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(betAmountRaw)]);

      tx.moveCall({
        target: `${SUI_CONFIG.packageIds?.dice || SUI_CONFIG.packageId}::${MODULES.dice}::play`,
        arguments: [
          tx.object(SUI_CONFIG.games.dice),
          betCoin,
          tx.pure.u8(betType),
          tx.pure.u8(chosenNumber),
          tx.object(RANDOM_OBJECT_ID)
        ],
        typeArguments: [SUI_CONFIG.suitrumpToken]
      });

      const result = await signAndExecute({
        transaction: tx,
        options: { showEvents: true }
      });

      if (result.events?.length > 0) {
        const betEvent = result.events.find(e => e.type.includes('BetResult'));
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
  }, [account, signAndExecute, fetchStats, isContractDeployed]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, account]);

  return {
    loading,
    error,
    stats,
    limits,
    lastResult,
    isContractDeployed,
    placeBet,
    calculatePayout,
    fetchStats,
    clearError: () => setError(null),
    BetType,
    BetTypeLabels
  };
}

export default useDice;
