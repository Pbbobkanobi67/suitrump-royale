import React, { useState, useEffect } from 'react';
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { ConnectButton } from '@mysten/dapp-kit';
import { useDemoContext } from '../contexts/DemoContext';
import { getNetworkConfig } from '../config/sui-config.js';

// Get token config from current network
const networkConfig = getNetworkConfig();

const TEST_TOKENS = {
  suitrump: {
    name: 'Test SUITRUMP',
    symbol: 'tSUIT',
    decimals: 9,
    publicFaucet: networkConfig.tokens.publicFaucets?.suitrump || '0xa5746991f5e85534455951ba8b90b98dcd5f30b0a11f23df6d5df8e385673f4f',
    packageId: networkConfig.tokens.suitrumpPackage || '0xe8fd4cdccd697947bdb84f357eadb626bafac3db769c228336ebcd1ad6ca9081',
    module: 'test_suitrump',
    amounts: [10000, 100000, 1000000, 10000000, 50000000], // 10K to 50M
    maxAmount: 50000000,
  },
  victory: {
    name: 'Test VICTORY',
    symbol: 'tVICT',
    decimals: 9,
    publicFaucet: networkConfig.tokens.publicFaucets?.victory || '0x4b4adf693592e9a2cb5390b9f97657f606d4fd3b753a4c58bafac873f34200a0',
    packageId: networkConfig.tokens.victoryPackage || '0xa2adeb311ccaa83e8dc7f07bdb552a18d8adfdd5d90d5fa48fd672ebcc2a3a24',
    module: 'test_victory',
    amounts: [1000, 10000, 100000, 1000000, 50000000], // 1K to 50M
    maxAmount: 50000000,
  }
};

