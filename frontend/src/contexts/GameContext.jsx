import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

const STORAGE_KEY = 'suitrumpRoyale_gameSettings';
const PLINKO_SETTINGS_KEY = 'suitrumpRoyale_plinkoSettings';
const BETTING_LIMITS_KEY = 'suitrumpRoyale_bettingLimits';

// Default betting limits per game (in tickets, 1 ticket = $0.10)
const DEFAULT_BETTING_LIMITS = {
  dice: { minBet: 1, maxBet: 10000 },
  slots: { minBet: 1, maxBet: 5000 },
  crash: { minBet: 1, maxBet: 10000 },
  roulette: { minBet: 1, maxBet: 10000 },
  plinko: { minBet: 1, maxBet: 5000 },
  keno: { minBet: 1, maxBet: 2000 },
  progressive: { minBet: 1, maxBet: 100 },
  raffle: { minBet: 1, maxBet: 10000 }
};

// Load betting limits from localStorage
const loadBettingLimits = () => {
  try {
    const saved = localStorage.getItem(BETTING_LIMITS_KEY);
    if (saved) {
      return { ...DEFAULT_BETTING_LIMITS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Error loading betting limits:', e);
  }
  return DEFAULT_BETTING_LIMITS;
};

// Default Plinko settings
const DEFAULT_PLINKO_SETTINGS = {
  recordedPathsEnabled: false,
  showLiveStats: true,
  testDropEnabled: true,
  defaultRows: 10,
  defaultRisk: 1,
  ballSpeed: 1,
  autoReveal: true,
};

// Load Plinko settings from localStorage
const loadPlinkoSettings = () => {
  try {
    const saved = localStorage.getItem(PLINKO_SETTINGS_KEY);
    if (saved) {
      return { ...DEFAULT_PLINKO_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Error loading Plinko settings:', e);
  }
  return DEFAULT_PLINKO_SETTINGS;
};

// Game icons mapping
const GAME_ICONS = {
  dice: '🎲',
  progressive: '💎',
  raffle: '🎟️',
  slots: '🎰',
  crash: '🚀',
  plinko: '🎯',
  keno: '🎱',
  roulette: '🎡',
  default: '🎮'
};

// Default games for SUITRUMP Royale (no Wheel)
const DEFAULT_GAMES = [
  {
    id: 'dice',
    name: 'SUITRUMP Dice',
    description: 'Predict dice outcomes with 5 bet types - Exact, Over, Under, Odd, Even',
    route: '/dice',
    enabled: true,
    featured: true,
    sortOrder: 0,
    houseEdge: '3%',
    minBet: '1 SUIT',
    maxBet: '1000 SUIT'
  },
  {
    id: 'progressive',
    name: 'Progressive Jackpot',
    description: 'Match 4 dice for the jackpot - growing prize pool',
    route: '/progressive',
    enabled: true,
    featured: true,
    sortOrder: 1,
    houseEdge: '20%',
    ticketPrice: '1 SUIT'
  },
  {
    id: 'raffle',
    name: 'SUITRUMP Raffle',
    description: 'Buy tickets for a chance to win the prize pool',
    route: '/raffle',
    enabled: true,
    featured: true,
    sortOrder: 2,
    houseEdge: '6%',
    minTickets: '5 SUIT'
  },
  {
    id: 'slots',
    name: 'SUITRUMP Slots',
    description: 'Classic 3-reel slot machine with multiple paylines',
    route: '/slots',
    enabled: true,
    featured: true,
    sortOrder: 3,
    houseEdge: '5%',
    minBet: '1 SUIT',
    maxBet: '100 SUIT'
  },
  {
    id: 'crash',
    name: 'SUITRUMP Crash',
    description: 'Cash out before the multiplier crashes - auto cash-out available',
    route: '/crash',
    enabled: true,
    featured: true,
    sortOrder: 4,
    houseEdge: '4%',
    minBet: '1 SUIT',
    maxBet: '1000 SUIT'
  },
  {
    id: 'plinko',
    name: 'SUITRUMP Plinko',
    description: 'Drop the ball and watch it bounce through pegs for multipliers',
    route: '/plinko',
    enabled: true,
    featured: true,
    sortOrder: 5,
    houseEdge: '3%',
    minBet: '1 SUIT',
    maxBet: '500 SUIT'
  },
  {
    id: 'keno',
    name: 'SUITRUMP Keno',
    description: 'Pick lucky numbers and match draws to win up to 100x',
    route: '/keno',
    enabled: true,
    featured: true,
    sortOrder: 6,
    houseEdge: '10%',
    minBet: '1 SUIT',
    maxBet: '100 SUIT'
  },
  {
    id: 'roulette',
    name: 'SUITRUMP Roulette',
    description: 'European roulette with inside and outside bets - up to 35x payout',
    route: '/roulette',
    enabled: true,
    featured: true,
    sortOrder: 7,
    houseEdge: '2.7%',
    minBet: '1 SUIT',
    maxBet: '500 SUIT'
  }
];

// Load saved game settings from localStorage
const loadSavedSettings = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error loading game settings:', e);
  }
  return null;
};

// Merge saved settings with default games
const getInitialGames = () => {
  const saved = loadSavedSettings();
  if (!saved) return DEFAULT_GAMES;

  return DEFAULT_GAMES.map(game => ({
    ...game,
    enabled: saved[game.id]?.enabled ?? game.enabled,
    featured: saved[game.id]?.featured ?? game.featured
  }));
};

const GameContext = createContext(null);

export function GameProvider({ children, provider, signer, account }) {
  const [games, setGames] = useState(getInitialGames);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOwner, setIsOwner] = useState(false);

  // Plinko settings
  const [plinkoSettings, setPlinkoSettingsState] = useState(loadPlinkoSettings);

  // Betting limits per game
  const [bettingLimits, setBettingLimitsState] = useState(loadBettingLimits);

  // Save game settings to localStorage whenever they change
  useEffect(() => {
    const settings = {};
    games.forEach(game => {
      settings[game.id] = {
        enabled: game.enabled,
        featured: game.featured
      };
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      window.dispatchEvent(new CustomEvent('gameSettingsChanged', { detail: settings }));
    } catch (e) {
      console.error('Error saving game settings:', e);
    }
  }, [games]);

  // TODO: Check if user is owner (Sui integration)
  useEffect(() => {
    // Placeholder - will integrate with Sui
    setIsOwner(false);
  }, [account]);

  // Get enabled games (for navigation)
  const enabledGames = useMemo(() => {
    return games.filter(game => game.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [games]);

  // Get featured games (for casino game room on homepage)
  const featuredGames = useMemo(() => {
    return games.filter(game => game.featured).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [games]);

  // Check if a specific game is playable
  const isGamePlayable = (gameId) => {
    const game = games.find(g => g.id === gameId);
    return game ? game.enabled : false;
  };

  // Get game by ID
  const getGame = (gameId) => {
    return games.find(g => g.id === gameId);
  };

  // Get game icon
  const getGameIcon = (gameId) => {
    return GAME_ICONS[gameId] || GAME_ICONS.default;
  };

  // Admin: Toggle game enabled (local only for now)
  const setGameEnabled = async (gameId, enabled) => {
    setGames(prev => prev.map(game =>
      game.id === gameId ? { ...game, enabled } : game
    ));
  };

  // Admin: Toggle game featured (local only for now)
  const setGameFeatured = async (gameId, featured) => {
    setGames(prev => prev.map(game =>
      game.id === gameId ? { ...game, featured } : game
    ));
  };

  // Dev helper: manually toggle game
  const devToggleGame = (gameId, field, value) => {
    setGames(prev => prev.map(game =>
      game.id === gameId ? { ...game, [field]: value } : game
    ));
  };

  // Update Plinko settings
  const updatePlinkoSettings = useCallback((newSettings) => {
    setPlinkoSettingsState(prev => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(PLINKO_SETTINGS_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving Plinko settings:', e);
      }
      return updated;
    });
  }, []);

  // Reset Plinko settings to defaults
  const resetPlinkoSettings = useCallback(() => {
    setPlinkoSettingsState(DEFAULT_PLINKO_SETTINGS);
    try {
      localStorage.removeItem(PLINKO_SETTINGS_KEY);
    } catch (e) {
      console.error('Error resetting Plinko settings:', e);
    }
  }, []);

  // Update betting limits for a specific game
  const updateBettingLimits = useCallback((gameId, limits) => {
    setBettingLimitsState(prev => {
      const updated = { ...prev, [gameId]: { ...prev[gameId], ...limits } };
      try {
        localStorage.setItem(BETTING_LIMITS_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving betting limits:', e);
      }
      return updated;
    });
  }, []);

  // Get betting limits for a specific game
  const getBettingLimits = useCallback((gameId) => {
    return bettingLimits[gameId] || DEFAULT_BETTING_LIMITS[gameId] || { minBet: 1, maxBet: 10000 };
  }, [bettingLimits]);

  // Reset betting limits to defaults
  const resetBettingLimits = useCallback(() => {
    setBettingLimitsState(DEFAULT_BETTING_LIMITS);
    try {
      localStorage.removeItem(BETTING_LIMITS_KEY);
    } catch (e) {
      console.error('Error resetting betting limits:', e);
    }
  }, []);

  const value = {
    // State
    games,
    enabledGames,
    featuredGames,
    loading,
    error,
    isOwner,

    // Plinko settings
    plinkoSettings,
    updatePlinkoSettings,
    resetPlinkoSettings,

    // Betting limits
    bettingLimits,
    updateBettingLimits,
    getBettingLimits,
    resetBettingLimits,

    // Methods
    isGamePlayable,
    getGame,
    getGameIcon,

    // Admin methods (local only for now)
    setGameEnabled,
    setGameFeatured,

    // Dev helper
    devToggleGame
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

export function useGameContext() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
}

export { GAME_ICONS, DEFAULT_GAMES };
