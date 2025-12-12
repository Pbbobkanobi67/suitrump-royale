import React, { useState, useEffect, useCallback } from 'react';
// TODO: Replace ethers with Sui SDK
import { useDemoContext } from '../contexts/DemoContext';

// Hardcoded config to avoid import issues
const SLOTS_ADDRESS = "0xD7eC02f33B02DE7b4a0ab835a2F0284C9a6FC0Ef";
const SUIT_TOKEN = "0xf11Af396703E11D48780B5154E52Fd7b430C6C01";

const SLOTS_ABI = [
  "function spin(uint256 betAmount) returns (uint256 spinId)",
  "function reveal(uint256 spinId) returns (uint256 winAmount)",
  "function getPendingSpin(address player) view returns (uint256)",
  "function blocksUntilReveal(uint256 spinId) view returns (uint256)",
  "function houseReserve() view returns (uint256)",
  "function jackpotPool() view returns (uint256)",
  "function getPlayerStats(address player) view returns (tuple(uint256 totalSpins, uint256 totalWagered, uint256 totalWon, uint256 biggestWin, uint256 freeSpinsUsed))",
  "event SpinStarted(uint256 indexed spinId, address indexed player, uint256 betAmount, bool isFreeSpin)",
  "event SpinRevealed(uint256 indexed spinId, address indexed player, uint8[3] symbols, uint8[3] symbolTypes, uint256 winAmount)"
];

const SYMBOLS = {
  0: { name: 'SUIT', emoji: '🔵', color: '#3B82F6' },
  1: { name: 'DIAMOND', emoji: '💎', color: '#A855F7' },
  2: { name: 'FIRE', emoji: '🔥', color: '#EF4444' },
  3: { name: 'STAR', emoji: '⭐', color: '#FBBF24' },
  4: { name: 'LUCKY', emoji: '🍀', color: '#22C55E' },
  5: { name: 'SEVEN', emoji: '🎰', color: '#EC4899' }
};

const BET_PRESETS = [1, 5, 10, 25, 50, 100];

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