function FaucetPage({ wallet }) {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const { demoBalance, demoWalletBalance, addDemoWalletBalance, setDemoWalletBalance } = useDemoContext();

  const [suiBalance, setSuiBalance] = useState('0');
  const [suitrumpBalance, setSuitrumpBalance] = useState('0');
  const [victoryBalance, setVictoryBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [loadingToken, setLoadingToken] = useState(null);
  const [message, setMessage] = useState(null);
  const [suitrumpAmount, setSuitrumpAmount] = useState(1000000); // Default 1M
  const [victoryAmount, setVictoryAmount] = useState(1000000); // Default 1M

  const account = currentAccount?.address || wallet?.account;

  useEffect(() => {
    const fetchBalances = async () => {
      if (!account || !suiClient) return;
      try {
        const suiBal = await suiClient.getBalance({ owner: account });
        setSuiBalance((Number(suiBal.totalBalance) / 1e9).toFixed(4));
        try {
          const suitrumpBal = await suiClient.getBalance({
            owner: account,
            coinType: `${TEST_TOKENS.suitrump.packageId}::test_suitrump::TEST_SUITRUMP`,
          });
          setSuitrumpBalance((Number(suitrumpBal.totalBalance) / 1e9).toFixed(2));
        } catch { setSuitrumpBalance('0'); }
        try {
          const victoryBal = await suiClient.getBalance({
            owner: account,
            coinType: `${TEST_TOKENS.victory.packageId}::test_victory::TEST_VICTORY`,
          });
          setVictoryBalance((Number(victoryBal.totalBalance) / 1e9).toFixed(2));
        } catch { setVictoryBalance('0'); }
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
      const response = await fetch('https://faucet.testnet.sui.io/gas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ FixedAmountRequest: { recipient: account } }),
      });
      if (response.ok) {
        setMessage({ type: 'success', text: 'Test SUI requested! It should arrive shortly.' });
      } else {
        throw new Error('Faucet request failed');
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to request SUI. Try the manual faucet link.' });
    } finally {
      setLoading(false);
    }
  };

  const claimTestToken = async (tokenType) => {
    if (!account) {
      setMessage({ type: 'error', text: 'Please connect your wallet first' });
      return;
    }

    const token = TEST_TOKENS[tokenType];
    const amount = tokenType === 'suitrump' ? suitrumpAmount : victoryAmount;
    setLoadingToken(tokenType);
    setMessage({ type: 'info', text: 'Opening wallet...' });

    try {
      const tx = new Transaction();
      // Use mint function with custom amount (amount * 10^9 for decimals)
      const amountWithDecimals = BigInt(amount) * BigInt(1000000000);
      tx.moveCall({
        target: `${token.packageId}::${token.module}::mint`,
        arguments: [
          tx.object(token.publicFaucet),
          tx.pure.u64(amountWithDecimals),
          tx.pure.address(account),
        ],
      });

      await signAndExecute({ transaction: tx });
      setMessage({ type: 'success', text: `Claimed ${amount.toLocaleString()} ${token.symbol}! Check your wallet.` });
    } catch (err) {
      const errorMsg = err?.message || err?.toString() || `Failed to claim ${token.symbol}`;
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setLoadingToken(null);
    }
  };

  const claimDemoTokens = (amount) => {
    addDemoWalletBalance(amount);
    setMessage({ type: 'success', text: `Added ${amount.toLocaleString()} SUITRUMP to wallet!` });
  };

  return (
    <div className="faucet-page">
      <div className="card faucet-card demo-faucet-card">
        <div className="faucet-icon">🎰</div>
        <h2>Demo Token Faucet</h2>
        <p className="faucet-desc">Get unlimited demo tokens to test all games - no wallet needed!</p>

        <div className="demo-balance-box">
          <span className="demo-label">Wallet (SUITRUMP):</span>
          <span className="demo-amount">{parseFloat(demoWalletBalance || 0).toLocaleString()}</span>
        </div>

        {message && <div className={`faucet-${message.type}`}>{message.text}</div>}

        <div className="demo-faucet-buttons">
          <button className="btn btn-primary btn-large" onClick={() => claimDemoTokens(10000)}>+10,000 SUIT</button>
          <button className="btn btn-primary btn-large" onClick={() => claimDemoTokens(100000)}>+100,000 SUIT</button>
          <button className="btn btn-jackpot btn-large" onClick={() => claimDemoTokens(1000000)}>+1,000,000 SUIT</button>
        </div>

        <div className="demo-faucet-actions">
          <button className="btn btn-secondary" onClick={() => setDemoWalletBalance(10000000)}>Reset Wallet</button>
          <button className="btn btn-secondary" onClick={() => setDemoWalletBalance(0)}>Clear Wallet</button>
        </div>

        <p className="demo-note">Demo tokens are in-app only and won't appear in external wallets like Slush. Switch to Demo Mode to use them!</p>
      </div>

      <div className="card faucet-card">
        <div className="faucet-icon">🚰</div>
        <h2>Testnet Token Faucet</h2>
        <p className="faucet-desc">Mint on-chain test tokens to your wallet. Use at the Cashier to buy tickets!</p>

        {!account ? (
          <div className="faucet-connect">
            <p>Connect your wallet to claim testnet tokens</p>
            <ConnectButton />
          </div>
        ) : (
          <div className="faucet-claim">
            <div className="wallet-display">
              <span className="wallet-label">Wallet:</span>
              <code className="wallet-address">{account.slice(0, 10)}...{account.slice(-8)}</code>
            </div>

            <div className="balances-grid">
              <div className="balance-item">
                <span className="balance-label">SUI</span>
                <span className="balance-value">{suiBalance}</span>
              </div>
              <div className="balance-item">
                <span className="balance-label">tSUIT</span>
                <span className="balance-value">{parseFloat(suitrumpBalance).toLocaleString()}</span>
              </div>
              <div className="balance-item">
                <span className="balance-label">tVICT</span>
                <span className="balance-value">{parseFloat(victoryBalance).toLocaleString()}</span>
              </div>
            </div>

            <div className="testnet-faucet-buttons">
              <a href="https://faucet.sui.io/" target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                Get Test SUI (Opens Faucet)
              </a>
            </div>

            <div className="token-faucet-row">
              <div className="token-faucet-item">
                <label className="faucet-label">tSUIT Amount</label>
                <select
                  className="faucet-select"
                  value={suitrumpAmount}
                  onChange={(e) => setSuitrumpAmount(Number(e.target.value))}
                >
                  <option value={10000}>10,000</option>
                  <option value={100000}>100,000</option>
                  <option value={1000000}>1,000,000</option>
                  <option value={10000000}>10,000,000</option>
                  <option value={50000000}>50,000,000</option>
                </select>
                <button className="btn btn-primary" onClick={() => claimTestToken('suitrump')} disabled={loadingToken === 'suitrump'}>
                  {loadingToken === 'suitrump' ? 'Claiming...' : `Get ${suitrumpAmount.toLocaleString()} tSUIT`}
                </button>
              </div>

              <div className="token-faucet-item">
                <label className="faucet-label">tVICT Amount</label>
                <select
                  className="faucet-select"
                  value={victoryAmount}
                  onChange={(e) => setVictoryAmount(Number(e.target.value))}
                >
                  <option value={1000}>1,000</option>
                  <option value={10000}>10,000</option>
                  <option value={100000}>100,000</option>
                  <option value={1000000}>1,000,000</option>
                  <option value={50000000}>50,000,000</option>
                </select>
                <button className="btn btn-warning" onClick={() => claimTestToken('victory')} disabled={loadingToken === 'victory'}>
                  {loadingToken === 'victory' ? 'Claiming...' : `Get ${victoryAmount.toLocaleString()} tVICT`}
                </button>
              </div>
            </div>

          </div>
        )}

        <div className="faucet-links">
          <a href="https://faucet.sui.io/" target="_blank" rel="noopener noreferrer" className="btn btn-secondary">Official Sui Faucet</a>
          <a href={`https://suiscan.xyz/testnet/account/${account || ''}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">View on Suiscan</a>
        </div>
      </div>

      <style>{`
        .faucet-page { display: flex; flex-direction: column; gap: 20px; width: 100%; box-sizing: border-box; }
        .faucet-card { background: linear-gradient(135deg, #1e293b, #0f172a); border: 2px solid #3b82f6; border-radius: 16px; padding: 30px; width: 100%; box-sizing: border-box; }
        .faucet-card h2 { color: #f8fafc; font-size: 1.8rem; margin-bottom: 10px; text-align: center; }
        .faucet-card .faucet-icon { font-size: 3rem; text-align: center; margin-bottom: 15px; }
        .faucet-card .faucet-desc { color: #94a3b8; text-align: center; margin-bottom: 20px; }
        .demo-faucet-card { background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%); }
        .demo-balance-box { background: #0f172a; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0; border: 1px solid #3b82f6; }
        .demo-label { display: block; color: #94a3b8; font-size: 0.9rem; margin-bottom: 8px; }
        .demo-amount { font-size: 2.5rem; font-weight: 700; color: #60a5fa; font-family: 'Dela Gothic One', sans-serif; }
        .demo-faucet-buttons { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin: 20px 0; }
        .demo-faucet-actions { display: flex; gap: 12px; justify-content: center; margin-top: 15px; }
        .demo-note { text-align: center; color: #64748b; font-size: 0.85rem; margin-top: 15px; }
        .faucet-connect { text-align: center; padding: 30px; }
        .faucet-connect p { color: #94a3b8; margin-bottom: 15px; }
        .wallet-display { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 20px; padding: 15px; background: #0f172a; border-radius: 8px; border: 1px solid #3b82f6; }
        .wallet-label { color: #94a3b8; }
        .wallet-address { color: #60a5fa; background: transparent; padding: 0; }
        .balances-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 15px 0; }
        .balance-item { background: #1e293b; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #3b82f6; }
        .balance-item .balance-label { display: block; color: #94a3b8; font-size: 0.8rem; margin-bottom: 4px; }
        .balance-item .balance-value { font-size: 1.2rem; font-weight: 600; color: #60a5fa; }
        .testnet-faucet-buttons { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin: 20px 0; }
        .token-faucet-row { display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; margin: 20px 0; }
        .token-faucet-item { display: flex; flex-direction: column; gap: 10px; align-items: center; background: #1e293b; padding: 20px; border-radius: 12px; min-width: 220px; flex: 1; max-width: 300px; border: 1px solid #3b82f6; }
        .faucet-label { color: #94a3b8; font-size: 0.9rem; font-weight: 600; }
        .faucet-select { background: #0f172a; color: #60a5fa; border: 1px solid #3b82f6; border-radius: 8px; padding: 12px 15px; font-size: 1rem; cursor: pointer; width: 100%; }
        .faucet-select:focus { outline: none; border-color: #60a5fa; box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.2); }
        .faucet-select option { background: #0f172a; color: #60a5fa; }
        .faucet-links { display: flex; gap: 12px; justify-content: center; margin-top: 20px; flex-wrap: wrap; }
        .faucet-success { background: #065f46; color: #34d399; padding: 12px 20px; border-radius: 8px; text-align: center; margin: 15px 0; border: 1px solid #34d399; }
        .faucet-error { background: #7f1d1d; color: #fca5a5; padding: 12px 20px; border-radius: 8px; text-align: center; margin: 15px 0; border: 1px solid #fca5a5; }
        .faucet-info { background: #1e3a5f; color: #60a5fa; padding: 12px 20px; border-radius: 8px; text-align: center; margin: 15px 0; border: 1px solid #3b82f6; }
        .btn-jackpot { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #0f172a; font-weight: 600; }
        .btn-jackpot:hover { background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); }
        @media (max-width: 768px) {
          .faucet-page { padding: 15px; }
          .faucet-card { padding: 20px; }
          .balances-grid { grid-template-columns: 1fr; }
          .token-faucet-row { flex-direction: column; align-items: center; }
          .token-faucet-item { width: 100%; max-width: none; }
        }
      `}</style>
    </div>
  );
}

export default FaucetPage;
