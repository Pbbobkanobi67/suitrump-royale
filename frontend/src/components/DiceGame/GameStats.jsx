import React from 'react';

function GameStats({ stats, limits }) {
  if (!stats) {
    return (
      <div className="game-stats loading">
        <p>Loading stats...</p>
      </div>
    );
  }

  return (
    <div className="game-stats">
      <h3>Game Statistics</h3>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">House Bankroll</span>
          <span className="stat-value">{parseFloat(stats.houseBankroll).toLocaleString()} SUIT</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Total Bets</span>
          <span className="stat-value">{stats.totalBets.toLocaleString()}</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Total Wagered</span>
          <span className="stat-value">{parseFloat(stats.totalWagered).toLocaleString()} SUIT</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Total Paid Out</span>
          <span className="stat-value">{parseFloat(stats.totalPaidOut).toLocaleString()} SUIT</span>
        </div>
      </div>

      {limits && (
        <div className="limits-info">
          <p><strong>House Edge:</strong> {limits.houseEdge}%</p>
          {limits.paused && (
            <p className="paused-warning">Game is currently paused</p>
          )}
        </div>
      )}
    </div>
  );
}

export default GameStats;
