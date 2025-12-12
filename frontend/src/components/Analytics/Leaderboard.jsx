import React, { useState, useEffect } from 'react';
// TODO: Replace ethers with Sui SDK

export function Leaderboard({ contract }) {
  const [leaderboard, setLeaderboard] = useState({
    topWinners: [],
    mostActive: [],
    biggestWins: [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('topWinners');

  useEffect(() => {
    if (contract) {
      loadLeaderboard();
    }
  }, [contract]);

  const loadLeaderboard = async () => {
    if (!contract) return;

    try {
      setLoading(true);

      const currentRoundId = await contract.currentRoundId();
      const totalRounds = Math.min(100, Number(currentRoundId) - 1); // Last 100 rounds

      // Data structures to track stats
      const playerWinnings = new Map(); // address -> total winnings
      const playerRounds = new Map(); // address -> rounds played
      const biggestWins = []; // array of {round, winner, prize}

      for (let i = Math.max(1, Number(currentRoundId) - totalRounds); i < Number(currentRoundId); i++) {
        try {
          const details = await contract.getRoundDetails(i);

          // Only process completed rounds
          if (Number(details.status) === 3) {
            const winner = details.winner.toLowerCase();
            const prize = details.winnerPrize;

            // Track winnings
            if (!playerWinnings.has(winner)) {
              playerWinnings.set(winner, BigInt(0));
            }
            playerWinnings.set(winner, playerWinnings.get(winner) + prize);

            // Track biggest single wins
            biggestWins.push({
              roundId: i,
              winner: details.winner,
              prize: ethers.formatEther(prize),
            });

            // Track all participants for active players
            const participants = await contract.getRoundParticipants(i);
            for (const participant of participants) {
              const addr = participant.toLowerCase();
              if (!playerRounds.has(addr)) {
                playerRounds.set(addr, 0);
              }
              playerRounds.set(addr, playerRounds.get(addr) + 1);
            }
          }
        } catch (err) {
          console.error(`Error loading round ${i}:`, err);
        }
      }

      // Sort top winners by total winnings
      const topWinners = Array.from(playerWinnings.entries())
        .map(([address, totalWinnings]) => ({
          address,
          totalWinnings: ethers.formatEther(totalWinnings),
          roundsWon: Array.from(playerWinnings.keys()).filter(a => a === address).length,
        }))
        .sort((a, b) => parseFloat(b.totalWinnings) - parseFloat(a.totalWinnings))
        .slice(0, 10);

      // Sort most active players by rounds played
      const mostActive = Array.from(playerRounds.entries())
        .map(([address, rounds]) => ({
          address,
          roundsPlayed: rounds,
        }))
        .sort((a, b) => b.roundsPlayed - a.roundsPlayed)
        .slice(0, 10);

      // Sort biggest single wins
      biggestWins.sort((a, b) => parseFloat(b.prize) - parseFloat(a.prize));
      const topBiggestWins = biggestWins.slice(0, 10);

      setLeaderboard({
        topWinners,
        mostActive,
        biggestWins: topBiggestWins,
      });
    } catch (err) {
      console.error('Error loading leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="leaderboard-card">
        <h3>🏆 Leaderboard</h3>
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  const renderTopWinners = () => (
    <div className="leaderboard-list">
      {leaderboard.topWinners.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
          No winners yet. Be the first!
        </p>
      ) : (
        leaderboard.topWinners.map((player, index) => (
          <div key={player.address} className="leaderboard-item">
            <div className="leaderboard-rank">
              {index === 0 && '🥇'}
              {index === 1 && '🥈'}
              {index === 2 && '🥉'}
              {index > 2 && `#${index + 1}`}
            </div>
            <div className="leaderboard-info">
              <div className="leaderboard-address">
                {player.address.slice(0, 6)}...{player.address.slice(-4)}
              </div>
              <div className="leaderboard-stats">
                {parseFloat(player.totalWinnings).toFixed(2)} SUIT won
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderMostActive = () => (
    <div className="leaderboard-list">
      {leaderboard.mostActive.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
          No players yet. Be the first!
        </p>
      ) : (
        leaderboard.mostActive.map((player, index) => (
          <div key={player.address} className="leaderboard-item">
            <div className="leaderboard-rank">
              {index === 0 && '🥇'}
              {index === 1 && '🥈'}
              {index === 2 && '🥉'}
              {index > 2 && `#${index + 1}`}
            </div>
            <div className="leaderboard-info">
              <div className="leaderboard-address">
                {player.address.slice(0, 6)}...{player.address.slice(-4)}
              </div>
              <div className="leaderboard-stats">
                {player.roundsPlayed} rounds played
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderBiggestWins = () => (
    <div className="leaderboard-list">
      {leaderboard.biggestWins.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
          No wins yet. Be the first!
        </p>
      ) : (
        leaderboard.biggestWins.map((win, index) => (
          <div key={`${win.roundId}-${win.winner}`} className="leaderboard-item">
            <div className="leaderboard-rank">
              {index === 0 && '🥇'}
              {index === 1 && '🥈'}
              {index === 2 && '🥉'}
              {index > 2 && `#${index + 1}`}
            </div>
            <div className="leaderboard-info">
              <div className="leaderboard-address">
                Round #{win.roundId} - {win.winner.slice(0, 6)}...{win.winner.slice(-4)}
              </div>
              <div className="leaderboard-stats">
                {parseFloat(win.prize).toFixed(2)} SUIT
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="leaderboard-card">
      <h3>🏆 Leaderboard</h3>

      <div className="leaderboard-tabs">
        <button
          className={`tab-button ${selectedTab === 'topWinners' ? 'active' : ''}`}
          onClick={() => setSelectedTab('topWinners')}
        >
          Top Winners
        </button>
        <button
          className={`tab-button ${selectedTab === 'mostActive' ? 'active' : ''}`}
          onClick={() => setSelectedTab('mostActive')}
        >
          Most Active
        </button>
        <button
          className={`tab-button ${selectedTab === 'biggestWins' ? 'active' : ''}`}
          onClick={() => setSelectedTab('biggestWins')}
        >
          Biggest Wins
        </button>
      </div>

      {selectedTab === 'topWinners' && renderTopWinners()}
      {selectedTab === 'mostActive' && renderMostActive()}
      {selectedTab === 'biggestWins' && renderBiggestWins()}

      <button
        className="btn btn-secondary"
        onClick={loadLeaderboard}
        style={{ width: '100%', marginTop: '20px' }}
      >
        🔄 Refresh Leaderboard
      </button>
    </div>
  );
}
