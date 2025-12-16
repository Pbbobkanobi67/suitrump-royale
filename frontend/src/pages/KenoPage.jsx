import React, { useState, useCallback } from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { useDemoContext } from '../contexts/DemoContext';
import { useGameWallet } from '../hooks/useGameWallet';
import NeedTickets from '../components/NeedTickets';
import { CURRENT_NETWORK, getContract } from '../config/sui-config';

// Get keno contract address (null until deployed)
const KENO_CONTRACT = getContract('keno');

// Payout tables based on number of picks
const PAYOUT_TABLES = {
  1: { 1: 3.5 },
  2: { 1: 1, 2: 9 },
  3: { 2: 2, 3: 25 },
  4: { 2: 1, 3: 5, 4: 50 },
  5: { 2: 1, 3: 2, 4: 10, 5: 100 }
};

const MAX_PAYOUTS = [
  { picks: 1, maxWin: '3.5x' },
  { picks: 2, maxWin: '9x' },
  { picks: 3, maxWin: '25x' },
  { picks: 4, maxWin: '50x' },
  { picks: 5, maxWin: '100x' }
];

const BET_OPTIONS = [1, 5, 10, 25, 50, 100, 500];
const GRID_SIZE = 40;
const MAX_PICKS = 5;
const DRAW_COUNT = 10;

