import React, { useState, useEffect, useCallback } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useGameContext } from '../contexts/GameContext';
import { useDemoContext } from '../contexts/DemoContext';
import { SUI_CONFIG, MODULES, parseSuit, formatSuit } from '../config/sui-config.js';

// Plinko Settings Section Component
function PlinkoSettingsSection() {
  const { plinkoSettings, updatePlinkoSettings, resetPlinkoSettings } = useGameContext();

  const RISK_LEVELS = ['Low', 'Medium', 'High'];
  const ROW_OPTIONS = [8, 10, 12, 14, 16];
  const SPEED_OPTIONS = [
    { value: 0.5, label: '0.5x (Slow)' },
    { value: 1, label: '1x (Normal)' },
    { value: 1.5, label: '1.5x (Fast)' },
    { value: 2, label: '2x (Very Fast)' }
  ];

  const handleToggle = (key) => {
    updatePlinkoSettings({ [key]: !plinkoSettings[key] });
  };

  return (
    <div className="admin-section">
      <div className="section-title">
        <span className="section-icon">🎯</span>
        <h2>Plinko Settings</h2>
      </div>
      <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '15px' }}>
        Configure Plinko game behavior and default settings
      </p>

      <div className="plinko-settings-grid">
        {/* Feature Toggles */}
        <div className="settings-card">
          <h4>Feature Toggles</h4>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Recorded Paths</span>
              <span className="setting-desc">Use pre-recorded physics for realistic ball animation</span>
            </div>
            <button
              className={`toggle-pill ${plinkoSettings?.recordedPathsEnabled ? 'active' : ''}`}
              onClick={() => handleToggle('recordedPathsEnabled')}
            >
              {plinkoSettings?.recordedPathsEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Live Stats Panel</span>
              <span className="setting-desc">Show profit, wins, losses tracker</span>
            </div>
            <button
              className={`toggle-pill ${plinkoSettings?.showLiveStats ? 'active' : ''}`}
              onClick={() => handleToggle('showLiveStats')}
            >
              {plinkoSettings?.showLiveStats ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Test Drop</span>
              <span className="setting-desc">Allow free test drops for users</span>
            </div>
            <button
              className={`toggle-pill ${plinkoSettings?.testDropEnabled ? 'active' : ''}`}
              onClick={() => handleToggle('testDropEnabled')}
            >
              {plinkoSettings?.testDropEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Default Values */}
        <div className="settings-card">
          <h4>Default Values</h4>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Default Rows</span>
              <span className="setting-desc">Initial row count for new users</span>
            </div>
            <div className="option-buttons">
              {ROW_OPTIONS.map(rows => (
                <button
                  key={rows}
                  className={`option-btn ${plinkoSettings?.defaultRows === rows ? 'active' : ''}`}
                  onClick={() => updatePlinkoSettings({ defaultRows: rows })}
                >
                  {rows}
                </button>
              ))}
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Default Risk</span>
              <span className="setting-desc">Initial risk level for new users</span>
            </div>
            <div className="option-buttons">
              {RISK_LEVELS.map((risk, i) => (
                <button
                  key={risk}
                  className={`option-btn risk-${risk.toLowerCase()} ${plinkoSettings?.defaultRisk === i ? 'active' : ''}`}
                  onClick={() => updatePlinkoSettings({ defaultRisk: i })}
                >
                  {risk}
                </button>
              ))}
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Ball Speed</span>
              <span className="setting-desc">Animation speed multiplier</span>
            </div>
            <select
              className="speed-select"
              value={plinkoSettings?.ballSpeed || 1}
              onChange={(e) => updatePlinkoSettings({ ballSpeed: parseFloat(e.target.value) })}
            >
              {SPEED_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Save and Reset Buttons */}
      <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
        <button
          className="btn btn-primary"
          onClick={() => {
            console.log('Saving Plinko settings:', plinkoSettings);
            alert('Plinko settings saved!');
          }}
        >
          Save Settings
        </button>
        <button className="btn btn-secondary" onClick={resetPlinkoSettings}>
          Reset to Defaults
        </button>
      </div>

      <style>{`
        .plinko-settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 20px;
        }

        .settings-card {
          background: linear-gradient(135deg, #2d4a3f 0%, #0f2c23 100%);
          border-radius: 12px;
          padding: 20px;
          border: 1px solid #4a6b5d;
        }

        .settings-card h4 {
          color: #f8ffe8;
          margin: 0 0 15px 0;
          font-size: 1rem;
        }

        .setting-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #4a6b5d;
        }

        .setting-row:last-child {
          border-bottom: none;
        }

        .setting-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .setting-label {
          color: #f8ffe8;
          font-weight: 500;
        }

        .setting-desc {
          color: #94a3b8;
          font-size: 0.8rem;
        }

        .option-buttons {
          display: flex;
          gap: 6px;
        }

        .option-btn {
          padding: 6px 12px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          background: #4a6b5d;
          color: #94a3b8;
        }

        .option-btn:hover {
          background: #5a7b6d;
        }

        .option-btn.active {
          background: #e2fea5;
          color: #0f2c23;
        }

        .option-btn.risk-low.active {
          background: #3b82f6;
        }

        .option-btn.risk-medium.active {
          background: #eab308;
          color: #0f2c23;
        }

        .option-btn.risk-high.active {
          background: #ef4444;
        }

        .speed-select {
          padding: 8px 12px;
          border-radius: 6px;
          background: #4a6b5d;
          border: 1px solid #5a7b6d;
          color: #f8ffe8;
          font-size: 0.9rem;
          cursor: pointer;
        }

        .speed-select:focus {
          outline: none;
          border-color: #e2fea5;
        }
      `}</style>
    </div>
  );
}

