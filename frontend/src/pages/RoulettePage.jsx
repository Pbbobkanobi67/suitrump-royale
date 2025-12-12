import React, { useState, useEffect, useRef } from 'react';
import { useDemoContext } from '../contexts/DemoContext';

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

function RoulettePage({ wallet }) {
  const { isDemoMode, demoBalance, setDemoBalance } = useDemoContext();
  const [selectedBets, setSelectedBets] = useState([]);
  const [betAmount, setBetAmount] = useState('10');
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [wheelRotation, setWheelRotation] = useState(0);
  const wheelRef = useRef(null);

  const isConnected = wallet?.account && wallet?.isCorrectNetwork;
  const canPlay = isDemoMode || isConnected;

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

    if (isDemoMode && amount > demoBalance) {
      alert('Insufficient demo balance!');
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

  // Spin the wheel
  const spin = async () => {
    if (spinning || selectedBets.length === 0) return;

    const totalBet = getTotalBet();

    if (isDemoMode) {
      if (totalBet > demoBalance) {
        alert('Insufficient demo balance!');
        return;
      }
      setDemoBalance(prev => prev - totalBet);
    }

    setSpinning(true);
    setResult(null);

    const resultNumber = Math.floor(Math.random() * 37);
    const resultIndex = WHEEL_NUMBERS.indexOf(resultNumber);
    const degreesPerNumber = 360 / 37;
    const fullSpins = 5 + Math.floor(Math.random() * 3);
    const targetDegrees = fullSpins * 360 + (360 - resultIndex * degreesPerNumber);

    setWheelRotation(prev => prev + targetDegrees);

    await new Promise(resolve => setTimeout(resolve, 4000));

    let totalWinnings = 0;
    const betResults = selectedBets.map(bet => {
      const won = checkBetWin(bet, resultNumber);
      const payout = won ? bet.amount * (BET_TYPES[bet.type].payout + 1) : 0;
      if (won) totalWinnings += payout;
      return { ...bet, won, payout };
    });

    if (isDemoMode && totalWinnings > 0) {
      setDemoBalance(prev => prev + totalWinnings);
    }

    setResult({
      number: resultNumber,
      color: getNumberColor(resultNumber),
      betResults,
      totalWinnings,
      netProfit: totalWinnings - totalBet
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
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="demo-mode-banner">
          <span className="demo-icon">🎮</span>
          <span className="demo-text">
            <strong>FREE PLAY MODE</strong> - Demo Balance: {demoBalance.toLocaleString()} SUIT
          </span>
        </div>
      )}

      {/* Connect Wallet Banner */}
      {!isDemoMode && !isConnected && (
        <div className="connect-banner">
          <button className="btn btn-connect-banner" onClick={wallet?.connect}>
            Connect your wallet to play Roulette
          </button>
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
              {WHEEL_NUMBERS.map((num, i) => (
                <div
                  key={num}
                  className={`wheel-number ${getNumberColor(num)}`}
                  style={{
                    transform: `rotate(${i * (360 / 37)}deg) translateY(-140px)`
                  }}
                >
                  {num}
                </div>
              ))}
            </div>
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
              <div className={`result-card ${result.netProfit > 0 ? 'win' : 'lose'}`}>
                <div className="result-title">{result.netProfit > 0 ? '🎉 Winner!' : 'No luck'}</div>
                <div className={`result-number-large ${result.color}`}>{result.number}</div>
                {result.netProfit > 0 && (
                  <div className="result-winnings">+{result.totalWinnings.toFixed(0)} SUIT</div>
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
        {/* Controls Bar */}
        <div className="betting-controls">
          <div className="balance-display">
            <span className="balance-label">Balance</span>
            <span className="balance-value">{isDemoMode ? demoBalance.toLocaleString() : (wallet?.blueBalance || 0).toLocaleString()} SUIT</span>
          </div>

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

          <button
            className="btn btn-primary btn-spin"
            onClick={spin}
            disabled={spinning || selectedBets.length === 0 || !canPlay}
          >
            {spinning ? 'Spinning...' : `SPIN (${getTotalBet()} SUIT)`}
          </button>
        </div>

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

        {/* Current Bets */}
        {selectedBets.length > 0 && (
          <div className="current-bets-bar">
            <div className="bets-list">
              {selectedBets.map((bet, i) => (
                <span key={i} className="bet-tag">
                  {BET_TYPES[bet.type].name}{bet.number !== null ? ` (${bet.number})` : ''}: {bet.amount}
                  <button onClick={() => removeBet(i)} disabled={spinning}>×</button>
                </span>
              ))}
            </div>
            <button className="btn btn-outline" onClick={clearBets} disabled={spinning}>Clear</button>
          </div>
        )}
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
