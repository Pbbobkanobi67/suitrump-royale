import React, { useState, useEffect, useRef, useCallback } from 'react';
// TODO: Replace ethers with Sui SDK
import { useDemoContext } from '../contexts/DemoContext';

// Contract addresses - Sui Testnet
const CRASH_ADDRESS = "0x10A3c6073CCE7284C19Cc0128BD4872585BEB821";
const SUIT_TOKEN = "0xf11Af396703E11D48780B5154E52Fd7b430C6C01";

const CRASH_ABI = [
  "function startGame(uint256 betAmount) returns (uint256 gameId)",
  "function cashOut(uint256 gameId)",
  "function getCurrentMultiplier(uint256 gameId) view returns (uint256)",
  "function blocksUntilReveal(uint256 gameId) view returns (uint256)",
  "function getPlayerActiveGame(address player) view returns (uint256)",
  "function houseReserve() view returns (uint256)",
  "function minBet() view returns (uint256)",
  "function maxBet() view returns (uint256)",
  "function getGame(uint256 gameId) view returns (address player, uint256 betAmount, uint256 startBlock, uint256 revealBlock, uint256 crashPoint, uint256 cashOutMultiplier, uint8 state)",
  "function getStats() view returns (uint256 totalGames, uint256 totalWagered, uint256 totalPaidOut, uint256 houseReserve)",
  "event GameStarted(uint256 indexed gameId, address indexed player, uint256 betAmount, uint256 revealBlock)",
  "event CashOut(uint256 indexed gameId, address indexed player, uint256 multiplier, uint256 payout)",
  "event GameCrashed(uint256 indexed gameId, address indexed player, uint256 crashPoint, uint256 cashOutMultiplier)"
];

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

