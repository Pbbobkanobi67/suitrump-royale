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
  DOZEN_1: { name: '1st Dozen', payout: 2, description: 'Numbers 1-12' },
  DOZEN_2: { name: '2nd Dozen', payout: 2, description: 'Numbers 13-24' },
  DOZEN_3: { name: '3rd Dozen', payout: 2, description: 'Numbers 25-36' },
  COLUMN_1: { name: '1st Column', payout: 2, description: '1,4,7,10...' },
  COLUMN_2: { name: '2nd Column', payout: 2, description: '2,5,8,11...' },
  COLUMN_3: { name: '3rd Column', payout: 2, description: '3,6,9,12...' },
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
      // Increase existing bet
      setSelectedBets(prev => prev.map(b =>
        b.type === type && b.number === number
          ? { ...b, amount: b.amount + amount }
          : b
      ));
    } else {
      // Add new bet
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
      // Deduct bet
      setDemoBalance(prev => prev - totalBet);
    }

    setSpinning(true);
    setResult(null);

    // Generate random result (0-36)
    const resultNumber = Math.floor(Math.random() * 37);

    // Find position in wheel
    const resultIndex = WHEEL_NUMBERS.indexOf(resultNumber);
    const degreesPerNumber = 360 / 37;

    // Calculate rotation (multiple full spins + land on number)
    const fullSpins = 5 + Math.floor(Math.random() * 3);
    const targetDegrees = fullSpins * 360 + (360 - resultIndex * degreesPerNumber);

    setWheelRotation(prev => prev + targetDegrees);

    // Wait for animation
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Calculate winnings
    let totalWinnings = 0;
    const betResults = selectedBets.map(bet => {
      const won = checkBetWin(bet, resultNumber);
      const payout = won ? bet.amount * (BET_TYPES[bet.type].payout + 1) : 0;
      if (won) totalWinnings += payout;
      return { ...bet, won, payout };
    });

    // Credit winnings
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

    // Add to history
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

      <div className="roulette-container">
        {/* Wheel Section */}
        <div className="roulette-wheel-section">
          <div className="wheel-container">
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
                    transform: `rotate(${i * (360 / 37)}deg) translateY(-150px)`
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
                <span className="wheel-logo">🎰</span>
              )}
            </div>
          </div>

          {/* History */}
          <div className="roulette-history">
            <h4>History</h4>
            <div className="history-numbers">
              {history.length === 0 ? (
                <span className="no-history">No spins yet</span>
              ) : (
                history.map((h, i) => (
                  <span key={i} className={`history-number ${h.color}`}>
                    {h.number}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Betting Board */}
        <div className="roulette-board-section">
          <div className="bet-amount-selector">
            <label>Bet Amount:</label>
            <div className="bet-chips">
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
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              min="1"
              disabled={spinning}
              className="bet-input"
            />
          </div>

          {/* Number Grid */}
          <div className="roulette-board">
            <div className="zero-section">
              {renderBoardNumber(0)}
            </div>
            <div className="numbers-grid">
              {[...Array(12)].map((_, row) => (
                <div key={row} className="number-row">
                  {[3, 2, 1].map(col => {
                    const num = row * 3 + col;
                    return renderBoardNumber(num);
                  })}
                </div>
              ))}
            </div>

            {/* Column bets */}
            <div className="column-bets">
              <button
                className={`outside-bet ${selectedBets.some(b => b.type === 'COLUMN_3') ? 'selected' : ''}`}
                onClick={() => addBet('COLUMN_3')}
                disabled={spinning}
              >
                2:1
              </button>
              <button
                className={`outside-bet ${selectedBets.some(b => b.type === 'COLUMN_2') ? 'selected' : ''}`}
                onClick={() => addBet('COLUMN_2')}
                disabled={spinning}
              >
                2:1
              </button>
              <button
                className={`outside-bet ${selectedBets.some(b => b.type === 'COLUMN_1') ? 'selected' : ''}`}
                onClick={() => addBet('COLUMN_1')}
                disabled={spinning}
              >
                2:1
              </button>
            </div>
          </div>

          {/* Outside Bets */}
          <div className="outside-bets">
            <div className="dozen-bets">
              <button
                className={`outside-bet dozen ${selectedBets.some(b => b.type === 'DOZEN_1') ? 'selected' : ''}`}
                onClick={() => addBet('DOZEN_1')}
                disabled={spinning}
              >
                1st 12
              </button>
              <button
                className={`outside-bet dozen ${selectedBets.some(b => b.type === 'DOZEN_2') ? 'selected' : ''}`}
                onClick={() => addBet('DOZEN_2')}
                disabled={spinning}
              >
                2nd 12
              </button>
              <button
                className={`outside-bet dozen ${selectedBets.some(b => b.type === 'DOZEN_3') ? 'selected' : ''}`}
                onClick={() => addBet('DOZEN_3')}
                disabled={spinning}
              >
                3rd 12
              </button>
            </div>

            <div className="even-money-bets">
              <button
                className={`outside-bet ${selectedBets.some(b => b.type === 'LOW') ? 'selected' : ''}`}
                onClick={() => addBet('LOW')}
                disabled={spinning}
              >
                1-18
              </button>
              <button
                className={`outside-bet ${selectedBets.some(b => b.type === 'EVEN') ? 'selected' : ''}`}
                onClick={() => addBet('EVEN')}
                disabled={spinning}
              >
                EVEN
              </button>
              <button
                className={`outside-bet red ${selectedBets.some(b => b.type === 'RED') ? 'selected' : ''}`}
                onClick={() => addBet('RED')}
                disabled={spinning}
              >
                RED
              </button>
              <button
                className={`outside-bet black ${selectedBets.some(b => b.type === 'BLACK') ? 'selected' : ''}`}
                onClick={() => addBet('BLACK')}
                disabled={spinning}
              >
                BLACK
              </button>
              <button
                className={`outside-bet ${selectedBets.some(b => b.type === 'ODD') ? 'selected' : ''}`}
                onClick={() => addBet('ODD')}
                disabled={spinning}
              >
                ODD
              </button>
              <button
                className={`outside-bet ${selectedBets.some(b => b.type === 'HIGH') ? 'selected' : ''}`}
                onClick={() => addBet('HIGH')}
                disabled={spinning}
              >
                19-36
              </button>
            </div>
          </div>

          {/* Current Bets */}
          {selectedBets.length > 0 && (
            <div className="current-bets">
              <h4>Current Bets (Total: {getTotalBet()} SUIT)</h4>
              <div className="bet-list">
                {selectedBets.map((bet, i) => (
                  <div key={i} className="bet-item">
                    <span>
                      {BET_TYPES[bet.type].name}
                      {bet.number !== null ? ` (${bet.number})` : ''}
                      : {bet.amount} SUIT
                    </span>
                    <button onClick={() => removeBet(i)} disabled={spinning}>×</button>
                  </div>
                ))}
              </div>
              <button className="btn btn-secondary" onClick={clearBets} disabled={spinning}>
                Clear All
              </button>
            </div>
          )}

          {/* Spin Button */}
          <button
            className="btn btn-primary btn-spin"
            onClick={spin}
            disabled={spinning || selectedBets.length === 0 || !canPlay}
          >
            {spinning ? 'Spinning...' : 'SPIN'}
          </button>

          {/* Result Display */}
          {result && (
            <div className={`spin-result ${result.netProfit > 0 ? 'win' : 'lose'}`}>
              <h3>
                {result.netProfit > 0 ? '🎉 You Won!' : 'Better luck next time!'}
              </h3>
              <p className="result-info">
                Ball landed on <span className={`result-num ${result.color}`}>{result.number}</span>
              </p>
              {result.netProfit > 0 && (
                <p className="winnings">+{result.totalWinnings.toFixed(2)} SUIT</p>
              )}
            </div>
          )}
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
