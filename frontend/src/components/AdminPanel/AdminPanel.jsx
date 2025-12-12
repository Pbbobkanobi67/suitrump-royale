import React, { useState, useEffect } from 'react';
// TODO: Replace ethers with Sui SDK
import { useGameContext } from '../../contexts/GameContext';

export function AdminPanel({ contract, account, signer }) {
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Contract state
  const [isPaused, setIsPaused] = useState(false);
  const [analytics, setAnalytics] = useState({
    currentRound: 0,
    contractBalance: '0',
    minTickets: '0',
    maxTickets: '0',
    roundDuration: 0,
    ticketMultiplier: 1,
  });

  // Form inputs
  const [bonusMultiplier, setBonusMultiplier] = useState('1');
  const [minTickets, setMinTickets] = useState('5');
  const [maxTickets, setMaxTickets] = useState('150');
  const [minParticipants, setMinParticipants] = useState('2');
  const [roundDuration, setRoundDuration] = useState('5'); // minutes
  const [treasuryWallet, setTreasuryWallet] = useState('');
  const [developerWallet, setDeveloperWallet] = useState('');

  useEffect(() => {
    checkOwner();
    loadAnalytics();
  }, [contract, account]);

  const checkOwner = async () => {
    if (!contract || !account) return;

    try {
      const owner = await contract.owner();
      setIsOwner(owner.toLowerCase() === account.toLowerCase());
    } catch (err) {
      console.error('Error checking owner:', err);
      setIsOwner(false);
    }
  };

  const loadAnalytics = async () => {
    if (!contract) return;

    try {
      const [
        paused,
        currentRoundId,
        minTix,
        maxTix,
        duration,
        multiplier,
        treasury,
        developer,
      ] = await Promise.all([
        contract.paused(),
        contract.currentRoundId(),
        contract.minTickets(),
        contract.maxTickets(),
        contract.roundDuration(),
        contract.ticketMultiplier(),
        contract.treasuryWallet(),
        contract.developerWallet(),
      ]);

      // Get contract balance
      const balance = await contract.blueToken().then(async (tokenAddr) => {
        const token = new ethers.Contract(
          tokenAddr,
          ['function balanceOf(address) view returns (uint256)'],
          contract.runner
        );
        return await token.balanceOf(await contract.getAddress());
      });

      setIsPaused(paused);
      setAnalytics({
        currentRound: currentRoundId.toString(),
        contractBalance: ethers.formatEther(balance),
        minTickets: ethers.formatEther(minTix),
        maxTickets: ethers.formatEther(maxTix),
        roundDuration: Number(duration),
        ticketMultiplier: Number(multiplier),
      });

      // Set form defaults
      setMinTickets(ethers.formatEther(minTix));
      setMaxTickets(ethers.formatEther(maxTix));
      setRoundDuration(duration.toString());
      setBonusMultiplier(multiplier.toString());
      setTreasuryWallet(treasury);
      setDeveloperWallet(developer);
    } catch (err) {
      console.error('Error loading analytics:', err);
    }
  };

  // Contract Status Controls
  const handlePause = async () => {
    if (!contract) return;
    try {
      setLoading(true);
      setMessage(null);
      const tx = await contract.pause();
      await tx.wait();
      setIsPaused(true);
      await loadAnalytics();
      setMessage({ type: 'success', text: 'Contract paused successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: err.shortMessage || err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleUnpause = async () => {
    if (!contract) return;
    try {
      setLoading(true);
      setMessage(null);
      const tx = await contract.unpause();
      await tx.wait();
      setIsPaused(false);
      await loadAnalytics();
      setMessage({ type: 'success', text: 'Contract unpaused successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: err.shortMessage || err.message });
    } finally {
      setLoading(false);
    }
  };

  // Bonus Multiplier
  const handleSetBonusMultiplier = async () => {
    if (!contract) return;
    try {
      setLoading(true);
      setMessage(null);
      const multiplier = parseInt(bonusMultiplier);
      if (multiplier < 1 || multiplier > 10) {
        setMessage({ type: 'error', text: 'Multiplier must be between 1 and 10' });
        return;
      }
      const tx = await contract.setBonusMultiplier(multiplier);
      await tx.wait();
      await loadAnalytics();
      setMessage({ type: 'success', text: `Bonus multiplier set to ${multiplier}x` });
    } catch (err) {
      setMessage({ type: 'error', text: err.shortMessage || err.message });
    } finally {
      setLoading(false);
    }
  };

  // Entry Limits
  const handleSetEntryLimits = async () => {
    if (!contract) return;
    try {
      setLoading(true);
      setMessage(null);
      const min = ethers.parseEther(minTickets);
      const max = ethers.parseEther(maxTickets);
      const minPart = parseInt(minParticipants);
      const tx = await contract.setEntryLimits(min, max, minPart);
      await tx.wait();
      await loadAnalytics();
      setMessage({ type: 'success', text: 'Entry limits updated' });
    } catch (err) {
      setMessage({ type: 'error', text: err.shortMessage || err.message });
    } finally {
      setLoading(false);
    }
  };

  // Round Duration
  const handleSetRoundDuration = async () => {
    if (!contract) return;
    try {
      setLoading(true);
      setMessage(null);
      const durationMinutes = parseInt(roundDuration);
      const durationSeconds = durationMinutes * 60; // Convert minutes to seconds
      const tx = await contract.setRoundDuration(durationSeconds);
      await tx.wait();
      await loadAnalytics();
      setMessage({ type: 'success', text: `Round duration set to ${durationMinutes} minutes` });
    } catch (err) {
      setMessage({ type: 'error', text: err.shortMessage || err.message });
    } finally {
      setLoading(false);
    }
  };

  // Update Wallets
  const handleSetTreasuryWallet = async () => {
    if (!contract) return;
    try {
      setLoading(true);
      setMessage(null);
      const tx = await contract.setTreasuryWallet(treasuryWallet);
      await tx.wait();
      await loadAnalytics();
      setMessage({ type: 'success', text: 'Treasury wallet updated' });
    } catch (err) {
      setMessage({ type: 'error', text: err.shortMessage || err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSetDeveloperWallet = async () => {
    if (!contract) return;
    try {
      setLoading(true);
      setMessage(null);
      const tx = await contract.setDeveloperWallet(developerWallet);
      await tx.wait();
      await loadAnalytics();
      setMessage({ type: 'success', text: 'Developer wallet updated' });
    } catch (err) {
      setMessage({ type: 'error', text: err.shortMessage || err.message });
    } finally {
      setLoading(false);
    }
  };

  // Cancel Round
  const handleCancelRound = async () => {
    if (!contract) return;
    const confirmed = window.confirm(
      'Are you sure you want to cancel the current round? All participants will be refunded.'
    );
    if (!confirmed) return;
    try {
      setLoading(true);
      setMessage(null);
      const tx = await contract.cancelRound();
      await tx.wait();
      await loadAnalytics();
      setMessage({ type: 'success', text: 'Round cancelled and participants refunded' });
    } catch (err) {
      setMessage({ type: 'error', text: err.shortMessage || err.message });
    } finally {
      setLoading(false);
    }
  };

  if (!isOwner) {
    return null;
  }

  return (
    <div className="admin-panel">
      <h2>⚙️ Admin Control Panel</h2>

      {message && (
        <div className={message.type === 'error' ? 'error-message' : 'success-message'}>
          {message.text}
        </div>
      )}

      {/* Analytics Section */}
      <div className="admin-section">
        <h3>📊 Analytics</h3>
        <div className="admin-controls">
          <div className="control-group">
            <h4>Contract Stats</h4>
            <p>Current Round: <strong>#{analytics.currentRound}</strong></p>
            <p>Contract Balance: <strong>{parseFloat(analytics.contractBalance).toFixed(2)} SUIT</strong></p>
            <p>Status: <strong>{isPaused ? '🔴 Paused' : '🟢 Active'}</strong></p>
          </div>

          <div className="control-group">
            <h4>Current Settings</h4>
            <p>Min Tickets: <strong>{analytics.minTickets} SUIT</strong></p>
            <p>Max Tickets: <strong>{analytics.maxTickets} SUIT</strong></p>
            <p>Round Duration: <strong>{analytics.roundDuration}s ({Math.floor(analytics.roundDuration / 60)}m)</strong></p>
            <p>Ticket Multiplier: <strong>{analytics.ticketMultiplier}x</strong></p>
          </div>

          <div className="control-group">
            <h4>Wallets</h4>
            <p style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>
              Treasury: <strong>{treasuryWallet.slice(0, 10)}...{treasuryWallet.slice(-8)}</strong>
            </p>
            <p style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>
              Developer: <strong>{developerWallet.slice(0, 10)}...{developerWallet.slice(-8)}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Contract Controls */}
      <div className="admin-section">
        <h3>🎛️ Contract Controls</h3>
        <div className="admin-controls">
          <div className="control-group">
            <h4>Contract Status</h4>
            <button
              className={`btn ${isPaused ? 'btn-success' : 'btn-danger'}`}
              onClick={isPaused ? handleUnpause : handlePause}
              disabled={loading}
            >
              {isPaused ? 'Unpause Contract' : 'Pause Contract'}
            </button>
          </div>

          <div className="control-group">
            <h4>Bonus Round Multiplier</h4>
            <input
              type="number"
              value={bonusMultiplier}
              onChange={(e) => setBonusMultiplier(e.target.value)}
              min="1"
              max="10"
              className="admin-input"
            />
            <button className="btn btn-primary" onClick={handleSetBonusMultiplier} disabled={loading}>
              Set {bonusMultiplier}x Multiplier
            </button>
          </div>

          <div className="control-group">
            <h4>Emergency</h4>
            <button className="btn btn-danger" onClick={handleCancelRound} disabled={loading}>
              Cancel Round & Refund
            </button>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '10px' }}>
              ⚠️ Refunds all participants
            </p>
          </div>
        </div>
      </div>

      {/* Parameter Controls */}
      <div className="admin-section">
        <h3>⚙️ Parameter Controls</h3>
        <div className="admin-controls">
          <div className="control-group">
            <h4>Entry Limits</h4>
            <label>Min Tickets (SUIT)</label>
            <input
              type="number"
              value={minTickets}
              onChange={(e) => setMinTickets(e.target.value)}
              className="admin-input"
            />
            <label>Max Tickets (SUIT)</label>
            <input
              type="number"
              value={maxTickets}
              onChange={(e) => setMaxTickets(e.target.value)}
              className="admin-input"
            />
            <label>Min Participants</label>
            <input
              type="number"
              value={minParticipants}
              onChange={(e) => setMinParticipants(e.target.value)}
              className="admin-input"
            />
            <button className="btn btn-primary" onClick={handleSetEntryLimits} disabled={loading}>
              Update Entry Limits
            </button>
          </div>

          <div className="control-group">
            <h4>Round Duration</h4>
            <label>Duration (minutes)</label>
            <input
              type="number"
              value={roundDuration}
              onChange={(e) => setRoundDuration(e.target.value)}
              className="admin-input"
              min="1"
            />
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              {parseInt(roundDuration || 0) * 60} seconds
            </p>
            <button className="btn btn-primary" onClick={handleSetRoundDuration} disabled={loading}>
              Update Duration
            </button>
          </div>
        </div>
      </div>

      {/* Wallet Management */}
      <div className="admin-section">
        <h3>💼 Wallet Management</h3>
        <div className="admin-controls">
          <div className="control-group">
            <h4>Treasury Wallet</h4>
            <input
              type="text"
              value={treasuryWallet}
              onChange={(e) => setTreasuryWallet(e.target.value)}
              placeholder="0x..."
              className="admin-input"
            />
            <button className="btn btn-primary" onClick={handleSetTreasuryWallet} disabled={loading}>
              Update Treasury
            </button>
          </div>

          <div className="control-group">
            <h4>Developer Wallet</h4>
            <input
              type="text"
              value={developerWallet}
              onChange={(e) => setDeveloperWallet(e.target.value)}
              placeholder="0x..."
              className="admin-input"
            />
            <button className="btn btn-primary" onClick={handleSetDeveloperWallet} disabled={loading}>
              Update Developer
            </button>
          </div>
        </div>
      </div>

      {/* Game Management */}
      <GameManagementSection />

      {/* Plinko Settings */}
      <PlinkoSettingsSection />

      {/* Refresh Button */}
      <div style={{ textAlign: 'center', marginTop: '30px' }}>
        <button className="btn btn-secondary" onClick={loadAnalytics} disabled={loading}>
          🔄 Refresh Data
        </button>
      </div>
    </div>
  );
}

// Game Management Section Component
function GameManagementSection() {
  const { games, devToggleGame, isOwner: isGameOwner } = useGameContext();
  const [localLoading, setLocalLoading] = useState(null);

  // Handle toggle game property (dev mode - no contract)
  const handleToggle = async (gameId, field) => {
    const game = games.find(g => g.id === gameId);
    if (!game) return;

    setLocalLoading(`${gameId}-${field}`);
    try {
      // In dev mode, just toggle locally
      devToggleGame(gameId, field, !game[field]);

      // TODO: When GameManager contract is deployed, use:
      // await setGameEnabled(gameId, !game.enabled);
      // await setGameVisible(gameId, !game.visible);
      // await setGameFeatured(gameId, !game.featured);

    } catch (err) {
      console.error('Error toggling game:', err);
    } finally {
      setLocalLoading(null);
    }
  };

  return (
    <div className="admin-section">
      <h3>🎮 Game Management</h3>
      <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '15px' }}>
        Toggle games on/off, show/hide in navigation, or feature on homepage
      </p>

      <div className="game-management-grid">
        {games.map((game) => (
          <div key={game.id} className="game-card">
            <div className="game-card-header">
              <span className="game-icon">
                {game.id === 'raffle' ? '🎰' : game.id === 'slots' ? '🎲' : '🎮'}
              </span>
              <div className="game-info">
                <h4>{game.name}</h4>
                <p>{game.description}</p>
              </div>
            </div>

            <div className="game-toggles">
              {/* Enabled Toggle */}
              <div className="toggle-row">
                <span className="toggle-label">Enabled</span>
                <button
                  className={`toggle-btn ${game.enabled ? 'active' : ''}`}
                  onClick={() => handleToggle(game.id, 'enabled')}
                  disabled={localLoading === `${game.id}-enabled`}
                >
                  {game.enabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Visible Toggle */}
              <div className="toggle-row">
                <span className="toggle-label">Visible</span>
                <button
                  className={`toggle-btn ${game.visible ? 'active' : ''}`}
                  onClick={() => handleToggle(game.id, 'visible')}
                  disabled={localLoading === `${game.id}-visible`}
                >
                  {game.visible ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Featured Toggle */}
              <div className="toggle-row">
                <span className="toggle-label">Featured</span>
                <button
                  className={`toggle-btn ${game.featured ? 'active' : ''}`}
                  onClick={() => handleToggle(game.id, 'featured')}
                  disabled={localLoading === `${game.id}-featured`}
                >
                  {game.featured ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {/* Status Summary */}
            <div className="game-status">
              {game.enabled && game.visible ? (
                <span className="status-badge live">Live</span>
              ) : game.visible && !game.enabled ? (
                <span className="status-badge coming-soon">Coming Soon</span>
              ) : (
                <span className="status-badge hidden">Hidden</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .game-management-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          margin-top: 15px;
        }

        .game-card {
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          border-radius: 12px;
          padding: 20px;
          border: 1px solid #334155;
        }

        .game-card-header {
          display: flex;
          gap: 12px;
          margin-bottom: 15px;
          align-items: flex-start;
        }

        .game-icon {
          font-size: 2rem;
        }

        .game-info h4 {
          margin: 0 0 5px 0;
          color: #f8fafc;
        }

        .game-info p {
          margin: 0;
          color: #94a3b8;
          font-size: 0.85rem;
        }

        .game-toggles {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 15px;
        }

        .toggle-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .toggle-label {
          color: #94a3b8;
          font-size: 0.9rem;
        }

        .toggle-btn {
          padding: 6px 16px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          min-width: 60px;
        }

        .toggle-btn:not(.active) {
          background: #334155;
          color: #94a3b8;
        }

        .toggle-btn.active {
          background: #22c55e;
          color: white;
        }

        .toggle-btn:hover:not(:disabled) {
          transform: scale(1.05);
        }

        .toggle-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .game-status {
          padding-top: 10px;
          border-top: 1px solid #334155;
        }

        .status-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .status-badge.live {
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
        }

        .status-badge.coming-soon {
          background: rgba(251, 191, 36, 0.2);
          color: #fbbf24;
        }

        .status-badge.hidden {
          background: rgba(148, 163, 184, 0.2);
          color: #94a3b8;
        }
      `}</style>
    </div>
  );
}

// Plinko Settings Section Component
function PlinkoSettingsSection() {
  const { plinkoSettings, updatePlinkoSettings, resetPlinkoSettings } = useGameContext();

  const RISK_LEVELS = ['Low', 'Medium', 'High'];
  const ROW_OPTIONS = [8, 10, 12];
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
      <h3>🎯 Plinko Settings</h3>
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
              className={`toggle-btn ${plinkoSettings.recordedPathsEnabled ? 'active' : ''}`}
              onClick={() => handleToggle('recordedPathsEnabled')}
            >
              {plinkoSettings.recordedPathsEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Live Stats Panel</span>
              <span className="setting-desc">Show profit, wins, losses tracker</span>
            </div>
            <button
              className={`toggle-btn ${plinkoSettings.showLiveStats ? 'active' : ''}`}
              onClick={() => handleToggle('showLiveStats')}
            >
              {plinkoSettings.showLiveStats ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Test Drop</span>
              <span className="setting-desc">Allow free test drops for users</span>
            </div>
            <button
              className={`toggle-btn ${plinkoSettings.testDropEnabled ? 'active' : ''}`}
              onClick={() => handleToggle('testDropEnabled')}
            >
              {plinkoSettings.testDropEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Auto-Reveal</span>
              <span className="setting-desc">Automatically reveal when blocks are ready</span>
            </div>
            <button
              className={`toggle-btn ${plinkoSettings.autoReveal ? 'active' : ''}`}
              onClick={() => handleToggle('autoReveal')}
            >
              {plinkoSettings.autoReveal ? 'ON' : 'OFF'}
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
                  className={`option-btn ${plinkoSettings.defaultRows === rows ? 'active' : ''}`}
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
                  className={`option-btn risk-${risk.toLowerCase()} ${plinkoSettings.defaultRisk === i ? 'active' : ''}`}
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
              value={plinkoSettings.ballSpeed}
              onChange={(e) => updatePlinkoSettings({ ballSpeed: parseFloat(e.target.value) })}
            >
              {SPEED_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Reset Button */}
      <div style={{ marginTop: '20px' }}>
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
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          border-radius: 12px;
          padding: 20px;
          border: 1px solid #334155;
        }

        .settings-card h4 {
          color: #f8fafc;
          margin: 0 0 15px 0;
          font-size: 1rem;
        }

        .setting-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #334155;
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
          color: #f8fafc;
          font-weight: 500;
        }

        .setting-desc {
          color: #64748b;
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
          background: #334155;
          color: #94a3b8;
        }

        .option-btn:hover {
          background: #475569;
        }

        .option-btn.active {
          background: #3b82f6;
          color: white;
        }

        .option-btn.risk-low.active {
          background: #22c55e;
        }

        .option-btn.risk-medium.active {
          background: #eab308;
          color: #0f172a;
        }

        .option-btn.risk-high.active {
          background: #ef4444;
        }

        .speed-select {
          padding: 8px 12px;
          border-radius: 6px;
          background: #334155;
          border: 1px solid #475569;
          color: #f8fafc;
          font-size: 0.9rem;
          cursor: pointer;
        }

        .speed-select:focus {
          outline: none;
          border-color: #3b82f6;
        }
      `}</style>
    </div>
  );
}
