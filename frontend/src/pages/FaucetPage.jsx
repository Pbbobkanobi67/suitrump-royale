import React, { useState, useEffect } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { ConnectButton } from '@mysten/dapp-kit';

// SUITRUMP Token on Sui Mainnet
const SUITRUMP_TOKEN = {
  type: '0x2053d08c1e2bd02791056171aab0fd12bd7cd7efad2ab8f6b9c8902f14df2ff2::ausd::AUSD',
  coinType: '0x2053d08c1e2bd02791056171aab0fd12bd7cd7efad2ab8f6b9c8902f14df2ff2::ausd::AUSD',
  symbol: 'SUITRUMP',
  decimals: 6,
  name: 'SUITRUMP',
};

function FaucetPage({ wallet }) {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const [suiBalance, setSuiBalance] = useState('0');
  const [suitrumpBalance, setSuitrumpBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const account = currentAccount?.address || wallet?.account;

  // Fetch balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!account || !suiClient) return;

      try {
        // Fetch SUI balance
        const suiBal = await suiClient.getBalance({
          owner: account,
        });
        setSuiBalance((Number(suiBal.totalBalance) / 1e9).toFixed(4));

        // Fetch SUITRUMP balance
        try {
          const suitrumpBal = await suiClient.getBalance({
            owner: account,
            coinType: SUITRUMP_TOKEN.coinType,
          });
          setSuitrumpBalance((Number(suitrumpBal.totalBalance) / Math.pow(10, SUITRUMP_TOKEN.decimals)).toFixed(2));
        } catch (err) {
          // Token might not exist yet or user has none
          setSuitrumpBalance('0');
        }
      } catch (err) {
        console.error('Error fetching balances:', err);
      }
    };

    fetchBalances();
    const interval = setInterval(fetchBalances, 10000);
    return () => clearInterval(interval);
  }, [account, suiClient]);

  const requestTestSui = async () => {
    if (!account) {
      setMessage({ type: 'error', text: 'Please connect your wallet first' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Request from Sui Testnet faucet
      const response = await fetch('https://faucet.testnet.sui.io/gas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          FixedAmountRequest: {
            recipient: account,
          },
        }),
      });

      if (response.ok) {
        setMessage({
          type: 'success',
          text: 'Test SUI requested! It should arrive in your wallet shortly.'
        });
      } else {
        const errorData = await response.text();
        throw new Error(errorData || 'Faucet request failed');
      }
    } catch (err) {
      console.error('Faucet error:', err);
      setMessage({
        type: 'error',
        text: err.message || 'Failed to request test SUI. Try the manual faucet link below.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="faucet-page">
      <div className="card faucet-card">
        <div className="faucet-icon">🚰</div>
        <h2>SUITRUMP Royale Faucet</h2>
        <p className="faucet-desc">
          Get test SUI tokens to play casino games on Sui Testnet
        </p>

        {!account ? (
          <div className="faucet-connect">
            <p>Connect your wallet to get started</p>
            <ConnectButton />
          </div>
        ) : (
          <div className="faucet-claim">
            <div className="wallet-display">
              <span className="wallet-label">Your Wallet:</span>
              <code className="wallet-address">
                {account.slice(0, 10)}...{account.slice(-8)}
              </code>
            </div>

            <div className="balance-display">
              <span className="balance-label">SUI Balance:</span>
              <span className="balance-value">{suiBalance} SUI</span>
            </div>

            <div className="balance-display">
              <span className="balance-label">SUITRUMP Balance:</span>
              <span className="balance-value">{parseFloat(suitrumpBalance).toLocaleString()} SUITRUMP</span>
            </div>

            {message && (
              <div className={`faucet-${message.type}`}>
                {message.text}
              </div>
            )}

            <button
              className="btn btn-primary btn-large"
              onClick={requestTestSui}
              disabled={loading}
            >
              {loading ? 'Requesting...' : 'Request Test SUI'}
            </button>
          </div>
        )}

        <div className="faucet-info">
          <h3>How to Get Tokens</h3>
          <div className="info-steps">
            <div className="step">
              <span className="step-number">1</span>
              <div className="step-content">
                <h4>Get Test SUI</h4>
                <p>Click the button above or use the official Sui faucet to get test SUI for gas fees.</p>
              </div>
            </div>
            <div className="step">
              <span className="step-number">2</span>
              <div className="step-content">
                <h4>Get SUITRUMP Tokens</h4>
                <p>Visit <a href="https://sui-trump.com/" target="_blank" rel="noopener noreferrer">sui-trump.com</a> to acquire SUITRUMP tokens for playing.</p>
              </div>
            </div>
            <div className="step">
              <span className="step-number">3</span>
              <div className="step-content">
                <h4>Play Games</h4>
                <p>Use your SUITRUMP tokens to play Classic Dice, Progressive Jackpot, Raffle, and more!</p>
              </div>
            </div>
          </div>
        </div>

        <div className="faucet-actions">
          <a
            href="https://faucet.sui.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            Official Sui Faucet
          </a>
          <a
            href="https://sui-trump.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            Get SUITRUMP
          </a>
          <a
            href={`https://suiscan.xyz/testnet/account/${account || ''}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            View on Suiscan
          </a>
        </div>

        <div className="token-info">
          <h3>SUITRUMP Token Info</h3>
          <div className="info-grid">
            <div className="info-row">
              <span>Symbol:</span>
              <span>{SUITRUMP_TOKEN.symbol}</span>
            </div>
            <div className="info-row">
              <span>Decimals:</span>
              <span>{SUITRUMP_TOKEN.decimals}</span>
            </div>
            <div className="info-row">
              <span>Network:</span>
              <span>Sui</span>
            </div>
            <div className="info-row token-address-row">
              <span>Contract:</span>
              <code className="token-address">{SUITRUMP_TOKEN.coinType.slice(0, 20)}...{SUITRUMP_TOKEN.coinType.slice(-10)}</code>
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => {
              navigator.clipboard.writeText(SUITRUMP_TOKEN.coinType);
              setMessage({ type: 'success', text: 'Token address copied to clipboard!' });
              setTimeout(() => setMessage(null), 3000);
            }}
          >
            ADD SUITRUMP TO WALLET
          </button>
          <p className="token-note">
            Copy the contract address above and add it as a custom token in your Sui wallet.
          </p>
        </div>
      </div>
    </div>
  );
}

export default FaucetPage;
