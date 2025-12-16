import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { useDemoContext } from '../contexts/DemoContext';
import { useGameWallet } from '../hooks/useGameWallet';
import NeedTickets from '../components/NeedTickets';
import { CURRENT_NETWORK, getContract } from '../config/sui-config';

// Get roulette contract address (null until deployed)
const ROULETTE_CONTRACT = getContract('roulette');

// Roulette numbers in wheel order (European single-zero)
const WHEEL_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

// Red numbers
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

// Get color for a number
const getNumberColor = (num) => {
  if (num === 0) return 'green';
  return RED_NUMBERS.includes(num) ? 'red' : 'black';
};

// Wheel dimensions - must match CSS .wheel-container (450px)
const WHEEL_SIZE = 450;
const WHEEL_CENTER = WHEEL_SIZE / 2; // 225px
const BALL_TRACK_RADIUS = 210; // Where ball travels during spin (outer track)
const POCKET_RADIUS = 200; // Where ball settles - aligned with outer ring numbers

// Bet types and their payouts
const BET_TYPES = {
  STRAIGHT: { name: 'Straight Up', payout: 35, description: 'Single number' },
  SPLIT: { name: 'Split', payout: 17, description: 'Two adjacent numbers' },
  RED: { name: 'Red', payout: 1, description: 'All red numbers' },
  BLACK: { name: 'Black', payout: 1, description: 'All black numbers' },
  ODD: { name: 'Odd', payout: 1, description: 'All odd numbers' },
  EVEN: { name: 'Even', payout: 1, description: 'All even numbers' },
  LOW: { name: '1-18', payout: 1, description: 'Numbers 1-18' },
  HIGH: { name: '19-36', payout: 1, description: 'Numbers 19-36' },
  DOZEN_1: { name: '1st 12', payout: 2, description: 'Numbers 1-12' },
  DOZEN_2: { name: '2nd 12', payout: 2, description: 'Numbers 13-24' },
  DOZEN_3: { name: '3rd 12', payout: 2, description: 'Numbers 25-36' },
  COLUMN_1: { name: 'Col 1', payout: 2, description: '1,4,7,10...' },
  COLUMN_2: { name: 'Col 2', payout: 2, description: '2,5,8,11...' },
  COLUMN_3: { name: 'Col 3', payout: 2, description: '3,6,9,12...' },
};

