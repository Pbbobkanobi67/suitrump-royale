import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Storage keys
const DEMO_STORAGE_KEY = 'suitrumpRoyale_demoMode';
const DEMO_BALANCE_KEY = 'suitrumpRoyale_demoBalance';
const DEMO_WALLET_KEY = 'suitrumpRoyale_demoWallet';
const DEMO_STATS_KEY = 'suitrumpRoyale_demoStats';
const WALLET_DATA_KEY = 'suitrumpRoyale_walletData'; // Per-wallet ticket data
const ADMIN_SETTINGS_KEY = 'suitrumpRoyale_adminSettings';

// Defaults
const DEFAULT_DEMO_BALANCE = 0;
const DEFAULT_WALLET_BALANCE = 10000000; // 10M SUITRUMP in demo wallet

const DEFAULT_STATS = {
  totalBets: 0,
  totalWins: 0,
  totalLosses: 0,
  totalWagered: 0,
  totalWon: 0,
  netProfit: 0,
  biggestWin: 0,
  currentStreak: 0,
  bestStreak: 0,
  gameStats: {}
};

const DEFAULT_WALLET_DATA = {
  tickets: 0,
  deposits: [], // { amount, rate, timestamp, ticketsReceived }
  stats: { ...DEFAULT_STATS }
};

const DEFAULT_ADMIN_SETTINGS = {
  demoModeEnabled: {
    global: false, // Master switch - default OFF
    dice: false,
    progressive: false,
    raffle: false,
    slots: false,
    crash: false,
    keno: false,
    plinko: false,
    roulette: false
  }
};

// Check if URL has ?demo=true parameter (demo-only mode for embedding)
const checkDemoOnlyMode = () => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('demo') === 'true';
  } catch (e) {
    return false;
  }
};