function KenoPage() {
  const gameWallet = useGameWallet();
  const { isDemoMode, demoBalance, setDemoBalance, realTickets, setRealTickets } = useDemoContext();
  const account = useCurrentAccount();
  const isWalletConnected = !!account;
  const [selectedNumbers, setSelectedNumbers] = useState(new Set());
  const [drawnNumbers, setDrawnNumbers] = useState(new Set());
  const [betAmount, setBetAmount] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [sessionStats, setSessionStats] = useState({
    gamesPlayed: 0,
    totalBet: 0,
    totalWon: 0
  });

  // Current balance based on mode
  const currentBalance = isDemoMode ? demoBalance : realTickets;

  // Check if user needs tickets
  const needsTickets = currentBalance <= 0;

  // Toggle number selection
  const toggleNumber = useCallback((num) => {
    if (isDrawing) return;
    if (drawnNumbers.size > 0) {
      // Clear previous draw if starting new selection
      setDrawnNumbers(new Set());
      setLastResult(null);
    }

    setSelectedNumbers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(num)) {
        newSet.delete(num);
      } else if (newSet.size < MAX_PICKS) {
        newSet.add(num);
      }
      return newSet;
    });
  }, [isDrawing, drawnNumbers.size]);

  // Quick pick random numbers
  const quickPick = useCallback(() => {
    if (isDrawing) return;
    setDrawnNumbers(new Set());
    setLastResult(null);

    const numbers = new Set();
    while (numbers.size < MAX_PICKS) {
      numbers.add(Math.floor(Math.random() * GRID_SIZE) + 1);
    }
    setSelectedNumbers(numbers);
  }, [isDrawing]);

  // Clear selections
  const clearSelection = useCallback(() => {
    if (isDrawing) return;
    setSelectedNumbers(new Set());
    setDrawnNumbers(new Set());
    setLastResult(null);
  }, [isDrawing]);

  // Draw numbers
  const draw = useCallback(async () => {
    if (selectedNumbers.size === 0 || isDrawing) return;

    // Check balance based on mode
    if (isDemoMode) {
      if (betAmount > demoBalance) {
        alert('Insufficient demo balance! Visit the Cashier to get more tickets.');
        return;
      }
      // Deduct bet amount
      setDemoBalance(prev => prev - betAmount);
    } else {
      // Real mode
      if (!isWalletConnected) {
        alert('Please connect your wallet to play');
        return;
      }
      if (betAmount > realTickets) {
        alert('Insufficient ticket balance! Buy tickets at the Cashier.');
        return;
      }
      // Deduct bet amount from real tickets
      setRealTickets(prev => prev - betAmount);
    }

    setIsDrawing(true);
    setDrawnNumbers(new Set());

    // Simulate drawing with animation
    const drawn = new Set();
    const drawSequence = [];

    while (drawn.size < DRAW_COUNT) {
      const num = Math.floor(Math.random() * GRID_SIZE) + 1;
      if (!drawn.has(num)) {
        drawn.add(num);
        drawSequence.push(num);
      }
    }

    // Animate drawing one by one
    for (let i = 0; i < drawSequence.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 150));
      setDrawnNumbers(prev => new Set([...prev, drawSequence[i]]));
    }

    // Calculate matches and payout
    const matches = [...selectedNumbers].filter(n => drawn.has(n)).length;
    const pickCount = selectedNumbers.size;
    const payoutTable = PAYOUT_TABLES[pickCount] || {};
    const multiplier = payoutTable[matches] || 0;
    const winAmount = betAmount * multiplier;

    // Credit winnings based on mode
    if (winAmount > 0) {
      if (isDemoMode) {
        setDemoBalance(prev => prev + winAmount);
      } else {
        setRealTickets(prev => prev + winAmount);
      }
    }

    setLastResult({
      matches,
      picks: pickCount,
      multiplier,
      winAmount,
      isWin: winAmount > 0
    });

    setSessionStats(prev => ({
      gamesPlayed: prev.gamesPlayed + 1,
      totalBet: prev.totalBet + betAmount,
      totalWon: prev.totalWon + winAmount
    }));

    setIsDrawing(false);
  }, [selectedNumbers, betAmount, isDrawing, isDemoMode, demoBalance, setDemoBalance, realTickets, setRealTickets, isWalletConnected]);

  // Get current payout table based on picks
  const currentPayouts = PAYOUT_TABLES[selectedNumbers.size] || {};

  // Get number state for styling
  const getNumberState = (num) => {
    const isSelected = selectedNumbers.has(num);
    const isDrawn = drawnNumbers.has(num);
    const isMatch = isSelected && isDrawn;

    if (isMatch) return 'match';
    if (isDrawn) return 'drawn';
    if (isSelected) return 'selected';
    return 'default';
  };

  // Check if number is a match (selected AND drawn) - shows Trump mascot
  const isMatch = (num) => selectedNumbers.has(num) && drawnNumbers.has(num);

  return (
    <div className="keno-page">
      {/* Need Tickets Overlay */}
      {needsTickets && <NeedTickets gameName="SUITRUMP Keno" isWalletConnected={isWalletConnected} />}

      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="demo-mode-banner">
          <span className="demo-icon">🎮</span>
          <span className="demo-text">
            <strong>FREE PLAY MODE</strong> - {demoBalance > 0 ? `${demoBalance.toLocaleString()} tickets available` : 'Get tickets at Cashier!'}
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

      <div className="keno-header">
        <h2>SUITRUMP Keno</h2>
        <p className="keno-subtitle">Pick your lucky numbers and watch the draw reveal your fortune!</p>
      </div>

      <div className="keno-main">
        <div className="keno-grid-container">
          <div className="keno-board-header">
            <div className="keno-balance">
              <span className="balance-label">{isDemoMode ? 'Demo Balance' : 'Ticket Balance'}</span>
              <span className="balance-value" style={isDemoMode ? { color: '#c4b5fd' } : {}}>{currentBalance.toLocaleString()} tickets</span>
            </div>

            <div className="keno-bet-selector">
              <span className="bet-label">Bet: <span className="usd-hint">(${(betAmount * 0.10).toFixed(2)} USD)</span></span>
              {BET_OPTIONS.map(amount => (
                <button
                  key={amount}
                  className={`bet-option ${betAmount === amount ? 'active' : ''}`}
                  onClick={() => setBetAmount(amount)}
                  disabled={isDrawing}
                >
                  {amount}
                </button>
              ))}
            </div>
          </div>

          <div className="keno-grid">
            {Array.from({ length: GRID_SIZE }, (_, i) => i + 1).map(num => (
              <button
                key={num}
                className={`keno-number ${getNumberState(num)}`}
                onClick={() => toggleNumber(num)}
                disabled={isDrawing}
              >
                {isMatch(num) ? (
                  <img
                    src="/suitrump-mascot.png"
                    alt="SUIT"
                    className="keno-whale-icon"
                  />
                ) : (
                  num
                )}
              </button>
            ))}
          </div>

          <div className="keno-action-buttons">
            <button
              className="btn btn-secondary keno-btn"
              onClick={quickPick}
              disabled={isDrawing}
            >
              Quick Pick ({MAX_PICKS})
            </button>
            <button
              className="btn btn-outline keno-btn"
              onClick={clearSelection}
              disabled={isDrawing}
            >
              Clear
            </button>
            <button
              className={`btn btn-primary keno-btn draw-btn ${isDrawing ? 'drawing' : ''}`}
              onClick={draw}
              disabled={selectedNumbers.size === 0 || isDrawing}
            >
              {isDrawing ? 'Drawing...' : `DRAW (${selectedNumbers.size}/${MAX_PICKS})`}
            </button>
          </div>
        </div>

        <div className="keno-side-panels">
          <div className="keno-panel payouts-panel">
            <h4>Payouts ({selectedNumbers.size || '-'} picks)</h4>
            {selectedNumbers.size > 0 ? (
              <div className="payout-list">
                {Object.entries(currentPayouts).map(([matches, mult]) => (
                  <div key={matches} className="payout-row">
                    <span>{matches} match{matches > 1 ? 'es' : ''}</span>
                    <span className="payout-mult">{mult}x</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="payout-hint">Select 1-5 numbers</p>
            )}
          </div>

          <div className="keno-panel result-panel">
            <h4>Result</h4>
            {lastResult ? (
              <div className={`keno-result-display ${lastResult.isWin ? 'win' : 'loss'}`}>
                <div className="keno-result-matches">
                  {lastResult.matches}
                </div>
                <div className="keno-result-label">
                  {lastResult.matches === 1 ? 'Match' : 'Matches'}
                </div>
                {lastResult.isWin ? (
                  <div className="keno-result-win">+{lastResult.winAmount} tickets</div>
                ) : (
                  <div className="keno-result-lose">Try again!</div>
                )}
              </div>
            ) : (
              <div className="keno-result-placeholder">
                <img src="/suitrump-mascot.png" alt="SUIT" className="placeholder-whale" />
                <span>Pick and draw!</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="keno-info-section">
        <div className="keno-info-card">
          <h4>Session Stats</h4>
          <div className="stats-list">
            <div className="stat-row">
              <span>Games Played</span>
              <span>{sessionStats.gamesPlayed}</span>
            </div>
            <div className="stat-row">
              <span>Total Bet</span>
              <span>{sessionStats.totalBet}</span>
            </div>
            <div className="stat-row">
              <span>Total Won</span>
              <span>{sessionStats.totalWon}</span>
            </div>
            <div className="stat-row net-profit">
              <span>Net Profit</span>
              <span className={sessionStats.totalWon - sessionStats.totalBet >= 0 ? 'positive' : 'negative'}>
                {sessionStats.totalWon - sessionStats.totalBet}
              </span>
            </div>
          </div>
        </div>

        <div className="keno-info-card">
          <h4>How to Play</h4>
          <ol className="how-to-list">
            <li>Pick 1-5 numbers from the grid</li>
            <li>Choose your bet amount</li>
            <li>Click DRAW to reveal 10 winning numbers</li>
            <li>Match numbers to win up to 100x!</li>
          </ol>
        </div>

        <div className="keno-info-card">
          <h4>Max Payouts</h4>
          <div className="max-payouts-table">
            <div className="max-payout-header">
              <span>Picks</span>
              <span>Max Win</span>
            </div>
            {MAX_PAYOUTS.map(({ picks, maxWin }) => (
              <div key={picks} className="max-payout-row">
                <span>{picks} {picks === 1 ? 'number' : 'numbers'}</span>
                <span className="max-win">{maxWin}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default KenoPage;
