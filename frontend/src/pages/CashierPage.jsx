import React, { useState, useEffect } from 'react';
import { useCurrentAccount, useSuiClient, ConnectButton } from '@mysten/dapp-kit';
import { useDemoContext } from '../contexts/DemoContext';
import { useSuitrumpPrice } from '../hooks/useSuitrumpPrice';
import { CURRENT_NETWORK, getNetworkConfig } from '../config/sui-config';
import '../styles/cashier.css';

// Get network config
const networkConfig = getNetworkConfig();
const isTestnet = CURRENT_NETWORK === 'testnet';

// Exchange rate: 1 ticket = $0.10
const TICKET_VALUE_USD = 0.10;

function CashierPage({ wallet, suitBalance: propSuitBalance }) {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const {
    isDemoMode,
    demoBalance,
    setDemoBalance,
    demoWalletBalance,
    setDemoWalletBalance,
    // New per-wallet functions
    getTickets,
    getWalletData,
    buyTickets,
    cashOutTickets,
    connectedWallet
  } = useDemoContext();

  // Get live SUITRUMP price from DEX (same price shown in header)
  const {
    price: suitrumpPrice,
    loading: priceLoading,
    error: priceError,
    lastUpdated,
    poolData,
  } = useSuitrumpPrice();

  // Calculate dynamic exchange rate
  const SUITRUMP_PER_DOLLAR = 1 / suitrumpPrice;
  const SUITRUMP_PER_TICKET = SUITRUMP_PER_DOLLAR * TICKET_VALUE_USD;

  // Helper function
  const suitrumpToUsd = (amount) => amount * suitrumpPrice;

  // Real wallet token balances (from blockchain)
  const [realSuitBalance, setRealSuitBalance] = useState(0);
  const [realVictoryBalance, setRealVictoryBalance] = useState(0);

  // Fetch real token balances from wallet
  useEffect(() => {
    const fetchRealBalances = async () => {
      if (!account?.address || !suiClient) {
        setRealSuitBalance(0);
        setRealVictoryBalance(0);
        return;
      }

      try {
        // Fetch SUITRUMP balance
        const suitrumpType = networkConfig.tokens.SUITRUMP;
        if (suitrumpType) {
          const suitCoins = await suiClient.getCoins({
            owner: account.address,
            coinType: suitrumpType
          });
          const suitTotal = suitCoins.data.reduce((sum, coin) => sum + BigInt(coin.balance), 0n);
          setRealSuitBalance(Number(suitTotal) / 1e9);
        }

        // Fetch VICTORY balance
        const victoryType = networkConfig.tokens.VICTORY;
        if (victoryType) {
          const victCoins = await suiClient.getCoins({
            owner: account.address,
            coinType: victoryType
          });
          const victTotal = victCoins.data.reduce((sum, coin) => sum + BigInt(coin.balance), 0n);
          setRealVictoryBalance(Number(victTotal) / 1e9);
        }
      } catch (err) {
        console.error('Error fetching token balances:', err);
        setRealSuitBalance(0);
        setRealVictoryBalance(0);
      }
    };

    fetchRealBalances();
    const interval = setInterval(fetchRealBalances, 5000);
    return () => clearInterval(interval);
  }, [account?.address, suiClient]);

  // Local state for inputs
  const [buyInAmount, setBuyInAmount] = useState('');
  const [cashOutAmount, setCashOutAmount] = useState('');
  const [txHistory, setTxHistory] = useState([]);
  const [message, setMessage] = useState(null);

  // Get wallet-specific data
  const walletAddress = account?.address;
  const walletData = walletAddress ? getWalletData(walletAddress) : null;

  // Use real or demo balances based on mode
  const walletSuitBalance = isDemoMode
    ? (demoWalletBalance ?? 10000000)
    : realSuitBalance;

  const walletVictoryBalance = isDemoMode ? 0 : realVictoryBalance;
  const ticketBalance = isDemoMode ? (demoBalance || 0) : (walletAddress ? getTickets(walletAddress) : 0);
  const isWalletConnected = !!account;

  // Calculate conversions with dynamic price
  const ticketsToDollars = (tickets) => (tickets * TICKET_VALUE_USD).toFixed(2);
  const localSuitrumpToTickets = (suit) => Math.floor(suit / SUITRUMP_PER_TICKET);
  const localTicketsToSuitrump = (tickets) => tickets * SUITRUMP_PER_TICKET;

  // Calculate average deposit rate for display
  const getAvgDepositRate = () => {
    if (!walletData || !walletData.deposits || walletData.deposits.length === 0) {
      return SUITRUMP_PER_TICKET;
    }
    let totalTickets = 0;
    let weightedSum = 0;
    for (const d of walletData.deposits) {
      totalTickets += d.ticketsReceived;
      weightedSum += d.rate * d.ticketsReceived;
    }
    return totalTickets > 0 ? weightedSum / totalTickets : SUITRUMP_PER_TICKET;
  };

  const avgDepositRate = getAvgDepositRate();
  const cashOutRate = Math.min(avgDepositRate, SUITRUMP_PER_TICKET);

  // Handle Buy In (SUITRUMP -> Tickets)
  const handleBuyIn = async () => {
    const suitAmount = parseFloat(buyInAmount);
    if (isNaN(suitAmount) || suitAmount <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid amount' });
      return;
    }

    if (suitAmount > walletSuitBalance) {
      setMessage({ type: 'error', text: 'Insufficient SUITRUMP balance in wallet' });
      return;
    }

    const ticketsReceived = localSuitrumpToTickets(suitAmount);
    if (ticketsReceived < 1) {
      setMessage({ type: 'error', text: `Minimum is ${SUITRUMP_PER_TICKET.toLocaleString(undefined, {maximumFractionDigits: 0})} SUITRUMP (1 ticket)` });
      return;
    }

    if (isDemoMode) {
      if (setDemoWalletBalance) {
        setDemoWalletBalance(prev => prev - suitAmount);
      }
      setDemoBalance(prev => prev + ticketsReceived);
    } else {
      if (!walletAddress) {
        setMessage({ type: 'error', text: 'Please connect your wallet first' });
        return;
      }
      // Use new per-wallet buyTickets function with deposit tracking
      buyTickets(walletAddress, suitAmount, ticketsReceived, SUITRUMP_PER_TICKET);
    }

    setTxHistory(prev => [{
      type: 'buy_in',
      suitrump: suitAmount,
      tickets: ticketsReceived,
      rate: SUITRUMP_PER_TICKET,
      timestamp: new Date().toLocaleTimeString()
    }, ...prev.slice(0, 9)]);

    setMessage({
      type: 'success',
      text: `Bought ${ticketsReceived.toLocaleString()} tickets for ${suitAmount.toLocaleString()} SUITRUMP`
    });
    setBuyInAmount('');
  };

  // Handle Cash Out (Tickets -> SUITRUMP)
  const handleCashOut = async () => {
    const tickets = parseInt(cashOutAmount);
    if (isNaN(tickets) || tickets <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid ticket amount' });
      return;
    }

    if (tickets > ticketBalance) {
      setMessage({ type: 'error', text: 'Insufficient ticket balance' });
      return;
    }

    if (isDemoMode) {
      const suitrumpReceived = localTicketsToSuitrump(tickets);
      setDemoBalance(prev => prev - tickets);
      if (setDemoWalletBalance) {
        setDemoWalletBalance(prev => (prev || 0) + suitrumpReceived);
      }

      setTxHistory(prev => [{
        type: 'cash_out',
        suitrump: suitrumpReceived,
        tickets: tickets,
        rate: SUITRUMP_PER_TICKET,
        timestamp: new Date().toLocaleTimeString()
      }, ...prev.slice(0, 9)]);

      setMessage({
        type: 'success',
        text: `Cashed out ${tickets.toLocaleString()} tickets for ${suitrumpReceived.toLocaleString(undefined, {maximumFractionDigits: 0})} SUITRUMP`
      });
    } else {
      if (!walletAddress) {
        setMessage({ type: 'error', text: 'Please connect your wallet first' });
        return;
      }

      // Use new per-wallet cashOutTickets function with MIN(original, current) protection
      const result = cashOutTickets(walletAddress, tickets, SUITRUMP_PER_TICKET);

      if (!result.success) {
        setMessage({ type: 'error', text: result.error });
        return;
      }

      setTxHistory(prev => [{
        type: 'cash_out',
        suitrump: result.suitrumpAmount,
        tickets: tickets,
        rate: result.rateUsed,
        originalRate: result.avgOriginalRate,
        currentRate: result.currentRate,
        timestamp: new Date().toLocaleTimeString()
      }, ...prev.slice(0, 9)]);

      const rateNote = result.rateUsed < result.currentRate
        ? ' (protected rate - price went up)'
        : result.rateUsed < result.avgOriginalRate
          ? ' (current rate - price went down)'
          : '';

      setMessage({
        type: 'success',
        text: `Cashed out ${tickets.toLocaleString()} tickets for ${result.suitrumpAmount.toLocaleString(undefined, {maximumFractionDigits: 0})} SUITRUMP${rateNote}`
      });
    }

    setCashOutAmount('');
  };

  const quickBuyAmounts = [10, 25, 50, 100, 250];
  const quickCashOutPercents = [25, 50, 75, 100];

  return (
    <div className="cashier-page">
      {isDemoMode && (
        <div className="demo-mode-banner">
          <span className="demo-icon">🎮</span>
          <span className="demo-text">
            <strong>DEMO MODE</strong> - Practice with simulated tokens.
          </span>
        </div>
      )}

      {!isDemoMode && !isWalletConnected && (
        <div className="connect-wallet-banner">
          <span className="wallet-icon">🔗</span>
          <span className="wallet-text">
            <strong>Connect Wallet</strong> - Connect your Sui wallet to buy tickets and play
          </span>
          <ConnectButton />
        </div>
      )}

      {!isDemoMode && isWalletConnected && (
        <div className="testnet-mode-banner">
          <span className="testnet-icon">🧪</span>
          <span className="testnet-text">
            <strong>TESTNET MODE</strong> - Using TEST_SUITRUMP on {CURRENT_NETWORK}
          </span>
          <span className="wallet-address">
            {account?.address?.slice(0, 6)}...{account?.address?.slice(-4)}
          </span>
        </div>
      )}

      <div className="cashier-header">
        <h1>Casino Cashier</h1>
        <p>Exchange SUITRUMP tokens for casino tickets</p>
      </div>

      {/* Live Price Display */}
      <div className="price-ticker">
        <div className="price-info">
          <span className="price-label">SUITRUMP Price:</span>
          <span className="price-value">
            ${suitrumpPrice?.toFixed(8) || '...'}
          </span>
          {poolData && (
            <span className="price-source">
              via {poolData.dex} (${poolData.liquidity?.toLocaleString(undefined, {maximumFractionDigits: 0})} liq)
            </span>
          )}
        </div>
        {lastUpdated && (
          <span className="price-updated">Updated: {lastUpdated.toLocaleTimeString()}</span>
        )}
        {priceError && <span className="price-error">Using fallback price</span>}
      </div>

      <div className="balance-cards">
        <div className="balance-card wallet-card">
          <div className="card-icon">👛</div>
          <div className="card-content">
            <span className="card-label">{isDemoMode ? 'Demo Wallet' : (isTestnet ? 'tSUIT Balance' : 'SUITRUMP')}</span>
            <span className="card-value">{walletSuitBalance.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
            <span className="card-unit">{isTestnet ? 'tSUIT' : 'SUITRUMP'}</span>
            <span className="card-usd">≈ ${suitrumpToUsd(walletSuitBalance).toFixed(2)} USD</span>
          </div>
        </div>

        <div className="balance-card arrow-card">
          <span className="exchange-arrow">⇄</span>
        </div>

        <div className="balance-card tickets-card">
          <div className="card-icon">🎟️</div>
          <div className="card-content">
            <span className="card-label">Casino Tickets</span>
            <span className="card-value">{ticketBalance.toLocaleString()}</span>
            <span className="card-unit">TICKETS</span>
            <span className="card-usd">= ${ticketsToDollars(ticketBalance)} USD</span>
          </div>
        </div>
      </div>

      {/* Victory Balance (rewards) - HIDDEN FOR NOW, saved for future game rewards
      {!isDemoMode && isWalletConnected && (
        <div className="victory-balance-card">
          <div className="card-icon">🏆</div>
          <div className="card-content">
            <span className="card-label">{isTestnet ? 'tVICT Balance' : 'VICTORY'}</span>
            <span className="card-value">{walletVictoryBalance.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
            <span className="card-unit">{isTestnet ? 'tVICT' : 'VICTORY'}</span>
            <span className="card-note">Reward tokens earned from gameplay</span>
          </div>
        </div>
      )}
      */}

      <div className="exchange-info">
        <div className="rate-box">
          <span className="rate-label">Current Exchange Rate</span>
          <span className="rate-value">
            1 Ticket = {SUITRUMP_PER_TICKET.toLocaleString(undefined, {maximumFractionDigits: 0})} SUITRUMP = ${TICKET_VALUE_USD}
          </span>
          {!isDemoMode && walletData && walletData.deposits && walletData.deposits.length > 0 && (
            <div className="rate-protection-info">
              <span className="protection-label">Your Avg Buy Rate:</span>
              <span className="protection-value">
                {avgDepositRate.toLocaleString(undefined, {maximumFractionDigits: 0})} SUITRUMP/ticket
              </span>
              <span className="protection-note">
                Cash out rate: MIN(your avg, current) = {cashOutRate.toLocaleString(undefined, {maximumFractionDigits: 0})} SUITRUMP/ticket
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Deposit History - only show in real mode when connected */}
      {!isDemoMode && isWalletConnected && walletData && walletData.deposits && walletData.deposits.length > 0 && (
        <div className="deposit-history">
          <h3>Your Deposit History</h3>
          <div className="deposit-list">
            {walletData.deposits.slice(0, 5).map((deposit, i) => (
              <div key={i} className="deposit-item">
                <span className="deposit-tickets">{deposit.ticketsReceived.toLocaleString()} tickets</span>
                <span className="deposit-amount">for {deposit.amount.toLocaleString(undefined, {maximumFractionDigits: 0})} SUITRUMP</span>
                <span className="deposit-rate">@ {deposit.rate.toLocaleString(undefined, {maximumFractionDigits: 0})} SUIT/ticket</span>
                <span className="deposit-time">{new Date(deposit.timestamp).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {message && (
        <div className={`message-banner ${message.type}`}>
          {message.text}
          <button className="close-btn" onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      <div className="action-cards">
        <div className="action-card buy-in-card">
          <h2>Buy Tickets</h2>
          <p className="action-desc">Exchange SUITRUMP for casino tickets at current rate</p>

          <div className="input-group">
            <label>SUITRUMP Amount</label>
            <input
              type="number"
              value={buyInAmount}
              onChange={(e) => setBuyInAmount(e.target.value)}
              placeholder="Enter SUITRUMP amount"
              min="0"
              disabled={!isDemoMode && !isWalletConnected}
            />
            {buyInAmount && parseFloat(buyInAmount) > 0 && (
              <span className="conversion-preview">
                = {localSuitrumpToTickets(parseFloat(buyInAmount)).toLocaleString()} tickets
                (${ticketsToDollars(localSuitrumpToTickets(parseFloat(buyInAmount)))})
              </span>
            )}
          </div>

          <div className="quick-amounts">
            <span className="quick-label">Quick Buy (USD):</span>
            <div className="quick-buttons">
              {quickBuyAmounts.map(usd => (
                <button
                  key={usd}
                  className="quick-btn"
                  onClick={() => setBuyInAmount(Math.ceil(usd / suitrumpPrice).toString())}
                  disabled={!isDemoMode && !isWalletConnected}
                >
                  ${usd}
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn btn-primary btn-large"
            onClick={handleBuyIn}
            disabled={!buyInAmount || parseFloat(buyInAmount) <= 0 || priceLoading || (!isDemoMode && !isWalletConnected)}
          >
            {!isDemoMode && !isWalletConnected ? 'Connect Wallet to Buy' : 'Buy Tickets'}
          </button>
        </div>

        <div className="action-card cash-out-card">
          <h2>Cash Out</h2>
          <p className="action-desc">
            Exchange tickets back to SUITRUMP
            {!isDemoMode && walletData?.deposits?.length > 0 && (
              <span className="protected-note"> (protected rate)</span>
            )}
          </p>

          <div className="input-group">
            <label>Ticket Amount</label>
            <input
              type="number"
              value={cashOutAmount}
              onChange={(e) => setCashOutAmount(e.target.value)}
              placeholder="Enter ticket amount"
              min="0"
              max={ticketBalance}
              disabled={!isDemoMode && !isWalletConnected}
            />
            {cashOutAmount && parseInt(cashOutAmount) > 0 && (
              <span className="conversion-preview">
                = {(parseInt(cashOutAmount) * cashOutRate).toLocaleString(undefined, {maximumFractionDigits: 0})} SUITRUMP
                {!isDemoMode && cashOutRate !== SUITRUMP_PER_TICKET && (
                  <span className="rate-note"> (protected rate)</span>
                )}
              </span>
            )}
          </div>

          <div className="quick-amounts">
            <span className="quick-label">Quick Cash Out:</span>
            <div className="quick-buttons">
              {quickCashOutPercents.map(percent => (
                <button
                  key={percent}
                  className="quick-btn"
                  onClick={() => setCashOutAmount(Math.floor(ticketBalance * percent / 100).toString())}
                  disabled={ticketBalance <= 0 || (!isDemoMode && !isWalletConnected)}
                >
                  {percent}%
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn btn-success btn-large"
            onClick={handleCashOut}
            disabled={!cashOutAmount || parseInt(cashOutAmount) <= 0 || parseInt(cashOutAmount) > ticketBalance || (!isDemoMode && !isWalletConnected)}
          >
            {!isDemoMode && !isWalletConnected ? 'Connect Wallet to Cash Out' : 'Cash Out'}
          </button>
        </div>
      </div>

      {txHistory.length > 0 && (
        <div className="tx-history">
          <h3>Recent Transactions</h3>
          <div className="tx-list">
            {txHistory.map((tx, i) => (
              <div key={i} className={`tx-item ${tx.type}`}>
                <span className="tx-icon">{tx.type === 'buy_in' ? '📥' : '📤'}</span>
                <span className="tx-details">
                  {tx.type === 'buy_in'
                    ? `Bought ${tx.tickets.toLocaleString()} tickets for ${tx.suitrump.toLocaleString()} SUITRUMP`
                    : `Cashed out ${tx.tickets.toLocaleString()} tickets for ${tx.suitrump.toLocaleString(undefined, {maximumFractionDigits: 0})} SUITRUMP`
                  }
                </span>
                <span className="tx-rate">@ {tx.rate?.toLocaleString(undefined, {maximumFractionDigits: 0})} SUIT/ticket</span>
                <span className="tx-time">{tx.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="info-section">
        <h3>How the Ticket System Works</h3>
        <div className="info-grid">
          <div className="info-card">
            <span className="info-icon">1️⃣</span>
            <h4>Buy Tickets</h4>
            <p>Exchange SUITRUMP for casino tickets at the current rate.</p>
          </div>
          <div className="info-card">
            <span className="info-icon">2️⃣</span>
            <h4>Play Games</h4>
            <p>Use tickets to play any casino game. 1 ticket = $0.10 value.</p>
          </div>
          <div className="info-card">
            <span className="info-icon">3️⃣</span>
            <h4>Cash Out</h4>
            <p>Exchange tickets back to SUITRUMP at the protected rate.</p>
          </div>
        </div>

        <div className="rate-explanation">
          <h4>Rate Protection System</h4>
          <p>Your cash-out rate is protected against price manipulation:</p>
          <ul>
            <li><strong>If price goes UP:</strong> You get your original rate (casino protected)</li>
            <li><strong>If price goes DOWN:</strong> You get current rate (you're protected)</li>
            <li><strong>Formula:</strong> MIN(your average buy rate, current rate)</li>
          </ul>
          <p className="protection-example">
            Example: You buy at 1000 SUIT/ticket. Price moons and rate drops to 500 SUIT/ticket.
            You cash out at 500 (current rate) — you can't profit from price increase.
          </p>
        </div>

        <div className="rate-explanation">
          <h4>Current Rates</h4>
          <ul>
            <li><strong>Price:</strong> ${suitrumpPrice.toFixed(8)} per SUITRUMP</li>
            <li><strong>1 Ticket ($0.10)</strong> = {SUITRUMP_PER_TICKET.toLocaleString(undefined, {maximumFractionDigits: 0})} SUITRUMP</li>
            <li><strong>$1.00 USD</strong> = {SUITRUMP_PER_DOLLAR.toLocaleString(undefined, {maximumFractionDigits: 0})} SUITRUMP</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default CashierPage;
