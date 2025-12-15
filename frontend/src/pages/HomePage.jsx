import React, { useEffect, useState } from 'react';
import BetControls from '../components/DiceGame/BetControls';
import RollControls from '../components/DiceGame/RollControls';
import GameStats from '../components/DiceGame/GameStats';
import Dice3D from '../components/DiceGame/Dice3D';
import NeedTickets from '../components/NeedTickets';
import { useDemoContext } from '../contexts/DemoContext';

function HomePage({ wallet, dice, aiStrategy, clearAiStrategy, currentBet, onBetChange }) {
  const { isDemoMode, demoBalance, setDemoBalance, demoStats, realTickets, setRealTickets } = useDemoContext();
  const isConnected = wallet.account && wallet.isCorrectNetwork;
  const isPaused = dice.limits?.paused;

  // Current balance based on mode
  const currentBalance = isDemoMode ? demoBalance : realTickets;

  // Use local simulation if contract isn't deployed (but still use real tickets if not in demo mode)
  const usesLocalSimulation = !dice.isContractDeployed;

  // Demo mode state
  const [demoPendingBet, setDemoPendingBet] = useState(null);
  const [demoLastResult, setDemoLastResult] = useState(null);
  const [demoLoading, setDemoLoading] = useState(false);

  // Calculate demo payout based on bet type
  const calculateDemoPayout = (amount, betType, chosenNumber) => {
    const betAmount = parseFloat(amount) || 0;
    if (betAmount <= 0) return 0;
    if (betType === 0) return betAmount * 5.82; // Exact
    if (betType === 3 || betType === 4) return betAmount * 1.94; // Odd/Even
    // Over/Under calculations
    if (betType === 1) { // Over
      const winCount = 6 - chosenNumber;
      return winCount > 0 ? betAmount * (6 / winCount) * 0.97 : 0;
    }
    if (betType === 2) { // Under
      const winCount = chosenNumber - 1;
      return winCount > 0 ? betAmount * (6 / winCount) * 0.97 : 0;
    }
    return 0;
  };

  // Simulate dice roll for demo mode
  const simulateDemoRoll = (betType, chosenNumber) => {
    const diceValue = Math.floor(Math.random() * 6) + 1;
    let won = false;

    switch (betType) {
      case 0: won = diceValue === chosenNumber; break; // Exact
      case 1: won = diceValue > chosenNumber; break;   // Over
      case 2: won = diceValue < chosenNumber; break;   // Under
      case 3: won = diceValue % 2 === 1; break;        // Odd
      case 4: won = diceValue % 2 === 0; break;        // Even
    }

    return { diceValue, won };
  };

  // Apply AI strategy if provided
  useEffect(() => {
    if (aiStrategy && clearAiStrategy) {
      console.log('AI Strategy received:', aiStrategy);
      clearAiStrategy();
    }
  }, [aiStrategy, clearAiStrategy]);

  // Handle placing a bet (demo or real)
  const handlePlaceBet = async (amount, betType, chosenNumber) => {
    const betAmount = parseFloat(amount);

    // Check balance based on mode
    if (isDemoMode) {
      if (betAmount > demoBalance) {
        alert('Insufficient demo balance! Visit the Cashier to get more tickets.');
        return;
      }
      // Deduct bet and store pending bet
      setDemoBalance(prev => prev - betAmount);
    } else {
      // Real mode
      if (betAmount > realTickets) {
        alert('Insufficient ticket balance! Buy tickets at the Cashier.');
        return;
      }
      // Deduct bet from real tickets
      setRealTickets(prev => prev - betAmount);
    }

    // Store pending bet for local simulation
    setDemoPendingBet({
      amount: betAmount,
      betType,
      chosenNumber,
      potentialPayout: calculateDemoPayout(betAmount, betType, chosenNumber)
    });

    if (onBetChange) {
      onBetChange({
        betType,
        betTypeName: ['Exact', 'Over', 'Under', 'Odd', 'Even'][betType],
        chosenNumber,
        betAmount: amount
      });
    }
  };

  // Handle roll (works for both demo and real mode)
  const handleDemoRoll = async () => {
    if (!demoPendingBet) return;

    setDemoLoading(true);

    // Simulate waiting time (makes it feel more realistic)
    await new Promise(resolve => setTimeout(resolve, 1500));

    const { diceValue, won } = simulateDemoRoll(demoPendingBet.betType, demoPendingBet.chosenNumber);
    const payout = won ? demoPendingBet.potentialPayout : 0;

    // Credit winnings based on mode
    if (won) {
      if (isDemoMode) {
        setDemoBalance(prev => prev + payout);
      } else {
        setRealTickets(prev => prev + payout);
      }
    }

    setDemoLastResult({
      rolledNumber: diceValue,
      won,
      payout,
      betAmount: demoPendingBet.amount,
      betType: demoPendingBet.betType,
      chosenNumber: demoPendingBet.chosenNumber
    });

    setDemoPendingBet(null);
    setDemoLoading(false);
  };

  // Handle cancel (refund bet)
  const handleDemoCancel = () => {
    if (demoPendingBet) {
      // Refund the bet based on mode
      if (isDemoMode) {
        setDemoBalance(prev => prev + demoPendingBet.amount);
      } else {
        setRealTickets(prev => prev + demoPendingBet.amount);
      }
      setDemoPendingBet(null);
    }
  };

  // Clear demo result
  const clearDemoResult = () => {
    setDemoLastResult(null);
  };

  // Use local simulation state (pending bet and result)
  const activePendingBet = demoPendingBet;
  const activeLastResult = demoLastResult;
  const activeLoading = demoLoading;

  // Check if user needs tickets (either mode)
  const needsTickets = currentBalance <= 0;

  return (
    <div className="dice-page">
      {/* Need Tickets Overlay - only use forceDemo if actually in demo mode */}
      {needsTickets && <NeedTickets gameName="SUITRUMP Dice" isWalletConnected={isConnected} />}

      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="demo-mode-banner">
          <span className="demo-icon">🎮</span>
          <span className="demo-text">
            <strong>FREE PLAY MODE</strong> - {demoBalance > 0 ? `${demoBalance.toLocaleString()} tickets available` : 'Get tickets at Cashier to play!'}
          </span>
        </div>
      )}

      {/* Real Mode - Testnet Banner */}
      {!isDemoMode && isConnected && (
        <div className="testnet-mode-banner" style={{ background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)', padding: '10px 20px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #3b82f6' }}>
          <span style={{ fontSize: '1.2rem' }}>🔗</span>
          <span style={{ color: '#93c5fd' }}>
            <strong style={{ color: '#60a5fa' }}>TESTNET MODE</strong> - Playing with real tickets ({realTickets.toLocaleString()} available)
          </span>
        </div>
      )}

      {/* Connect Wallet Banner - only in real mode when not connected */}
      {!isDemoMode && !isConnected && (
        <div className="connect-banner">
          <button className="btn btn-connect-banner" onClick={wallet.connect}>
            Connect your wallet to start playing
          </button>
        </div>
      )}

      {/* Error Display */}
      {dice.error && (
        <div className="error-banner">
          <p>{dice.error}</p>
        </div>
      )}

      {/* Paused Warning */}
      {isPaused && (
        <div className="warning-banner">
          Game is currently paused by admin
        </div>
      )}

      {/* Main Game Area - Dice + Bet Controls */}
      <div className="dice-game-box">
        <div className="dice-game-grid">
          {/* Left: Dice Display */}
          <div className="dice-display-area">
            {activePendingBet || activeLastResult ? (
              <RollControls
                pendingBet={activePendingBet}
                lastResult={activeLastResult}
                onRoll={handleDemoRoll}
                onCancel={handleDemoCancel}
                canRoll={() => ({ canExecute: !!demoPendingBet, reason: '' })}
                loading={activeLoading}
                clearResult={clearDemoResult}
                isDemoMode={isDemoMode || usesLocalSimulation}
              />
            ) : (
              <div className="dice-idle">
                <Dice3D
                  rolling={false}
                  targetValue={1}
                  size={180}
                />
                <p>Place a bet to start playing!</p>
              </div>
            )}
          </div>

          {/* Right: Bet Controls */}
          <div className="bet-controls-area">
            <div className="demo-game-balance">
              <span className="balance-label">{isDemoMode ? 'Demo Balance:' : 'Ticket Balance:'}</span>
              <span className="balance-value" style={isDemoMode ? { color: '#c4b5fd' } : {}}>{currentBalance.toLocaleString()} tickets</span>
            </div>
            <BetControls
              limits={{ minBet: '1', maxBet: String(Math.floor(currentBalance)), paused: false }}
              onPlaceBet={handlePlaceBet}
              calculatePayout={calculateDemoPayout}
              loading={activeLoading}
              disabled={isPaused || activePendingBet || (!isDemoMode && !isConnected)}
            />
          </div>
        </div>
      </div>

      {/* Game Statistics */}
      <GameStats stats={dice.stats} limits={dice.limits} />

      {/* How to Play */}
      <div className="how-to-play-box">
        <h3>How to Play</h3>
        <ol className="how-to-steps">
          <li><strong>Choose Bet Type:</strong> Select from Exact, Over, Under, Odd, or Even</li>
          <li><strong>Set Amount:</strong> Enter your bet amount in tickets (1 ticket = $0.10)</li>
          <li><strong>Place Bet:</strong> Click Place Bet to lock in your wager</li>
          <li><strong>Roll:</strong> Click Roll Dice to reveal your result!</li>
        </ol>

        <div className="bet-types-table">
          <h4>Bet Types & Payouts</h4>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Description</th>
                <th>Multiplier</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Exact</td>
                <td>Guess the exact number (1-6)</td>
                <td className="multiplier">5.82x</td>
              </tr>
              <tr>
                <td>Odd</td>
                <td>Roll 1, 3, or 5</td>
                <td className="multiplier">1.94x</td>
              </tr>
              <tr>
                <td>Even</td>
                <td>Roll 2, 4, or 6</td>
                <td className="multiplier">1.94x</td>
              </tr>
              <tr>
                <td>Over</td>
                <td>Roll higher than chosen number</td>
                <td className="multiplier">Variable</td>
              </tr>
              <tr>
                <td>Under</td>
                <td>Roll lower than chosen number</td>
                <td className="multiplier">Variable</td>
              </tr>
            </tbody>
          </table>
          <p className="house-edge-note">House edge: 3% (2% to treasury, 1% burned)</p>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
