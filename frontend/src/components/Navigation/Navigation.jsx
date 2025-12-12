import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';

const STORAGE_KEY = 'suitrumpRoyale_gameSettings';

// Static nav items that are always shown
const STATIC_NAV = [
  { id: 'casino', route: '/', icon: '🏠', name: 'Royale', end: true },
  { id: 'faucet', route: '/faucet', icon: '🚰', name: 'Faucet' },
  { id: 'docs', route: '/docs', icon: '📖', name: 'Docs' }
];

// Game nav items - controlled by Game Manager (no Wheel)
const GAME_NAV = [
  { id: 'dice', route: '/dice', icon: '🎲', name: 'Dice' },
  { id: 'progressive', route: '/progressive', icon: '💎', name: 'Progressive' },
  { id: 'raffle', route: '/raffle', icon: '🎟️', name: 'Raffle' },
  { id: 'slots', route: '/slots', icon: '🎰', name: 'Slots' },
  { id: 'crash', route: '/crash', icon: '🚀', name: 'Crash' },
  { id: 'plinko', route: '/plinko', icon: '🎯', name: 'Plinko' },
  { id: 'keno', route: '/keno', icon: '🎱', name: 'Keno' },
  { id: 'roulette', route: '/roulette', icon: '🎡', name: 'Roulette' }
];

function Navigation() {
  const [enabledGames, setEnabledGames] = useState(() => {
    // Load initial state from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const settings = JSON.parse(saved);
        return GAME_NAV.map(game => game.id).filter(id => settings[id]?.enabled !== false);
      }
    } catch (e) {}
    // Default: all games enabled
    return GAME_NAV.map(game => game.id);
  });

  // Listen for game settings changes
  useEffect(() => {
    const handleSettingsChange = (e) => {
      const settings = e.detail;
      const enabled = GAME_NAV.map(game => game.id).filter(id => settings[id]?.enabled !== false);
      setEnabledGames(enabled);
    };

    window.addEventListener('gameSettingsChanged', handleSettingsChange);

    // Also poll localStorage for changes (in case event doesn't fire)
    const interval = setInterval(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const settings = JSON.parse(saved);
          const enabled = GAME_NAV.map(game => game.id).filter(id => settings[id]?.enabled !== false);
          setEnabledGames(enabled);
        }
      } catch (e) {}
    }, 1000);

    return () => {
      window.removeEventListener('gameSettingsChanged', handleSettingsChange);
      clearInterval(interval);
    };
  }, []);

  const visibleGames = GAME_NAV.filter(game => enabledGames.includes(game.id));

  return (
    <nav className="navigation">
      <div className="nav-links">
        {/* Royale link always first */}
        <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <span className="nav-icon">🏠</span> Royale
        </NavLink>

        {/* Dynamic game links */}
        {visibleGames.map(game => (
          <NavLink
            key={game.id}
            to={game.route}
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >
            <span className="nav-icon">{game.icon}</span> {game.name}
          </NavLink>
        ))}

        {/* Static links at end */}
        <NavLink to="/faucet" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <span className="nav-icon">🚰</span> Faucet
        </NavLink>
        <NavLink to="/docs" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <span className="nav-icon">📖</span> Docs
        </NavLink>
      </div>
    </nav>
  );
}

export default Navigation;
