import React, { useState, useEffect } from 'react';
// TODO: Replace ethers with Sui SDK

export function PlayerStats({ contract, account }) {
  const [stats, setStats] = useState({
    totalTicketsBought: '0',
    roundsPlayed: 0,
    roundsWon: 0,
    totalWinnings: '0',
    winRate: '0',
    currentStreak: 0,
    lastPlayed: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (contract && account) {
      loadPlayerStats();
    }
  }, [contract, account]);

  const loadPlayerStats = async () => {
    if (!contract || !account) return;

    try {
      setLoading(true);

      const currentRoundId = await contract.currentRoundId();
      let totalTickets = 0;
      let roundsPlayed = 0;
      let roundsWon = 0;
      let totalWinnings = BigInt(0);
      let lastPlayed = null;

      // Check last 100 rounds for this player's history
      const startRound = Math.max(1, Number(currentRoundId) - 100);

      for (let i = startRound; i < Number(currentRoundId); i++) {
        try {
          const tickets = await contract.getUserTickets(i, account);
          const ticketsNum = Number(ethers.formatEther(tickets));

          if (ticketsNum > 0) {
            totalTickets += ticketsNum;
            roundsPlayed++;
            lastPlayed = i;

            // Check if won
            const roundDetails = await contract.getRoundDetails(i);
            if (roundDetails.winner.toLowerCase() === account.toLowerCase()) {
              roundsWon++;
              totalWinnings += roundDetails.winnerPrize;
            }
          }
        } catch (err) {
          // Round might not exist or be incomplete
          continue;
        }
      }

      const winRate = roundsPlayed > 0 ? ((roundsWon / roundsPlayed) * 100).toFixed(1) : '0';

      setStats({
        totalTicketsBought: totalTickets.toFixed(0),
        roundsPlayed,
        roundsWon,
        totalWinnings: ethers.formatEther(totalWinnings),
        winRate,
        currentStreak: 0, // TODO: Calculate streak
        lastPlayed,
      });
    } catch (err) {
      console.error('Error loading player stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="stats-card">
        <h3>📊 Your Statistics</h3>
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading your stats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stats-card">
      <h3>📊 Your Statistics</h3>

      <div className="stats-grid">
        <div className="stat-box">
          <div className="stat-icon">🎟️</div>
          <div className="stat-info">
            <div className="stat-value">{stats.totalTicketsBought}</div>
            <div className="stat-label">Total Tickets</div>
          </div>
        </div>

        <div className="stat-box">
          <div className="stat-icon">🎮</div>
          <div className="stat-info">
            <div className="stat-value">{stats.roundsPlayed}</div>
            <div className="stat-label">Rounds Played</div>
          </div>
        </div>

        <div className="stat-box">
          <div className="stat-icon">🏆</div>
          <div className="stat-info">
            <div className="stat-value">{stats.roundsWon}</div>
            <div className="stat-label">Wins</div>
          </div>
        </div>

        <div className="stat-box">
          <div className="stat-icon">💰</div>
          <div className="stat-info">
            <div className="stat-value">{parseFloat(stats.totalWinnings).toFixed(2)}</div>
            <div className="stat-label">Total Winnings (SUIT)</div>
          </div>
        </div>

        <div className="stat-box">
          <div className="stat-icon">📈</div>
          <div className="stat-info">
            <div className="stat-value">{stats.winRate}%</div>
            <div className="stat-label">Win Rate</div>
          </div>
        </div>

        <div className="stat-box">
          <div className="stat-icon">🔥</div>
          <div className="stat-info">
            <div className="stat-value">{stats.lastPlayed ? `#${stats.lastPlayed}` : 'N/A'}</div>
            <div className="stat-label">Last Round</div>
          </div>
        </div>
      </div>

      <button
        className="btn btn-secondary"
        onClick={loadPlayerStats}
        style={{ width: '100%', marginTop: '20px' }}
      >
        🔄 Refresh Stats
      </button>
    </div>
  );
}
