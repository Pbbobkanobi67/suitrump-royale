import React, { useState, useEffect } from 'react';
// TODO: Replace ethers with Sui SDK

export function LiveAnalytics({ contract }) {
  const [analytics, setAnalytics] = useState({
    totalRounds: 0,
    totalVolume: '0',
    uniqueParticipants: 0,
    avgPrizePool: '0',
    totalWinnings: '0',
    largestPrize: '0',
    currentRoundPool: '0',
    currentRoundParticipants: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (contract) {
      loadAnalytics();
    }
  }, [contract]);

  const loadAnalytics = async () => {
    if (!contract) return;

    try {
      setLoading(true);

      const currentRoundId = await contract.currentRoundId();
      const totalCompletedRounds = Number(currentRoundId) - 1;

      let totalVolume = BigInt(0);
      let totalWinnings = BigInt(0);
      let largestPrize = BigInt(0);
      const uniqueAddresses = new Set();
      let prizePoolSum = BigInt(0);
      let prizePoolCount = 0;

      // Get current round info
      let currentRoundPool = '0';
      let currentRoundParticipants = 0;
      try {
        const currentRound = await contract.getRoundDetails(Number(currentRoundId));
        currentRoundPool = ethers.formatEther(currentRound.totalTickets);
        const currentParticipants = await contract.getRoundParticipants(Number(currentRoundId));
        currentRoundParticipants = currentParticipants.length;
      } catch (err) {
        // Current round might not exist yet
      }

      // Scan all completed rounds
      for (let i = 1; i < Number(currentRoundId); i++) {
        try {
          const details = await contract.getRoundDetails(i);

          // Only process completed rounds
          if (Number(details.status) === 3) {
            const tickets = details.totalTickets;
            const prize = details.winnerPrize;

            totalVolume += tickets;
            totalWinnings += prize;
            prizePoolSum += prize;
            prizePoolCount++;

            if (prize > largestPrize) {
              largestPrize = prize;
            }

            // Get unique participants
            const participants = await contract.getRoundParticipants(i);
            participants.forEach(addr => uniqueAddresses.add(addr.toLowerCase()));
          }
        } catch (err) {
          console.error(`Error loading round ${i}:`, err);
        }
      }

      const avgPrize = prizePoolCount > 0 ? prizePoolSum / BigInt(prizePoolCount) : BigInt(0);

      setAnalytics({
        totalRounds: totalCompletedRounds,
        totalVolume: ethers.formatEther(totalVolume),
        uniqueParticipants: uniqueAddresses.size,
        avgPrizePool: ethers.formatEther(avgPrize),
        totalWinnings: ethers.formatEther(totalWinnings),
        largestPrize: ethers.formatEther(largestPrize),
        currentRoundPool,
        currentRoundParticipants,
      });
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="analytics-card">
        <h3>📈 Live Analytics</h3>
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-card">
      <h3>📈 Live Analytics</h3>

      <div className="analytics-grid">
        <div className="analytics-stat">
          <div className="analytics-icon">🎯</div>
          <div className="analytics-info">
            <div className="analytics-value">{analytics.totalRounds}</div>
            <div className="analytics-label">Total Rounds</div>
          </div>
        </div>

        <div className="analytics-stat">
          <div className="analytics-icon">💎</div>
          <div className="analytics-info">
            <div className="analytics-value">{parseFloat(analytics.totalVolume).toFixed(0)}</div>
            <div className="analytics-label">Total Volume (SUIT)</div>
          </div>
        </div>

        <div className="analytics-stat">
          <div className="analytics-icon">👥</div>
          <div className="analytics-info">
            <div className="analytics-value">{analytics.uniqueParticipants}</div>
            <div className="analytics-label">Unique Players</div>
          </div>
        </div>

        <div className="analytics-stat">
          <div className="analytics-icon">🏆</div>
          <div className="analytics-info">
            <div className="analytics-value">{parseFloat(analytics.totalWinnings).toFixed(2)}</div>
            <div className="analytics-label">Total Winnings (SUIT)</div>
          </div>
        </div>

        <div className="analytics-stat">
          <div className="analytics-icon">📊</div>
          <div className="analytics-info">
            <div className="analytics-value">{parseFloat(analytics.avgPrizePool).toFixed(2)}</div>
            <div className="analytics-label">Avg Prize Pool (SUIT)</div>
          </div>
        </div>

        <div className="analytics-stat">
          <div className="analytics-icon">💰</div>
          <div className="analytics-info">
            <div className="analytics-value">{parseFloat(analytics.largestPrize).toFixed(2)}</div>
            <div className="analytics-label">Largest Prize (SUIT)</div>
          </div>
        </div>
      </div>

      <div className="current-round-section">
        <h4>Current Round</h4>
        <div className="current-round-stats">
          <div className="current-stat">
            <span className="current-label">Prize Pool:</span>
            <span className="current-value">{parseFloat(analytics.currentRoundPool).toFixed(2)} SUIT</span>
          </div>
          <div className="current-stat">
            <span className="current-label">Participants:</span>
            <span className="current-value">{analytics.currentRoundParticipants}</span>
          </div>
        </div>
      </div>

      <button
        className="btn btn-secondary"
        onClick={loadAnalytics}
        style={{ width: '100%', marginTop: '20px' }}
      >
        🔄 Refresh Analytics
      </button>
    </div>
  );
}
