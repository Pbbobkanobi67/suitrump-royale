/**
 * useGameWallet - Unified wallet hook for games
 *
 * This hook provides a unified interface for games to interact with
 * either demo mode (local state) or real mode (Sui blockchain).
 *
 * Features:
 * - Automatic mode detection (demo vs real)
 * - Unified balance interface
 * - Transaction helpers for real mode
 * - Wallet connection status
 */

import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useDemoContext } from '../contexts/DemoContext';
import { useSuitrumpBalance, useVictoryBalance, useSuiBalance } from './useTokenBalance';
import { getNetworkConfig, TOKEN_DECIMALS, parseSuit, CURRENT_NETWORK } from '../config/sui-config';

/**
 * Main hook for game wallet interactions
 */
export function useGameWallet() {
  // Demo mode context
  const {
    isDemoMode,
    demoBalance,
    demoWalletBalance,
    setDemoBalance,
    setDemoWalletBalance,
    realTickets,
    setRealTickets,
    addTickets: contextAddTickets,
    deductTickets: contextDeductTickets,
    connectedWallet
  } = useDemoContext();

  // Sui wallet hooks
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  // Real token balances
  const suitrumpBalance = useSuitrumpBalance();
  const victoryBalance = useVictoryBalance();
  const suiBalance = useSuiBalance();

  // Connection status
  const isConnected = !!account?.address;
  const address = account?.address || null;

  // Get the appropriate balance based on mode
  const getBalance = () => {
    if (isDemoMode) {
      return {
        tickets: demoBalance,
        wallet: demoWalletBalance,
        formatted: demoBalance.toLocaleString(),
        walletFormatted: demoWalletBalance.toLocaleString()
      };
    }

    // Real mode - tickets come from context (bought at cashier)
    // wallet balance comes from blockchain
    return {
      tickets: realTickets,
      wallet: Number(suitrumpBalance.data?.formatted || 0),
      formatted: realTickets.toLocaleString(),
      walletFormatted: suitrumpBalance.data?.formatted || '0',
      raw: suitrumpBalance.data?.balance || 0n,
      victory: {
        balance: Number(victoryBalance.data?.formatted || 0),
        formatted: victoryBalance.data?.formatted || '0',
        raw: victoryBalance.data?.balance || 0n
      },
      sui: {
        balance: Number(suiBalance.data?.formatted || 0),
        formatted: suiBalance.data?.formatted || '0'
      }
    };
  };

  // Check if user can afford a bet
  const canAfford = (amount) => {
    const balance = getBalance();
    return balance.tickets >= amount;
  };

  // Refetch balances
  const refetchBalances = () => {
    if (!isDemoMode) {
      suitrumpBalance.refetch();
      victoryBalance.refetch();
      suiBalance.refetch();
    }
  };

  /**
   * Execute a game transaction on Sui
   * @param {Object} options
   * @param {string} options.packageId - The package ID of the game contract
   * @param {string} options.module - The module name
   * @param {string} options.function - The function name
   * @param {Array} options.arguments - Function arguments
   * @param {Array} options.typeArguments - Type arguments (optional)
   * @param {number} options.betAmount - Bet amount in tokens (for coin selection)
   */
  const executeGameTransaction = async ({
    packageId,
    module,
    functionName,
    arguments: args = [],
    typeArguments = [],
    betAmount = 0
  }) => {
    if (isDemoMode) {
      throw new Error('Cannot execute blockchain transaction in demo mode');
    }

    if (!isConnected) {
      throw new Error('Wallet not connected');
    }

    const networkConfig = getNetworkConfig();
    const tx = new Transaction();

    // If bet amount specified, we need to split coins
    if (betAmount > 0) {
      const betAmountRaw = parseSuit(betAmount);
      const coins = suitrumpBalance.data?.coins || [];

      if (coins.length === 0) {
        throw new Error('No SUITRUMP tokens available');
      }

      // Merge all coins and split the required amount
      const [primaryCoin, ...otherCoins] = coins;

      if (otherCoins.length > 0) {
        tx.mergeCoins(
          tx.object(primaryCoin.coinObjectId),
          otherCoins.map(c => tx.object(c.coinObjectId))
        );
      }

      const [betCoin] = tx.splitCoins(
        tx.object(primaryCoin.coinObjectId),
        [tx.pure.u64(betAmountRaw)]
      );

      // Replace the first argument with the split coin
      args[0] = betCoin;
    }

    // Build the move call
    tx.moveCall({
      target: `${packageId}::${module}::${functionName}`,
      arguments: args.map(arg => {
        if (typeof arg === 'string' && arg.startsWith('0x')) {
          return tx.object(arg);
        }
        if (typeof arg === 'number' || typeof arg === 'bigint') {
          return tx.pure.u64(arg);
        }
        return arg; // Already a TransactionArgument
      }),
      typeArguments
    });

    // Sign and execute
    const result = await signAndExecute({
      transaction: tx,
    });

    // Wait for transaction to be confirmed
    await suiClient.waitForTransaction({
      digest: result.digest,
    });

    // Refetch balances after transaction
    refetchBalances();

    return result;
  };

  return {
    // Mode
    isDemoMode,
    isRealMode: !isDemoMode,
    network: CURRENT_NETWORK,

    // Connection
    isConnected,
    address,

    // Balances
    balance: getBalance(),
    canAfford,
    isLoadingBalance: !isDemoMode && (suitrumpBalance.isLoading || victoryBalance.isLoading),

    // Demo mode actions
    setDemoBalance,
    setDemoWalletBalance,

    // Ticket actions (works in both modes)
    addTickets: (amount) => {
      if (isDemoMode) {
        setDemoBalance(prev => prev + amount);
      } else if (connectedWallet) {
        contextAddTickets(connectedWallet, amount);
      }
    },
    deductTickets: (amount) => {
      if (isDemoMode) {
        setDemoBalance(prev => Math.max(0, prev - amount));
        return true;
      } else if (connectedWallet) {
        return contextDeductTickets(connectedWallet, amount);
      }
      return false;
    },

    // Real mode actions
    setRealTickets,
    executeGameTransaction,
    refetchBalances,

    // Raw data (for advanced usage)
    suitrumpBalance,
    victoryBalance,
    suiBalance,
    suiClient
  };
}

/**
 * Hook to check if the app should show "connect wallet" prompt
 */
export function useWalletPrompt() {
  const { isDemoMode } = useDemoContext();
  const account = useCurrentAccount();

  return {
    shouldShowPrompt: !isDemoMode && !account,
    isDemoMode,
    isConnected: !!account
  };
}

export default useGameWallet;
