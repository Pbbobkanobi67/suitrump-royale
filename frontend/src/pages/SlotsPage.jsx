import React, { useState, useEffect, useCallback } from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { useDemoContext } from '../contexts/DemoContext';
import { useGameWallet } from '../hooks/useGameWallet';
import NeedTickets from '../components/NeedTickets';
import { CURRENT_NETWORK, getContract } from '../config/sui-config';

// Get slots contract address (null until deployed)
const SLOTS_CONTRACT = getContract('slots');

const SYMBOLS = {
  0: { name: 'SUIT', emoji: null, image: '/suitrump-mascot.png', color: '#3B82F6' },
  1: { name: 'DIAMOND', emoji: '💎', color: '#A855F7' },
  2: { name: 'FIRE', emoji: '🔥', color: '#EF4444' },
  3: { name: 'STAR', emoji: '⭐', color: '#FBBF24' },
  4: { name: 'LUCKY', emoji: '🍀', color: '#22C55E' },
  5: { name: 'SEVEN', emoji: '🎰', color: '#EC4899' }
};

// Helper to render symbol (image or emoji)
const renderSymbol = (symbolIndex, className = '') => {
  const symbol = SYMBOLS[symbolIndex];
  if (symbol?.image) {
    return <img src={symbol.image} alt={symbol.name} className={`symbol-img ${className}`} />;
  }
  return symbol?.emoji || '?';
};

const BET_PRESETS = [1, 5, 10, 25, 50, 100, 500];

// Slot symbol weights for demo mode (realistic distribution)
const SYMBOL_WEIGHTS = [
  { symbol: 0, weight: 5 },   // SUIT (rare - jackpot)
  { symbol: 1, weight: 8 },   // DIAMOND
  { symbol: 2, weight: 12 },  // FIRE
  { symbol: 3, weight: 20 },  // STAR
  { symbol: 4, weight: 25 },  // LUCKY
  { symbol: 5, weight: 15 }   // SEVEN
];

const TOTAL_WEIGHT = SYMBOL_WEIGHTS.reduce((acc, s) => acc + s.weight, 0);

// Get random symbol based on weights
const getRandomSymbol = () => {
  const rand = Math.random() * TOTAL_WEIGHT;
  let cumulative = 0;
  for (const { symbol, weight } of SYMBOL_WEIGHTS) {
    cumulative += weight;
    if (rand < cumulative) return symbol;
  }
  return 3; // Default to star
};

// Calculate payout for symbol combination
const calculateSlotPayout = (symbols, betAmount) => {
  // Triple match
  if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
    const multipliers = { 0: 50, 1: 25, 5: 15, 2: 10, 4: 8, 3: 5 };
    return betAmount * (multipliers[symbols[0]] || 5);
  }
  // Two match
  if (symbols[0] === symbols[1] || symbols[1] === symbols[2] || symbols[0] === symbols[2]) {
    return betAmount * 1.5;
  }
  return 0;
};

