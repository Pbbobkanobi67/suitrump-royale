import { useState, useCallback, useEffect } from 'react';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_CONFIG, MODULES, RANDOM_OBJECT_ID, CLOCK_OBJECT_ID, parseSuit, formatSuit, getTokenType } from '../config/sui-config.js';

// Get the full token type path for TEST_SUITRUMP
const SUITRUMP_TOKEN_TYPE = getTokenType('SUITRUMP');

// Round status constants (matches contract)
export const ROUND_STATUS = {
  WAITING: 0,    // Escrow phase - waiting for 2+ players
  ACTIVE: 1,     // Round is live, timer running
  DRAWING: 2,    // Draw in progress
  COMPLETE: 3    // Round finished
};

export const ROUND_STATUS_LABELS = {
  [ROUND_STATUS.WAITING]: 'Waiting for Players',
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
    status: ROUND_STATUS.WAITING,
    statusText: 'Waiting for Players',
    totalTickets: 0,
    participants: 0,
    prizePool: '0',
    endTime: 0,
    timeRemaining: 0,
    winner: null
  });
  const [escrowInfo, setEscrowInfo] = useState({
    participants: 0,
    totalPool: '0',
    userTickets: 0
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
        const endTimeMs = Number(fields.end_time || 0);
        const now = Date.now();
        const timeRemaining = Math.max(0, Math.floor((endTimeMs - now) / 1000));

        // Active round participants
        const participantCount = Array.isArray(fields.participants) ? fields.participants.length : 0;

        // Escrow participants
        const escrowParticipantCount = Array.isArray(fields.escrow_participants) ? fields.escrow_participants.length : 0;

        setRoundInfo({
          roundId: Number(fields.round_id || 1),
          status: Number(fields.status || 0),
          statusText: ROUND_STATUS_LABELS[Number(fields.status || 0)],
          totalTickets: Number(fields.total_tickets || 0),
          participants: participantCount,
          prizePool: formatSuit(fields.prize_pool || '0'),
          endTime: endTimeMs,
          timeRemaining: timeRemaining,
          winner: fields.winner !== '0x0000000000000000000000000000000000000000000000000000000000000000' ? fields.winner : null
        });

        // Set escrow info
        setEscrowInfo({
          participants: escrowParticipantCount,
          totalPool: formatSuit(fields.escrow_pool || '0'),
          userTickets: 0 // Will be fetched separately
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

  // Fetch user's tickets for current round and escrow
  const fetchUserTickets = useCallback(async () => {
    if (!account?.address || !SUI_CONFIG.games.raffle || SUI_CONFIG.games.raffle.startsWith('0x_')) {
      return;
    }

    try {
      // Call the get_player_tickets view function for active round
      const tx1 = new Transaction();
      tx1.moveCall({
        target: `${SUI_CONFIG.packageIds.raffle}::${MODULES.raffle}::get_player_tickets`,
        arguments: [
          tx1.object(SUI_CONFIG.games.raffle),
          tx1.pure.address(account.address)
        ],
        typeArguments: [SUITRUMP_TOKEN_TYPE]
      });

      const result1 = await suiClient.devInspectTransactionBlock({
        transactionBlock: tx1,
        sender: account.address
      });

      if (result1.results?.[0]?.returnValues?.[0]) {
        const bytes = result1.results[0].returnValues[0][0];
        const tickets = new DataView(new Uint8Array(bytes).buffer).getBigUint64(0, true);
        setUserTickets(Number(tickets));
      }

      // Call get_player_escrow for escrow tickets
      const tx2 = new Transaction();
      tx2.moveCall({
        target: `${SUI_CONFIG.packageIds.raffle}::${MODULES.raffle}::get_player_escrow`,
        arguments: [
          tx2.object(SUI_CONFIG.games.raffle),
          tx2.pure.address(account.address)
        ],
        typeArguments: [SUITRUMP_TOKEN_TYPE]
      });

      const result2 = await suiClient.devInspectTransactionBlock({
        transactionBlock: tx2,
        sender: account.address
      });

      if (result2.results?.[0]?.returnValues?.[0]) {
        const bytes = result2.results[0].returnValues[0][0];
        const escrowTickets = new DataView(new Uint8Array(bytes).buffer).getBigUint64(0, true);
        setEscrowInfo(prev => ({ ...prev, userTickets: Number(escrowTickets) }));
      }
    } catch (err) {
      console.error('Error fetching user tickets:', err);
      setUserTickets(0);
    }
  }, [account, suiClient]);

  // Buy/deposit raffle tickets (1 SUIT each)
  // Uses deposit_escrow when WAITING, buy_tickets when ACTIVE
  const buyTickets = useCallback(async (numTickets, currentStatus) => {
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
      const ticketPrice = parseSuit('1'); // 1 SUIT per ticket
      const totalCost = ticketPrice * BigInt(numTickets);

      // Fetch user's TEST_SUITRUMP coins
      const coins = await suiClient.getCoins({
        owner: account.address,
        coinType: SUITRUMP_TOKEN_TYPE
      });

      if (!coins.data || coins.data.length === 0) {
        setError('No TEST_SUITRUMP tokens found. Get some from the Faucet first!');
        setLoading(false);
        return null;
      }

      // Calculate total balance
      const totalBalance = coins.data.reduce((sum, coin) => sum + BigInt(coin.balance), 0n);
      if (totalBalance < totalCost) {
        setError(`Insufficient TEST_SUITRUMP balance. Need ${formatSuit(totalCost.toString())} SUIT, have ${formatSuit(totalBalance.toString())} SUIT`);
        setLoading(false);
        return null;
      }

      const tx = new Transaction();

      // If we have multiple coins, merge them first
      let paymentCoin;
      if (coins.data.length === 1) {
        // Single coin - split if needed
        if (BigInt(coins.data[0].balance) === totalCost) {
          paymentCoin = tx.object(coins.data[0].coinObjectId);
        } else {
          [paymentCoin] = tx.splitCoins(tx.object(coins.data[0].coinObjectId), [tx.pure.u64(totalCost)]);
        }
      } else {
        // Multiple coins - merge then split
        const primaryCoin = tx.object(coins.data[0].coinObjectId);
        const otherCoins = coins.data.slice(1).map(c => tx.object(c.coinObjectId));
        tx.mergeCoins(primaryCoin, otherCoins);
        [paymentCoin] = tx.splitCoins(primaryCoin, [tx.pure.u64(totalCost)]);
      }

      // Determine which function to call based on status
      const isWaiting = currentStatus === ROUND_STATUS.WAITING || currentStatus === undefined;
      const functionName = isWaiting ? 'deposit_escrow' : 'buy_tickets';

      if (isWaiting) {
        // deposit_escrow requires clock
        tx.moveCall({
          target: `${SUI_CONFIG.packageIds.raffle}::${MODULES.raffle}::deposit_escrow`,
          arguments: [
            tx.object(SUI_CONFIG.games.raffle),
            paymentCoin,
            tx.pure.u64(numTickets),
            tx.object(CLOCK_OBJECT_ID)
          ],
          typeArguments: [SUITRUMP_TOKEN_TYPE]
        });
      } else {
        // buy_tickets for active round
        tx.moveCall({
          target: `${SUI_CONFIG.packageIds.raffle}::${MODULES.raffle}::buy_tickets`,
          arguments: [
            tx.object(SUI_CONFIG.games.raffle),
            paymentCoin,
            tx.pure.u64(numTickets)
          ],
          typeArguments: [SUITRUMP_TOKEN_TYPE]
        });
      }

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
  }, [account, suiClient, signAndExecute, fetchRoundInfo, fetchUserTickets]);

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
        target: `${SUI_CONFIG.packageIds.raffle}::${MODULES.raffle}::draw_winner`,
        arguments: [
          tx.object(SUI_CONFIG.games.raffle),
          tx.object(RANDOM_OBJECT_ID),
          tx.object(CLOCK_OBJECT_ID)
        ],
        typeArguments: [SUITRUMP_TOKEN_TYPE]
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

  // Withdraw from escrow (100% refund, only during WAITING status)
  const withdrawEscrow = useCallback(async () => {
    if (!account) {
      setError('Please connect your wallet');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${SUI_CONFIG.packageIds.raffle}::${MODULES.raffle}::withdraw_escrow`,
        arguments: [
          tx.object(SUI_CONFIG.games.raffle)
        ],
        typeArguments: [SUITRUMP_TOKEN_TYPE]
      });

      const result = await signAndExecute({
        transaction: tx,
        options: { showEvents: true }
      });

      await Promise.all([fetchRoundInfo(), fetchUserTickets()]);
      setLoading(false);
      return result;
    } catch (err) {
      console.error('Error withdrawing from escrow:', err);
      setError(err.message || 'Failed to withdraw from escrow');
      setLoading(false);
      return null;
    }
  }, [account, signAndExecute, fetchRoundInfo, fetchUserTickets]);

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
    escrowInfo,
    userTickets,
    stats,
    contract: isContractDeployed,
    buyTickets,
    withdrawEscrow,
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
