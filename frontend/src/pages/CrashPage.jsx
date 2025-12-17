import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { useDemoContext } from '../contexts/DemoContext';
import NeedTickets from '../components/NeedTickets';
import { CURRENT_NETWORK, getContract } from '../config/sui-config';

// Get crash contract address (null until deployed)
const CRASH_CONTRACT = getContract('crash');

const BET_PRESETS = [1, 5, 10, 25, 50, 100];
const TARGET_PRESETS = [1.5, 2.0, 3.0, 5.0, 10.0];
const MULTIPLIER_PRECISION = 10000;
const GROWTH_PER_BLOCK = 500; // 0.05x per block

// Generate random crash point (house edge ~4%)
const generateCrashPoint = () => {
  const r = Math.random();
  // Inverse cumulative distribution with house edge
  // P(crash > x) = 0.96/x for x >= 1
  if (r < 0.04) return 1.0; // 4% instant crash (house edge)
  return Math.min(0.96 / (1 - r), 100); // Cap at 100x
};

function CrashPage() {
  const { isDemoMode, demoBalance, setDemoBalance, realTickets, setRealTickets } = useDemoContext();
  const account = useCurrentAccount();
  const isWalletConnected = !!account;
  const [betAmount, setBetAmount] = useState(10);

  // Current balance based on mode
  const currentBalance = isDemoMode ? demoBalance : realTickets;
  const [balance, setBalance] = useState('0');
  const [activeGameId, setActiveGameId] = useState(null);
  const [gameState, setGameState] = useState('idle'); // idle, waiting, playing, cashed, crashed
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [displayMultiplier, setDisplayMultiplier] = useState(1.0);
  const [blocksRemaining, setBlocksRemaining] = useState(0);
  const [crashPoint, setCrashPoint] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);
  const [houseReserve, setHouseReserve] = useState('0');
  const [gameHistory, setGameHistory] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Demo mode specific
  const [demoCrashPoint, setDemoCrashPoint] = useState(null);
  const demoIntervalRef = useRef(null);

  // Real mode specific (local simulation with real tickets)
  const [realCrashPoint, setRealCrashPoint] = useState(null);
  const [realBetAmount, setRealBetAmount] = useState(0);
  const realIntervalRef = useRef(null);

  // Auto cash-out settings
  const [autoMode, setAutoMode] = useState(true);
  const [targetMultiplier, setTargetMultiplier] = useState(2.0);
  const [autoCashingOut, setAutoCashingOut] = useState(false);

  const animationRef = useRef(null);
  const startTimeRef = useRef(null);
  const baseMultiplierRef = useRef(1.0);
  const gameStateRef = useRef(gameState);

  // Keep ref in sync with state
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Smooth multiplier animation - uses ref to avoid stale closure
  const animateMultiplier = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;

    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    // Match demo rate: 0.1x per second for smooth animation
    const smoothMultiplier = baseMultiplierRef.current + (elapsed * 0.1);

    setDisplayMultiplier(smoothMultiplier);
    animationRef.current = requestAnimationFrame(animateMultiplier);
  }, []);

  // Start animation when playing (REAL MODE ONLY - demo mode uses setInterval)
  useEffect(() => {
    // Skip animation for demo mode - it has its own setInterval
    if (isDemoMode) return;

    if (gameState === 'playing') {
      startTimeRef.current = Date.now();
      baseMultiplierRef.current = currentMultiplier;
      // Start animation loop for real mode
      const animate = () => {
        if (gameStateRef.current !== 'playing') return;
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const smoothMultiplier = baseMultiplierRef.current + (elapsed * 0.1);
        setDisplayMultiplier(smoothMultiplier);
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else if (gameState === 'idle' || gameState === 'waiting') {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState, isDemoMode]);

  // Fetch balance and contract data
  useEffect(() => {
    // Contract not deployed yet - skip blockchain fetches
    if (!CRASH_CONTRACT || !isWalletConnected) return;

    // TODO: Implement Sui contract integration when deployed
    console.log('Crash contract integration pending');
  }, [isWalletConnected]);

  // Poll for game state updates and auto cash-out (blockchain mode - not yet implemented)
  useEffect(() => {
    // Contract polling disabled until Sui contract is deployed
    if (!activeGameId || !CRASH_CONTRACT) return;

    // TODO: Implement Sui contract polling when deployed
  }, [activeGameId]);

  // Real mode start handler (local simulation with real tickets)
  const handleStartGame = () => {
    if (!isWalletConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (betAmount > realTickets) {
      setError('Insufficient ticket balance! Buy tickets at the Cashier.');
      return;
    }

    setError(null);
    setLastResult(null);
    setIsProcessing(true);

    // Deduct bet from real tickets
    setRealTickets(prev => prev - betAmount);
    setRealBetAmount(betAmount);

    // Generate crash point
    const crashPt = generateCrashPoint();
    setRealCrashPoint(crashPt);
    setCrashPoint(null);

    // Brief waiting state
    setGameState('waiting');
    setBlocksRemaining(2);
    setCurrentMultiplier(1.0);
    setDisplayMultiplier(1.0);

    setTimeout(() => {
      setBlocksRemaining(1);
      setTimeout(() => {
        setBlocksRemaining(0);
        setGameState('playing');
        startTimeRef.current = Date.now();
        baseMultiplierRef.current = 1.0;
        setIsProcessing(false);

        // Start real mode multiplier growth
        realIntervalRef.current = setInterval(() => {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          const newMult = 1.0 + (elapsed * 0.1); // 0.1x per second

          if (newMult >= crashPt) {
            // Crashed!
            clearInterval(realIntervalRef.current);
            realIntervalRef.current = null;
            setDisplayMultiplier(crashPt);
            setCurrentMultiplier(crashPt);
            setCrashPoint(crashPt);
            setGameState('crashed');
            setLastResult({
              type: 'crash',
              multiplier: 0,
              crashPoint: crashPt,
              loss: betAmount
            });
            setGameHistory(prev => [{
              id: Date.now(),
              multiplier: crashPt,
              result: 'crash',
              amount: 0
            }, ...prev.slice(0, 9)]);
          } else {
            setDisplayMultiplier(newMult);
            setCurrentMultiplier(newMult);

            // Auto cash-out check
            if (autoMode && newMult >= targetMultiplier && !autoCashingOut) {
              handleCashOut(newMult);
            }
          }
        }, 50);
      }, 1000);
    }, 1000);
  };

  // Real mode cash out handler
  const handleCashOut = (mult = displayMultiplier) => {
    if (realIntervalRef.current) {
      clearInterval(realIntervalRef.current);
      realIntervalRef.current = null;
    }

    const payout = realBetAmount * mult;
    setRealTickets(prev => prev + payout);

    setDisplayMultiplier(mult);
    setCurrentMultiplier(mult);
    setCrashPoint(realCrashPoint);
    setGameState('cashed');
    setLastResult({
      type: 'win',
      multiplier: mult,
      payout: payout,
      profit: payout - realBetAmount
    });
    setGameHistory(prev => [{
      id: Date.now(),
      multiplier: mult,
      result: 'win',
      amount: payout
    }, ...prev.slice(0, 9)]);
  };

  const resetGame = () => {
    setGameState('idle');
    setActiveGameId(null);
    setLastResult(null);
    setCrashPoint(null);
    setCurrentMultiplier(1.0);
    setDisplayMultiplier(1.0);
    setAutoCashingOut(false);
    setDemoCrashPoint(null);
    setRealCrashPoint(null);
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    if (realIntervalRef.current) {
      clearInterval(realIntervalRef.current);
      realIntervalRef.current = null;
    }
  };

  // Demo mode game handlers
  const handleDemoStart = () => {
    if (betAmount > demoBalance) {
      setError('Insufficient demo balance!');
      return;
    }

    setError(null);
    setLastResult(null);
    setIsProcessing(true);

    // Deduct bet
    setDemoBalance(prev => prev - betAmount);

    // Generate crash point
    const crashPt = generateCrashPoint();
    setDemoCrashPoint(crashPt);
    setCrashPoint(null);

    // Brief waiting state
    setGameState('waiting');
    setBlocksRemaining(2);
    setCurrentMultiplier(1.0);
    setDisplayMultiplier(1.0);

    setTimeout(() => {
      setBlocksRemaining(1);
      setTimeout(() => {
        setBlocksRemaining(0);
        setGameState('playing');
        startTimeRef.current = Date.now();
        baseMultiplierRef.current = 1.0;
        setIsProcessing(false);

        // Start demo multiplier growth
        demoIntervalRef.current = setInterval(() => {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          const newMult = 1.0 + (elapsed * 0.1); // 0.1x per second

          if (newMult >= crashPt) {
            // Crashed!
            clearInterval(demoIntervalRef.current);
            demoIntervalRef.current = null;
            setDisplayMultiplier(crashPt);
            setCurrentMultiplier(crashPt);
            setCrashPoint(crashPt);
            setGameState('crashed');
            setLastResult({
              type: 'crash',
              multiplier: 0,
              crashPoint: crashPt,
              loss: betAmount
            });
            setGameHistory(prev => [{
              id: Date.now(),
              multiplier: crashPt,
              result: 'crash',
              amount: 0
            }, ...prev.slice(0, 9)]);
          } else {
            setDisplayMultiplier(newMult);
            setCurrentMultiplier(newMult);

            // Auto cash-out check
            if (autoMode && newMult >= targetMultiplier && !autoCashingOut) {
              handleDemoCashOut(newMult);
            }
          }
        }, 50);
      }, 1000);
    }, 1000);
  };

  const handleDemoCashOut = (mult = displayMultiplier) => {
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }

    const payout = betAmount * mult;
    setDemoBalance(prev => prev + payout);

    setDisplayMultiplier(mult);
    setCurrentMultiplier(mult);
    setCrashPoint(demoCrashPoint);
    setGameState('cashed');
    setLastResult({
      type: 'win',
      multiplier: mult,
      payout: payout,
      profit: payout - betAmount
    });
    setGameHistory(prev => [{
      id: Date.now(),
      multiplier: mult,
      result: 'win',
      amount: payout
    }, ...prev.slice(0, 9)]);
  };

  // Cleanup demo interval on unmount
  useEffect(() => {
    return () => {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
      }
    };
  }, []);

  const getMultiplierColor = () => {
    if (gameState === 'crashed') return '#ef4444';
    if (gameState === 'cashed') return '#3b82f6';
    if (displayMultiplier >= 5) return '#fbbf24';
    if (displayMultiplier >= 2) return '#3b82f6';
    return '#3b82f6';
  };

  const formatMultiplier = (mult) => {
    return mult.toFixed(2) + 'x';
  };

  // Check if user needs tickets
  const needsTickets = currentBalance <= 0;

  return (
    <div className="crash-page">
      {/* Need Tickets Overlay */}
      {needsTickets && <NeedTickets gameName="SUITRUMP Crash" isWalletConnected={isWalletConnected} />}

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

      <div className="crash-header">
        <div className="crash-title">
          <span className="crash-icon">🚀</span>
          <div>
            <h2>SUITRUMP Crash</h2>
            <p>{isDemoMode ? 'FREE PLAY | Demo Mode' : 'Cash out before it crashes!'}</p>
          </div>
        </div>
        <div className="crash-balance">
          <span className="balance-label">{isDemoMode ? 'Demo Balance' : 'Ticket Balance'}</span>
          <span className="balance-value" style={isDemoMode ? { color: '#c4b5fd' } : {}}>
            {currentBalance.toLocaleString()} tickets
          </span>
        </div>
      </div>

      {!isDemoMode && (
        <div className="contract-stats">
          <div className="stat-box">
            <span className="stat-label">House Reserve</span>
            <span className="stat-value">{houseReserve} tickets</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Growth Rate</span>
            <span className="stat-value">+0.05x/block</span>
          </div>
        </div>
      )}

      {/* Always show auto cash-out setting if enabled */}
      {autoMode && (
        <div className="auto-cashout-banner">
          <span className="auto-icon">🤖</span>
          <span className="auto-text">
            Auto Cash-Out: <strong>{targetMultiplier}x</strong> = {(betAmount * targetMultiplier).toFixed(1)} tickets
          </span>
        </div>
      )}

      <div className="crash-game">
        <div className={`crash-display ${gameState}`}>
          {/* Chart Background with Grid */}
          <div className="chart-container">
            <svg viewBox="0 0 500 300" className="chart-svg" preserveAspectRatio="xMidYMid meet">
              {/* Grid lines */}
              <defs>
                <linearGradient id="trailGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#1e40af" stopOpacity="0.3" />
                  <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#60a5fa" stopOpacity="1" />
                </linearGradient>
                <linearGradient id="trailGradientWin" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#166534" stopOpacity="0.3" />
                  <stop offset="50%" stopColor="#22c55e" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#4ade80" stopOpacity="1" />
                </linearGradient>
                <linearGradient id="trailGradientCrash" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#991b1b" stopOpacity="0.3" />
                  <stop offset="50%" stopColor="#ef4444" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#f87171" stopOpacity="1" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <filter id="strongGlow">
                  <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>

              {/* Horizontal grid lines */}
              {[1, 2, 3, 4, 5].map(i => (
                <g key={`h-${i}`}>
                  <line
                    x1="40"
                    y1={280 - (i * 50)}
                    x2="490"
                    y2={280 - (i * 50)}
                    stroke="rgba(59, 130, 246, 0.15)"
                    strokeWidth="1"
                  />
                  <text
                    x="25"
                    y={285 - (i * 50)}
                    fill="rgba(148, 163, 184, 0.6)"
                    fontSize="11"
                    textAnchor="end"
                  >
                    {i + 1}x
                  </text>
                </g>
              ))}

              {/* Vertical grid lines */}
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <line
                  key={`v-${i}`}
                  x1={40 + (i * 55)}
                  y1="30"
                  x2={40 + (i * 55)}
                  y2="280"
                  stroke="rgba(59, 130, 246, 0.1)"
                  strokeWidth="1"
                />
              ))}

              {/* Base line */}
              <line
                x1="40"
                y1="280"
                x2="490"
                y2="280"
                stroke="rgba(59, 130, 246, 0.3)"
                strokeWidth="2"
              />

              {/* The rocket trail - exponential curve */}
              <path
                className={`rocket-trail ${gameState}`}
                d={(() => {
                  const progress = Math.min((displayMultiplier - 1) / 5, 1); // 0 to 1 over 6x
                  const x = 45 + progress * 420;
                  const y = 275 - Math.pow(progress, 0.7) * 240;
                  return `M 45 275 Q ${45 + progress * 200} ${275 - progress * 100} ${x} ${Math.max(y, 35)}`;
                })()}
                fill="none"
                stroke={gameState === 'crashed' ? 'url(#trailGradientCrash)' : gameState === 'cashed' ? 'url(#trailGradientWin)' : 'url(#trailGradient)'}
                strokeWidth="5"
                strokeLinecap="round"
                filter={gameState === 'playing' ? 'url(#glow)' : gameState === 'cashed' ? 'url(#strongGlow)' : 'none'}
              />

              {/* Trail glow effect */}
              {gameState === 'playing' && (
                <path
                  className="rocket-trail-glow"
                  d={(() => {
                    const progress = Math.min((displayMultiplier - 1) / 5, 1);
                    const x = 45 + progress * 420;
                    const y = 275 - Math.pow(progress, 0.7) * 240;
                    return `M 45 275 Q ${45 + progress * 200} ${275 - progress * 100} ${x} ${Math.max(y, 35)}`;
                  })()}
                  fill="none"
                  stroke="rgba(96, 165, 250, 0.4)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  filter="url(#glow)"
                />
              )}
            </svg>

            {/* Whale mascot rising vertically on left side */}
            <div
              className={`crash-whale ${gameState}`}
              style={{
                left: '35px',
                bottom: `${5 + Math.min((displayMultiplier - 1) * 20, 80)}%`,
              }}
            >
              <img src="/suitrump-mascot.png" alt="SUIT" className="whale-mascot" />
              {gameState === 'playing' && (
                <div className="whale-flames">
                  <span>🔥</span>
                  <span>🔥</span>
                </div>
              )}
              {gameState === 'crashed' && (
                <div className="whale-explosion">
                  <span>💥</span>
                  <span>💥</span>
                  <span>💥</span>
                </div>
              )}
              {gameState === 'cashed' && (
                <div className="whale-stars">
                  <span>✨</span>
                  <span>⭐</span>
                  <span>🌟</span>
                  <span>✨</span>
                </div>
              )}
            </div>

            {/* Multiplier display at bottom */}
            <div className={`multiplier-bottom ${gameState}`}>
              <div className="multiplier-number" style={{ color: getMultiplierColor() }}>
                {formatMultiplier(displayMultiplier)}
              </div>
              {gameState === 'waiting' && (
                <div className="status-text waiting">
                  <span className="loading-dots">Launching in {blocksRemaining}</span>
                </div>
              )}
              {gameState === 'crashed' && (
                <div className="status-text crashed">
                  <span className="crash-label">CRASHED</span>
                </div>
              )}
              {gameState === 'cashed' && lastResult && (
                <div className="status-text cashed">
                  <span className="win-label">+{lastResult.profit.toFixed(2)} tickets</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {gameState === 'idle' && (
          <div className="bet-section">
            <h3>Place Your Bet</h3>

            {/* Start Button - At Top */}
            <button
              className="action-btn start"
              onClick={isDemoMode ? handleDemoStart : handleStartGame}
              disabled={isProcessing || (!isDemoMode && !CRASH_CONTRACT)}
            >
              {isProcessing ? 'Starting...' : autoMode
                ? `🚀 START @ ${targetMultiplier}x - ${betAmount} tickets`
                : `🚀 START GAME - ${betAmount} tickets`}
            </button>

            <div className="bet-presets">
              {BET_PRESETS.map(preset => (
                <button
                  key={preset}
                  className={`bet-btn ${betAmount === preset ? 'selected' : ''}`}
                  onClick={() => setBetAmount(preset)}
                  disabled={isProcessing}
                >
                  {preset}
                </button>
              ))}
            </div>
            <div className="custom-bet">
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={isProcessing}
                min="1"
              />
              <span>tickets</span>
              <span className="usd-hint">= ${(betAmount * 0.10).toFixed(2)} USD</span>
            </div>

            <div className="auto-section">
              <div className="auto-toggle">
                <button
                  className={`mode-btn ${autoMode ? 'active' : ''}`}
                  onClick={() => setAutoMode(true)}
                >
                  Auto Cash-Out
                </button>
                <button
                  className={`mode-btn ${!autoMode ? 'active' : ''}`}
                  onClick={() => setAutoMode(false)}
                >
                  Manual
                </button>
              </div>

              {autoMode && (
                <>
                  <h4>Target Multiplier</h4>
                  <div className="target-presets">
                    {TARGET_PRESETS.map(preset => (
                      <button
                        key={preset}
                        className={`target-btn ${targetMultiplier === preset ? 'selected' : ''}`}
                        onClick={() => setTargetMultiplier(preset)}
                        disabled={isProcessing}
                      >
                        {preset}x
                      </button>
                    ))}
                  </div>
                  <div className="custom-target">
                    <input
                      type="number"
                      value={targetMultiplier}
                      onChange={(e) => setTargetMultiplier(Math.max(1.1, parseFloat(e.target.value) || 1.1))}
                      disabled={isProcessing}
                      min="1.1"
                      step="0.1"
                    />
                    <span>x target</span>
                  </div>
                  <div className="auto-info">
                    Will auto cash-out at {targetMultiplier}x = <strong>{(betAmount * targetMultiplier).toFixed(1)} tickets</strong>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {gameState === 'waiting' && (
          <button className="action-btn waiting" disabled>
            ⏳ Waiting for blocks...
          </button>
        )}

        {gameState === 'playing' && (
          <>
            {autoMode && (
              <div className="auto-status">
                🤖 Auto cash-out at <strong>{targetMultiplier}x</strong>
                {autoCashingOut && ' - Cashing out...'}
              </div>
            )}
            <button
              className="action-btn cashout"
              onClick={isDemoMode ? () => handleDemoCashOut() : () => handleCashOut()}
              disabled={isProcessing || autoCashingOut}
            >
              {isProcessing || autoCashingOut ? 'Cashing out...' : `💰 CASH OUT @ ${formatMultiplier(displayMultiplier)}`}
            </button>
          </>
        )}

        {(gameState === 'crashed' || gameState === 'cashed') && (
          <button className="action-btn reset" onClick={resetGame}>
            🔄 PLAY AGAIN
          </button>
        )}

        {error && <div className="error-message">{error}</div>}

        {!isDemoMode && !CRASH_CONTRACT && (
          <div className="deploy-notice">
            ⚠️ Contract not deployed. Run deployment script first.
          </div>
        )}
      </div>

      <div className="crash-info-grid">
        <div className="info-panel">
          <h3>How To Play</h3>
          <div className="how-to-list">
            <div className="how-to-item">1. Place your bet and start the game</div>
            <div className="how-to-item">2. Watch the multiplier climb</div>
            <div className="how-to-item">3. Cash out before it crashes!</div>
            <div className="how-to-item">4. The longer you wait, the higher the risk</div>
          </div>
        </div>

        <div className="info-panel">
          <h3>Potential Wins with {betAmount} tickets</h3>
          <div className="potential-list">
            <div className="potential-row"><span>@ 1.50x</span><span>{(betAmount * 1.5).toFixed(1)} tickets</span></div>
            <div className="potential-row"><span>@ 2.00x</span><span>{(betAmount * 2).toFixed(1)} tickets</span></div>
            <div className="potential-row highlight"><span>@ 5.00x</span><span>{(betAmount * 5).toFixed(1)} tickets</span></div>
            <div className="potential-row jackpot"><span>@ 10.00x</span><span>{(betAmount * 10).toFixed(1)} tickets</span></div>
          </div>
        </div>

        <div className="info-panel">
          <h3>Recent Games</h3>
          <div className="history-list">
            {gameHistory.length === 0 ? (
              <div className="no-history">No games yet</div>
            ) : (
              gameHistory.map((game, i) => (
                <div key={i} className={`history-item ${game.result}`}>
                  <span className="history-mult">{game.multiplier.toFixed(2)}x</span>
                  <span className="history-result">
                    {game.result === 'win' ? `+${game.amount.toFixed(1)}` : 'CRASH'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <style>{`
        .crash-page { width: 100%; }

        .auto-cashout-banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px 20px;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.1));
          border: 2px solid #3b82f6;
          border-radius: 12px;
          margin-bottom: 20px;
        }
        .auto-cashout-banner .auto-icon { font-size: 1.2rem; }
        .auto-cashout-banner .auto-text { color: #94a3b8; font-size: 1rem; }
        .auto-cashout-banner .auto-text strong { color: #3b82f6; font-size: 1.1rem; }
        .crash-header { display: flex; justify-content: space-between; align-items: center; padding: 20px; background: linear-gradient(135deg, #1e293b, #0f172a); border-radius: 16px; margin-bottom: 20px; border: 2px solid #2563eb; }
        .crash-title { display: flex; align-items: center; gap: 12px; }
        .crash-icon { font-size: 2.5rem; }
        .crash-title h2 { margin: 0; color: #f8fafc; }
        .crash-title p { margin: 0; color: #94a3b8; font-size: 0.85rem; }
        .crash-balance { text-align: right; }
        .balance-label { display: block; color: #94a3b8; font-size: 0.85rem; }
        .balance-value { color: #3b82f6; font-size: 1.25rem; font-weight: 700; }

        .contract-stats { display: flex; gap: 16px; margin-bottom: 20px; }
        .stat-box { flex: 1; background: linear-gradient(135deg, #1e293b, #0f172a); border-radius: 12px; padding: 16px; text-align: center; border: 2px solid #2563eb; }
        .stat-label { display: block; color: #94a3b8; font-size: 0.85rem; margin-bottom: 4px; }
        .stat-value { color: #f8fafc; font-size: 1.25rem; font-weight: 700; }

        .crash-game { background: linear-gradient(135deg, #1e293b, #0f172a); border-radius: 16px; padding: 30px; margin-bottom: 20px; border: 2px solid #2563eb; }

        .crash-display {
          background: linear-gradient(180deg, #0a0f1a 0%, #0f172a 50%, #1e293b 100%);
          border-radius: 16px;
          padding: 0;
          text-align: center;
          border: 2px solid #2563eb;
          position: relative;
          overflow: hidden;
          min-height: 400px;
        }

        .crash-display.crashed {
          border-color: #ef4444;
          box-shadow: 0 0 30px rgba(239, 68, 68, 0.3);
        }

        .crash-display.cashed {
          border-color: #22c55e;
          box-shadow: 0 0 30px rgba(34, 197, 94, 0.3);
        }

        /* Chart Container */
        .chart-container {
          position: relative;
          width: 100%;
          height: 400px;
          overflow: hidden;
        }

        .chart-svg {
          width: 100%;
          height: 100%;
        }

        /* Rocket Trail */
        .rocket-trail {
          transition: d 0.05s linear;
        }

        .rocket-trail.playing {
          animation: trailPulse 0.5s ease-in-out infinite alternate;
        }

        .rocket-trail.crashed {
          opacity: 0.6;
        }

        .rocket-trail.cashed {
          animation: trailGlow 0.5s ease-in-out infinite alternate;
        }

        @keyframes trailPulse {
          0% { stroke-width: 5; }
          100% { stroke-width: 7; }
        }

        @keyframes trailGlow {
          0% { stroke-width: 5; filter: url(#strongGlow); }
          100% { stroke-width: 8; filter: url(#strongGlow); }
        }

        .rocket-trail-glow {
          opacity: 0.6;
        }

        /* Whale Mascot */
        .crash-whale {
          position: absolute;
          transition: bottom 0.1s linear;
          z-index: 20;
        }

        .whale-mascot {
          width: 80px;
          height: 80px;
          object-fit: contain;
          filter: drop-shadow(0 0 20px rgba(59, 130, 246, 0.9)) drop-shadow(0 4px 8px rgba(0,0,0,0.5));
          transform: rotate(-15deg);
        }

        .crash-whale.playing .whale-mascot {
          animation: whaleFly 0.3s ease-in-out infinite;
        }

        .crash-whale.crashed .whale-mascot {
          animation: whaleCrash 0.5s ease-out forwards;
          filter: drop-shadow(0 0 20px rgba(239, 68, 68, 0.8));
        }

        .crash-whale.cashed .whale-mascot {
          animation: whaleWin 0.5s ease-in-out infinite;
          filter: drop-shadow(0 0 25px rgba(34, 197, 94, 0.9));
        }

        @keyframes whaleFly {
          0%, 100% { transform: rotate(-15deg) translateY(0); }
          50% { transform: rotate(-10deg) translateY(-5px); }
        }

        @keyframes whaleCrash {
          0% { transform: rotate(-15deg) scale(1); }
          50% { transform: rotate(45deg) scale(1.2); }
          100% { transform: rotate(180deg) scale(0.3) translateY(100px); opacity: 0; }
        }

        @keyframes whaleWin {
          0%, 100% { transform: rotate(-15deg) scale(1); }
          50% { transform: rotate(-5deg) scale(1.15); }
        }

        /* Whale Flames */
        .whale-flames {
          position: absolute;
          bottom: -15px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 2px;
        }

        .whale-flames span {
          font-size: 1.2rem;
          animation: flameFlicker 0.15s ease-in-out infinite alternate;
        }

        .whale-flames span:nth-child(2) {
          animation-delay: 0.075s;
        }

        @keyframes flameFlicker {
          0% { transform: scaleY(0.8) translateY(2px); opacity: 0.8; }
          100% { transform: scaleY(1.2) translateY(-2px); opacity: 1; }
        }

        /* Whale Explosion */
        .whale-explosion {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .whale-explosion span {
          position: absolute;
          font-size: 2.5rem;
          animation: explode 0.6s ease-out forwards;
        }

        .whale-explosion span:nth-child(1) { --angle: -45deg; animation-delay: 0s; }
        .whale-explosion span:nth-child(2) { --angle: 0deg; animation-delay: 0.1s; }
        .whale-explosion span:nth-child(3) { --angle: 45deg; animation-delay: 0.2s; }

        @keyframes explode {
          0% { transform: rotate(var(--angle)) translateX(0) scale(0.5); opacity: 1; }
          100% { transform: rotate(var(--angle)) translateX(60px) scale(1.5); opacity: 0; }
        }

        /* Whale Stars */
        .whale-stars {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .whale-stars span {
          position: absolute;
          font-size: 1.5rem;
          animation: starBurst 1s ease-out infinite;
        }

        .whale-stars span:nth-child(1) { animation-delay: 0s; --angle: -60deg; --dist: 50px; }
        .whale-stars span:nth-child(2) { animation-delay: 0.2s; --angle: -20deg; --dist: 60px; }
        .whale-stars span:nth-child(3) { animation-delay: 0.4s; --angle: 20deg; --dist: 55px; }
        .whale-stars span:nth-child(4) { animation-delay: 0.6s; --angle: 60deg; --dist: 45px; }

        @keyframes starBurst {
          0% { transform: rotate(var(--angle)) translateX(0) scale(0); opacity: 0; }
          50% { transform: rotate(var(--angle)) translateX(calc(var(--dist) * 0.5)) scale(1.2); opacity: 1; }
          100% { transform: rotate(var(--angle)) translateX(var(--dist)) scale(0.5); opacity: 0; }
        }

        /* Multiplier at Bottom */
        .multiplier-bottom {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 15;
          text-align: center;
          pointer-events: none;
        }

        .multiplier-number {
          font-size: 4rem;
          font-weight: 800;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          text-shadow: 0 0 30px currentColor, 0 0 60px currentColor;
          transition: color 0.3s ease, text-shadow 0.3s ease;
        }

        .multiplier-bottom.playing .multiplier-number {
          animation: multPulse 0.5s ease-in-out infinite alternate;
        }

        .multiplier-bottom.crashed .multiplier-number {
          animation: multShake 0.3s ease-out;
          text-shadow: 0 0 60px #ef4444, 0 0 100px #ef4444;
        }

        .multiplier-bottom.cashed .multiplier-number {
          animation: multWin 0.5s ease-out;
          text-shadow: 0 0 60px #22c55e, 0 0 100px #22c55e;
        }

        @keyframes multPulse {
          0% { transform: scale(1); }
          100% { transform: scale(1.03); }
        }

        @keyframes multShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }

        @keyframes multWin {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1.05); }
        }

        /* Status Text */
        .status-text {
          margin-top: 10px;
        }

        .status-text.waiting .loading-dots {
          font-size: 1.2rem;
          color: #94a3b8;
          animation: blink 1s ease-in-out infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .status-text.crashed .crash-label {
          font-size: 2rem;
          font-weight: 800;
          color: #ef4444;
          text-shadow: 0 0 30px rgba(239, 68, 68, 0.8);
          animation: crashFlash 0.3s ease-out 3;
        }

        @keyframes crashFlash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .status-text.cashed .win-label {
          font-size: 1.5rem;
          font-weight: 700;
          color: #22c55e;
          text-shadow: 0 0 20px rgba(34, 197, 94, 0.8);
          animation: winGlow 0.5s ease-in-out infinite alternate;
        }

        @keyframes winGlow {
          0% { text-shadow: 0 0 20px rgba(34, 197, 94, 0.8); }
          100% { text-shadow: 0 0 40px rgba(34, 197, 94, 1), 0 0 60px rgba(34, 197, 94, 0.5); }
        }

        .bet-section { margin: 25px 0; text-align: center; }
        .bet-section h3 { color: #f8fafc; margin-bottom: 15px; }
        .bet-section h4 { color: #94a3b8; margin: 15px 0 10px; font-size: 0.9rem; }
        .bet-section .action-btn.start { margin: 0 auto 20px; }
        .bet-presets { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin-bottom: 15px; }
        .bet-btn { padding: 10px 20px; background: #334155; border: 2px solid #475569; border-radius: 8px; color: #f8fafc; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .bet-btn:hover:not(:disabled) { background: #475569; border-color: #3b82f6; }
        .bet-btn.selected { background: #3b82f6; border-color: #3b82f6; }
        .bet-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .auto-section { margin-top: 25px; padding-top: 20px; border-top: 1px solid #334155; }
        .auto-toggle { display: flex; justify-content: center; gap: 0; margin-bottom: 15px; }
        .mode-btn { padding: 10px 24px; background: #1e293b; border: 2px solid #334155; color: #94a3b8; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .mode-btn:first-child { border-radius: 8px 0 0 8px; }
        .mode-btn:last-child { border-radius: 0 8px 8px 0; border-left: none; }
        .mode-btn.active { background: #3b82f6; border-color: #3b82f6; color: white; }
        .mode-btn:hover:not(.active) { background: #334155; }

        .target-presets { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
        .target-btn { padding: 8px 16px; background: #1e293b; border: 2px solid #334155; border-radius: 8px; color: #f8fafc; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .target-btn:hover:not(:disabled) { border-color: #3b82f6; }
        .target-btn.selected { background: #3b82f6; border-color: #3b82f6; }

        .custom-target { display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 10px; }
        .custom-target input { width: 80px; padding: 8px; background: #334155; border: 2px solid #475569; border-radius: 8px; color: #f8fafc; font-size: 1rem; text-align: center; }
        .custom-target input:focus { outline: none; border-color: #3b82f6; }
        .custom-target span { color: #94a3b8; font-weight: 600; }

        .auto-info { margin-top: 12px; color: #94a3b8; font-size: 0.9rem; }
        .auto-info strong { color: #3b82f6; }

        .auto-status { text-align: center; margin-bottom: 15px; padding: 12px; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px; color: #3b82f6; font-weight: 600; }

        .custom-bet {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .custom-bet input {
          width: 100px;
          padding: 10px;
          background: #334155;
          border: 2px solid #475569;
          border-radius: 8px;
          color: #f8fafc;
          font-size: 1rem;
          text-align: center;
        }

        .custom-bet input:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .custom-bet span {
          color: #94a3b8;
          font-weight: 600;
        }

        .action-btn {
          width: 100%;
          max-width: 400px;
          padding: 18px 32px;
          font-size: 1.25rem;
          font-weight: 700;
          color: white;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          display: block;
          margin: 25px auto 0;
          transition: all 0.2s;
        }

        .action-btn.start {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
        }

        .action-btn.start:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(59, 130, 246, 0.4);
        }

        .action-btn.waiting {
          background: linear-gradient(135deg, #475569, #334155);
          cursor: not-allowed;
        }

        .action-btn.cashout {
          background: linear-gradient(135deg, #3b82f6, #0284c7);
          animation: cashoutPulse 1s ease infinite;
        }

        @keyframes cashoutPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(56, 189, 248, 0.4); }
          50% { box-shadow: 0 0 40px rgba(56, 189, 248, 0.6); }
        }

        .action-btn.cashout:hover:not(:disabled) {
          transform: translateY(-2px);
        }

        .action-btn.reset {
          background: linear-gradient(135deg, #6366f1, #4f46e5);
        }

        .action-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .error-message {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
          padding: 12px;
          border-radius: 8px;
          margin-top: 15px;
          text-align: center;
        }

        .deploy-notice {
          background: rgba(251, 191, 36, 0.1);
          border: 1px solid rgba(251, 191, 36, 0.3);
          color: #fbbf24;
          padding: 12px;
          border-radius: 8px;
          margin-top: 15px;
          text-align: center;
        }

        .crash-info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
        .info-panel { background: linear-gradient(135deg, #1e293b, #0f172a); border-radius: 12px; padding: 20px; border: 2px solid #2563eb; }
        .info-panel h3 { color: #f8fafc; margin: 0 0 15px 0; font-size: 1rem; border-bottom: 1px solid #334155; padding-bottom: 10px; }

        .how-to-list { display: flex; flex-direction: column; gap: 10px; }
        .how-to-item { color: #94a3b8; font-size: 0.9rem; padding-left: 10px; border-left: 2px solid #3b82f6; }

        .potential-list { display: flex; flex-direction: column; gap: 8px; }
        .potential-row { display: flex; justify-content: space-between; color: #94a3b8; font-size: 0.9rem; }
        .potential-row.highlight { color: #3b82f6; font-weight: 600; }
        .potential-row.jackpot { color: #fbbf24; font-weight: 600; }

        .history-list { display: flex; flex-direction: column; gap: 8px; }
        .no-history { color: #64748b; font-size: 0.9rem; text-align: center; padding: 20px; }
        .history-item { display: flex; justify-content: space-between; padding: 8px 12px; border-radius: 6px; font-size: 0.9rem; }
        .history-item.win { background: rgba(56, 189, 248, 0.1); color: #3b82f6; }
        .history-item.crash { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .history-mult { font-weight: 600; }

        @media (max-width: 600px) {
          .crash-header { flex-direction: column; gap: 15px; text-align: center; }
          .contract-stats { flex-direction: column; }
          .crash-display { min-height: 300px; }
          .chart-container { height: 300px; }
          .multiplier-number { font-size: 2.5rem; }
          .multiplier-bottom { bottom: 15px; }
          .whale-mascot { width: 60px; height: 60px; }
          .status-text.crashed .crash-label { font-size: 1.5rem; }
          .status-text.cashed .win-label { font-size: 1.2rem; }
        }
      `}</style>
    </div>
  );
}

export default CrashPage;