function CrashPage({ wallet }) {
  const { isDemoMode, demoBalance, setDemoBalance } = useDemoContext();
  const [betAmount, setBetAmount] = useState(10);
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

  // Auto cash-out settings
  const [autoMode, setAutoMode] = useState(true);
  const [targetMultiplier, setTargetMultiplier] = useState(2.0);
  const [autoCashingOut, setAutoCashingOut] = useState(false);

  const animationRef = useRef(null);
  const startTimeRef = useRef(null);
  const baseMultiplierRef = useRef(1.0);

  // Smooth multiplier animation
  const animateMultiplier = useCallback(() => {
    if (gameState !== 'playing') return;

    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    // Simulate smooth growth between blocks (~2 sec per block on Base)
    const smoothMultiplier = baseMultiplierRef.current + (elapsed * 0.025); // ~0.05x per 2 seconds

    setDisplayMultiplier(smoothMultiplier);
    animationRef.current = requestAnimationFrame(animateMultiplier);
  }, [gameState]);

  // Start animation when playing
  useEffect(() => {
    if (gameState === 'playing') {
      startTimeRef.current = Date.now();
      baseMultiplierRef.current = currentMultiplier;
      animationRef.current = requestAnimationFrame(animateMultiplier);
    } else if (gameState === 'idle' || gameState === 'waiting') {
      // Only cancel animation for idle/waiting states, not cashed/crashed
      // (those states handle their own animation cleanup)
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
  }, [gameState, currentMultiplier, animateMultiplier]);

  // Fetch balance and contract data
  useEffect(() => {
    if (!wallet?.account || !wallet?.signer || CRASH_ADDRESS === "0x0000000000000000000000000000000000000000") return;

    const fetchData = async () => {
      try {
        const blueToken = new ethers.Contract(
          SUIT_TOKEN,
          ["function balanceOf(address) view returns (uint256)"],
          wallet.signer
        );
        const bal = await blueToken.balanceOf(wallet.account);
        setBalance(parseFloat(ethers.formatEther(bal)).toLocaleString());

        const crash = new ethers.Contract(CRASH_ADDRESS, CRASH_ABI, wallet.signer);
        const [reserve, activeId] = await Promise.all([
          crash.houseReserve(),
          crash.getPlayerActiveGame(wallet.account)
        ]);

        setHouseReserve(parseFloat(ethers.formatEther(reserve)).toLocaleString());

        if (activeId > 0n) {
          setActiveGameId(Number(activeId));
          const blocks = await crash.blocksUntilReveal(activeId);
          setBlocksRemaining(Number(blocks));

          if (Number(blocks) === 0) {
            setGameState('playing');
            const mult = await crash.getCurrentMultiplier(activeId);
            setCurrentMultiplier(Number(mult) / MULTIPLIER_PRECISION);
          } else {
            setGameState('waiting');
          }
        }
      } catch (err) {
        console.error('Fetch error:', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [wallet?.signer, wallet?.account]);

  // Poll for game state updates and auto cash-out
  useEffect(() => {
    if (!activeGameId || !wallet?.signer || CRASH_ADDRESS === "0x0000000000000000000000000000000000000000") return;

    const checkGame = async () => {
      try {
        const crash = new ethers.Contract(CRASH_ADDRESS, CRASH_ABI, wallet.signer);
        const blocks = await crash.blocksUntilReveal(activeGameId);
        setBlocksRemaining(Number(blocks));

        if (Number(blocks) === 0 && gameState === 'waiting') {
          setGameState('playing');
          startTimeRef.current = Date.now();
          baseMultiplierRef.current = 1.0;
        }

        if (gameState === 'playing') {
          const mult = await crash.getCurrentMultiplier(activeGameId);
          const newMult = Number(mult) / MULTIPLIER_PRECISION;
          setCurrentMultiplier(newMult);
          baseMultiplierRef.current = newMult;
          startTimeRef.current = Date.now();

          // Auto cash-out when target reached
          if (autoMode && newMult >= targetMultiplier && !autoCashingOut && !isProcessing) {
            setAutoCashingOut(true);
            handleCashOut();
          }
        }
      } catch (err) {
        console.error('Game check error:', err);
      }
    };

    checkGame();
    const interval = setInterval(checkGame, 1500); // Faster polling for auto-cashout
    return () => clearInterval(interval);
  }, [activeGameId, wallet?.signer, gameState, autoMode, targetMultiplier, autoCashingOut, isProcessing]);

  const handleStartGame = async () => {
    if (!wallet?.signer) {
      setError('Please connect your wallet first');
      return;
    }
    if (CRASH_ADDRESS === "0x0000000000000000000000000000000000000000") {
      setError('Contract not deployed yet');
      return;
    }

    try {
      setError(null);
      setLastResult(null);
      setIsProcessing(true);
      setCrashPoint(null);

      const crash = new ethers.Contract(CRASH_ADDRESS, CRASH_ABI, wallet.signer);
      const betWei = ethers.parseEther(betAmount.toString());

      // Approve tokens
      const blueToken = new ethers.Contract(
        SUIT_TOKEN,
        ["function approve(address,uint256) returns (bool)"],
        wallet.signer
      );
      const approveTx = await blueToken.approve(CRASH_ADDRESS, betWei);
      await approveTx.wait();

      // Start game
      const tx = await crash.startGame(betWei);
      const receipt = await tx.wait();

      // Find GameStarted event
      for (const log of receipt.logs) {
        try {
          const parsed = crash.interface.parseLog({ topics: log.topics, data: log.data });
          if (parsed?.name === 'GameStarted') {
            setActiveGameId(Number(parsed.args.gameId));
            setBlocksRemaining(2);
            setGameState('waiting');
            setCurrentMultiplier(1.0);
            setDisplayMultiplier(1.0);
            break;
          }
        } catch (e) {}
      }

      setIsProcessing(false);
    } catch (err) {
      console.error('Start game error:', err);
      setError(err.reason || err.message || 'Failed to start game');
      setIsProcessing(false);
    }
  };

  const handleCashOut = async () => {
    if (!activeGameId || !wallet?.signer) return;

    try {
      setError(null);
      setIsProcessing(true);

      const crash = new ethers.Contract(CRASH_ADDRESS, CRASH_ABI, wallet.signer);
      const tx = await crash.cashOut(activeGameId);
      const receipt = await tx.wait();

      // Check for CashOut or GameCrashed event
      for (const log of receipt.logs) {
        try {
          const parsed = crash.interface.parseLog({ topics: log.topics, data: log.data });

          if (parsed?.name === 'CashOut') {
            const mult = Number(parsed.args.multiplier) / MULTIPLIER_PRECISION;
            const payout = parseFloat(ethers.formatEther(parsed.args.payout));

            // Stop animation FIRST and set display value immediately
            if (animationRef.current) {
              cancelAnimationFrame(animationRef.current);
              animationRef.current = null;
            }

            // Set all values in one batch to avoid flicker
            setDisplayMultiplier(mult);
            setCurrentMultiplier(mult);
            setCrashPoint(mult + 0.5); // Crash was higher
            setLastResult({
              type: 'win',
              multiplier: mult,
              payout: payout,
              profit: payout - betAmount
            });
            setGameState('cashed');

            // Add to history
            setGameHistory(prev => [{
              id: activeGameId,
              multiplier: mult,
              result: 'win',
              amount: payout
            }, ...prev.slice(0, 9)]);
            break;
          }

          if (parsed?.name === 'GameCrashed') {
            const crashMult = Number(parsed.args.crashPoint) / MULTIPLIER_PRECISION;
            const playerMult = Number(parsed.args.cashOutMultiplier) / MULTIPLIER_PRECISION;

            setLastResult({
              type: 'crash',
              multiplier: playerMult,
              crashPoint: crashMult,
              loss: betAmount
            });
            // Stop animation and show crash point
            if (animationRef.current) {
              cancelAnimationFrame(animationRef.current);
              animationRef.current = null;
            }
            setDisplayMultiplier(crashMult);
            setCurrentMultiplier(crashMult);
            setCrashPoint(crashMult);
            setGameState('crashed');

            // Add to history
            setGameHistory(prev => [{
              id: activeGameId,
              multiplier: crashMult,
              result: 'crash',
              amount: 0
            }, ...prev.slice(0, 9)]);
            break;
          }
        } catch (e) {}
      }

      setActiveGameId(null);
      setIsProcessing(false);
    } catch (err) {
      console.error('Cash out error:', err);
      setError(err.reason || err.message || 'Failed to cash out');
      setIsProcessing(false);
    }
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
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
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

  return (
    <div className="crash-page">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="demo-mode-banner">
          <span className="demo-icon">🎮</span>
          <span className="demo-text">
            <strong>FREE PLAY MODE</strong> - Practice with {demoBalance.toLocaleString()} demo SUIT tokens. No wallet needed!
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
          <span className="balance-label">{isDemoMode ? 'Demo Balance' : 'Balance'}</span>
          <span className="balance-value" style={isDemoMode ? { color: '#c4b5fd' } : {}}>
            {isDemoMode ? demoBalance.toLocaleString() : balance} SUIT
          </span>
        </div>
      </div>

      {!isDemoMode && (
        <div className="contract-stats">
          <div className="stat-box">
            <span className="stat-label">House Reserve</span>
            <span className="stat-value">{houseReserve} SUIT</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Growth Rate</span>
            <span className="stat-value">+0.05x/block</span>
          </div>
        </div>
      )}

      <div className="crash-game">
        <div className="crash-display">
          {/* Whale Arc Animation */}
          <div className="whale-arc-container">
            <svg viewBox="0 0 400 200" className="arc-svg" preserveAspectRatio="xMidYMid meet">
              {/* Arc path - curves up based on multiplier */}
              <path
                className={`arc-path ${gameState}`}
                d={`M 20 180 Q ${Math.min(20 + (displayMultiplier - 1) * 40, 350)} ${Math.max(180 - (displayMultiplier - 1) * 30, 20)} ${Math.min(20 + (displayMultiplier - 1) * 50, 380)} ${Math.max(180 - (displayMultiplier - 1) * 35, 10)}`}
                fill="none"
                stroke="url(#arcGradient)"
                strokeWidth="4"
                strokeLinecap="round"
              />
              {/* Gradient definition */}
              <defs>
                <linearGradient id="arcGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
            </svg>

            {/* Whale at the tip of the arc */}
            <div
              className={`whale-rider ${gameState}`}
              style={{
                left: `${Math.min(5 + (displayMultiplier - 1) * 12, 90)}%`,
                bottom: `${Math.min(10 + (displayMultiplier - 1) * 17, 85)}%`
              }}
            >
              <img src="/suitrump-mascot.png" alt="whale" className="whale-img" />
              {gameState === 'crashed' && (
                <div className="explosion">
                  <span>💥</span>
                  <span>💥</span>
                  <span>💥</span>
                </div>
              )}
              {gameState === 'cashed' && (
                <div className="celebration">
                  <span>🎉</span>
                  <span>⭐</span>
                  <span>✨</span>
                  <span>🎊</span>
                </div>
              )}
            </div>
          </div>

          <div
            className={`multiplier-value ${gameState}`}
            style={{ color: getMultiplierColor() }}
          >
            {formatMultiplier(displayMultiplier)}
          </div>

          {gameState === 'waiting' && (
            <div className="waiting-message">
              <span className="waiting-icon">⏳</span>
              Waiting for {blocksRemaining} block{blocksRemaining !== 1 ? 's' : ''}...
            </div>
          )}

          {gameState === 'crashed' && (
            <div className="crash-message">
              <span className="crash-banner">CRASHED!</span>
              <span className="crash-at">@ {formatMultiplier(crashPoint || displayMultiplier)}</span>
            </div>
          )}

          {gameState === 'cashed' && lastResult && (
            <div className="win-message">
              <span className="win-banner">CASHED OUT!</span>
              <span className="win-amount">+{lastResult.profit.toFixed(2)} SUIT</span>
            </div>
          )}
        </div>

        {gameState === 'idle' && (
          <div className="bet-section">
            <h3>Place Your Bet</h3>
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
              <span>SUIT</span>
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
                    Will auto cash-out at {targetMultiplier}x = <strong>{(betAmount * targetMultiplier).toFixed(1)} SUIT</strong>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {gameState === 'idle' && (
          <button
            className="action-btn start"
            onClick={isDemoMode ? handleDemoStart : handleStartGame}
            disabled={isProcessing || (!isDemoMode && CRASH_ADDRESS === "0x0000000000000000000000000000000000000000")}
          >
            {isProcessing ? 'Starting...' : autoMode
              ? `🚀 START @ ${targetMultiplier}x - ${betAmount} SUIT`
              : `🚀 START GAME - ${betAmount} SUIT`}
          </button>
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
              onClick={isDemoMode ? () => handleDemoCashOut() : handleCashOut}
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

        {!isDemoMode && CRASH_ADDRESS === "0x0000000000000000000000000000000000000000" && (
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
          <h3>Potential Wins with {betAmount} SUIT</h3>
          <div className="potential-list">
            <div className="potential-row"><span>@ 1.50x</span><span>{(betAmount * 1.5).toFixed(1)} SUIT</span></div>
            <div className="potential-row"><span>@ 2.00x</span><span>{(betAmount * 2).toFixed(1)} SUIT</span></div>
            <div className="potential-row highlight"><span>@ 5.00x</span><span>{(betAmount * 5).toFixed(1)} SUIT</span></div>
            <div className="potential-row jackpot"><span>@ 10.00x</span><span>{(betAmount * 10).toFixed(1)} SUIT</span></div>
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
          background: linear-gradient(180deg, #0f172a, #1e293b);
          border-radius: 16px;
          padding: 30px 30px 40px;
          text-align: center;
          border: 2px solid #2563eb;
          position: relative;
          overflow: hidden;
          min-height: 320px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
        }

        /* Whale Arc Container */
        .whale-arc-container {
          position: relative;
          width: 100%;
          height: 180px;
          margin-bottom: 10px;
        }

        .arc-svg {
          width: 100%;
          height: 100%;
          position: absolute;
          top: 0;
          left: 0;
        }

        .arc-path {
          transition: d 0.1s ease-out;
          filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.5));
        }

        .arc-path.crashed {
          stroke: #ef4444;
          filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.5));
        }

        .arc-path.cashed {
          stroke: #3b82f6;
          filter: drop-shadow(0 0 12px rgba(56, 189, 248, 0.6));
        }

        /* Whale Rider */
        .whale-rider {
          position: absolute;
          transition: left 0.1s ease-out, bottom 0.1s ease-out;
          z-index: 10;
        }

        .whale-img {
          width: 50px;
          height: 50px;
          object-fit: contain;
          filter: drop-shadow(0 0 10px rgba(59, 130, 246, 0.6));
          transition: transform 0.2s ease;
        }

        .whale-rider.playing .whale-img {
          animation: whaleFloat 0.5s ease-in-out infinite;
        }

        .whale-rider.crashed {
          animation: whaleFall 0.8s ease-in forwards;
        }

        .whale-rider.crashed .whale-img {
          animation: whaleExplode 0.3s ease-out forwards;
        }

        .whale-rider.cashed .whale-img {
          animation: whaleCelebrate 0.5s ease-in-out 3;
        }

        @keyframes whaleFloat {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50% { transform: translateY(-5px) rotate(5deg); }
        }

        @keyframes whaleFall {
          0% { transform: translateY(0); }
          100% { transform: translateY(150px) rotate(180deg); opacity: 0; }
        }

        @keyframes whaleExplode {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); }
          100% { transform: scale(0); opacity: 0; }
        }

        @keyframes whaleCelebrate {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.2) rotate(-10deg); }
          50% { transform: scale(1.1) rotate(10deg); }
          75% { transform: scale(1.2) rotate(-5deg); }
        }

        /* Explosion Effect */
        .explosion {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .explosion span {
          position: absolute;
          font-size: 2rem;
          animation: explodePiece 0.6s ease-out forwards;
        }

        .explosion span:nth-child(1) { animation-delay: 0s; }
        .explosion span:nth-child(2) { animation-delay: 0.1s; }
        .explosion span:nth-child(3) { animation-delay: 0.2s; }

        @keyframes explodePiece {
          0% { transform: translate(0, 0) scale(0.5); opacity: 1; }
          100% { transform: translate(var(--tx, 30px), var(--ty, -30px)) scale(1.5); opacity: 0; }
        }

        .explosion span:nth-child(1) { --tx: -40px; --ty: -40px; }
        .explosion span:nth-child(2) { --tx: 40px; --ty: -30px; }
        .explosion span:nth-child(3) { --tx: 0px; --ty: 50px; }

        /* Celebration Effect */
        .celebration {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .celebration span {
          position: absolute;
          font-size: 1.5rem;
          animation: celebratePiece 1s ease-out infinite;
        }

        .celebration span:nth-child(1) { animation-delay: 0s; --tx: -50px; --ty: -60px; }
        .celebration span:nth-child(2) { animation-delay: 0.15s; --tx: 50px; --ty: -50px; }
        .celebration span:nth-child(3) { animation-delay: 0.3s; --tx: -30px; --ty: -80px; }
        .celebration span:nth-child(4) { animation-delay: 0.45s; --tx: 40px; --ty: -70px; }

        @keyframes celebratePiece {
          0% { transform: translate(0, 0) scale(0); opacity: 0; }
          50% { transform: translate(calc(var(--tx) / 2), calc(var(--ty) / 2)) scale(1.2); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(0.5); opacity: 0; }
        }

        .multiplier-value {
          font-size: 5rem;
          font-weight: 800;
          font-family: 'JetBrains Mono', monospace;
          text-shadow: 0 0 30px currentColor;
          transition: color 0.3s ease;
        }

        .multiplier-value.playing {
          animation: pulse 1s ease infinite;
        }

        .multiplier-value.crashed {
          animation: shake 0.5s ease;
        }

        .multiplier-value.cashed {
          animation: celebrate 0.5s ease;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }

        @keyframes celebrate {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }

        .waiting-message {
          margin-top: 20px;
          color: #94a3b8;
          font-size: 1.2rem;
        }

        .waiting-icon {
          margin-right: 8px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .crash-message, .win-message {
          margin-top: 20px;
          text-align: center;
        }

        .crash-banner {
          display: block;
          font-size: 2rem;
          font-weight: 800;
          color: #ef4444;
          text-shadow: 0 0 20px rgba(239, 68, 68, 0.5);
        }

        .crash-at {
          display: block;
          font-size: 1.2rem;
          color: #94a3b8;
          margin-top: 5px;
        }

        .win-banner {
          display: block;
          font-size: 2rem;
          font-weight: 800;
          color: #3b82f6;
          text-shadow: 0 0 20px rgba(56, 189, 248, 0.5);
        }

        .win-amount {
          display: block;
          font-size: 1.5rem;
          font-weight: 700;
          color: #3b82f6;
          margin-top: 5px;
        }

        .rocket-trail {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
        }

        .rocket {
          font-size: 2rem;
          animation: rocketFly 0.5s ease infinite;
        }

        @keyframes rocketFly {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }

        .bet-section { margin: 25px 0; text-align: center; }
        .bet-section h3 { color: #f8fafc; margin-bottom: 15px; }
        .bet-section h4 { color: #94a3b8; margin: 15px 0 10px; font-size: 0.9rem; }
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
          .multiplier-value { font-size: 3.5rem; }
          .crash-display { padding: 40px 20px; min-height: 160px; }
        }
      `}</style>
    </div>
  );
}

export default CrashPage;