function SlotsPage({ wallet }) {
  const { isDemoMode, demoBalance, setDemoBalance } = useDemoContext();
  const [betAmount, setBetAmount] = useState(10);
  const [balance, setBalance] = useState('0');
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
        if (spinIntervalRef.current) {
          clearInterval(spinIntervalRef.current);
          spinIntervalRef.current = null;
        }
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

  // Fetch contract data
  useEffect(() => {
    if (!wallet?.account || !wallet?.signer) return;

    const fetchData = async () => {
      try {
        // Get SUIT balance
        const blueToken = new ethers.Contract(
          SUIT_TOKEN,
          ["function balanceOf(address) view returns (uint256)"],
          wallet.signer
        );
        const bal = await blueToken.balanceOf(wallet.account);
        setBalance(parseFloat(ethers.formatEther(bal)).toLocaleString());

        // Get slots contract data
        const slots = new ethers.Contract(SLOTS_ADDRESS, SLOTS_ABI, wallet.signer);

        const [reserve, jackpot, pendingId, playerStats] = await Promise.all([
          slots.houseReserve(),
          slots.jackpotPool(),
          slots.getPendingSpin(wallet.account),
          slots.getPlayerStats(wallet.account)
        ]);

        setHouseReserve(parseFloat(ethers.formatEther(reserve)).toLocaleString());
        setJackpotPool(parseFloat(ethers.formatEther(jackpot)).toLocaleString());
        const hasPending = pendingId > 0n;
        setPendingSpinId(hasPending ? Number(pendingId) : null);
        // Start spinning if there's a pending spin
        if (hasPending) {
          setIsSpinning(true);
          startSpinning();
        }
        setStats({
          totalSpins: Number(playerStats.totalSpins),
          totalWagered: parseFloat(ethers.formatEther(playerStats.totalWagered)).toFixed(2),
          totalWon: parseFloat(ethers.formatEther(playerStats.totalWon)).toFixed(2),
          biggestWin: parseFloat(ethers.formatEther(playerStats.biggestWin)).toFixed(2)
        });
      } catch (err) {
        console.error('Fetch error:', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [wallet?.signer, wallet?.account]);

  // Check blocks for pending spin and auto-reveal when ready
  const [autoRevealing, setAutoRevealing] = useState(false);

  useEffect(() => {
    if (!pendingSpinId || !wallet?.signer) return;

    const checkBlocks = async () => {
      try {
        const slots = new ethers.Contract(SLOTS_ADDRESS, SLOTS_ABI, wallet.signer);
        const blocks = await slots.blocksUntilReveal(pendingSpinId);
        const blocksNum = Number(blocks);
        setBlocksRemaining(blocksNum);

        // Auto-reveal when blocks reach 0
        if (blocksNum === 0 && !autoRevealing) {
          setAutoRevealing(true);
          // Small delay to let UI update
          setTimeout(() => {
            handleReveal();
          }, 500);
        }
      } catch (err) {
        console.error('Block check error:', err);
      }
    };

    checkBlocks();
    const interval = setInterval(checkBlocks, 2000);
    return () => clearInterval(interval);
  }, [pendingSpinId, wallet?.signer, autoRevealing]);

  // Reset autoRevealing when pendingSpinId changes
  useEffect(() => {
    if (!pendingSpinId) {
      setAutoRevealing(false);
    }
  }, [pendingSpinId]);

  const handleSpin = async () => {
    if (!wallet?.signer) {
      setError('Please connect your wallet');
      return;
    }

    try {
      setError(null);
      setLastWin(null);
      setIsSpinning(true);

      const slots = new ethers.Contract(SLOTS_ADDRESS, SLOTS_ABI, wallet.signer);
      const betWei = ethers.parseEther(betAmount.toString());

      // Approve tokens
      const blueToken = new ethers.Contract(
        SUIT_TOKEN,
        ["function approve(address,uint256) returns (bool)"],
        wallet.signer
      );
      const approveTx = await blueToken.approve(SLOTS_ADDRESS, betWei);
      await approveTx.wait();

      // Start spinning animation immediately when user signs
      startSpinning();

      // Spin
      const spinTx = await slots.spin(betWei);
      const receipt = await spinTx.wait();

      // Find SpinStarted event - ethers v6 format
      let foundSpinId = null;
      for (const log of receipt.logs) {
        try {
          const parsed = slots.interface.parseLog({ topics: log.topics, data: log.data });
          if (parsed?.name === 'SpinStarted') {
            foundSpinId = Number(parsed.args.spinId);
            console.log('Spin started! ID:', foundSpinId);
            break;
          }
        } catch (e) {
          // Not our event, skip
        }
      }

      // Fallback: check contract for pending spin if event parsing failed
      if (!foundSpinId) {
        const pendingId = await slots.getPendingSpin(wallet.account);
        if (pendingId > 0n) {
          foundSpinId = Number(pendingId);
          console.log('Found pending spin from contract:', foundSpinId);
        }
      }

      if (foundSpinId) {
        setPendingSpinId(foundSpinId);
        setBlocksRemaining(1);
        // Keep spinning - don't stop until reveal
      }

      // Don't set isSpinning to false - keep it true until reveal completes
    } catch (err) {
      console.error('Spin error:', err);
      setError(err.reason || err.message || 'Spin failed');
      setIsSpinning(false);
      // Stop spinning on error
      if (spinIntervalRef.current) {
        clearInterval(spinIntervalRef.current);
        spinIntervalRef.current = null;
      }
      setAnimatingReels([false, false, false]);
    }
  };

  const handleReveal = async () => {
    if (!pendingSpinId || !wallet?.signer) return;

    try {
      setError(null);
      // Keep spinning if not already (in case of page reload with pending spin)
      if (!spinIntervalRef.current) {
        startSpinning();
      }

      const slots = new ethers.Contract(SLOTS_ADDRESS, SLOTS_ABI, wallet.signer);
      const revealTx = await slots.reveal(pendingSpinId);
      const receipt = await revealTx.wait();

      // Find SpinRevealed event - ethers v6 format
      let finalSymbols = [3, 3, 3]; // Default to stars
      let winAmountNum = 0;

      for (const log of receipt.logs) {
        try {
          const parsed = slots.interface.parseLog({ topics: log.topics, data: log.data });
          if (parsed?.name === 'SpinRevealed') {
            // Use symbolTypes (0-5) not symbols (0-19 positions)
            finalSymbols = parsed.args.symbolTypes.map(s => Number(s));
            const winAmount = parsed.args.winAmount;
            winAmountNum = parseFloat(ethers.formatEther(winAmount));
            console.log('Spin revealed! Symbol types:', finalSymbols, 'Win:', winAmountNum);
            break;
          }
        } catch (e) {
          // Not our event, skip
        }
      }

      // Stop spinning with dramatic reel-by-reel stop
      await stopSpinning(finalSymbols);

      // Determine result type and show notification
      const isJackpot = finalSymbols[0] === 0 && finalSymbols[1] === 0 && finalSymbols[2] === 0; // Triple SUIT
      if (winAmountNum > 0) {
        setLastWin(winAmountNum);
        setShowResult({
          type: isJackpot ? 'jackpot' : 'win',
          amount: winAmountNum,
          symbols: finalSymbols
        });
      } else {
        setLastWin(null);
        setShowResult({
          type: 'loss',
          amount: betAmount,
          symbols: finalSymbols
        });
      }

      setPendingSpinId(null);
      setBlocksRemaining(0);
      setIsSpinning(false);
    } catch (err) {
      console.error('Reveal error:', err);
      setError(err.reason || err.message || 'Reveal failed');
      setIsSpinning(false);
      // Stop spinning on error
      if (spinIntervalRef.current) {
        clearInterval(spinIntervalRef.current);
        spinIntervalRef.current = null;
      }
      setAnimatingReels([false, false, false]);
    }
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
    if (!isDemoMode && pendingSpinId && blocksRemaining > 0) return `Wait ${blocksRemaining} blocks...`;
    if (!isDemoMode && pendingSpinId && blocksRemaining === 0) return 'REVEAL RESULT';
    return `SPIN - ${betAmount} SUIT`;
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

  const isDisabled = isSpinning || (!isDemoMode && pendingSpinId && blocksRemaining > 0);

  const dismissResult = () => setShowResult(null);

  return (
    <div className="slots-page">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="demo-mode-banner">
          <span className="demo-icon">🎮</span>
          <span className="demo-text">
            <strong>FREE PLAY MODE</strong> - Practice with {demoBalance.toLocaleString()} demo SUIT tokens. No wallet needed!
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
                    <span key={i} className="result-symbol jackpot-symbol">{SYMBOLS[s]?.emoji}</span>
                  ))}
                </div>
                <div className="result-amount jackpot-amount">+{showResult.amount.toLocaleString()} SUIT</div>
                <div className="result-subtitle">{isDemoMode ? 'Demo jackpot!' : 'You hit the progressive jackpot!'}</div>
              </>
            )}
            {showResult.type === 'win' && (
              <>
                <div className="result-banner win-banner">🎉 WINNER! 🎉</div>
                <div className="result-symbols">
                  {showResult.symbols.map((s, i) => (
                    <span key={i} className="result-symbol">{SYMBOLS[s]?.emoji}</span>
                  ))}
                </div>
                <div className="result-amount win-amount">+{showResult.amount.toLocaleString()} SUIT</div>
              </>
            )}
            {showResult.type === 'loss' && (
              <>
                <div className="result-banner loss-banner">No Match</div>
                <div className="result-symbols">
                  {showResult.symbols.map((s, i) => (
                    <span key={i} className="result-symbol">{SYMBOLS[s]?.emoji}</span>
                  ))}
                </div>
                <div className="result-amount loss-amount">-{showResult.amount} SUIT</div>
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
          <div className="stat-box jackpot">
            <span className="stat-label">Jackpot Pool</span>
            <span className="stat-value">{jackpotPool} SUIT</span>
            <span className="jackpot-hint">🔵🔵🔵 TO WIN</span>
          </div>
        </div>
      )}

      <div className="slots-game">
        <div className="slot-machine">
          <div className="reels-container">
            {reels.map((symbol, i) => (
              <div key={i} className={`reel ${animatingReels[i] ? 'spinning' : ''}`}>
                <div className="reel-symbol" style={{ color: SYMBOLS[symbol]?.color || '#fff' }}>
                  {SYMBOLS[symbol]?.emoji || '?'}
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
           lastWin > 0 ? `Winner! +${lastWin} SUIT` : 'Spin to play!'}
        </div>

        <div className="bet-section">
          <h3>Select Bet</h3>
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
            <div className="payout-row jackpot"><span>🔵🔵🔵</span><span>50x</span></div>
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
            <div className="stat-row"><span>Total Wagered</span><span>{isDemoMode ? demoStats.totalWagered.toFixed(2) : stats.totalWagered} SUIT</span></div>
            <div className="stat-row"><span>Total Won</span><span>{isDemoMode ? demoStats.totalWon.toFixed(2) : stats.totalWon} SUIT</span></div>
            <div className="stat-row highlight"><span>Biggest Win</span><span>{isDemoMode ? demoStats.biggestWin.toFixed(2) : stats.biggestWin} SUIT</span></div>
          </div>
        </div>

        <div className="info-panel">
          <h3>With {betAmount} SUIT Bet</h3>
          <div className="potential-list">
            <div className="potential-row jackpot"><span>🔵🔵🔵 Jackpot</span><span>{betAmount * 50} SUIT</span></div>
            <div className="potential-row"><span>💎💎💎 Diamond</span><span>{betAmount * 25} SUIT</span></div>
            <div className="potential-row"><span>🎰🎰🎰 Seven</span><span>{betAmount * 15} SUIT</span></div>
            <div className="potential-row"><span>2-Match</span><span>{betAmount * 1.5} SUIT</span></div>
          </div>
        </div>
      </div>

      <style>{`
        .slots-page { width: 100%; }
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
        .reel-symbol { font-size: 3rem; text-shadow: 0 0 10px currentColor; }
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
          .result-modal { padding: 25px; min-width: 280px; }
          .result-banner { font-size: 1.5rem; }
          .result-symbol { font-size: 3rem; }
          .result-amount { font-size: 2rem; }
          .jackpot-amount { font-size: 2.25rem; }
        }
      `}</style>
    </div>
  );
}

export default SlotsPage;
