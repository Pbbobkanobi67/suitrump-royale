import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

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
  { id: 'blackjack', route: '/blackjack', icon: '🃏', name: 'Blackjack' },
  { id: 'videopoker', route: '/videopoker', icon: '🎴', name: 'Video Poker' },
  { id: 'progressive', route: '/progressive', icon: '💎', name: 'Progressive' },
  { id: 'raffle', route: '/raffle', icon: '🎟️', name: 'Raffle' },
  { id: 'slots', route: '/slots', icon: '🎰', name: 'Slots' },
  { id: 'crash', route: '/crash', icon: '🚀', name: 'Crash' },
  { id: 'plinko', route: '/plinko', icon: '🎯', name: 'Plinko' },
  { id: 'keno', route: '/keno', icon: '🎱', name: 'Keno' },
  { id: 'roulette', route: '/roulette', icon: '🎡', name: 'Roulette' }
];

function Navigation({ isAdmin }) {
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

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  // Close sidebar on route change
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsSidebarOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isSidebarOpen]);

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

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  // Render nav links (used in both desktop and mobile)
  const renderNavLinks = (isMobile = false) => (
    <>
      {/* Royale link always first */}
      <NavLink
        to="/"
        end
        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''} ${isMobile ? 'mobile' : ''}`}
        onClick={isMobile ? closeSidebar : undefined}
      >
        <span className="nav-icon">🏠</span> Royale
      </NavLink>

      {/* Dynamic game links */}
      {visibleGames.map(game => (
        <NavLink
          key={game.id}
          to={game.route}
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''} ${isMobile ? 'mobile' : ''}`}
          onClick={isMobile ? closeSidebar : undefined}
        >
          <span className="nav-icon">{game.icon}</span> {game.name}
        </NavLink>
      ))}

      {/* Static links at end */}
      <NavLink
        to="/faucet"
        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''} ${isMobile ? 'mobile' : ''}`}
        onClick={isMobile ? closeSidebar : undefined}
      >
        <span className="nav-icon">🚰</span> Faucet
      </NavLink>
      <NavLink
        to="/docs"
        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''} ${isMobile ? 'mobile' : ''}`}
        onClick={isMobile ? closeSidebar : undefined}
      >
        <span className="nav-icon">📖</span> Docs
      </NavLink>

      {/* Buy SUITRUMP - external link */}
      <a
        href="https://sui-trump.com/"
        target="_blank"
        rel="noopener noreferrer"
        className={`nav-link nav-link-external ${isMobile ? 'mobile' : ''}`}
        onClick={isMobile ? closeSidebar : undefined}
      >
        <span className="nav-icon">💰</span> Buy SUITRUMP
      </a>

      {/* Admin link - only visible to admins */}
      {isAdmin && (
        <NavLink
          to="/admin"
          className={({ isActive }) => `nav-link nav-link-admin ${isActive ? 'active' : ''} ${isMobile ? 'mobile' : ''}`}
          onClick={isMobile ? closeSidebar : undefined}
        >
          <span className="nav-icon">⚙️</span> Admin
        </NavLink>
      )}
    </>
  );

  return (
    <>
      <nav className="navigation">
        {/* Hamburger menu button - visible on mobile */}
        <button
          className={`hamburger-btn ${isSidebarOpen ? 'open' : ''}`}
          onClick={toggleSidebar}
          aria-label="Toggle navigation menu"
          aria-expanded={isSidebarOpen}
        >
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
        </button>

        {/* Desktop nav links */}
        <div className="nav-links nav-links-desktop">
          {renderNavLinks(false)}
        </div>
      </nav>

      {/* Mobile sidebar overlay */}
      <div
        className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`}
        onClick={closeSidebar}
        aria-hidden={!isSidebarOpen}
      />

      {/* Mobile sidebar */}
      <aside
        className={`sidebar ${isSidebarOpen ? 'open' : ''}`}
        aria-hidden={!isSidebarOpen}
      >
        <div className="sidebar-header">
          <img src="/suitrump-mascot.png" alt="SUITRUMP" className="sidebar-mascot" />
          <span className="sidebar-title">SUITRUMP Royale</span>
          <button
            className="sidebar-close-btn"
            onClick={closeSidebar}
            aria-label="Close navigation menu"
          >
            ×
          </button>
        </div>
        <div className="sidebar-links">
          {renderNavLinks(true)}
        </div>
      </aside>
    </>
  );
}

export default Navigation;
