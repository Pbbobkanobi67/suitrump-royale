/**
 * useTokenBalance - Fetches real token balances from Sui blockchain
 *
 * This hook connects to the Sui network and retrieves the user's
 * SUITRUMP and VICTORY token balances.
 */

import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useQuery } from '@tanstack/react-query';
import { getNetworkConfig, TOKEN_DECIMALS, formatSuit } from '../config/sui-config';

/**
 * Fetch balance for a specific token type
 */
export function useTokenBalance(tokenType) {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();

  return useQuery({
    queryKey: ['tokenBalance', account?.address, tokenType],
    queryFn: async () => {
      if (!account?.address || !tokenType) {
        return { balance: 0n, formatted: '0' };
      }

      try {
        const coins = await suiClient.getCoins({
          owner: account.address,
          coinType: tokenType,
        });

        // Sum up all coin balances
        const totalBalance = coins.data.reduce((sum, coin) => {
          return sum + BigInt(coin.balance);
        }, 0n);

        return {
          balance: totalBalance,
          formatted: formatSuit(totalBalance),
          coins: coins.data // Individual coin objects (useful for transactions)
        };
      } catch (error) {
        console.error('Error fetching token balance:', error);
        return { balance: 0n, formatted: '0', error };
      }
    },
    enabled: !!account?.address && !!tokenType,
    refetchInterval: 10000, // Refetch every 10 seconds
    staleTime: 5000,
  });
}

/**
 * Fetch SUITRUMP balance for current wallet
 */
export function useSuitrumpBalance() {
  const networkConfig = getNetworkConfig();
  const tokenType = networkConfig.tokens.SUITRUMP;
  return useTokenBalance(tokenType);
}

/**
 * Fetch VICTORY balance for current wallet
 */
export function useVictoryBalance() {
  const networkConfig = getNetworkConfig();
  const tokenType = networkConfig.tokens.VICTORY;
  return useTokenBalance(tokenType);
}

/**
 * Fetch all token balances at once
 */
export function useAllTokenBalances() {
  const suitrump = useSuitrumpBalance();
  const victory = useVictoryBalance();

  return {
    suitrump: {
      balance: suitrump.data?.balance || 0n,
      formatted: suitrump.data?.formatted || '0',
      isLoading: suitrump.isLoading,
      error: suitrump.error,
      refetch: suitrump.refetch
    },
    victory: {
      balance: victory.data?.balance || 0n,
      formatted: victory.data?.formatted || '0',
      isLoading: victory.isLoading,
      error: victory.error,
      refetch: victory.refetch
    },
    isLoading: suitrump.isLoading || victory.isLoading,
    refetchAll: () => {
      suitrump.refetch();
      victory.refetch();
    }
  };
}

/**
 * Get SUI balance (native token for gas)
 */
export function useSuiBalance() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();

  return useQuery({
    queryKey: ['suiBalance', account?.address],
    queryFn: async () => {
      if (!account?.address) {
        return { balance: 0n, formatted: '0' };
      }

      try {
        const balance = await suiClient.getBalance({
          owner: account.address,
        });

        return {
          balance: BigInt(balance.totalBalance),
          formatted: formatSuit(balance.totalBalance)
        };
      } catch (error) {
        console.error('Error fetching SUI balance:', error);
        return { balance: 0n, formatted: '0', error };
      }
    },
    enabled: !!account?.address,
    refetchInterval: 10000,
    staleTime: 5000,
  });
}

export default useTokenBalance;
