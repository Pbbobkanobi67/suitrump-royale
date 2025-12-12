import React, { useState, useMemo } from 'react';
import Dice3D from '../components/DiceGame/Dice3D';
import { useDemoContext } from '../contexts/DemoContext';

function ProgressivePage({ wallet, progressive }) {
  const { isDemoMode, demoBalance, setDemoBalance } = useDemoContext();
  // Determine which rolled dice and target dice match
  const { matchedRollIndices, matchedTargetIndices } = useMemo(() => {
    if (!progressive.lastResult || !progressive.targetDice) {
      return { matchedRollIndices: [], matchedTargetIndices: [] };
    }

    const targetValues = [
      progressive.targetDice.die1,
      progressive.targetDice.die2,
      progressive.targetDice.die3,
      progressive.targetDice.die4
    ];
    const rolledValues = [...progressive.lastResult.rolledDice];
    const matchedRoll = [];
    const matchedTarget = [];

    // Find matches (order doesn't matter)
    rolledValues.forEach((rolled, rollIdx) => {
      const targetIdx = targetValues.findIndex((target, tIdx) =>
        target === rolled && !matchedTarget.includes(tIdx)
      );
      if (targetIdx !== -1) {
        matchedRoll.push(rollIdx);
        matchedTarget.push(targetIdx);
      }
    });

    return { matchedRollIndices: matchedRoll, matchedTargetIndices: matchedTarget };
  }, [progressive.lastResult, progressive.targetDice]);
  const [autoRollCount, setAutoRollCount] = useState(10);
  const [isAutoRolling, setIsAutoRolling] = useState(false);
  const [autoRollProgress, setAutoRollProgress] = useState({ current: 0, total: 0 });

  // Demo mode state
  const [demoTargetDice, setDemoTargetDice] = useState([
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1
  ]);
  const [demoLastResult, setDemoLastResult] = useState(null);
  const [demoLoading, setDemoLoading] = useState(false);

  // Demo jackpot settings
  const DEMO_TICKET_PRICE = 1;
  const DEMO_JACKPOT = 5000;
  const DEMO_PAYOUTS = { jackpot: DEMO_JACKPOT, match3: 100, match2: 5 };

  // Count matches between rolled and target dice
  const countMatches = (rolled, target) => {
    const remaining = [...target];
    let matches = 0;
    for (const die of rolled) {
      const idx = remaining.indexOf(die);
      if (idx !== -1) {
        remaining.splice(idx, 1);
        matches++;
      }
    }
    return matches;
  };

  // Demo roll handler
  const handleDemoRoll = async () => {
    if (DEMO_TICKET_PRICE > demoBalance) {
      return;
    }

    setDemoBalance(prev => prev - DEMO_TICKET_PRICE);
    setDemoLoading(true);
    setDemoLastResult(null);

    // Simulate rolling delay
    await new Promise(r => setTimeout(r, 1500));

    // Generate random roll
    const rolled = [
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1
    ];

    const matches = countMatches(rolled, demoTargetDice);
    let payout = 0;
    let isJackpot = false;

    if (matches === 4) {
      payout = DEMO_PAYOUTS.jackpot;
      isJackpot = true;
      // Generate new target dice after jackpot
      setDemoTargetDice([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1
      ]);
    } else if (matches === 3) {
      payout = DEMO_PAYOUTS.match3;
    } else if (matches === 2) {
      payout = DEMO_PAYOUTS.match2;
    }

    if (payout > 0) {
      setDemoBalance(prev => prev + payout);
    }

    setDemoLastResult({
      rolledDice: rolled,
      matches,
      payout,
      isJackpot
    });
    setDemoLoading(false);
  };

  const isConnected = wallet.account && wallet.isCorrectNetwork;
  const isPaused = progressive.stats?.paused;
  const hasJackpot = progressive.stats && parseFloat(progressive.stats.jackpotPool) >= 5;
  const targetRevealed = progressive.targetDice?.isRevealed;
  const canPlay = isConnected && !isPaused && hasJackpot && targetRevealed;

  const ticketPrice = parseFloat(progressive.stats?.ticketPrice || 1);

  // Single roll handler
  const handleSingleRoll = async () => {
    if (!canPlay || progressive.loading) return;

    const rollId = await progressive.buyRoll();
    if (rollId !== null) {
      // Wait for blocks then auto-reveal
      await waitForReveal(rollId);
    }
  };

  // Wait for reveal to be ready and execute
  const waitForReveal = async (rollId) => {
    // Poll until we can reveal
    let attempts = 0;
    while (attempts < 30) {
      const status = await progressive.canRevealRoll(rollId);
      if (status.canReveal) {
        await progressive.revealRoll(rollId);
        return true;
      }
      await new Promise(r => setTimeout(r, 2000));
      attempts++;
    }
    return false;
  };

  // Auto-roll handler
  const handleAutoRoll = async () => {
    if (!canPlay || isAutoRolling || autoRollCount < 1) return;

    setIsAutoRolling(true);
    setAutoRollProgress({ current: 0, total: autoRollCount });

    try {
      // Pre-approve for all tickets
      const totalAmount = autoRollCount * ticketPrice;
      await progressive.approveTokens(totalAmount);

      // Roll one at a time
      for (let i = 0; i < autoRollCount; i++) {
        setAutoRollProgress({ current: i + 1, total: autoRollCount });

        const rollId = await progressive.buyRoll();
        if (rollId === null) break;

        const revealed = await waitForReveal(rollId);
        if (!revealed) break;

        // Check if we hit jackpot - stop auto-roll
        if (progressive.lastResult?.isJackpot) {
          break;
        }

        // Small delay between rolls
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (err) {
      console.error('Auto-roll error:', err);
    } finally {
      setIsAutoRolling(false);
      setAutoRollProgress({ current: 0, total: 0 });
    }
  };

  // Stop auto-roll
  const stopAutoRoll = () => {
    setIsAutoRolling(false);
  };

  // Get active result based on mode
  const activeLastResult = isDemoMode ? demoLastResult : progressive.lastResult;
  const activeTargetDice = isDemoMode ? demoTargetDice : (progressive.targetDice ? [
    progressive.targetDice.die1,
    progressive.targetDice.die2,
    progressive.targetDice.die3,
    progressive.targetDice.die4
  ] : null);
  const activeLoading = isDemoMode ? demoLoading : progressive.loading;
  const activeTicketPrice = isDemoMode ? DEMO_TICKET_PRICE : ticketPrice;

  // Calculate matches for demo mode display
  const demoMatchedRollIndices = useMemo(() => {
    if (!isDemoMode || !demoLastResult) return [];
    const matched = [];
    const remaining = [...demoTargetDice];
    demoLastResult.rolledDice.forEach((die, idx) => {
      const targetIdx = remaining.indexOf(die);
      if (targetIdx !== -1) {
        matched.push(idx);
        remaining.splice(targetIdx, 1);
      }
    });
    return matched;
  }, [isDemoMode, demoLastResult, demoTargetDice]);

  return (
    <div className="progressive-page-v2">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="demo-mode-banner">
          <span className="demo-icon">🎮</span>
          <span className="demo-text">
            <strong>FREE PLAY MODE</strong> - Practice with {demoBalance.toLocaleString()} demo SUIT tokens. No wallet needed!
          </span>
        </div>
      )}

      {/* Error Display */}
      {!isDemoMode && progressive.error && (
        <div className="error-banner">
          <p>{progressive.error}</p>
          <button onClick={progressive.clearError}>Dismiss</button>
        </div>
      )}

      {/* Main Game Card */}
      <div className="progressive-card">
        {/* Jackpot Section */}
        <div className="jackpot-section">
          <span className="jackpot-label">{isDemoMode ? 'DEMO JACKPOT' : 'JACKPOT'}</span>
          <span className="jackpot-amount" style={isDemoMode ? { color: '#c4b5fd' } : {}}>
            {isDemoMode ? DEMO_JACKPOT.toLocaleString() : parseFloat(progressive.stats?.jackpotPool || 0).toLocaleString()} SUIT
          </span>

          <div className="payout-boxes">
            <div className="payout-box jackpot-box">
              <span className="box-label">4/4 Match</span>
              <span className="box-value jackpot-value">
                {isDemoMode ? DEMO_PAYOUTS.jackpot.toLocaleString() : parseFloat(progressive.payouts?.jackpot || 0).toLocaleString()} SUIT
              </span>
            </div>
            <div className="payout-box">
              <span className="box-label">3/4 Match</span>
              <span className="box-value">{isDemoMode ? DEMO_PAYOUTS.match3 : parseFloat(progressive.payouts?.match3 || 0).toLocaleString()} SUIT</span>
            </div>
            <div className="payout-box">
              <span className="box-label">2/4 Match</span>
              <span className="box-value">{isDemoMode ? DEMO_PAYOUTS.match2 : parseFloat(progressive.payouts?.match2 || 0)} SUIT</span>
            </div>
            <div className="payout-box">
              <span className="box-label">Ticket</span>
              <span className="box-value">{activeTicketPrice} SUIT</span>
            </div>
          </div>
        </div>

        {/* Target Dice Section */}
        <div className="target-section">
          <h3 className="section-title">TARGET DICE {isDemoMode ? '(DEMO)' : `(ROUND #${progressive.targetDice?.roundId || 0})`}</h3>

          {isDemoMode ? (
            <div className="dice-display">
              {demoTargetDice.map((die, i) => (
                <div key={i} className="dice-with-value">
                  <Dice3D targetValue={die} size={100} topDown={true} />
                  <span className="dice-value">{die}</span>
                </div>
              ))}
            </div>
          ) : targetRevealed && progressive.targetDice ? (
            <div className="dice-display">
              <div className={`dice-with-value ${matchedTargetIndices.includes(0) ? 'matched' : ''}`}>
                <Dice3D targetValue={progressive.targetDice.die1} size={100} topDown={true} />
                <span className="dice-value">{progressive.targetDice.die1}</span>
              </div>
              <div className={`dice-with-value ${matchedTargetIndices.includes(1) ? 'matched' : ''}`}>
                <Dice3D targetValue={progressive.targetDice.die2} size={100} topDown={true} />
                <span className="dice-value">{progressive.targetDice.die2}</span>
              </div>
              <div className={`dice-with-value ${matchedTargetIndices.includes(2) ? 'matched' : ''}`}>
                <Dice3D targetValue={progressive.targetDice.die3} size={100} topDown={true} />
                <span className="dice-value">{progressive.targetDice.die3}</span>
              </div>
              <div className={`dice-with-value ${matchedTargetIndices.includes(3) ? 'matched' : ''}`}>
                <Dice3D targetValue={progressive.targetDice.die4} size={100} topDown={true} />
                <span className="dice-value">{progressive.targetDice.die4}</span>
              </div>
            </div>
          ) : (
            <div className="dice-display">
              <div className="dice-placeholder-box">?</div>
              <div className="dice-placeholder-box">?</div>
              <div className="dice-placeholder-box">?</div>
              <div className="dice-placeholder-box">?</div>
            </div>
          )}
        </div>

        {/* Your Roll Section */}
        <div className="roll-section">
          <h3 className="section-title">YOUR ROLL</h3>

          {isDemoMode ? (
            // Demo mode roll display
            demoLastResult ? (
              <>
                <div className="dice-display">
                  {demoLastResult.rolledDice.map((die, i) => (
                    <div className={`dice-with-value ${demoMatchedRollIndices.includes(i) ? 'matched' : ''}`} key={i}>
                      <Dice3D targetValue={die} size={100} topDown={true} />
                      <span className="dice-value">{die}</span>
                    </div>
                  ))}
                </div>
                <div className={`result-display ${demoLastResult.isJackpot ? 'jackpot-win' : demoLastResult.matches >= 2 ? 'win' : 'loss'}`}>
                  <span className="result-matches">{demoLastResult.matches}/4 Matches</span>
                  {demoLastResult.payout > 0 && (
                    <span className="result-payout">+{demoLastResult.payout} SUIT</span>
                  )}
                  {demoLastResult.isJackpot && <span className="jackpot-text">JACKPOT!</span>}
                </div>
              </>
            ) : demoLoading ? (
              <div className="dice-display">
                <div className="dice-with-value"><Dice3D rolling={true} size={100} /></div>
                <div className="dice-with-value"><Dice3D rolling={true} size={100} /></div>
                <div className="dice-with-value"><Dice3D rolling={true} size={100} /></div>
                <div className="dice-with-value"><Dice3D rolling={true} size={100} /></div>
              </div>
            ) : (
              <div className="dice-display">
                <div className="dice-placeholder-box empty">-</div>
                <div className="dice-placeholder-box empty">-</div>
                <div className="dice-placeholder-box empty">-</div>
                <div className="dice-placeholder-box empty">-</div>
              </div>
            )
          ) : (
            // Real mode roll display
            progressive.lastResult ? (
              <>
                <div className="dice-display">
                  {progressive.lastResult.rolledDice.map((die, i) => (
                    <div className={`dice-with-value ${matchedRollIndices.includes(i) ? 'matched' : ''}`} key={i}>
                      <Dice3D targetValue={die} size={100} topDown={true} />
                      <span className="dice-value">{die}</span>
                    </div>
                  ))}
                </div>
                <div className={`result-display ${progressive.lastResult.isJackpot ? 'jackpot-win' : progressive.lastResult.matches >= 2 ? 'win' : 'loss'}`}>
                  <span className="result-matches">{progressive.lastResult.matches}/4 Matches</span>
                  {parseFloat(progressive.lastResult.payout) > 0 && (
                    <span className="result-payout">+{progressive.lastResult.payout} SUIT</span>
                  )}
                  {progressive.lastResult.isJackpot && <span className="jackpot-text">JACKPOT!</span>}
                </div>
              </>
            ) : progressive.pendingRoll ? (
              <div className="dice-display">
                <div className="dice-with-value"><Dice3D rolling={true} size={100} /></div>
                <div className="dice-with-value"><Dice3D rolling={true} size={100} /></div>
                <div className="dice-with-value"><Dice3D rolling={true} size={100} /></div>
                <div className="dice-with-value"><Dice3D rolling={true} size={100} /></div>
              </div>
            ) : (
              <div className="dice-display">
                <div className="dice-placeholder-box empty">-</div>
                <div className="dice-placeholder-box empty">-</div>
                <div className="dice-placeholder-box empty">-</div>
                <div className="dice-placeholder-box empty">-</div>
              </div>
            )
          )}

          {isAutoRolling && (
            <div className="auto-roll-progress">
              Rolling {autoRollProgress.current} of {autoRollProgress.total}...
            </div>
          )}
        </div>

        {/* Buy Tickets Section */}
        <div className="buy-section">
          <h3 className="section-title">{isDemoMode ? 'PLAY (DEMO)' : 'BUY TICKETS'}</h3>

          {isDemoMode ? (
            // Demo mode - always available
            <div className="buy-options">
              <div className="buy-option">
                <div className="option-header">
                  <span className="option-icon">🎲</span>
                  <span className="option-title">Demo Roll</span>
                </div>
                <div className="option-details">
                  <span>Demo Balance:</span>
                  <span className="option-price" style={{ color: '#c4b5fd' }}>{demoBalance.toLocaleString()} SUIT</span>
                </div>
                <button
                  className="btn btn-primary btn-glow"
                  onClick={handleDemoRoll}
                  disabled={demoLoading || DEMO_TICKET_PRICE > demoBalance}
                >
                  {demoLoading ? 'Rolling...' : `ROLL - ${DEMO_TICKET_PRICE} SUIT`}
                </button>
              </div>
            </div>
          ) : !isConnected ? (
            <p className="connect-prompt">Connect wallet to play</p>
          ) : !targetRevealed ? (
            <p className="connect-prompt">Waiting for round to start...</p>
          ) : (
            <div className="buy-options">
              {/* Single Roll */}
              <div className="buy-option">
                <div className="option-header">
                  <span className="option-icon">🎲</span>
                  <span className="option-title">Single Roll</span>
                </div>
                <div className="option-details">
                  <span>1 ticket</span>
                  <span className="option-price">{ticketPrice} SUIT</span>
                </div>
                <button
                  className="btn btn-primary btn-glow"
                  onClick={handleSingleRoll}
                  disabled={!canPlay || progressive.loading || isAutoRolling}
                >
                  {progressive.loading ? 'Rolling...' : 'BUY 1 TICKET'}
                </button>
              </div>

              {/* Auto Roll */}
              <div className="buy-option">
                <div className="option-header">
                  <span className="option-icon">🎰</span>
                  <span className="option-title">Auto-Roll</span>
                </div>
                <div className="option-details">
                  <input
                    type="number"
                    value={autoRollCount}
                    onChange={(e) => setAutoRollCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                    min="1"
                    max="50"
                    className="auto-roll-input"
                    disabled={isAutoRolling}
                  />
                  <span>tickets</span>
                  <span className="option-price">{(autoRollCount * ticketPrice).toFixed(1)} SUIT</span>
                </div>
                {isAutoRolling ? (
                  <button className="btn btn-danger btn-glow" onClick={stopAutoRoll}>
                    STOP AUTO-ROLL
                  </button>
                ) : (
                  <button
                    className="btn btn-primary btn-glow"
                    onClick={handleAutoRoll}
                    disabled={!canPlay || progressive.loading}
                  >
                    START AUTO-ROLL
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status Messages - only show in real mode */}
        {!isDemoMode && isPaused && (
          <div className="status-message warning">Game is currently paused</div>
        )}
        {!isDemoMode && !hasJackpot && !isPaused && (
          <div className="status-message warning">Jackpot needs funding before play can begin</div>
        )}
      </div>

      {/* How to Play Section */}
      <div className="how-to-play-card">
        <h2 className="how-to-play-title">How to Play Progressive Dice</h2>

        <div className="how-to-play-content">
          {/* Instructions */}
          <div className="instructions-column">
            <ol className="instructions-list">
              <li><strong>Target Dice:</strong> 4 target dice are set for the round</li>
              <li><strong>Buy Roll:</strong> Pay {ticketPrice} SUIT to roll 4 dice</li>
              <li><strong>Match:</strong> Try to match all 4 target dice (order doesn't matter)</li>
              <li><strong>Win:</strong> Match 4/4 for the jackpot, 3/4 or 2/4 for smaller prizes</li>
            </ol>
          </div>

          {/* Payout Structure */}
          <div className="payout-column">
            <h3>Payout Structure</h3>
            <table className="payout-table">
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Payout</th>
                </tr>
              </thead>
              <tbody>
                <tr className="jackpot-row">
                  <td>4/4 (Jackpot)</td>
                  <td>80% of pot</td>
                </tr>
                <tr>
                  <td>3/4</td>
                  <td>1% of pot (min 5 SUIT)</td>
                </tr>
                <tr>
                  <td>2/4</td>
                  <td>Ticket refund</td>
                </tr>
                <tr>
                  <td>0-1/4</td>
                  <td>No payout</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* On Jackpot Win */}
          <div className="jackpot-win-column">
            <h3>On Jackpot Win</h3>
            <ul className="distribution-list">
              <li><span className="highlight">80% to winner</span></li>
              <li>10% seeds next jackpot</li>
              <li>3% to treasury</li>
              <li>2% to developer</li>
              <li>3% burned</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProgressivePage;
