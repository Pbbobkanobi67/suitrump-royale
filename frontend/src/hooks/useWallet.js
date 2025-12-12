import { useCurrentAccount, useDisconnectWallet, useConnectWallet, useSuiClient } from '@mysten/dapp-kit';
import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Sui Wallet Hook for SUITRUMP Royale
 * Provides wallet connection and balance functionality using @mysten/dapp-kit
 */
export function useWallet() {
  const currentAccount = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const { mutate: connectWallet } = useConnectWallet();
  const suiClient = useSuiClient();

  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [suiBalance, setSuiBalance] = useState('0');

  // Get account address
  const account = currentAccount?.address || null;
  const isConnected = !!account;

  // Fetch SUI balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!account || !suiClient) {
        setSuiBalance('0');
        return;
      }

      try {
        const balance = await suiClient.getBalance({
          owner: account,
        });
        // Convert from MIST to SUI (9 decimals)
        const suiAmount = Number(balance.totalBalance) / 1e9;
        setSuiBalance(suiAmount.toFixed(4));
      } catch (err) {
        console.error('Error fetching SUI balance:', err);
        setSuiBalance('0');
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [account, suiClient]);

  // Connect wallet
  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // This opens the wallet selector modal from dapp-kit
      connectWallet();
    } catch (err) {
      console.error('Error connecting wallet:', err);
      setError(err.message);
    } finally {
      setIsConnecting(false);
    }
  }, [connectWallet]);

  // Disconnect wallet
  const handleDisconnect = useCallback(() => {
    disconnect();
    setError(null);
  }, [disconnect]);

  // Switch network (placeholder - Sui handles this differently)
  const switchNetwork = useCallback(async () => {
    console.log('Network switching handled by wallet');
  }, []);

  // For compatibility with existing code
  const provider = suiClient;
  const signer = currentAccount; // In Sui, the account handles signing
  const chainId = 'sui:testnet';
  const isCorrectNetwork = true; // Will be updated based on actual network

  return {
    account,
    provider,
    signer,
    chainId,
    suiBalance,
    isConnecting,
    isConnected,
    isCorrectNetwork,
    error,
    connect,
    disconnect: handleDisconnect,
    switchNetwork,
    suiClient,
    currentAccount,
  };
}

export default useWallet;