// Load functions
const loadDemoMode = () => {
  try {
    if (checkDemoOnlyMode()) return true;
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

const loadDemoWalletBalance = () => {
  try {
    const saved = localStorage.getItem(DEMO_WALLET_KEY);
    return saved ? parseFloat(saved) : DEFAULT_WALLET_BALANCE;
  } catch (e) {
    return DEFAULT_WALLET_BALANCE;
  }
};

const loadDemoStats = () => {
  try {
    const saved = localStorage.getItem(DEMO_STATS_KEY);
    return saved ? { ...DEFAULT_STATS, ...JSON.parse(saved) } : { ...DEFAULT_STATS };
  } catch (e) {
    return { ...DEFAULT_STATS };
  }
};

const loadWalletData = () => {
  try {
    const saved = localStorage.getItem(WALLET_DATA_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    return {};
  }
};

const loadAdminSettings = () => {
  try {
    const saved = localStorage.getItem(ADMIN_SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults to ensure all keys exist
      return {
        ...DEFAULT_ADMIN_SETTINGS,
        ...parsed,
        demoModeEnabled: {
          ...DEFAULT_ADMIN_SETTINGS.demoModeEnabled,
          ...(parsed.demoModeEnabled || {})
        }
      };
    }
    return DEFAULT_ADMIN_SETTINGS;
  } catch (e) {
    return DEFAULT_ADMIN_SETTINGS;
  }
};

const DemoContext = createContext(null);

export function DemoProvider({ children }) {
  const [isDemoOnly] = useState(checkDemoOnlyMode);
  const [isDemoMode, setIsDemoMode] = useState(loadDemoMode);
  const [demoBalance, setDemoBalance] = useState(loadDemoBalance);
  const [demoWalletBalance, setDemoWalletBalance] = useState(loadDemoWalletBalance);
  const [demoStats, setDemoStats] = useState(loadDemoStats);

  // Per-wallet data: { [walletAddress]: { tickets, deposits, stats } }
  const [walletData, setWalletData] = useState(loadWalletData);

  // Admin settings for demo mode toggles
  const [adminSettings, setAdminSettings] = useState(loadAdminSettings);

  // Current connected wallet (set by components)
  const [connectedWallet, setConnectedWallet] = useState(null);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(DEMO_STORAGE_KEY, isDemoMode.toString());
  }, [isDemoMode]);

  useEffect(() => {
    localStorage.setItem(DEMO_BALANCE_KEY, demoBalance.toString());
  }, [demoBalance]);

  useEffect(() => {
    localStorage.setItem(DEMO_WALLET_KEY, demoWalletBalance.toString());
  }, [demoWalletBalance]);

  useEffect(() => {
    localStorage.setItem(DEMO_STATS_KEY, JSON.stringify(demoStats));
  }, [demoStats]);

  useEffect(() => {
    localStorage.setItem(WALLET_DATA_KEY, JSON.stringify(walletData));
  }, [walletData]);

  useEffect(() => {
    localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(adminSettings));
  }, [adminSettings]);

  // Auto-disable demo mode if admin has it turned off (unless isDemoOnly from URL)
  useEffect(() => {
    const demoAvailable = adminSettings?.demoModeEnabled?.global || isDemoOnly;
    if (isDemoMode && !demoAvailable) {
      console.log('Demo mode disabled by admin - forcing exit');
      setIsDemoMode(false);
    }
  }, [adminSettings?.demoModeEnabled?.global, isDemoOnly, isDemoMode]);

  // Get wallet data for a specific address
  const getWalletData = useCallback((walletAddress) => {
    if (!walletAddress) return null;
    const addr = walletAddress.toLowerCase();
    return walletData[addr] || { ...DEFAULT_WALLET_DATA, deposits: [], stats: { ...DEFAULT_STATS } };
  }, [walletData]);

  // Get tickets for connected wallet
  const getTickets = useCallback((walletAddress) => {
    const data = getWalletData(walletAddress);
    return data ? data.tickets : 0;
  }, [getWalletData]);

  // Buy tickets - track deposit with rate
  const buyTickets = useCallback((walletAddress, suitrumpAmount, ticketsReceived, rate) => {
    if (!walletAddress) return false;
    const addr = walletAddress.toLowerCase();

    setWalletData(prev => {
      const existing = prev[addr] || { ...DEFAULT_WALLET_DATA, deposits: [], stats: { ...DEFAULT_STATS } };
      return {
        ...prev,
        [addr]: {
          ...existing,
          tickets: existing.tickets + ticketsReceived,
          deposits: [
            ...existing.deposits,
            {
              amount: suitrumpAmount,
              rate: rate, // SUITRUMP per ticket at time of purchase
              timestamp: new Date().toISOString(),
              ticketsReceived: ticketsReceived
            }
          ]
        }
      };
    });
    return true;
  }, []);

  // Cash out tickets - uses MIN(original avg rate, current rate)
  const cashOutTickets = useCallback((walletAddress, ticketAmount, currentRate) => {
    if (!walletAddress) return { success: false, error: 'No wallet connected' };
    const addr = walletAddress.toLowerCase();
    const data = walletData[addr];

    if (!data || data.tickets < ticketAmount) {
      return { success: false, error: 'Insufficient tickets' };
    }

    // Calculate weighted average rate from deposits
    let totalTicketsFromDeposits = 0;
    let weightedRateSum = 0;

    for (const deposit of data.deposits) {
      totalTicketsFromDeposits += deposit.ticketsReceived;
      weightedRateSum += deposit.rate * deposit.ticketsReceived;
    }

    const avgOriginalRate = totalTicketsFromDeposits > 0
      ? weightedRateSum / totalTicketsFromDeposits
      : currentRate;

    // Use MIN(original avg rate, current rate) - protects both sides
    const cashOutRate = Math.min(avgOriginalRate, currentRate);
    const suitrumpToReturn = ticketAmount * cashOutRate;

    setWalletData(prev => {
      const existing = prev[addr];

      // Reduce deposits proportionally
      let ticketsToDeduct = ticketAmount;
      const newDeposits = [];

      for (const deposit of existing.deposits) {
        if (ticketsToDeduct <= 0) {
          newDeposits.push(deposit);
        } else if (deposit.ticketsReceived <= ticketsToDeduct) {
          ticketsToDeduct -= deposit.ticketsReceived;
          // This deposit is fully consumed, don't add to newDeposits
        } else {
          // Partial consumption
          newDeposits.push({
            ...deposit,
            ticketsReceived: deposit.ticketsReceived - ticketsToDeduct,
            amount: deposit.amount * ((deposit.ticketsReceived - ticketsToDeduct) / deposit.ticketsReceived)
          });
          ticketsToDeduct = 0;
        }
      }

      return {
        ...prev,
        [addr]: {
          ...existing,
          tickets: existing.tickets - ticketAmount,
          deposits: newDeposits
        }
      };
    });

    return {
      success: true,
      suitrumpAmount: suitrumpToReturn,
      rateUsed: cashOutRate,
      avgOriginalRate,
      currentRate
    };
  }, [walletData]);

  // Add tickets (from game wins)
  const addTickets = useCallback((walletAddress, amount) => {
    if (!walletAddress || amount <= 0) return;
    const addr = walletAddress.toLowerCase();

    setWalletData(prev => {
      const existing = prev[addr] || { ...DEFAULT_WALLET_DATA, deposits: [], stats: { ...DEFAULT_STATS } };
      return {
        ...prev,
        [addr]: {
          ...existing,
          tickets: existing.tickets + amount
        }
      };
    });
  }, []);

  // Deduct tickets (from game bets)
  const deductTickets = useCallback((walletAddress, amount) => {
    if (!walletAddress || amount <= 0) return false;
    const addr = walletAddress.toLowerCase();
    const data = walletData[addr];

    if (!data || data.tickets < amount) return false;

    setWalletData(prev => {
      const existing = prev[addr];
      return {
        ...prev,
        [addr]: {
          ...existing,
          tickets: existing.tickets - amount
        }
      };
    });
    return true;
  }, [walletData]);

  // Update wallet stats (for game results)
  const updateWalletStats = useCallback((walletAddress, betAmount, winAmount, won) => {
    if (!walletAddress) return;
    const addr = walletAddress.toLowerCase();

    setWalletData(prev => {
      const existing = prev[addr] || { ...DEFAULT_WALLET_DATA, deposits: [], stats: { ...DEFAULT_STATS } };
      const stats = existing.stats || { ...DEFAULT_STATS };
      const profit = winAmount - betAmount;
      const newStreak = won
        ? (stats.currentStreak >= 0 ? stats.currentStreak + 1 : 1)
        : (stats.currentStreak <= 0 ? stats.currentStreak - 1 : -1);

      return {
        ...prev,
        [addr]: {
          ...existing,
          stats: {
            ...stats,
            totalBets: stats.totalBets + 1,
            totalWins: stats.totalWins + (won ? 1 : 0),
            totalLosses: stats.totalLosses + (won ? 0 : 1),
            totalWagered: stats.totalWagered + betAmount,
            totalWon: stats.totalWon + winAmount,
            netProfit: stats.netProfit + profit,
            biggestWin: Math.max(stats.biggestWin, profit > 0 ? profit : 0),
            currentStreak: newStreak,
            bestStreak: Math.max(stats.bestStreak, newStreak)
          }
        }
      };
    });
  }, []);

  // Get stats for wallet
  const getWalletStats = useCallback((walletAddress) => {
    const data = getWalletData(walletAddress);
    return data ? data.stats : { ...DEFAULT_STATS };
  }, [getWalletData]);

  // Reset wallet stats
  const resetWalletStats = useCallback((walletAddress) => {
    if (!walletAddress) return;
    const addr = walletAddress.toLowerCase();

    setWalletData(prev => {
      const existing = prev[addr];
      if (!existing) return prev;
      return {
        ...prev,
        [addr]: {
          ...existing,
          stats: { ...DEFAULT_STATS }
        }
      };
    });
  }, []);

  // Demo mode functions
  const toggleDemoMode = useCallback(() => {
    setIsDemoMode(prev => !prev);
  }, []);

  const enableDemoMode = useCallback(() => setIsDemoMode(true), []);
  const disableDemoMode = useCallback(() => setIsDemoMode(false), []);

  const resetDemoBalance = useCallback(() => {
    setDemoBalance(DEFAULT_DEMO_BALANCE);
  }, []);

  const resetDemoWalletBalance = useCallback(() => {
    setDemoWalletBalance(DEFAULT_WALLET_BALANCE);
  }, []);

  const resetDemoStats = useCallback(() => {
    setDemoStats({ ...DEFAULT_STATS });
  }, []);

  const resetDemoMode = useCallback(() => {
    setDemoBalance(DEFAULT_DEMO_BALANCE);
    setDemoWalletBalance(DEFAULT_WALLET_BALANCE);
    setDemoStats({ ...DEFAULT_STATS });
  }, []);

  // Admin settings functions
  const updateAdminSettings = useCallback((newSettings) => {
    setAdminSettings(prev => ({
      ...prev,
      ...newSettings
    }));
  }, []);

  const setGameDemoMode = useCallback((game, enabled) => {
    setAdminSettings(prev => ({
      ...prev,
      demoModeEnabled: {
        ...prev.demoModeEnabled,
        [game]: enabled
      }
    }));
  }, []);

  const isGameDemoEnabled = useCallback((game) => {
    // Global switch must be on, AND specific game must be on
    return adminSettings.demoModeEnabled.global && adminSettings.demoModeEnabled[game];
  }, [adminSettings]);

  // Check if demo mode is available (either global demo mode or URL param)
  const canUseDemoMode = useCallback((game) => {
    if (isDemoOnly) return true; // URL param always allows demo
    return adminSettings.demoModeEnabled.global && adminSettings.demoModeEnabled[game];
  }, [isDemoOnly, adminSettings]);

  // Legacy compatibility - get current balance based on mode and wallet
  const getTicketBalance = useCallback((walletAddress) => {
    if (isDemoMode) return demoBalance;
    return getTickets(walletAddress);
  }, [isDemoMode, demoBalance, getTickets]);

  const getCurrentStats = useCallback((walletAddress) => {
    if (isDemoMode) return demoStats;
    return getWalletStats(walletAddress);
  }, [isDemoMode, demoStats, getWalletStats]);

  const value = {
    // Demo mode state
    isDemoMode,
    isDemoOnly,
    demoBalance,
    demoWalletBalance,
    demoStats,

    // Demo mode actions
    toggleDemoMode,
    enableDemoMode,
    disableDemoMode,
    resetDemoBalance,
    resetDemoWalletBalance,
    resetDemoStats,
    resetDemoMode,
    setDemoBalance,
    setDemoWalletBalance,

    // Per-wallet ticket system
    connectedWallet,
    setConnectedWallet,
    walletData,
    getWalletData,
    getTickets,
    buyTickets,
    cashOutTickets,
    addTickets,
    deductTickets,
    updateWalletStats,
    getWalletStats,
    resetWalletStats,

    // Admin settings
    adminSettings,
    updateAdminSettings,
    setGameDemoMode,
    isGameDemoEnabled,
    canUseDemoMode,

    // Legacy compatibility
    getTicketBalance,
    getCurrentStats,

    // For backwards compatibility with existing code
    realTickets: connectedWallet ? getTickets(connectedWallet) : 0,
    setRealTickets: (val) => {
      if (connectedWallet) {
        const newVal = typeof val === 'function' ? val(getTickets(connectedWallet)) : val;
        const diff = newVal - getTickets(connectedWallet);
        if (diff > 0) addTickets(connectedWallet, diff);
        else if (diff < 0) deductTickets(connectedWallet, -diff);
      }
    },
    realStats: connectedWallet ? getWalletStats(connectedWallet) : { ...DEFAULT_STATS },
    resetRealStats: () => connectedWallet && resetWalletStats(connectedWallet),

    // Constants
    DEFAULT_DEMO_BALANCE,
    DEFAULT_WALLET_BALANCE
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
