import { useState, useCallback, useEffect } from 'react';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_CONFIG, MODULES, RANDOM_OBJECT_ID, CLOCK_OBJECT_ID, parseSuit, formatSuit } from '../config/sui-config.js';

// Round status constants
export const ROUND_STATUS = {
  ACTIVE: 0,
  DRAWING: 1,
  COMPLETE: 2
};

export const ROUND_STATUS_LABELS = {
  [ROUND_STATUS.ACTIVE]: 'Active',
  [ROUND_STATUS.DRAWING]: 'Drawing...',
  [ROUND_STATUS.COMPLETE]: 'Complete'
};

// Hook for SUITRUMP Raffle game
export function useRaffle(account) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [roundInfo, setRoundInfo] = useState({
    roundId: 1,
    status: ROUND_STATUS.ACTIVE,
    statusText: 'Active',
    totalTickets: 0,
    prizePool: '0',
    endTime: Date.now() + 3600000,
    winner: null
  });
  const [userTickets, setUserTickets] = useState(0);
  const [stats, setStats] = useState({
    totalRounds: 0,
    totalDistributed: '0'
  });

  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  // Fetch raffle house info
  const fetchRoundInfo = useCallback(async () => {
    if (!SUI_CONFIG.games.raffle || SUI_CONFIG.games.raffle.startsWith('0x_')) {
      console.log('Raffle contract not deployed yet');
      return;
    }

    try {
      const houseObject = await suiClient.getObject({
        id: SUI_CONFIG.games.raffle,
        options: { showContent: true }
      });

      if (houseObject.data?.content?.fields) {
        const fields = houseObject.data.content.fields;
        setRoundInfo({
          roundId: Number(fields.round_id || 1),
          status: Number(fields.status || 0),
          statusText: ROUND_STATUS_LABELS[Number(fields.status || 0)],
          totalTickets: Number(fields.total_tickets || 0),
          prizePool: formatSuit(fields.prize_pool || '0'),
          endTime: Number(fields.end_time || Date.now()),
          winner: fields.winner !== '0x0' ? fields.winner : null
        });
        setStats({
          totalRounds: Number(fields.total_rounds || 0),
          totalDistributed: formatSuit(fields.total_distributed || '0')
        });
      }
    } catch (err) {
      console.error('Error fetching raffle info:', err);
    }
  }, [suiClient]);

  // Fetch user's tickets for current round
  const fetchUserTickets = useCallback(async () => {
    if (!account || !SUI_CONFIG.games.raffle || SUI_CONFIG.games.raffle.startsWith('0x_')) {
      return;
    }

    try {
      // Call the get_player_tickets view function
      const result = await suiClient.devInspectTransactionBlock({
        transactionBlock: (() => {
          const tx = new Transaction();
          tx.moveCall({
            target: `${SUI_CONFIG.packageId}::${MODULES.raffle}::get_player_tickets`,
            arguments: [
              tx.object(SUI_CONFIG.games.raffle),
              tx.pure.address(account)
            ],
            typeArguments: [SUI_CONFIG.suitrumpToken]
          });
          return tx;
        })(),
        sender: account
      });

      if (result.results?.[0]?.returnValues?.[0]) {
        const bytes = result.results[0].returnValues[0][0];
        const tickets = new DataView(new Uint8Array(bytes).buffer).getBigUint64(0, true);
        setUserTickets(Number(tickets));
      }
    } catch (err) {
      console.error('Error fetching user tickets:', err);
    }
  }, [account, suiClient]);

  // Buy raffle tickets (5 SUIT each)
  const buyTickets = useCallback(async (numTickets) => {
    if (!account) {
      setError('Please connect your wallet');
      return null;
    }

    if (!SUI_CONFIG.games.raffle || SUI_CONFIG.games.raffle.startsWith('0x_')) {
      setError('Raffle contract not deployed yet');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const ticketPrice = parseSuit('5'); // 5 SUIT per ticket
      const totalCost = ticketPrice * BigInt(numTickets);

      const tx = new Transaction();
      const [paymentCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(totalCost)]);

      tx.moveCall({
        target: `${SUI_CONFIG.packageId}::${MODULES.raffle}::buy_tickets`,
        arguments: [
          tx.object(SUI_CONFIG.games.raffle),
          paymentCoin,
          tx.pure.u64(numTickets)
        ],
        typeArguments: [SUI_CONFIG.suitrumpToken]
      });

      const result = await signAndExecute({
        transaction: tx,
        options: { showEvents: true }
      });

      await Promise.all([fetchRoundInfo(), fetchUserTickets()]);
      setLoading(false);
      return result;
    } catch (err) {
      console.error('Error buying tickets:', err);
      setError(err.message || 'Failed to buy tickets');
      setLoading(false);
      return null;
    }
  }, [account, signAndExecute, fetchRoundInfo, fetchUserTickets]);

  // Draw winner (can be called by anyone after round ends)
  const drawWinner = useCallback(async () => {
    if (!account) {
      setError('Please connect your wallet');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${SUI_CONFIG.packageId}::${MODULES.raffle}::draw_winner`,
        arguments: [
          tx.object(SUI_CONFIG.games.raffle),
          tx.object(RANDOM_OBJECT_ID),
          tx.object(CLOCK_OBJECT_ID)
        ],
        typeArguments: [SUI_CONFIG.suitrumpToken]
      });

      const result = await signAndExecute({
        transaction: tx,
        options: { showEvents: true }
      });

      await fetchRoundInfo();
      setLoading(false);
      return result;
    } catch (err) {
      console.error('Error drawing winner:', err);
      setError(err.message || 'Failed to draw winner');
      setLoading(false);
      return null;
    }
  }, [account, signAndExecute, fetchRoundInfo]);

  useEffect(() => {
    fetchRoundInfo();
    fetchUserTickets();
  }, [fetchRoundInfo, fetchUserTickets, account]);

  // Check if contract is deployed (package ID is set and not a placeholder)
  const isContractDeployed = SUI_CONFIG.packageIds.raffle &&
    !SUI_CONFIG.packageIds.raffle.startsWith('0x_');

  // Clear error helper
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Placeholder functions for advanced raffle features
  const canRequestDraw = useCallback(async () => {
    return { canRequest: false, reason: 'Not implemented yet' };
  }, []);

  const canExecuteDraw = useCallback(async () => {
    return { canExecute: false, reason: 'Not implemented yet' };
  }, []);

  const requestDraw = useCallback(async () => {
    return drawWinner();
  }, [drawWinner]);

  const executeDraw = useCallback(async () => {
    return drawWinner();
  }, [drawWinner]);

  const cancelRound = useCallback(async () => {
    setError('Cancel round not implemented yet');
    return null;
  }, []);

  const getPreviousRoundWinner = useCallback(async () => {
    return null;
  }, []);

  return {
    loading,
    error,
    roundInfo,
    userTickets,
    stats,
    contract: isContractDeployed,
    buyTickets,
    drawWinner,
    requestDraw,
    executeDraw,
    canRequestDraw,
    canExecuteDraw,
    cancelRound,
    getPreviousRoundWinner,
    clearError,
    fetchRoundInfo,
    fetchUserTickets,
    ROUND_STATUS,
    ROUND_STATUS_LABELS
  };
}

export default useRaffle;
