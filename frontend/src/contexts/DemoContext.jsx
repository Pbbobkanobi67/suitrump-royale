import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const DEMO_STORAGE_KEY = 'suitrumpRoyale_demoMode';
const DEMO_BALANCE_KEY = 'suitrumpRoyale_demoBalance';
const DEMO_STATS_KEY = 'suitrumpRoyale_demoStats';

const DEFAULT_DEMO_BALANCE = 10000; // 10,000 demo SUIT tokens

const DEFAULT_DEMO_STATS = {
  totalBets: 0,
  totalWins: 0,
  totalLosses: 0,
  totalWagered: 0,
  totalWon: 0,
  netProfit: 0,
  biggestWin: 0,
  gameStats: {} // Per-game breakdown
};

// Check if URL has ?demo=true parameter (demo-only mode)
const checkDemoOnlyMode = () => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('demo') === 'true';
  } catch (e) {
    return false;
  }
};

// Load from localStorage
const loadDemoMode = () => {
  try {
    // If URL has ?demo=true, always start in demo mode
    if (checkDemoOnlyMode()) {
      return true;
    }
    const saved = localStorage.getItem(DEMO_STORAGE_KEY);
    return saved === 'true';
  } catch (e) {
    return false;
  }
};

const loadDemoBalance = () => {
  try {
    const saved = localStorage.getItem(DEMO_BALANCE_KEY);
    return saved ? parseFloat(saved) : DEFAULT_DEMO_BALANCE;
  } catch (e) {
    return DEFAULT_DEMO_BALANCE;
  }
};

const loadDemoStats = () => {
  try {
    const saved = localStorage.getItem(DEMO_STATS_KEY);
    return saved ? { ...DEFAULT_DEMO_STATS, ...JSON.parse(saved) } : DEFAULT_DEMO_STATS;
  } catch (e) {
    return DEFAULT_DEMO_STATS;
  }
};

const DemoContext = createContext(null);

export function DemoProvider({ children }) {
  // Check if this is a demo-only session (via URL parameter)
  const [isDemoOnly] = useState(checkDemoOnlyMode);
  const [isDemoMode, setIsDemoMode] = useState(loadDemoMode);
  const [demoBalance, setDemoBalance] = useState(loadDemoBalance);
  const [demoStats, setDemoStats] = useState(loadDemoStats);

  // Save to localStorage when state changes
  useEffect(() => {
    localStorage.setItem(DEMO_STORAGE_KEY, isDemoMode.toString());
  }, [isDemoMode]);

  useEffect(() => {
    localStorage.setItem(DEMO_BALANCE_KEY, demoBalance.toString());
  }, [demoBalance]);

  useEffect(() => {
    localStorage.setItem(DEMO_STATS_KEY, JSON.stringify(demoStats));
  }, [demoStats]);

  // Toggle demo mode
  const toggleDemoMode = useCallback(() => {
    setIsDemoMode(prev => !prev);
  }, []);

  // Enable/disable demo mode
  const enableDemoMode = useCallback(() => setIsDemoMode(true), []);
  const disableDemoMode = useCallback(() => setIsDemoMode(false), []);

  // Reset demo balance to default
  const resetDemoBalance = useCallback(() => {
    setDemoBalance(DEFAULT_DEMO_BALANCE);
  }, []);

  // Reset all demo stats
  const resetDemoStats = useCallback(() => {
    setDemoStats(DEFAULT_DEMO_STATS);
  }, []);

  // Reset everything (balance + stats)
  const resetDemoMode = useCallback(() => {
    setDemoBalance(DEFAULT_DEMO_BALANCE);
    setDemoStats(DEFAULT_DEMO_STATS);
  }, []);

  // Place a demo bet - returns result with win amount
  const placeDemoBet = useCallback((gameId, betAmount, odds, simulateResult) => {
    if (betAmount > demoBalance) {
      return { success: false, error: 'Insufficient demo balance' };
    }

    // Deduct bet amount
    setDemoBalance(prev => prev - betAmount);

    // Simulate result (use provided function or default random based on odds)
    let won = false;
    let winAmount = 0;
    let result = null;

    if (simulateResult) {
      result = simulateResult();
      won = result.won;
      winAmount = result.winAmount || 0;
    } else {
      // Default: use odds to determine win
      won = Math.random() < (1 / odds);
      winAmount = won ? betAmount * odds : 0;
    }

    // Credit winnings
    if (won && winAmount > 0) {
      setDemoBalance(prev => prev + winAmount);
    }

    // Update stats
    setDemoStats(prev => {
      const gameStats = prev.gameStats[gameId] || { bets: 0, wins: 0, wagered: 0, won: 0 };

      return {
        ...prev,
        totalBets: prev.totalBets + 1,
        totalWins: prev.totalWins + (won ? 1 : 0),
        totalLosses: prev.totalLosses + (won ? 0 : 1),
        totalWagered: prev.totalWagered + betAmount,
        totalWon: prev.totalWon + winAmount,
        netProfit: prev.netProfit + (winAmount - betAmount),
        biggestWin: Math.max(prev.biggestWin, winAmount - betAmount),
        gameStats: {
          ...prev.gameStats,
          [gameId]: {
            bets: gameStats.bets + 1,
            wins: gameStats.wins + (won ? 1 : 0),
            wagered: gameStats.wagered + betAmount,
            won: gameStats.won + winAmount
          }
        }
      };
    });

    return {
      success: true,
      won,
      winAmount,
      result,
      newBalance: won ? demoBalance - betAmount + winAmount : demoBalance - betAmount
    };
  }, [demoBalance]);

  // Add demo balance (for testing/bonus)
  const addDemoBalance = useCallback((amount) => {
    setDemoBalance(prev => prev + amount);
  }, []);

  const value = {
    // State
    isDemoMode,
    isDemoOnly, // True if accessed via ?demo=true URL
    demoBalance,
    demoStats,

    // Actions
    toggleDemoMode,
    enableDemoMode,
    disableDemoMode,
    resetDemoBalance,
    resetDemoStats,
    resetDemoMode,
    placeDemoBet,
    addDemoBalance,
    setDemoBalance,

    // Constants
    DEFAULT_DEMO_BALANCE
  };

  return (
    <DemoContext.Provider value={value}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoContext() {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemoContext must be used within a DemoProvider');
  }
  return context;
}

export { DEFAULT_DEMO_BALANCE };
