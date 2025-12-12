import React, { useEffect, useState } from 'react';
import BetControls from '../components/DiceGame/BetControls';
import RollControls from '../components/DiceGame/RollControls';
import GameStats from '../components/DiceGame/GameStats';
import Dice3D from '../components/DiceGame/Dice3D';
import { useDemoContext } from '../contexts/DemoContext';

function HomePage({ wallet, dice, aiStrategy, clearAiStrategy, currentBet, onBetChange }) {
  const { isDemoMode, demoBalance, setDemoBalance, demoStats } = useDemoContext();
  const isConnected = wallet.account && wallet.isCorrectNetwork;
  const isPaused = dice.limits?.paused;

  // Demo mode state
  const [demoPendingBet, setDemoPendingBet] = useState(null);
  const [demoLastResult, setDemoLastResult] = useState(null);
  const [demoLoading, setDemoLoading] = useState(false);

  // Payout multipliers for demo mode
  const DEMO_PAYOUTS = {
    0: 5.82, // Exact
    1: 0,    // Over (variable)
    2: 0,    // Under (variable)
    3: 1.94, // Odd
    4: 1.94, // Even
  };

  // Calculate demo payout based on bet type
  const calculateDemoPayout = (amount, betType, chosenNumber) => {
    if (betType === 0) return amount * 5.82; // Exact
    if (betType === 3 || betType === 4) return amount * 1.94; // Odd/Even
    // Over/Under calculations
    if (betType === 1) { // Over
      const winCount = 6 - chosenNumber;
      return winCount > 0 ? amount * (6 / winCount) * 0.97 : 0;
    }
    if (betType === 2) { // Under
      const winCount = chosenNumber - 1;
      return winCount > 0 ? amount * (6 / winCount) * 0.97 : 0;
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
    if (isDemoMode) {
      // Demo mode bet
      const betAmount = parseFloat(amount);
      if (betAmount > demoBalance) {
        alert('Insufficient demo balance!');
        return;
      }

      // Deduct bet and store pending bet
      setDemoBalance(prev => prev - betAmount);
      setDemoPendingBet({
        amount: betAmount,
        betType,
        chosenNumber,
        potentialPayout: calculateDemoPayout(betAmount, betType, chosenNumber)
      });
      return;
    }

    // Real mode bet
    if (!dice.placeBet) return;

    try {
      await dice.placeBet(amount, betType, chosenNumber);
      if (onBetChange) {
        onBetChange({
          betType,
          betTypeName: ['Exact', 'Over', 'Under', 'Odd', 'Even'][betType],
          chosenNumber,
          betAmount: amount
        });
      }
    } catch (err) {
      console.error('Error placing bet:', err);
    }
  };

  // Handle demo roll
  const handleDemoRoll = async () => {
    if (!demoPendingBet) return;

    setDemoLoading(true);

    // Simulate waiting time (makes it feel more realistic)
    await new Promise(resolve => setTimeout(resolve, 1500));

    const { diceValue, won } = simulateDemoRoll(demoPendingBet.betType, demoPendingBet.chosenNumber);
    const payout = won ? demoPendingBet.potentialPayout : 0;

    // Credit winnings if won
    if (won) {
      setDemoBalance(prev => prev + payout);
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

  // Handle demo cancel
  const handleDemoCancel = () => {
    if (demoPendingBet) {
      // Refund the bet
      setDemoBalance(prev => prev + demoPendingBet.amount);
      setDemoPendingBet(null);
    }
  };

  // Clear demo result
  const clearDemoResult = () => {
    setDemoLastResult(null);
  };

  // Get the appropriate pending bet and result based on mode
  const activePendingBet = isDemoMode ? demoPendingBet : dice.pendingBet;
  const activeLastResult = isDemoMode ? demoLastResult : dice.lastResult;
  const activeLoading = isDemoMode ? demoLoading : dice.loading;

  return (
    <div className="dice-page">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="demo-mode-banner">
          <span className="demo-icon">🎮</span>
          <span className="demo-text">
            <strong>FREE PLAY MODE</strong> - Practice with {demoBalance.toLocaleString()} demo SUIT tokens. No wallet needed!
          </span>
        </div>
      )}

      {/* Connect Wallet Banner - only in real mode */}
      {!isDemoMode && !isConnected && (
        <div className="connect-banner">
          <button className="btn btn-connect-banner" onClick={wallet.connect}>
            Connect your wallet to start playing
          </button>
        </div>
      )}

      {/* Error Display */}
      {!isDemoMode && dice.error && (
        <div className="error-banner">
          <p>{dice.error}</p>
        </div>
      )}

      {/* Paused Warning - only in real mode */}
      {!isDemoMode && isPaused && (
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
                onRoll={isDemoMode ? handleDemoRoll : dice.rollDice}
                onCancel={isDemoMode ? handleDemoCancel : dice.cancelBet}
                canRoll={isDemoMode ? !!demoPendingBet : dice.canRoll}
                loading={activeLoading}
                clearResult={isDemoMode ? clearDemoResult : dice.clearResult}
                isDemoMode={isDemoMode}
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
            {isDemoMode && (
              <div className="demo-game-balance">
                <span className="balance-label">Demo Balance:</span>
                <span className="balance-value">{demoBalance.toLocaleString()} SUIT</span>
              </div>
            )}
            <BetControls
              limits={isDemoMode ? { minBet: '1', maxBet: String(Math.floor(demoBalance)), paused: false } : dice.limits}
              onPlaceBet={handlePlaceBet}
              calculatePayout={isDemoMode ? calculateDemoPayout : dice.calculatePayout}
              loading={activeLoading}
              disabled={(!isDemoMode && isPaused) || activePendingBet || (!isDemoMode && !isConnected)}
            />
          </div>
        </div>
      </div>

      {/* Game Statistics - only show in real mode */}
      {!isDemoMode && <GameStats stats={dice.stats} limits={dice.limits} />}

      {/* How to Play */}
      <div className="how-to-play-box">
        <h3>How to Play</h3>
        <ol className="how-to-steps">
          <li><strong>Connect Wallet:</strong> Connect your MetaMask wallet to Sui Testnet</li>
          <li><strong>Choose Bet Type:</strong> Select from Exact, Over, Under, Odd, or Even</li>
          <li><strong>Set Amount:</strong> Enter your bet amount in SUIT tokens</li>
          <li><strong>Place Bet:</strong> Approve tokens and place your bet</li>
          <li><strong>Wait:</strong> Wait ~6 seconds for block confirmation</li>
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