// Admin wallet address (Sui format)
const ADMIN_WALLET = '0x9b66dfcc45d57ed624b4058f2ba52f084af2330a1145087e61ef1eaac4a7cc20';

// Sui Explorer URL
const SUI_EXPLORER = 'https://suiscan.xyz/testnet';
const SUI_FAUCET_URL = 'https://faucet.sui.io/';

function AdminPage() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const { games, devToggleGame, getGameIcon, bettingLimits, updateBettingLimits, resetBettingLimits } = useGameContext();
  const { adminSettings, setGameDemoMode, updateAdminSettings } = useDemoContext();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Game stats
  const [gameStats, setGameStats] = useState({
    dice: { balance: '0', totalBets: 0, totalWagered: '0', totalPaidOut: '0', isPaused: false },
    slots: { balance: '0', totalSpins: 0, totalWagered: '0', totalPaidOut: '0', isPaused: false },
    crash: { balance: '0', totalGames: 0, totalWagered: '0', totalPaidOut: '0', isPaused: false },
    roulette: { balance: '0', totalSpins: 0, totalWagered: '0', totalPaidOut: '0', isPaused: false },
    plinko: { balance: '0', totalDrops: 0, totalWagered: '0', totalPaidOut: '0', isPaused: false },
    keno: { balance: '0', totalGames: 0, totalWagered: '0', totalPaidOut: '0', isPaused: false },
    progressive: { balance: '0', jackpotPool: '0', totalRolls: 0, totalWagered: '0', isPaused: false },
    raffle: { prizePool: '0', roundId: 1, totalTickets: 0, status: 0, roundDurationMs: 21600000 }
  });

  // Form states
  const [fundAmount, setFundAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedGame, setSelectedGame] = useState('slots');
  const [raffleDurationHours, setRaffleDurationHours] = useState(6); // Default 6 hours

  // Wallet settings (editable)
  const [walletSettings, setWalletSettings] = useState({
    devA: SUI_CONFIG.wallets?.devA || '',
    devB: SUI_CONFIG.wallets?.devB || '',
    treasury: SUI_CONFIG.wallets?.treasury || '',
    burn: SUI_CONFIG.wallets?.burn || '0x0000000000000000000000000000000000000000000000000000000000000000'
  });

  // Note: Betting limits now managed via GameContext

  // Update wallet address
  const handleWalletUpdate = (key, value) => {
    setWalletSettings(prev => ({ ...prev, [key]: value }));
  };

  // Save wallet settings (would call contract in production)
  const saveWalletSettings = () => {
    console.log('Saving wallet settings:', walletSettings);
    setMessage({ type: 'success', text: 'Wallet settings saved (local only - deploy contracts to persist)' });
  };

  // Note: Betting limits save is now handled by GameContext

  const account = currentAccount?.address;
  const isAdmin = account && account.toLowerCase() === ADMIN_WALLET.toLowerCase();

  // Fetch all game stats
  const fetchAllStats = useCallback(async () => {
    if (!SUI_CONFIG.packageId || SUI_CONFIG.packageId.startsWith('0x_')) {
      return; // Contracts not deployed yet
    }

    const gameConfigs = [
      { key: 'dice', objectId: SUI_CONFIG.games.dice },
      { key: 'slots', objectId: SUI_CONFIG.games.slots },
      { key: 'crash', objectId: SUI_CONFIG.games.crash },
      { key: 'roulette', objectId: SUI_CONFIG.games.roulette },
      { key: 'plinko', objectId: SUI_CONFIG.games.plinko },
      { key: 'keno', objectId: SUI_CONFIG.games.keno },
      { key: 'progressive', objectId: SUI_CONFIG.games.progressive },
      { key: 'raffle', objectId: SUI_CONFIG.games.raffle }
    ];

    const newStats = { ...gameStats };

    for (const config of gameConfigs) {
      if (!config.objectId || config.objectId.startsWith('0x_')) continue;

      try {
        const obj = await suiClient.getObject({
          id: config.objectId,
          options: { showContent: true }
        });

        if (obj.data?.content?.fields) {
          const fields = obj.data.content.fields;

          if (config.key === 'progressive') {
            newStats[config.key] = {
              balance: formatSuit(fields.house_balance || '0'),
              jackpotPool: formatSuit(fields.jackpot_pool || '0'),
              totalRolls: Number(fields.total_rolls || 0),
              totalWagered: formatSuit(fields.total_wagered || '0'),
              jackpotsWon: Number(fields.jackpots_won || 0),
              isPaused: fields.is_paused || false
            };
          } else if (config.key === 'raffle') {
            const durationMs = Number(fields.round_duration_ms || 21600000);
            newStats[config.key] = {
              prizePool: formatSuit(fields.prize_pool || '0'),
              houseBalance: formatSuit(fields.house_balance || '0'),
              roundId: Number(fields.round_id || 1),
              totalTickets: Number(fields.total_tickets || 0),
              status: Number(fields.status || 0),
              totalRounds: Number(fields.total_rounds || 0),
              totalDistributed: formatSuit(fields.total_distributed || '0'),
              roundDurationMs: durationMs,
              roundDurationHours: durationMs / (1000 * 60 * 60)
            };
            // Update the form state with current value
            setRaffleDurationHours(durationMs / (1000 * 60 * 60));
          } else {
            newStats[config.key] = {
              balance: formatSuit(fields.balance || '0'),
              totalBets: Number(fields.total_bets || fields.total_spins || fields.total_games || fields.total_drops || 0),
              totalWagered: formatSuit(fields.total_wagered || '0'),
              totalPaidOut: formatSuit(fields.total_paid_out || '0'),
              isPaused: fields.is_paused || false
            };
          }
        }
      } catch (err) {
        console.error(`Error fetching ${config.key} stats:`, err);
      }
    }

    setGameStats(newStats);
  }, [suiClient]);

  useEffect(() => {
    fetchAllStats();
    const interval = setInterval(fetchAllStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchAllStats]);

  // Calculate totals
  const calculateTotals = () => {
    let totalVolume = 0;
    let totalPaidOut = 0;
    let totalLiquidity = 0;

    Object.values(gameStats).forEach(stats => {
      totalVolume += parseFloat(stats.totalWagered || '0');
      totalPaidOut += parseFloat(stats.totalPaidOut || '0');
      totalLiquidity += parseFloat(stats.balance || stats.jackpotPool || stats.prizePool || '0');
    });

    return {
      totalVolume,
      totalPaidOut,
      totalLiquidity,
      netProfit: totalVolume - totalPaidOut
    };
  };

  const totals = calculateTotals();

  // Set raffle round duration
  const handleSetRaffleDuration = async () => {
    if (!raffleDurationHours || raffleDurationHours <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid duration' });
      return;
    }

    setLoading(true);
    try {
      const durationMs = Math.floor(raffleDurationHours * 60 * 60 * 1000); // Convert hours to ms
      const SUITRUMP_TOKEN_TYPE = '0xe8fd4cdccd697947bdb84f357eadb626bafac3db769c228336ebcd1ad6ca9081::test_suitrump::TEST_SUITRUMP';

      const tx = new Transaction();
      tx.moveCall({
        target: `${SUI_CONFIG.packageIds.raffle}::${MODULES.raffle}::set_round_duration`,
        arguments: [
          tx.object(SUI_CONFIG.games.raffle),
          tx.pure.u64(durationMs),
          tx.object(SUI_CONFIG.adminCaps.raffle)
        ],
        typeArguments: [SUITRUMP_TOKEN_TYPE]
      });

      await signAndExecute({
        transaction: tx,
        options: { showEffects: true }
      });

      setMessage({ type: 'success', text: `Raffle duration set to ${raffleDurationHours} hours` });
      await fetchAllStats();
    } catch (err) {
      console.error('Error setting raffle duration:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to set raffle duration' });
    } finally {
      setLoading(false);
    }
  };

  // Fund house
  const handleFundHouse = async (gameName) => {
    if (!fundAmount || parseFloat(fundAmount) <= 0) {
      setMessage({ type: 'error', text: 'Enter a valid amount' });
      return;
    }

    const gameObjectId = SUI_CONFIG.games[gameName];

    // Demo mode - simulate funding when contracts not deployed
    if (!gameObjectId || gameObjectId.startsWith('0x_')) {
      setLoading(true);
      setTimeout(() => {
        setGameStats(prev => ({
          ...prev,
          [gameName]: {
            ...prev[gameName],
            balance: String(parseFloat(prev[gameName]?.balance || '0') + parseFloat(fundAmount))
          }
        }));
        setMessage({ type: 'success', text: `[Demo] Funded ${gameName} house with ${fundAmount} SUIT` });
        setFundAmount('');
        setLoading(false);
      }, 500);
      return;
    }

    setLoading(true);
    try {
      const amount = parseSuit(fundAmount);
      const tx = new Transaction();
      const [fundCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);

      tx.moveCall({
        target: `${SUI_CONFIG.packageId}::${MODULES[gameName]}::fund_house`,
        arguments: [
          tx.object(gameObjectId),
          fundCoin,
          tx.object(SUI_CONFIG.adminCap || '0x0') // AdminCap object
        ],
        typeArguments: [SUI_CONFIG.suitrumpToken]
      });

      await signAndExecute({ transaction: tx });
      setMessage({ type: 'success', text: `Funded ${gameName} house with ${fundAmount} SUIT` });
      setFundAmount('');
      await fetchAllStats();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to fund house' });
    } finally {
      setLoading(false);
    }
  };

  // Withdraw from house
  const handleWithdraw = async (gameName) => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      setMessage({ type: 'error', text: 'Enter a valid amount' });
      return;
    }

    const gameObjectId = SUI_CONFIG.games[gameName];

    // Demo mode - simulate withdrawal when contracts not deployed
    if (!gameObjectId || gameObjectId.startsWith('0x_')) {
      const currentBalance = parseFloat(gameStats[gameName]?.balance || '0');
      const withdrawAmt = parseFloat(withdrawAmount);

      if (withdrawAmt > currentBalance) {
        setMessage({ type: 'error', text: `Insufficient balance. Available: ${currentBalance} SUIT` });
        return;
      }

      setLoading(true);
      setTimeout(() => {
        setGameStats(prev => ({
          ...prev,
          [gameName]: {
            ...prev[gameName],
            balance: String(currentBalance - withdrawAmt)
          }
        }));
        setMessage({ type: 'success', text: `[Demo] Withdrew ${withdrawAmount} SUIT from ${gameName}` });
        setWithdrawAmount('');
        setLoading(false);
      }, 500);
      return;
    }

    setLoading(true);
    try {
      const amount = parseSuit(withdrawAmount);
      const tx = new Transaction();

      tx.moveCall({
        target: `${SUI_CONFIG.packageId}::${MODULES[gameName]}::withdraw`,
        arguments: [
          tx.object(gameObjectId),
          tx.pure.u64(amount),
          tx.object(SUI_CONFIG.adminCap || '0x0')
        ],
        typeArguments: [SUI_CONFIG.suitrumpToken]
      });

      await signAndExecute({ transaction: tx });
      setMessage({ type: 'success', text: `Withdrew ${withdrawAmount} SUIT from ${gameName}` });
      setWithdrawAmount('');
      await fetchAllStats();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to withdraw' });
    } finally {
      setLoading(false);
    }
  };

  // Pause/Unpause game
  const handleTogglePause = async (gameName) => {
    const gameObjectId = SUI_CONFIG.games[gameName];
    if (!gameObjectId || gameObjectId.startsWith('0x_')) {
      setMessage({ type: 'error', text: `${gameName} contract not deployed` });
      return;
    }

    const isPaused = gameStats[gameName]?.isPaused;

    setLoading(true);
    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${SUI_CONFIG.packageId}::${MODULES[gameName]}::${isPaused ? 'unpause' : 'pause'}`,
        arguments: [
          tx.object(gameObjectId),
          tx.object(SUI_CONFIG.adminCap || '0x0')
        ],
        typeArguments: [SUI_CONFIG.suitrumpToken]
      });

      await signAndExecute({ transaction: tx });
      setMessage({ type: 'success', text: `${gameName} ${isPaused ? 'unpaused' : 'paused'}` });
      await fetchAllStats();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to toggle pause' });
    } finally {
      setLoading(false);
    }
  };

  // Copy faucet link
  const copyFaucetLink = () => {
    navigator.clipboard.writeText(SUI_FAUCET_URL);
    setMessage({ type: 'success', text: 'Link copied!' });
  };

  if (!account) {
    return (
      <div className="admin-page-v2">
        <div className="admin-connect-card">
          <h2>Admin Panel</h2>
          <p>Connect your Sui wallet to access admin functions</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="admin-page-v2">
        <div className="admin-connect-card">
          <h2>Access Denied</h2>
          <p>Your wallet is not authorized to access admin functions.</p>
          <code style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{account}</code>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page-v2">
      {/* Header */}
      <div className="admin-header">
        <h1>SUITRUMP Royale Admin</h1>
        <span className="admin-badge">Sui Testnet</span>
      </div>

      {/* Messages */}
      {message && (
        <div className={`admin-message ${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      {/* Game Manager Section */}
      <div className="admin-section game-manager-section">
        <div className="section-title">
          <span className="section-icon">🎮</span>
          <h2>Game Manager</h2>
        </div>
        <p className="section-description">
          <strong>Enabled:</strong> Shows game in navigation menu. <strong>Featured:</strong> Shows game in Game Room.
        </p>

        <div className="games-grid">
          {games.map(game => (
            <div key={game.id} className={`game-toggle-card ${game.enabled ? 'active' : 'inactive'}`}>
              <div className="game-toggle-header">
                <span className="game-toggle-icon">{getGameIcon(game.id)}</span>
                <div className="game-toggle-info">
                  <h4>{game.name}</h4>
                  <p>{game.description}</p>
                </div>
              </div>
              <div className="game-toggle-meta">
                <span className="game-meta-item">
                  <span className="meta-label">Route:</span>
                  <code>{game.route}</code>
                </span>
                {game.houseEdge && (
                  <span className="game-meta-item">
                    <span className="meta-label">Edge:</span>
                    <span>{game.houseEdge}</span>
                  </span>
                )}
              </div>
              <div className="game-toggle-pills">
                <button
                  className={`toggle-pill ${game.enabled ? 'active' : ''}`}
                  onClick={() => devToggleGame(game.id, 'enabled', !game.enabled)}
                >
                  <span className="pill-icon">{game.enabled ? '✓' : '✗'}</span>
                  <span className="pill-text">Enabled</span>
                </button>
                <button
                  className={`toggle-pill featured ${game.featured ? 'active' : ''}`}
                  onClick={() => devToggleGame(game.id, 'featured', !game.featured)}
                >
                  <span className="pill-icon">{game.featured ? '⭐' : '☆'}</span>
                  <span className="pill-text">Featured</span>
                </button>
              </div>
              <div className={`game-status-indicator ${game.enabled ? 'live' : 'disabled'}`}>
                {game.enabled ? 'LIVE' : 'DISABLED'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Demo Mode Settings */}
      <div className="admin-section demo-mode-section">
        <div className="section-title">
          <span className="section-icon">🎮</span>
          <h2>Demo Mode Settings</h2>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '15px' }}>
          Control demo/free play mode availability. When enabled, users can try games without spending real tokens.
        </p>

        {/* Global Toggle */}
        <div className="demo-global-toggle">
          <div className="setting-row" style={{
            background: 'linear-gradient(135deg, #1e3a5f 0%, #0a1628 100%)',
            padding: '16px 20px',
            borderRadius: '12px',
            border: adminSettings?.demoModeEnabled?.global ? '2px solid #22c55e' : '1px solid #3b82f6',
            marginBottom: '20px'
          }}>
            <div className="setting-info">
              <span className="setting-label" style={{ fontSize: '1.1rem', color: '#f0f9ff' }}>
                🎛️ Global Demo Mode
              </span>
              <span className="setting-desc" style={{ color: '#94a3b8' }}>
                Master switch - must be ON to enable any game's demo mode
              </span>
            </div>
            <button
              className={`toggle-pill large ${adminSettings?.demoModeEnabled?.global ? 'active' : ''}`}
              onClick={() => updateAdminSettings({
                demoModeEnabled: {
                  ...adminSettings?.demoModeEnabled,
                  global: !adminSettings?.demoModeEnabled?.global
                }
              })}
              style={{
                padding: '10px 24px',
                fontSize: '1rem',
                background: adminSettings?.demoModeEnabled?.global ? '#22c55e' : '#64748b'
              }}
            >
              {adminSettings?.demoModeEnabled?.global ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>
        </div>

        {/* Per-Game Demo Toggles */}
        <div className="demo-games-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          opacity: adminSettings?.demoModeEnabled?.global ? 1 : 0.5,
          pointerEvents: adminSettings?.demoModeEnabled?.global ? 'auto' : 'none'
        }}>
          {[
            { id: 'dice', name: 'Dice', icon: '🎲' },
            { id: 'progressive', name: 'Progressive', icon: '💎' },
            { id: 'raffle', name: 'Raffle', icon: '🎟️' },
            { id: 'slots', name: 'Slots', icon: '🎰' },
            { id: 'crash', name: 'Crash', icon: '🚀' },
            { id: 'keno', name: 'Keno', icon: '🎱' },
            { id: 'plinko', name: 'Plinko', icon: '🎯' },
            { id: 'roulette', name: 'Roulette', icon: '🎡' }
          ].map(game => (
            <div
              key={game.id}
              className={`demo-game-card ${adminSettings?.demoModeEnabled?.[game.id] ? 'active' : ''}`}
              style={{
                background: adminSettings?.demoModeEnabled?.[game.id]
                  ? 'linear-gradient(135deg, #166534 0%, #14532d 100%)'
                  : 'linear-gradient(135deg, #1e3a5f 0%, #0a1628 100%)',
                padding: '14px 16px',
                borderRadius: '10px',
                border: adminSettings?.demoModeEnabled?.[game.id] ? '1px solid #22c55e' : '1px solid #3b82f6',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={() => setGameDemoMode(game.id, !adminSettings?.demoModeEnabled?.[game.id])}
            >
              <span style={{ color: '#f0f9ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>{game.icon}</span>
                <span>{game.name}</span>
              </span>
              <span style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                background: adminSettings?.demoModeEnabled?.[game.id] ? '#22c55e' : '#64748b',
                color: '#fff'
              }}>
                {adminSettings?.demoModeEnabled?.[game.id] ? 'ON' : 'OFF'}
              </span>
            </div>
          ))}
        </div>

        {!adminSettings?.demoModeEnabled?.global && (
          <p style={{ color: '#f59e0b', fontSize: '0.85rem', marginTop: '12px', fontStyle: 'italic' }}>
            ⚠️ Enable Global Demo Mode to configure individual games
          </p>
        )}

        <div style={{ marginTop: '20px', padding: '12px 16px', background: '#0a1628', borderRadius: '8px', border: '1px solid #3b82f6' }}>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
            <strong style={{ color: '#60a5fa' }}>Note:</strong> When demo mode is enabled for a game, users will see a "FREE PLAY" button in the header.
            Demo mode uses simulated tokens and doesn't affect real balances.
          </p>
        </div>
      </div>

      {/* Profit/Loss Analysis */}
      <div className="admin-section">
        <h2>Profit/Loss Analysis</h2>
        <div className="profit-grid">
          <div className="profit-box lime">
            <span className="profit-label">Total Volume</span>
            <span className="profit-value">{totals.totalVolume.toLocaleString()} SUIT</span>
          </div>
          <div className="profit-box lime">
            <span className="profit-label">Total Paid Out</span>
            <span className="profit-value">{totals.totalPaidOut.toLocaleString()} SUIT</span>
          </div>
          <div className="profit-box green">
            <span className="profit-label">Net House Profit</span>
            <span className="profit-value">{totals.netProfit >= 0 ? '+' : ''}{totals.netProfit.toLocaleString()} SUIT</span>
          </div>
          <div className="profit-box orange">
            <span className="profit-label">Total Liquidity</span>
            <span className="profit-value">{totals.totalLiquidity.toLocaleString()} SUIT</span>
          </div>
        </div>

        {/* Breakdown Table */}
        <div className="breakdown-section">
          <h3>Breakdown by Game</h3>
          <table className="breakdown-table">
            <thead>
              <tr>
                <th>Game</th>
                <th>Volume</th>
                <th>Paid Out</th>
                <th>Profit/Loss</th>
                <th>Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {['dice', 'slots', 'crash', 'roulette', 'plinko', 'keno'].map(game => {
                const stats = gameStats[game];
                const volume = parseFloat(stats.totalWagered || '0');
                const paidOut = parseFloat(stats.totalPaidOut || '0');
                const profit = volume - paidOut;
                return (
                  <tr key={game}>
                    <td><span className={`game-badge ${game}`}>{game.charAt(0).toUpperCase() + game.slice(1)}</span></td>
                    <td>{volume.toLocaleString()}</td>
                    <td>{paidOut.toLocaleString()}</td>
                    <td className={profit >= 0 ? 'positive' : 'negative'}>
                      {profit >= 0 ? '+' : ''}{profit.toLocaleString()}
                    </td>
                    <td className="held">{stats.balance}</td>
                    <td>
                      <span className={`status-pill ${stats.isPaused ? 'paused' : 'active'}`}>
                        {stats.isPaused ? 'Paused' : 'Active'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td><span className="game-badge progressive">Progressive</span></td>
                <td>{parseFloat(gameStats.progressive.totalWagered || '0').toLocaleString()}</td>
                <td>-</td>
                <td>-</td>
                <td className="held">{gameStats.progressive.jackpotPool} (Jackpot)</td>
                <td>
                  <span className={`status-pill ${gameStats.progressive.isPaused ? 'paused' : 'active'}`}>
                    {gameStats.progressive.isPaused ? 'Paused' : 'Active'}
                  </span>
                </td>
              </tr>
              <tr>
                <td><span className="game-badge raffle">Raffle</span></td>
                <td>Round #{gameStats.raffle.roundId}</td>
                <td>{gameStats.raffle.totalTickets} tickets</td>
                <td>-</td>
                <td className="held">{gameStats.raffle.prizePool} (Pool)</td>
                <td>
                  <span className={`status-pill ${gameStats.raffle.status === 0 ? 'active' : 'waiting'}`}>
                    {gameStats.raffle.status === 0 ? 'Active' : gameStats.raffle.status === 1 ? 'Drawing' : 'Complete'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Classic Dice Section */}
      <div className="admin-section dice-section">
        <div className="section-title">
          <span className="section-icon">🎲</span>
          <h2>Classic Dice</h2>
        </div>

        <div className="game-admin-grid">
          <div className="stat-card highlight">
            <span className="stat-label">House Bankroll</span>
            <span className="stat-value">{gameStats.dice.balance} SUIT</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Bets</span>
            <span className="stat-value">{gameStats.dice.totalBets?.toLocaleString() || '0'}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Wagered</span>
            <span className="stat-value">{gameStats.dice.totalWagered} SUIT</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Paid Out</span>
            <span className="stat-value">{gameStats.dice.totalPaidOut} SUIT</span>
          </div>
        </div>

        <div className="admin-controls-row">
          <div className="control-group">
            <label>Fund House</label>
            <div className="input-row">
              <input
                type="number"
                placeholder="Amount (SUIT)"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
              />
              <button
                className="btn btn-primary"
                onClick={() => handleFundHouse('dice')}
                disabled={loading}
              >
                Fund Dice
              </button>
            </div>
          </div>

          <div className="control-group">
            <label>Withdraw</label>
            <div className="input-row">
              <input
                type="number"
                placeholder="Amount (SUIT)"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
              <button
                className="btn btn-warning"
                onClick={() => handleWithdraw('dice')}
                disabled={loading}
              >
                Withdraw
              </button>
            </div>
          </div>

          <div className="control-group">
            <label>Game Status</label>
            <button
              className={`btn btn-full ${gameStats.dice.isPaused ? 'btn-success' : 'btn-danger'}`}
              onClick={() => handleTogglePause('dice')}
              disabled={loading}
            >
              {gameStats.dice.isPaused ? '▶ Unpause Dice' : '⏸ Pause Dice'}
            </button>
          </div>
        </div>

        <div className="betting-limits-section">
          <h4>Betting Limits</h4>
          <div className="limits-display">
            <div className="limit-item">
              <span className="limit-label">Min Bet:</span>
              <span className="limit-value">1 SUIT</span>
            </div>
            <div className="limit-item">
              <span className="limit-label">Max Bet:</span>
              <span className="limit-value">1,000 SUIT</span>
            </div>
            <div className="limit-item">
              <span className="limit-label">House Edge:</span>
              <span className="limit-value">3%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progressive Jackpot Section */}
      <div className="admin-section progressive-section">
        <div className="section-title">
          <span className="section-icon">💎</span>
          <h2>Progressive Jackpot</h2>
        </div>

        <div className="game-admin-grid">
          <div className="stat-card jackpot-highlight">
            <span className="stat-label">Current Jackpot</span>
            <span className="stat-value jackpot">{gameStats.progressive.jackpotPool} SUIT</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">House Balance</span>
            <span className="stat-value">{gameStats.progressive.balance} SUIT</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Rolls</span>
            <span className="stat-value">{gameStats.progressive.totalRolls?.toLocaleString() || '0'}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Jackpots Won</span>
            <span className="stat-value">{gameStats.progressive.jackpotsWon || '0'}</span>
          </div>
        </div>

        <div className="admin-controls-row">
          <div className="control-group">
            <label>Fund Jackpot Pool</label>
            <div className="input-row">
              <input
                type="number"
                placeholder="Amount (SUIT)"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
              />
              <button
                className="btn btn-jackpot"
                onClick={() => handleFundHouse('progressive')}
                disabled={loading}
              >
                💎 Fund Jackpot
              </button>
            </div>
          </div>

          <div className="control-group">
            <label>Game Status</label>
            <button
              className={`btn btn-full ${gameStats.progressive.isPaused ? 'btn-success' : 'btn-danger'}`}
              onClick={() => handleTogglePause('progressive')}
              disabled={loading}
            >
              {gameStats.progressive.isPaused ? '▶ Unpause Progressive' : '⏸ Pause Progressive'}
            </button>
          </div>
        </div>

        <div className="jackpot-info">
          <p><strong>Ticket Price:</strong> 1 SUIT | <strong>House Edge:</strong> 20% | <strong>Win:</strong> Match 4 dice for jackpot</p>
        </div>
      </div>

      {/* SUITRUMP Raffle Section */}
      <div className="admin-section raffle-section">
        <div className="section-title">
          <span className="section-icon">🎟️</span>
          <h2>SUITRUMP Raffle</h2>
        </div>

        <div className="game-admin-grid">
          <div className="stat-card highlight">
            <span className="stat-label">Prize Pool</span>
            <span className="stat-value">{gameStats.raffle.prizePool} SUIT</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Current Round</span>
            <span className="stat-value">#{gameStats.raffle.roundId}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Tickets</span>
            <span className="stat-value">{gameStats.raffle.totalTickets?.toLocaleString() || '0'}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Status</span>
            <span className={`stat-value status-${gameStats.raffle.status === 0 ? 'active' : 'waiting'}`}>
              {gameStats.raffle.status === 0 ? 'Active' : gameStats.raffle.status === 1 ? 'Drawing' : 'Complete'}
            </span>
          </div>
        </div>

        <div className="admin-controls-row">
          <div className="control-group">
            <label>Round Duration (Hours)</label>
            <div className="input-row">
              <input
                type="number"
                placeholder="Duration in hours"
                min="0.5"
                max="168"
                step="0.5"
                value={raffleDurationHours}
                onChange={(e) => setRaffleDurationHours(parseFloat(e.target.value))}
              />
              <button
                className="btn btn-primary"
                disabled={loading || gameStats.raffle.status !== 0}
                onClick={handleSetRaffleDuration}
              >
                {loading ? 'Setting...' : 'Set Duration'}
              </button>
            </div>
            <span className="input-hint">
              Current: {gameStats.raffle.roundDurationHours?.toFixed(1) || 6} hours
              {gameStats.raffle.status !== 0 && ' (can only change during WAITING status)'}
            </span>
          </div>

          <div className="control-group">
            <label>Quick Duration Presets</label>
            <div className="button-row">
              <button className="btn btn-secondary" onClick={() => setRaffleDurationHours(1)}>1h</button>
              <button className="btn btn-secondary" onClick={() => setRaffleDurationHours(6)}>6h</button>
              <button className="btn btn-secondary" onClick={() => setRaffleDurationHours(12)}>12h</button>
              <button className="btn btn-secondary" onClick={() => setRaffleDurationHours(24)}>24h</button>
              <button className="btn btn-secondary" onClick={() => setRaffleDurationHours(48)}>48h</button>
            </div>
          </div>
        </div>

        <div className="admin-controls-row">
          <div className="control-group">
            <label>Raffle Actions</label>
            <div className="button-row">
              <button className="btn btn-warning" disabled={loading}>
                🔄 Force Draw
              </button>
              <button className="btn btn-danger" disabled={loading}>
                ❌ Cancel & Refund
              </button>
            </div>
          </div>
        </div>

        <div className="raffle-info">
          <p><strong>Ticket Price:</strong> 1 Ticket ($0.10) | <strong>House Edge:</strong> 6% | <strong>Draw:</strong> After timer expires</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="admin-section">
        <div className="section-title">
          <span className="section-icon">⚡</span>
          <h2>Other Games - Quick Actions</h2>
        </div>

        <div className="quick-actions-grid">
          <div className="action-card">
            <h4>Select Game</h4>
            <select
              value={selectedGame}
              onChange={(e) => setSelectedGame(e.target.value)}
              className="game-select game-select-large"
            >
              <option value="slots">Slots</option>
              <option value="crash">Crash</option>
              <option value="roulette">Roulette</option>
              <option value="plinko">Plinko</option>
              <option value="keno">Keno</option>
              <option value="progressive">Progressive</option>
            </select>
          </div>

          <div className="action-card">
            <h4>Fund House</h4>
            <div className="input-row">
              <input
                type="number"
                placeholder="Amount (SUIT)"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
              />
              <button
                className="btn btn-primary"
                onClick={() => handleFundHouse(selectedGame)}
                disabled={loading}
              >
                Fund
              </button>
            </div>
          </div>

          <div className="action-card">
            <h4>Withdraw</h4>
            <div className="input-row">
              <input
                type="number"
                placeholder="Amount (SUIT)"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
              <button
                className="btn btn-warning"
                onClick={() => handleWithdraw(selectedGame)}
                disabled={loading}
              >
                Withdraw
              </button>
            </div>
          </div>

          <div className="action-card">
            <h4>Toggle Pause</h4>
            <button
              className={`btn ${gameStats[selectedGame]?.isPaused ? 'btn-success' : 'btn-warning'}`}
              onClick={() => handleTogglePause(selectedGame)}
              disabled={loading}
            >
              {gameStats[selectedGame]?.isPaused ? 'Unpause' : 'Pause'} {selectedGame}
            </button>
          </div>
        </div>
      </div>

      {/* Ecosystem Wallets */}
      <div className="admin-section wallets-section">
        <div className="section-title">
          <span className="section-icon">💼</span>
          <h2>Ecosystem Wallets</h2>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '15px' }}>
          Fee Distribution: 1% Burn | 2% Treasury | 1% Dev A | 1% Dev B
        </p>

        <div className="wallet-grid">
          <div className="wallet-card">
            <div className="wallet-card-header">
              <span className="wallet-icon">👨‍💻</span>
              <span className="wallet-label">Dev Wallet A</span>
            </div>
            <div className="wallet-card-body">
              <input
                type="text"
                className="wallet-input"
                value={walletSettings.devA}
                onChange={(e) => handleWalletUpdate('devA', e.target.value)}
                placeholder="0x..."
              />
              {walletSettings.devA && (
                <a
                  href={`${SUI_EXPLORER}/account/${walletSettings.devA}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wallet-link"
                >
                  View on Explorer
                </a>
              )}
            </div>
          </div>

          <div className="wallet-card">
            <div className="wallet-card-header">
              <span className="wallet-icon">👩‍💻</span>
              <span className="wallet-label">Dev Wallet B</span>
            </div>
            <div className="wallet-card-body">
              <input
                type="text"
                className="wallet-input"
                value={walletSettings.devB}
                onChange={(e) => handleWalletUpdate('devB', e.target.value)}
                placeholder="0x..."
              />
              {walletSettings.devB && (
                <a
                  href={`${SUI_EXPLORER}/account/${walletSettings.devB}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wallet-link"
                >
                  View on Explorer
                </a>
              )}
            </div>
          </div>

          <div className="wallet-card">
            <div className="wallet-card-header">
              <span className="wallet-icon">🏦</span>
              <span className="wallet-label">Treasury Wallet</span>
            </div>
            <div className="wallet-card-body">
              <input
                type="text"
                className="wallet-input"
                value={walletSettings.treasury}
                onChange={(e) => handleWalletUpdate('treasury', e.target.value)}
                placeholder="0x..."
              />
              {walletSettings.treasury && (
                <a
                  href={`${SUI_EXPLORER}/account/${walletSettings.treasury}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wallet-link"
                >
                  View on Explorer
                </a>
              )}
            </div>
          </div>

          <div className="wallet-card">
            <div className="wallet-card-header">
              <span className="wallet-icon">🔥</span>
              <span className="wallet-label">Burn Address</span>
            </div>
            <div className="wallet-card-body">
              <code className="wallet-address-fixed">
                0x000...0000
              </code>
              <span className="wallet-note">(Fixed - Cannot be changed)</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '15px' }}>
          <button className="btn btn-primary" onClick={saveWalletSettings}>
            Save Wallet Settings
          </button>
        </div>
      </div>


      {/* Betting Limits Section */}
      <div className="admin-section betting-limits-section">
        <div className="section-title">
          <span className="section-icon">💰</span>
          <h2>Betting Limits</h2>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '15px' }}>
          Configure min/max bets per game (in tickets). 1 ticket = $0.10 USD
        </p>

        <div className="betting-limits-grid">
          {['dice', 'slots', 'crash', 'roulette', 'plinko', 'keno', 'progressive', 'raffle'].map(gameId => {
            const limits = bettingLimits[gameId] || { minBet: 1, maxBet: 10000 };
            const gameNames = {
              dice: '🎲 Dice',
              slots: '🎰 Slots',
              crash: '🚀 Crash',
              roulette: '🎡 Roulette',
              plinko: '🎯 Plinko',
              keno: '🎱 Keno',
              progressive: '💎 Progressive',
              raffle: '🎟️ Raffle'
            };
            return (
              <div key={gameId} className="betting-limit-card">
                <h4>{gameNames[gameId]}</h4>
                <div className="limit-inputs">
                  <div className="limit-input-group">
                    <label>Min Bet</label>
                    <input
                      type="number"
                      value={limits.minBet}
                      onChange={(e) => updateBettingLimits(gameId, { minBet: parseInt(e.target.value) || 1 })}
                      min="1"
                    />
                    <span className="limit-usd">= ${(limits.minBet * 0.10).toFixed(2)}</span>
                  </div>
                  <div className="limit-input-group">
                    <label>Max Bet</label>
                    <input
                      type="number"
                      value={limits.maxBet}
                      onChange={(e) => updateBettingLimits(gameId, { maxBet: parseInt(e.target.value) || 100 })}
                      min="1"
                    />
                    <span className="limit-usd">= ${(limits.maxBet * 0.10).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
          <button
            className="btn btn-primary"
            onClick={() => {
              console.log('Betting limits saved:', bettingLimits);
              setMessage({ type: 'success', text: 'Betting limits saved!' });
            }}
          >
            Save Limits
          </button>
          <button className="btn btn-secondary" onClick={resetBettingLimits}>
            Reset to Defaults
          </button>
        </div>

        <style>{`
          .betting-limits-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 16px;
          }

          .betting-limit-card {
            background: linear-gradient(135deg, #1e3a5f 0%, #0a1628 100%);
            border-radius: 12px;
            padding: 16px;
            border: 1px solid #3b82f6;
          }

          .betting-limit-card h4 {
            color: #60a5fa;
            margin: 0 0 12px 0;
            font-size: 1rem;
          }

          .limit-inputs {
            display: flex;
            gap: 12px;
          }

          .limit-input-group {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .limit-input-group label {
            color: #94a3b8;
            font-size: 0.75rem;
            text-transform: uppercase;
          }

          .limit-input-group input {
            padding: 8px 12px;
            border-radius: 6px;
            background: #0a1628;
            border: 1px solid #3b82f6;
            color: #e0f2fe;
            font-size: 1rem;
            width: 100%;
          }

          .limit-input-group input:focus {
            outline: none;
            border-color: #60a5fa;
          }

          .limit-usd {
            color: #60a5fa;
            font-size: 0.8rem;
            font-style: italic;
          }
        `}</style>
      </div>

      {/* Plinko Settings Section */}
      <PlinkoSettingsSection />

      {/* Tools Section */}
      <div className="admin-section tools-section">
        <div className="section-title">
          <span className="section-icon">🔧</span>
          <h2>Tools</h2>
        </div>

        <div className="tool-box">
          <h4>Sui Testnet Faucet</h4>
          <p>Get test SUI tokens for development</p>
          <div className="tool-buttons">
            <a href={SUI_FAUCET_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              Open Faucet
            </a>
            <button className="btn btn-secondary" onClick={copyFaucetLink}>
              Copy Link
            </button>
          </div>
        </div>


      </div>
    </div>
  );
}

export default AdminPage;