function RoulettePage() {
  const gameWallet = useGameWallet();
  const { isDemoMode, demoBalance, setDemoBalance, realTickets, setRealTickets } = useDemoContext();
  const account = useCurrentAccount();
  const isWalletConnected = !!account;
  const [selectedBets, setSelectedBets] = useState([]);
  const [betAmount, setBetAmount] = useState('10');
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [wheelRotation, setWheelRotation] = useState(0);
  const wheelRef = useRef(null);

  // Ball physics state
  const [ballPosition, setBallPosition] = useState({ x: WHEEL_CENTER, y: WHEEL_CENTER - BALL_TRACK_RADIUS });
  const [ballVisible, setBallVisible] = useState(false);
  const ballAngleRef = useRef(0);
  const ballSpeedRef = useRef(0);
  const ballRadiusRef = useRef(BALL_TRACK_RADIUS);
  const animationRef = useRef(null);
  const targetNumberRef = useRef(null);

  // Current balance based on mode
  const currentBalance = isDemoMode ? demoBalance : realTickets;
  const canPlay = isDemoMode || isWalletConnected;

  // Check if user needs tickets
  const needsTickets = currentBalance <= 0;

  // Check if a bet wins
  const checkBetWin = (bet, resultNumber) => {
    switch (bet.type) {
      case 'STRAIGHT':
        return bet.number === resultNumber;
      case 'RED':
        return resultNumber !== 0 && RED_NUMBERS.includes(resultNumber);
      case 'BLACK':
        return resultNumber !== 0 && !RED_NUMBERS.includes(resultNumber);
      case 'ODD':
        return resultNumber !== 0 && resultNumber % 2 === 1;
      case 'EVEN':
        return resultNumber !== 0 && resultNumber % 2 === 0;
      case 'LOW':
        return resultNumber >= 1 && resultNumber <= 18;
      case 'HIGH':
        return resultNumber >= 19 && resultNumber <= 36;
      case 'DOZEN_1':
        return resultNumber >= 1 && resultNumber <= 12;
      case 'DOZEN_2':
        return resultNumber >= 13 && resultNumber <= 24;
      case 'DOZEN_3':
        return resultNumber >= 25 && resultNumber <= 36;
      case 'COLUMN_1':
        return resultNumber !== 0 && resultNumber % 3 === 1;
      case 'COLUMN_2':
        return resultNumber !== 0 && resultNumber % 3 === 2;
      case 'COLUMN_3':
        return resultNumber !== 0 && resultNumber % 3 === 0;
      default:
        return false;
    }
  };

  // Add a bet
  const addBet = (type, number = null) => {
    if (spinning) return;

    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) return;

    if (amount > currentBalance) {
      alert(isDemoMode ? 'Insufficient demo balance!' : 'Insufficient ticket balance! Buy tickets at the Cashier.');
      return;
    }

    const existingBet = selectedBets.find(b => b.type === type && b.number === number);
    if (existingBet) {
      setSelectedBets(prev => prev.map(b =>
        b.type === type && b.number === number
          ? { ...b, amount: b.amount + amount }
          : b
      ));
    } else {
      setSelectedBets(prev => [...prev, { type, number, amount }]);
    }
  };

  // Remove a bet
  const removeBet = (index) => {
    if (spinning) return;
    setSelectedBets(prev => prev.filter((_, i) => i !== index));
  };

  // Clear all bets
  const clearBets = () => {
    if (spinning) return;
    setSelectedBets([]);
  };

  // Get total bet amount
  const getTotalBet = () => {
    return selectedBets.reduce((sum, bet) => sum + bet.amount, 0);
  };

  // Animate ball - spins clockwise, slows gradually, lands on winning number
  const animateBall = useCallback((landingAngle, duration, onComplete) => {
    // Convert landing angle to radians (CSS: 0=top, clockwise; Math: 0=right, counter-clockwise)
    const targetAngleRad = (landingAngle - 90) * (Math.PI / 180);

    const startTime = performance.now();

    // Ball spins clockwise (negative direction in math coordinates)
    // Start from a random position and calculate total rotation to land on target
    const fullSpins = 5 + Math.floor(Math.random() * 3); // 5-7 full rotations
    const startAngle = targetAngleRad + (fullSpins * Math.PI * 2); // Start ahead, spin down to target
    const totalRotation = fullSpins * Math.PI * 2; // Total radians to travel

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth deceleration - cubic ease out
      const easeOut = 1 - Math.pow(1 - progress, 3);

      // Current angle - starts at startAngle, ends at targetAngleRad
      // Ball moves clockwise (decreasing angle in math coords)
      const currentAngle = startAngle - (totalRotation * easeOut);

      // Radius drops gradually in the last 35% of animation
      let currentRadius;
      if (progress < 0.65) {
        currentRadius = BALL_TRACK_RADIUS;
      } else {
        const dropProgress = (progress - 0.65) / 0.35;
        const dropEase = Math.pow(dropProgress, 1.5);
        currentRadius = BALL_TRACK_RADIUS - (BALL_TRACK_RADIUS - POCKET_RADIUS) * dropEase;
      }

      // Add subtle wobble in the last 20% as ball settles
      let wobble = 0;
      if (progress > 0.8) {
        const wobbleProgress = (progress - 0.8) / 0.2;
        const decay = 1 - wobbleProgress;
        wobble = Math.sin(wobbleProgress * 8 * Math.PI) * decay * 0.03;
      }

      const finalAngle = currentAngle + wobble;
      const finalX = WHEEL_CENTER + Math.cos(finalAngle) * currentRadius;
      const finalY = WHEEL_CENTER + Math.sin(finalAngle) * currentRadius;

      setBallPosition({ x: finalX, y: finalY });

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Ensure exact final position
        setBallPosition({
          x: WHEEL_CENTER + Math.cos(targetAngleRad) * POCKET_RADIUS,
          y: WHEEL_CENTER + Math.sin(targetAngleRad) * POCKET_RADIUS
        });
        onComplete();
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, []);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Spin the wheel
  const spin = async () => {
    if (spinning || selectedBets.length === 0) return;

    const totalBet = getTotalBet();

    // Check balance and deduct based on mode
    if (isDemoMode) {
      if (totalBet > demoBalance) {
        alert('Insufficient demo balance!');
        return;
      }
      setDemoBalance(prev => prev - totalBet);
    } else {
      // Real mode
      if (!isWalletConnected) {
        alert('Please connect your wallet to play');
        return;
      }
      if (totalBet > realTickets) {
        alert('Insufficient ticket balance! Buy tickets at the Cashier.');
        return;
      }
      setRealTickets(prev => prev - totalBet);
    }

    setSpinning(true);
    setResult(null);
    setBallVisible(true);

    // Get winning number (will come from blockchain in production)
    const resultNumber = Math.floor(Math.random() * 37);
    targetNumberRef.current = resultNumber;

    // Find where this number is on the STATIC outer ring
    // Numbers are positioned at i * (360/37) degrees in CSS
    const winIndex = WHEEL_NUMBERS.indexOf(resultNumber);
    const degreesPerSegment = 360 / 37;
    const winningAngle = winIndex * degreesPerSegment;

    // Animation duration - slower for more realistic feel
    const spinDuration = 7000;

    // Inner wheel spins randomly (just visual, doesn't affect ball position)
    const fullSpins = 5 + Math.floor(Math.random() * 3);
    const randomExtra = Math.random() * 360;
    setWheelRotation(prev => prev + fullSpins * 360 + randomExtra);

    // Ball lands at the winning number's FIXED position on the static outer ring
    await new Promise(resolve => {
      animateBall(winningAngle, spinDuration, resolve);
    });

    let totalWinnings = 0;
    const betResults = selectedBets.map(bet => {
      const won = checkBetWin(bet, resultNumber);
      const payout = won ? bet.amount * (BET_TYPES[bet.type].payout + 1) : 0;
      if (won) totalWinnings += payout;
      return { ...bet, won, payout };
    });

    // Credit winnings based on mode
    if (totalWinnings > 0) {
      if (isDemoMode) {
        setDemoBalance(prev => prev + totalWinnings);
      } else {
        setRealTickets(prev => prev + totalWinnings);
      }
    }

    // Check if any bet won
    const anyWin = betResults.some(b => b.won);

    setResult({
      number: resultNumber,
      color: getNumberColor(resultNumber),
      betResults,
      totalWinnings,
      netProfit: totalWinnings - totalBet,
      anyWin
    });

    setHistory(prev => [{ number: resultNumber, color: getNumberColor(resultNumber) }, ...prev.slice(0, 19)]);

    setSpinning(false);
    setSelectedBets([]);
  };

  // Render roulette board number
  const renderBoardNumber = (num) => {
    const color = getNumberColor(num);
    const isSelected = selectedBets.some(b => b.type === 'STRAIGHT' && b.number === num);

    return (
      <button
        key={num}
        className={`roulette-number ${color} ${isSelected ? 'selected' : ''}`}
        onClick={() => addBet('STRAIGHT', num)}
        disabled={spinning}
      >
        {num}
      </button>
    );
  };

  return (
    <div className="roulette-page">
      {/* Need Tickets Overlay */}
      {needsTickets && <NeedTickets gameName="SUITRUMP Roulette" isWalletConnected={isWalletConnected} />}

      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="demo-mode-banner">
          <span className="demo-icon">🎮</span>
          <span className="demo-text">
            <strong>FREE PLAY MODE</strong> - Demo Balance: {demoBalance.toLocaleString()} tickets
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

      {/* Wheel Section - Top, Centered */}
      <div className="roulette-wheel-section">
        <div className="wheel-area">
          <div className="wheel-container">
            <div className="wheel-outer-ring">
              {WHEEL_NUMBERS.map((num, i) => (
                <div
                  key={`outer-${num}`}
                  className={`outer-number ${getNumberColor(num)}`}
                  style={{
                    transform: `rotate(${i * (360 / 37)}deg)`
                  }}
                >
                  <span>{num}</span>
                </div>
              ))}
            </div>
            <div className="wheel-pointer">▼</div>
            <div
              className="roulette-wheel"
              ref={wheelRef}
              style={{ transform: `rotate(${wheelRotation}deg)` }}
            >
              {WHEEL_NUMBERS.map((num, i) => {
                const angle = i * (360 / 37);
                return (
                  <div
                    key={num}
                    className={`wheel-segment ${getNumberColor(num)}`}
                    style={{
                      transform: `rotate(${angle}deg)`
                    }}
                  >
                    <span className="segment-number">{num}</span>
                  </div>
                );
              })}
            </div>
            {/* Ball - always visible during and after spin */}
            {ballVisible && (
              <div
                className={`roulette-ball-animated ${!spinning && result ? 'settled' : ''}`}
                style={{
                  left: ballPosition.x - 8,
                  top: ballPosition.y - 8
                }}
              />
            )}
            <div className="wheel-center">
              {result ? (
                <div className={`result-display ${result.color}`}>
                  <span className="result-number">{result.number}</span>
                </div>
              ) : (
                <img src="/suitrump-mascot.png" alt="SUIT" className="wheel-mascot" />
              )}
            </div>
          </div>

          {/* Result & History Panel */}
          <div className="wheel-info-panel">
            {result ? (
              <div className={`result-card ${result.anyWin ? 'win' : 'lose'}`}>
                <div className="result-title">{result.anyWin ? '🎉 Winner!' : 'No luck'}</div>
                <div className={`result-number-large ${result.color}`}>{result.number}</div>
                {result.anyWin && (
                  <div className="result-winnings">
                    +{result.totalWinnings.toFixed(0)} tickets
                    {result.netProfit === 0 && <span className="break-even"> (break even)</span>}
                  </div>
                )}
              </div>
            ) : (
              <div className="result-card waiting">
                <div className="result-title">Place Your Bets</div>
                <div className="result-subtitle">Select chips and click numbers</div>
              </div>
            )}

            <div className="history-panel">
              <h4>History</h4>
              <div className="history-numbers">
                {history.length === 0 ? (
                  <span className="no-history">No spins yet</span>
                ) : (
                  history.slice(0, 10).map((h, i) => (
                    <span key={i} className={`history-number ${h.color}`}>
                      {h.number}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Betting Section - Horizontal Layout */}
      <div className="roulette-betting-section">
        {/* Top Row: Balance + Placed Bets + Chip Selector */}
        <div className="betting-controls-top">
          <div className="balance-display">
            <span className="balance-label">{isDemoMode ? 'Demo Balance' : 'Ticket Balance'}</span>
            <span className="balance-value" style={isDemoMode ? { color: '#c4b5fd' } : {}}>{currentBalance.toLocaleString()} tickets</span>
          </div>

          {/* Placed Bets - inline */}
          {selectedBets.length > 0 && (
            <div className="placed-bets-inline">
              {selectedBets.map((bet, i) => (
                <span key={i} className="bet-tag">
                  {BET_TYPES[bet.type].name}{bet.number !== null ? ` (${bet.number})` : ''}: {bet.amount}
                  <button onClick={() => removeBet(i)} disabled={spinning}>×</button>
                </span>
              ))}
              <button className="btn-clear-small" onClick={clearBets} disabled={spinning}>Clear</button>
            </div>
          )}

          <div className="chip-selector">
            <span className="chip-label">Chip:</span>
            {[5, 10, 25, 50, 100].map(amount => (
              <button
                key={amount}
                className={`chip ${betAmount === String(amount) ? 'selected' : ''}`}
                onClick={() => setBetAmount(String(amount))}
                disabled={spinning}
              >
                {amount}
              </button>
            ))}
          </div>
        </div>

        {/* Spin Button - Full Width */}
        <button
          className="btn btn-primary btn-spin btn-spin-full"
          onClick={spin}
          disabled={spinning || selectedBets.length === 0 || !canPlay}
        >
          {spinning ? 'Spinning...' : `SPIN (${getTotalBet()} tickets = $${(getTotalBet() * 0.10).toFixed(2)})`}
        </button>

        {/* Horizontal Betting Table */}
        <div className="betting-table-horizontal">
          {/* Left Outside Bets */}
          <div className="outside-column">
            <button className={`table-bet ${selectedBets.some(b => b.type === 'LOW') ? 'selected' : ''}`} onClick={() => addBet('LOW')} disabled={spinning}>1-18</button>
            <button className={`table-bet ${selectedBets.some(b => b.type === 'EVEN') ? 'selected' : ''}`} onClick={() => addBet('EVEN')} disabled={spinning}>EVEN</button>
            <button className={`table-bet red ${selectedBets.some(b => b.type === 'RED') ? 'selected' : ''}`} onClick={() => addBet('RED')} disabled={spinning}>RED</button>
          </div>

          {/* Main Number Grid */}
          <div className="number-grid-horizontal">
            <div className="zero-cell">{renderBoardNumber(0)}</div>
            <div className="numbers-rows">
              {[3, 2, 1].map(row => (
                <div key={row} className="number-row-h">
                  {[...Array(12)].map((_, col) => {
                    const num = col * 3 + row;
                    return renderBoardNumber(num);
                  })}
                  <button
                    className={`table-bet col-bet ${selectedBets.some(b => b.type === `COLUMN_${row}`) ? 'selected' : ''}`}
                    onClick={() => addBet(`COLUMN_${row}`)}
                    disabled={spinning}
                  >
                    2:1
                  </button>
                </div>
              ))}
            </div>
            <div className="dozen-row-h">
              <button className={`table-bet dozen ${selectedBets.some(b => b.type === 'DOZEN_1') ? 'selected' : ''}`} onClick={() => addBet('DOZEN_1')} disabled={spinning}>1st 12</button>
              <button className={`table-bet dozen ${selectedBets.some(b => b.type === 'DOZEN_2') ? 'selected' : ''}`} onClick={() => addBet('DOZEN_2')} disabled={spinning}>2nd 12</button>
              <button className={`table-bet dozen ${selectedBets.some(b => b.type === 'DOZEN_3') ? 'selected' : ''}`} onClick={() => addBet('DOZEN_3')} disabled={spinning}>3rd 12</button>
            </div>
          </div>

          {/* Right Outside Bets */}
          <div className="outside-column">
            <button className={`table-bet black ${selectedBets.some(b => b.type === 'BLACK') ? 'selected' : ''}`} onClick={() => addBet('BLACK')} disabled={spinning}>BLACK</button>
            <button className={`table-bet ${selectedBets.some(b => b.type === 'ODD') ? 'selected' : ''}`} onClick={() => addBet('ODD')} disabled={spinning}>ODD</button>
            <button className={`table-bet ${selectedBets.some(b => b.type === 'HIGH') ? 'selected' : ''}`} onClick={() => addBet('HIGH')} disabled={spinning}>19-36</button>
          </div>
        </div>

      </div>

      {/* How to Play */}
      <div className="card roulette-info">
        <h3>How to Play Roulette</h3>
        <div className="info-grid">
          <div className="info-item">
            <h4>Inside Bets</h4>
            <ul>
              <li><strong>Straight Up:</strong> Single number (35:1)</li>
            </ul>
          </div>
          <div className="info-item">
            <h4>Outside Bets</h4>
            <ul>
              <li><strong>Red/Black:</strong> Color bet (1:1)</li>
              <li><strong>Odd/Even:</strong> Parity bet (1:1)</li>
              <li><strong>1-18/19-36:</strong> High/Low (1:1)</li>
              <li><strong>Dozens:</strong> 12 numbers (2:1)</li>
              <li><strong>Columns:</strong> 12 numbers (2:1)</li>
            </ul>
          </div>
        </div>
        <p className="house-edge-note">European Roulette with single zero. House edge: 2.7%</p>
      </div>
    </div>
  );
}

export default RoulettePage;