function SlotsPage() {
  // Use unified game wallet hook
  const gameWallet = useGameWallet();
  const {
    isDemoMode,
    demoBalance,
    setDemoBalance,
    getTickets,
    addTickets,
    deductTickets
  } = useDemoContext();
  const account = useCurrentAccount();

  const [betAmount, setBetAmount] = useState(10);
  const [reels, setReels] = useState([3, 3, 3]); // Start with stars
  const [isSpinning, setIsSpinning] = useState(false);
  const [pendingSpinId, setPendingSpinId] = useState(null);
  const [blocksRemaining, setBlocksRemaining] = useState(0);
  const [lastWin, setLastWin] = useState(null);
  const [error, setError] = useState(null);
  const [houseReserve, setHouseReserve] = useState('0');
  const [jackpotPool, setJackpotPool] = useState('0');
  const [animatingReels, setAnimatingReels] = useState([false, false, false]);
  const [stats, setStats] = useState({ totalSpins: 0, totalWagered: '0', totalWon: '0', biggestWin: '0' });
  const [showResult, setShowResult] = useState(null); // { type: 'win'|'loss'|'jackpot', amount: number, symbols: [] }
  const [demoStats, setDemoStats] = useState({ totalSpins: 0, totalWagered: 0, totalWon: 0, biggestWin: 0 });
  const [history, setHistory] = useState([]);

  // Get current balance based on mode - directly use wallet address for real mode
  const walletAddress = account?.address;
  const realTicketBalance = walletAddress ? getTickets(walletAddress) : 0;
  const currentBalance = isDemoMode ? demoBalance : realTicketBalance;
  const isWalletConnected = !!account;

  // Ref to track spinning interval (defined early so it's available in all effects)
  const spinIntervalRef = React.useRef(null);

  const startSpinning = useCallback(() => {
    setAnimatingReels([true, true, true]);
    if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    spinIntervalRef.current = setInterval(() => {
      setReels([Math.floor(Math.random() * 6), Math.floor(Math.random() * 6), Math.floor(Math.random() * 6)]);
    }, 100);
  }, []);

  const stopSpinning = useCallback((finalSymbols) => {
    // FIRST: Stop the random spinning interval immediately
    if (spinIntervalRef.current) {
      clearInterval(spinIntervalRef.current);
      spinIntervalRef.current = null;
    }

    // Stop reels one by one with delays for dramatic effect
    return new Promise((resolve) => {
      setTimeout(() => {
        setReels(prev => [finalSymbols[0], prev[1], prev[2]]);
        setAnimatingReels([false, true, true]);
      }, 300);
      setTimeout(() => {
        setReels(prev => [prev[0], finalSymbols[1], prev[2]]);
        setAnimatingReels([false, false, true]);
      }, 600);
      setTimeout(() => {
        setReels(finalSymbols);
        setAnimatingReels([false, false, false]);
        resolve();
      }, 900);
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    };
  }, []);

  // Fetch contract data when in real mode
  useEffect(() => {
    if (isDemoMode || !isWalletConnected || !SLOTS_CONTRACT) return;
    // TODO: Fetch house reserve, jackpot pool from contract when deployed
    // For now, just refetch token balance
    gameWallet.refetchBalances();
  }, [isDemoMode, isWalletConnected]);

  // Check blocks for pending spin
  const [autoRevealing, setAutoRevealing] = useState(false);

  useEffect(() => {
    if (!pendingSpinId || isDemoMode) return;
    // TODO: Implement block checking when contract is deployed
  }, [pendingSpinId, isDemoMode, autoRevealing]);

  // Reset autoRevealing when pendingSpinId changes
  useEffect(() => {
    if (!pendingSpinId) {
      setAutoRevealing(false);
    }
  }, [pendingSpinId]);

  // Real mode spin handler
  const handleSpin = async () => {
    if (!isWalletConnected || !walletAddress) {
      setError('Please connect your wallet to play');
      return;
    }

    if (currentBalance < betAmount) {
      setError('Insufficient ticket balance! Buy tickets at the Cashier.');
      return;
    }

    // Deduct bet amount FIRST
    const deducted = deductTickets(walletAddress, betAmount);
    if (!deducted) {
      setError('Failed to deduct tickets');
      return;
    }

    setError(null);
    setLastWin(null);
    setIsSpinning(true);

    // Start spinning animation
    startSpinning();

    // Simulate delay for realism
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate random symbols
    const finalSymbols = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
    const winAmount = calculateSlotPayout(finalSymbols, betAmount);

    // Stop spinning with dramatic effect
    await stopSpinning(finalSymbols);

    // Add winnings if won
    if (winAmount > 0) {
      addTickets(walletAddress, winAmount);
      setLastWin(winAmount);
      setHistory(prev => [{
        time: new Date().toLocaleTimeString(),
        result: finalSymbols.join(''),
        amount: betAmount,
        win: winAmount,
        won: true
      }, ...prev.slice(0, 9)]);

      // Show result
      const isJackpot = finalSymbols[0] === 0 && finalSymbols[1] === 0 && finalSymbols[2] === 0;
      setShowResult({
        type: isJackpot ? 'jackpot' : 'win',
        amount: winAmount,
        symbols: finalSymbols
      });
    } else {
      setHistory(prev => [{
        time: new Date().toLocaleTimeString(),
        result: finalSymbols.join(''),
        amount: betAmount,
        win: 0,
        won: false
      }, ...prev.slice(0, 9)]);

      setShowResult({
        type: 'loss',
        amount: betAmount,
        symbols: finalSymbols
      });
    }

    setIsSpinning(false);
  };

  const handleReveal = async () => {
    if (!pendingSpinId || isDemoMode) return;
    // TODO: Implement reveal when contract is deployed
    setError('Contract integration coming soon');
  };

  // Demo mode spin handler
  const handleDemoSpin = async () => {
    if (betAmount > demoBalance) {
      setError('Insufficient demo balance!');
      return;
    }

    setError(null);
    setLastWin(null);
    setIsSpinning(true);

    // Deduct bet
    setDemoBalance(prev => prev - betAmount);

    // Start spinning animation
    startSpinning();

    // Simulate delay for realism
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate random symbols
    const finalSymbols = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
    const winAmount = calculateSlotPayout(finalSymbols, betAmount);

    // Stop spinning with dramatic effect
    await stopSpinning(finalSymbols);

    // Credit winnings
    if (winAmount > 0) {
      setDemoBalance(prev => prev + winAmount);
    }

    // Update demo stats
    setDemoStats(prev => ({
      totalSpins: prev.totalSpins + 1,
      totalWagered: prev.totalWagered + betAmount,
      totalWon: prev.totalWon + winAmount,
      biggestWin: Math.max(prev.biggestWin, winAmount)
    }));

    // Show result
    const isJackpot = finalSymbols[0] === 0 && finalSymbols[1] === 0 && finalSymbols[2] === 0;
    if (winAmount > 0) {
      setLastWin(winAmount);
      setShowResult({
        type: isJackpot ? 'jackpot' : 'win',
        amount: winAmount,
        symbols: finalSymbols
      });
    } else {
      setShowResult({
        type: 'loss',
        amount: betAmount,
        symbols: finalSymbols
      });
    }

    setIsSpinning(false);
  };

  const getButtonText = () => {
    if (isSpinning) return 'Spinning...';
    if (!isDemoMode && !isWalletConnected) return 'CONNECT WALLET TO PLAY';
    if (!isDemoMode && pendingSpinId && blocksRemaining > 0) return `Wait ${blocksRemaining} blocks...`;
    if (!isDemoMode && pendingSpinId && blocksRemaining === 0) return 'REVEAL RESULT';
    return `SPIN - ${betAmount} tickets`;
  };

  const handleClick = () => {
    if (isDemoMode) {
      handleDemoSpin();
    } else if (pendingSpinId && blocksRemaining === 0) {
      handleReveal();
    } else if (!pendingSpinId) {
      handleSpin();
    }
  };

  // Disable spin if: spinning, waiting for blocks, OR in real mode without wallet connected
  const isDisabled = isSpinning ||
    (!isDemoMode && pendingSpinId && blocksRemaining > 0) ||
    (!isDemoMode && !isWalletConnected);

  const dismissResult = () => setShowResult(null);

  // Check if user needs tickets (either mode)
  const needsTickets = currentBalance <= 0;

  return (
    <div className="slots-page">
      {/* Need Tickets Overlay */}
      {needsTickets && <NeedTickets gameName="SUITRUMP Slots" isWalletConnected={isWalletConnected} />}

      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="demo-mode-banner">
          <span className="demo-icon">🎮</span>
          <span className="demo-text">
            <strong>FREE PLAY MODE</strong> - Practice with {demoBalance.toLocaleString()} tickets. No wallet needed!
          </span>
        </div>
      )}

      {/* Real Mode - Not Connected Banner */}
      {!isDemoMode && !isWalletConnected && (
        <div className="connect-wallet-banner">
          <span className="wallet-icon">🔗</span>
          <span className="wallet-text">
            <strong>TESTNET MODE</strong> - Connect your Sui wallet to play with test tokens
          </span>
          <ConnectButton />
        </div>
      )}

      {/* Real Mode - Connected Banner */}
      {!isDemoMode && isWalletConnected && (
        <div className="testnet-mode-banner">
          <span className="testnet-icon">🧪</span>
          <span className="testnet-text">
            <strong>TESTNET MODE</strong> - Playing with TEST_SUITRUMP on {CURRENT_NETWORK}
          </span>
          <span className="wallet-address">
            {account?.address?.slice(0, 6)}...{account?.address?.slice(-4)}
          </span>
        </div>
      )}

      {/* Result Notification Overlay */}
      {showResult && (
        <div className={`result-overlay ${showResult.type}`} onClick={dismissResult}>
          <div className="result-modal" onClick={e => e.stopPropagation()}>
            {showResult.type === 'jackpot' && (
              <>
                <div className="result-banner jackpot-banner">🎰 JACKPOT! 🎰</div>
                <div className="result-symbols">
                  {showResult.symbols.map((s, i) => (
                    <span key={i} className="result-symbol jackpot-symbol">{renderSymbol(s)}</span>
                  ))}
                </div>
                <div className="result-amount jackpot-amount">+{showResult.amount.toLocaleString()} tickets</div>
                <div className="result-subtitle">{isDemoMode ? 'Demo jackpot!' : 'You hit the progressive jackpot!'}</div>
              </>
            )}
            {showResult.type === 'win' && (
              <>
                <div className="result-banner win-banner">🎉 WINNER! 🎉</div>
                <div className="result-symbols">
                  {showResult.symbols.map((s, i) => (
                    <span key={i} className="result-symbol">{renderSymbol(s)}</span>
                  ))}
                </div>
                <div className="result-amount win-amount">+{showResult.amount.toLocaleString()} tickets</div>
              </>
            )}
            {showResult.type === 'loss' && (
              <>
                <div className="result-banner loss-banner">No Match</div>
                <div className="result-symbols">
                  {showResult.symbols.map((s, i) => (
                    <span key={i} className="result-symbol">{renderSymbol(s)}</span>
                  ))}
                </div>
                <div className="result-amount loss-amount">-{showResult.amount} tickets</div>
                <div className="result-subtitle">Better luck next spin!</div>
              </>
            )}
            <button className="result-btn" onClick={dismissResult}>
              {showResult.type === 'loss' ? 'Try Again' : 'Continue'}
            </button>
          </div>
        </div>
      )}

      <div className="slots-header">
        <div className="slots-title">
          <span className="slots-icon">🎰</span>
          <div>
            <h2>SUITRUMP Slots</h2>
            <p>{isDemoMode ? 'FREE PLAY | Demo Mode' : 'Provably Fair | 3-Reel Classic'}</p>
          </div>
        </div>
        <div className="slots-balance">
          <span className="balance-label">
            {isDemoMode ? 'Demo Balance' : 'Ticket Balance'}
          </span>
          <span className="balance-value" style={isDemoMode ? { color: '#c4b5fd' } : {}}>
            {gameWallet.isLoadingBalance ? '...' : currentBalance.toLocaleString()} tickets
          </span>
        </div>
      </div>

      {!isDemoMode && (
        <div className="contract-stats">
          <div className="stat-box">
            <span className="stat-label">House Reserve</span>
            <span className="stat-value">{houseReserve} tickets</span>
          </div>
          <div className="stat-box jackpot">
            <span className="stat-label">Jackpot Pool</span>
            <span className="stat-value">{jackpotPool} tickets</span>
            <span className="jackpot-hint"><img src="/suitrump-mascot.png" alt="SUIT" className="jackpot-hint-img" /><img src="/suitrump-mascot.png" alt="SUIT" className="jackpot-hint-img" /><img src="/suitrump-mascot.png" alt="SUIT" className="jackpot-hint-img" /> TO WIN</span>
          </div>
        </div>
      )}

      <div className="slots-game">
        <div className="slot-machine">
          <div className="reels-container">
            {reels.map((symbol, i) => (
              <div key={i} className={`reel ${animatingReels[i] ? 'spinning' : ''}`}>
                <div className="reel-symbol" style={{ color: SYMBOLS[symbol]?.color || '#fff' }}>
                  {renderSymbol(symbol)}
                </div>
              </div>
            ))}
          </div>
          <div className="payline-indicator">
            <span>→ PAYLINE ←</span>
          </div>
        </div>

        <div className="result-message">
          {isSpinning ? 'Spinning...' :
           pendingSpinId && blocksRemaining > 0 ? `Waiting ${blocksRemaining} blocks...` :
           pendingSpinId ? 'Click REVEAL!' :
           lastWin > 0 ? `Winner! +${lastWin} tickets` : 'Spin to play!'}
        </div>

        <div className="bet-section">
          <h3>Select Bet <span className="usd-hint">({betAmount} tickets = ${(betAmount * 0.10).toFixed(2)} USD)</span></h3>
          <div className="bet-presets">
            {BET_PRESETS.map(preset => (
              <button
                key={preset}
                className={`bet-btn ${betAmount === preset ? 'selected' : ''}`}
                onClick={() => setBetAmount(preset)}
                disabled={!!pendingSpinId || isSpinning}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <button
          className={`spin-btn ${pendingSpinId && blocksRemaining === 0 ? 'reveal' : ''}`}
          onClick={handleClick}
          disabled={isDisabled}
        >
          🎰 {getButtonText()}
        </button>

        {error && <div className="error-message">{error}</div>}
      </div>

      <div className="slots-info-grid">
        <div className="info-panel">
          <h3>Payouts</h3>
          <div className="payout-list">
            <div className="payout-row jackpot"><span className="payout-symbols"><img src="/suitrump-mascot.png" alt="SUIT" className="payout-img" /><img src="/suitrump-mascot.png" alt="SUIT" className="payout-img" /><img src="/suitrump-mascot.png" alt="SUIT" className="payout-img" /></span><span>50x</span></div>
            <div className="payout-row"><span>💎💎💎</span><span>25x</span></div>
            <div className="payout-row"><span>🎰🎰🎰</span><span>15x</span></div>
            <div className="payout-row"><span>🔥🔥🔥</span><span>10x</span></div>
            <div className="payout-row"><span>🍀🍀🍀</span><span>8x</span></div>
            <div className="payout-row"><span>⭐⭐⭐</span><span>5x</span></div>
            <div className="payout-row"><span>XX_</span><span>1.5x</span></div>
          </div>
        </div>

        <div className="info-panel">
          <h3>{isDemoMode ? 'Demo Stats' : 'Your Stats'}</h3>
          <div className="stats-list">
            <div className="stat-row"><span>Total Spins</span><span>{isDemoMode ? demoStats.totalSpins : stats.totalSpins}</span></div>
            <div className="stat-row"><span>Total Wagered</span><span>{isDemoMode ? demoStats.totalWagered.toFixed(2) : stats.totalWagered} tickets</span></div>
            <div className="stat-row"><span>Total Won</span><span>{isDemoMode ? demoStats.totalWon.toFixed(2) : stats.totalWon} tickets</span></div>
            <div className="stat-row highlight"><span>Biggest Win</span><span>{isDemoMode ? demoStats.biggestWin.toFixed(2) : stats.biggestWin} tickets</span></div>
          </div>
        </div>

        <div className="info-panel">
          <h3>With {betAmount} ticket bet</h3>
          <div className="potential-list">
            <div className="potential-row jackpot"><span className="payout-symbols"><img src="/suitrump-mascot.png" alt="SUIT" className="payout-img" /><img src="/suitrump-mascot.png" alt="SUIT" className="payout-img" /><img src="/suitrump-mascot.png" alt="SUIT" className="payout-img" /> Jackpot</span><span>{betAmount * 50} tickets</span></div>
            <div className="potential-row"><span>💎💎💎 Diamond</span><span>{betAmount * 25} tickets</span></div>
            <div className="potential-row"><span>🎰🎰🎰 Seven</span><span>{betAmount * 15} tickets</span></div>
            <div className="potential-row"><span>2-Match</span><span>{betAmount * 1.5} tickets</span></div>
          </div>
        </div>
      </div>

      <style>{`
        .slots-page { width: 100%; }

        /* Mode Banners */
        .connect-wallet-banner, .testnet-mode-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 20px;
          border-radius: 12px;
          margin-bottom: 20px;
        }
        .connect-wallet-banner {
          background: linear-gradient(135deg, #1e3a5f, #0f172a);
          border: 2px solid #3b82f6;
        }
        .testnet-mode-banner {
          background: linear-gradient(135deg, #3d1f5c, #1e1b4b);
          border: 2px solid #8b5cf6;
        }
        .wallet-icon, .testnet-icon { font-size: 1.5rem; }
        .wallet-text, .testnet-text { flex: 1; color: #e2e8f0; font-size: 0.9rem; }
        .wallet-address {
          background: rgba(139, 92, 246, 0.2);
          padding: 6px 12px;
          border-radius: 8px;
          color: #a78bfa;
          font-family: monospace;
          font-size: 0.85rem;
        }
        .connect-btn {
          padding: 8px 20px;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .connect-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        /* Style the dapp-kit ConnectButton to be blue */
        .connect-wallet-banner [data-dapp-kit],
        .connect-wallet-banner button {
          background: linear-gradient(135deg, #3b82f6, #2563eb) !important;
          border: none !important;
          color: white !important;
          font-weight: 600 !important;
          border-radius: 8px !important;
          padding: 8px 20px !important;
        }
        .connect-wallet-banner [data-dapp-kit]:hover,
        .connect-wallet-banner button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }
        .slots-header { display: flex; justify-content: space-between; align-items: center; padding: 20px; background: linear-gradient(135deg, #1e293b, #0f172a); border-radius: 16px; margin-bottom: 20px; border: 2px solid #2563eb; }
        .slots-title { display: flex; align-items: center; gap: 12px; }
        .slots-icon { font-size: 2.5rem; }
        .slots-title h2 { margin: 0; color: #f8fafc; }
        .slots-title p { margin: 0; color: #94a3b8; font-size: 0.85rem; }
        .slots-balance { text-align: right; }
        .balance-label { display: block; color: #94a3b8; font-size: 0.85rem; }
        .balance-value { color: #3b82f6; font-size: 1.25rem; font-weight: 700; }
        .contract-stats { display: flex; gap: 16px; margin-bottom: 20px; }
        .stat-box { flex: 1; background: linear-gradient(135deg, #1e293b, #0f172a); border-radius: 12px; padding: 16px; text-align: center; border: 2px solid #2563eb; }
        .stat-box.jackpot { background: linear-gradient(135deg, #422006, #78350f); border: 1px solid #f59e0b; }
        .stat-label { display: block; color: #94a3b8; font-size: 0.85rem; margin-bottom: 4px; }
        .stat-value { color: #f8fafc; font-size: 1.25rem; font-weight: 700; }
        .stat-box.jackpot .stat-value { color: #fbbf24; }
        .jackpot-hint { display: block; font-size: 0.75rem; color: #f59e0b; margin-top: 4px; opacity: 0.9; }
        .slots-game { background: linear-gradient(135deg, #1e293b, #0f172a); border-radius: 16px; padding: 30px; margin-bottom: 20px; border: 2px solid #2563eb; }
        .slot-machine { background: linear-gradient(180deg, #0f172a, #1e293b); border-radius: 16px; padding: 30px; border: 2px solid #2563eb; }
        .reels-container { display: flex; justify-content: center; gap: 20px; margin-bottom: 15px; }
        .reel { width: 100px; height: 100px; background: linear-gradient(180deg, #0f172a, #1e293b); border-radius: 12px; border: 2px solid #2563eb; display: flex; align-items: center; justify-content: center; }
        .reel.spinning { animation: reelSpin 0.1s infinite; border-color: #3b82f6; box-shadow: 0 0 20px rgba(59,130,246,0.5); }
        @keyframes reelSpin { 0%,100% { transform: translateY(-2px); } 50% { transform: translateY(2px); } }
        .reel-symbol { font-size: 3rem; text-shadow: 0 0 10px currentColor; display: flex; align-items: center; justify-content: center; }
        .symbol-img { width: 60px; height: 60px; object-fit: contain; filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.6)); }
        .payout-img { width: 20px; height: 20px; object-fit: contain; vertical-align: middle; }
        .payout-symbols { display: inline-flex; align-items: center; gap: 2px; }
        .jackpot-hint-img { width: 14px; height: 14px; object-fit: contain; vertical-align: middle; }
        .payline-indicator { text-align: center; color: #fbbf24; font-size: 0.8rem; font-weight: 600; }
        .result-message { text-align: center; margin: 20px 0; font-size: 1.5rem; color: #94a3b8; min-height: 40px; }
        .bet-section { margin: 20px 0; text-align: center; }
        .bet-section h3 { color: #f8fafc; margin-bottom: 10px; }
        .bet-presets { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
        .bet-btn { padding: 10px 20px; background: #334155; border: 2px solid #475569; border-radius: 8px; color: #f8fafc; font-weight: 600; cursor: pointer; }
        .bet-btn:hover:not(:disabled) { background: #475569; border-color: #3b82f6; }
        .bet-btn.selected { background: #3b82f6; border-color: #3b82f6; }
        .bet-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .spin-btn { width: 100%; max-width: 300px; padding: 16px 32px; font-size: 1.25rem; font-weight: 700; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; border-radius: 12px; cursor: pointer; display: block; margin: 20px auto 0; }
        .spin-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(59,130,246,0.4); }
        .spin-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .spin-btn.reveal { background: linear-gradient(135deg, #3b82f6, #0284c7); animation: revealPulse 1s infinite; }
        @keyframes revealPulse { 0%,100% { box-shadow: 0 0 20px rgba(34,197,94,0.5); } 50% { box-shadow: 0 0 40px rgba(34,197,94,0.8); } }
        .error-message { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; padding: 12px; border-radius: 8px; margin-top: 15px; text-align: center; }
        .slots-info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
        .info-panel { background: linear-gradient(135deg, #1e293b, #0f172a); border-radius: 12px; padding: 20px; border: 2px solid #2563eb; }
        .info-panel h3 { color: #f8fafc; margin: 0 0 15px 0; font-size: 1rem; border-bottom: 1px solid #334155; padding-bottom: 10px; }
        .payout-list, .stats-list, .potential-list { display: flex; flex-direction: column; gap: 8px; }
        .payout-row, .stat-row, .potential-row { display: flex; justify-content: space-between; color: #94a3b8; font-size: 0.9rem; }
        .payout-row.jackpot, .potential-row.jackpot { color: #fbbf24; font-weight: 600; }
        .stat-row.highlight { color: #3b82f6; font-weight: 600; }

        /* Result Overlay Styles */
        .result-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .result-modal {
          background: linear-gradient(135deg, #1e293b, #0f172a);
          border-radius: 24px;
          padding: 40px;
          text-align: center;
          min-width: 320px;
          max-width: 90vw;
          animation: modalSlideIn 0.4s ease;
          border: 2px solid rgba(59, 130, 246, 0.5);
        }
        @keyframes modalSlideIn { from { transform: scale(0.8) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }

        .result-overlay.jackpot .result-modal {
          border-color: #fbbf24;
          box-shadow: 0 0 60px rgba(251, 191, 36, 0.5), 0 0 120px rgba(251, 191, 36, 0.3);
          animation: modalSlideIn 0.4s ease, jackpotGlow 1s ease infinite alternate;
        }
        @keyframes jackpotGlow { from { box-shadow: 0 0 60px rgba(251, 191, 36, 0.5); } to { box-shadow: 0 0 100px rgba(251, 191, 36, 0.8); } }

        .result-overlay.win .result-modal {
          border-color: #3b82f6;
          box-shadow: 0 0 40px rgba(56, 189, 248, 0.4);
        }

        .result-overlay.loss .result-modal {
          border-color: #64748b;
        }

        .result-banner {
          font-size: 2rem;
          font-weight: 800;
          margin-bottom: 20px;
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        .jackpot-banner { color: #fbbf24; animation: jackpotPulse 0.5s ease infinite alternate; }
        @keyframes jackpotPulse { from { transform: scale(1); } to { transform: scale(1.05); } }
        .win-banner { color: #3b82f6; }
        .loss-banner { color: #94a3b8; font-size: 1.5rem; }

        .result-symbols {
          display: flex;
          justify-content: center;
          gap: 15px;
          margin: 25px 0;
        }
        .result-symbol {
          font-size: 4rem;
          animation: symbolBounce 0.5s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .result-symbol .symbol-img {
          width: 80px;
          height: 80px;
        }
        .result-symbol:nth-child(1) { animation-delay: 0s; }
        .result-symbol:nth-child(2) { animation-delay: 0.1s; }
        .result-symbol:nth-child(3) { animation-delay: 0.2s; }
        @keyframes symbolBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }

        .jackpot-symbol { animation: symbolBounce 0.5s ease, jackpotSymbolGlow 1s ease infinite alternate; }
        @keyframes jackpotSymbolGlow { from { text-shadow: 0 0 20px #fbbf24; } to { text-shadow: 0 0 40px #fbbf24, 0 0 60px #f59e0b; } }

        .result-amount {
          font-size: 2.5rem;
          font-weight: 800;
          margin: 20px 0 10px;
        }
        .jackpot-amount { color: #fbbf24; font-size: 3rem; }
        .win-amount { color: #3b82f6; }
        .loss-amount { color: #ef4444; font-size: 1.75rem; }

        .result-subtitle {
          color: #94a3b8;
          font-size: 1rem;
          margin-bottom: 10px;
        }

        .result-btn {
          margin-top: 25px;
          padding: 14px 40px;
          font-size: 1.1rem;
          font-weight: 700;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .result-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(59, 130, 246, 0.4);
        }
        .result-overlay.jackpot .result-btn {
          background: linear-gradient(135deg, #f59e0b, #d97706);
        }
        .result-overlay.win .result-btn {
          background: linear-gradient(135deg, #3b82f6, #0284c7);
        }

        @media (max-width: 600px) {
          .slots-header { flex-direction: column; gap: 15px; text-align: center; }
          .contract-stats { flex-direction: column; }
          .reel { width: 80px; height: 80px; }
          .reel-symbol { font-size: 2.5rem; }
          .symbol-img { width: 50px; height: 50px; }
          .result-modal { padding: 25px; min-width: 280px; }
          .result-banner { font-size: 1.5rem; }
          .result-symbol { font-size: 3rem; }
          .result-symbol .symbol-img { width: 60px; height: 60px; }
          .result-amount { font-size: 2rem; }
          .jackpot-amount { font-size: 2.25rem; }
        }
      `}</style>
    </div>
  );
}

export default SlotsPage;
