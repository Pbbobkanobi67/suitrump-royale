import React, { useState, useEffect } from 'react';

function PlayerStatsPage({ wallet, dice, progressive, raffle }) {
  const [suitBalance, setSuitBalance] = useState('0');
  const [diceHistory, setDiceHistory] = useState([]);
  const [progressiveHistory, setProgressiveHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch SUIT balance (placeholder - will use Sui SDK)
  useEffect(() => {
    const fetchBalance = async () => {
      if (!wallet.account) return;

      // TODO: Implement Sui balance fetching
      setSuitBalance('10000');
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [wallet.account]);

  // Fetch player history
  useEffect(() => {
    const fetchHistory = async () => {
      if (!wallet.account) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        // Fetch dice history (placeholder)
        if (dice.fetchPlayerBets) {
          await dice.fetchPlayerBets(wallet.account);
        }

        // Fetch progressive history (placeholder)
        if (progressive.fetchPlayerRolls) {
          await progressive.fetchPlayerRolls(wallet.account);
        }
      } catch (err) {
        console.error('Error fetching history:', err);
      }

      setLoading(false);
    };

    fetchHistory();
  }, [wallet.account]);

  // Update local state when hooks update
  useEffect(() => {
    setDiceHistory(dice.playerBets || []);
  }, [dice.playerBets]);

  useEffect(() => {
    setProgressiveHistory(progressive.playerRolls || []);
  }, [progressive.playerRolls]);

  // Calculate dice stats
  const diceStats = React.useMemo(() => {
    if (!diceHistory.length) return null;

    const totalBets = diceHistory.length;
    const wins = diceHistory.filter(b => b.status === 1).length;
    const losses = diceHistory.filter(b => b.status === 2).length;
    const totalWagered = diceHistory.reduce((sum, b) => sum + parseFloat(b.amount), 0);
    const totalWon = diceHistory.filter(b => b.status === 1).reduce((sum, b) => sum + parseFloat(b.payout), 0);
    const netProfit = totalWon - totalWagered;
    const winRate = totalBets > 0 ? ((wins / totalBets) * 100).toFixed(1) : 0;

    return { totalBets, wins, losses, totalWagered, totalWon, netProfit, winRate };
  }, [diceHistory]);

  // Calculate progressive stats
  const progressiveStats = React.useMemo(() => {
    if (!progressiveHistory.length) return null;

    const totalRolls = progressiveHistory.length;
    const jackpots = progressiveHistory.filter(r => r.matches === 4).length;
    const match3 = progressiveHistory.filter(r => r.matches === 3).length;
    const match2 = progressiveHistory.filter(r => r.matches === 2).length;
    const totalSpent = totalRolls * 100;
    const totalWon = progressiveHistory.reduce((sum, r) => sum + parseFloat(r.payout), 0);
    const netProfit = totalWon - totalSpent;

    return { totalRolls, jackpots, match3, match2, totalSpent, totalWon, netProfit };
  }, [progressiveHistory]);

  // Calculate raffle stats from user tickets
  const raffleStats = React.useMemo(() => {
    if (!raffle.roundInfo) return null;

    return {
      currentTickets: parseFloat(raffle.userTickets || 0),
      currentRound: raffle.roundInfo.roundId,
      prizePool: parseFloat(raffle.roundInfo.prizePool),
      totalTicketsInRound: parseFloat(raffle.roundInfo.totalTickets),
      winChance: raffle.roundInfo.totalTickets > 0
        ? ((parseFloat(raffle.userTickets) / parseFloat(raffle.roundInfo.totalTickets)) * 100).toFixed(2)
        : 0
    };
  }, [raffle.roundInfo, raffle.userTickets]);

  const getBetTypeLabel = (betType) => {
    const labels = ['Exact', 'Over', 'Under', 'Odd', 'Even'];
    return labels[betType] || 'Unknown';
  };

  const getStatusLabel = (status) => {
    const labels = ['Pending', 'Won', 'Lost', 'Expired', 'Cancelled'];
    return labels[status] || 'Unknown';
  };

  const getStatusClass = (status) => {
    if (status === 1) return 'status-won';
    if (status === 2) return 'status-lost';
    return 'status-pending';
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!wallet.account) {
    return (
      <div className="player-stats-page">
        <div className="card stats-connect-card">
          <div className="stats-icon">📊</div>
          <h2>History & Stats</h2>
          <p>Connect your wallet to view your gaming history and statistics</p>
          <button className="btn btn-primary" onClick={wallet.connect}>
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="player-stats-page">
      {/* Player Overview */}
      <div className="card player-overview-card">
        <h2>Player Overview</h2>
        <div className="player-info">
          <div className="player-address">
            <span className="label">Wallet:</span>
            <code>{wallet.account}</code>
          </div>
          <div className="player-balance">
            <span className="label">SUIT Balance:</span>
            <span className="balance-value">{parseFloat(suitBalance).toLocaleString()} SUIT</span>
          </div>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="stats-summary-grid">
        {/* Classic Dice Stats */}
        <div className="card stats-card dice-stats">
          <div className="stats-card-header">
            <span className="stats-icon-small">🎲</span>
            <h3>SUITRUMP Dice</h3>
          </div>
          {diceStats ? (
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-value">{diceStats.totalBets}</span>
                <span className="stat-label">Total Bets</span>
              </div>
              <div className="stat-item">
                <span className="stat-value win">{diceStats.wins}</span>
                <span className="stat-label">Wins</span>
              </div>
              <div className="stat-item">
                <span className="stat-value loss">{diceStats.losses}</span>
                <span className="stat-label">Losses</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{diceStats.winRate}%</span>
                <span className="stat-label">Win Rate</span>
              </div>
              <div className="stat-item full-width">
                <span className="stat-value">{diceStats.totalWagered.toLocaleString()} SUIT</span>
                <span className="stat-label">Total Wagered</span>
              </div>
              <div className="stat-item full-width">
                <span className={`stat-value ${diceStats.netProfit >= 0 ? 'win' : 'loss'}`}>
                  {diceStats.netProfit >= 0 ? '+' : ''}{diceStats.netProfit.toLocaleString()} SUIT
                </span>
                <span className="stat-label">Net Profit/Loss</span>
              </div>
            </div>
          ) : (
            <p className="no-stats">No betting history yet</p>
          )}
        </div>

        {/* Progressive Dice Stats */}
        <div className="card stats-card progressive-stats">
          <div className="stats-card-header">
            <span className="stats-icon-small">🎰</span>
            <h3>Progressive Jackpot</h3>
          </div>
          {progressiveStats ? (
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-value">{progressiveStats.totalRolls}</span>
                <span className="stat-label">Total Rolls</span>
              </div>
              <div className="stat-item">
                <span className="stat-value jackpot">{progressiveStats.jackpots}</span>
                <span className="stat-label">Jackpots (4/4)</span>
              </div>
              <div className="stat-item">
                <span className="stat-value win">{progressiveStats.match3}</span>
                <span className="stat-label">Match 3</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{progressiveStats.match2}</span>
                <span className="stat-label">Match 2</span>
              </div>
              <div className="stat-item full-width">
                <span className="stat-value">{progressiveStats.totalSpent.toLocaleString()} SUIT</span>
                <span className="stat-label">Total Spent</span>
              </div>
              <div className="stat-item full-width">
                <span className={`stat-value ${progressiveStats.netProfit >= 0 ? 'win' : 'loss'}`}>
                  {progressiveStats.netProfit >= 0 ? '+' : ''}{progressiveStats.netProfit.toLocaleString()} SUIT
                </span>
                <span className="stat-label">Net Profit/Loss</span>
              </div>
            </div>
          ) : (
            <p className="no-stats">No progressive history yet</p>
          )}
        </div>

        {/* Raffle Stats */}
        <div className="card stats-card player-raffle-stats">
          <div className="stats-card-header">
            <span className="stats-icon-small">🎟️</span>
            <h3>SUITRUMP Raffle</h3>
          </div>
          {raffleStats ? (
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-value">{raffleStats.currentTickets.toLocaleString()}</span>
                <span className="stat-label">Your Tickets</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">#{raffleStats.currentRound}</span>
                <span className="stat-label">Current Round</span>
              </div>
              <div className="stat-item">
                <span className="stat-value win">{raffleStats.prizePool.toLocaleString()}</span>
                <span className="stat-label">Prize Pool (SUIT)</span>
              </div>
              <div className="stat-item">
                <span className="stat-value jackpot">{raffleStats.winChance}%</span>
                <span className="stat-label">Win Chance</span>
              </div>
            </div>
          ) : (
            <p className="no-stats">Raffle not available</p>
          )}
        </div>
      </div>

      {/* Recent Dice History */}
      <div className="card history-card">
        <h3>Recent Dice Bets</h3>
        {loading ? (
          <p className="loading-text">Loading history...</p>
        ) : diceHistory.length > 0 ? (
          <div className="history-table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Bet Type</th>
                  <th>Choice</th>
                  <th>Amount</th>
                  <th>Result</th>
                  <th>Payout</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {diceHistory.map((bet, index) => (
                  <tr key={index}>
                    <td>{formatDate(bet.timestamp)}</td>
                    <td>{getBetTypeLabel(bet.betType)}</td>
                    <td>{bet.chosenNumber}</td>
                    <td>{parseFloat(bet.amount).toLocaleString()} SUIT</td>
                    <td>{bet.rolledNumber || '-'}</td>
                    <td>{bet.status === 1 ? `${parseFloat(bet.payout).toLocaleString()} SUIT` : '-'}</td>
                    <td>
                      <span className={`status-badge ${getStatusClass(bet.status)}`}>
                        {getStatusLabel(bet.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="no-history">No dice bets yet. Start playing to see your history!</p>
        )}
      </div>

      {/* Recent Progressive History */}
      <div className="card history-card">
        <h3>Recent Progressive Rolls</h3>
        {loading ? (
          <p className="loading-text">Loading history...</p>
        ) : progressiveHistory.length > 0 ? (
          <div className="history-table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Rolled Dice</th>
                  <th>Matches</th>
                  <th>Payout</th>
                </tr>
              </thead>
              <tbody>
                {progressiveHistory.map((roll, index) => (
                  <tr key={index} className={roll.matches === 4 ? 'jackpot-row' : ''}>
                    <td>{formatDate(roll.timestamp)}</td>
                    <td className="rolled-dice">
                      {roll.rolledDice?.map((d, i) => (
                        <span key={i} className="dice-value">{d}</span>
                      ))}
                    </td>
                    <td>
                      <span className={`matches-badge matches-${roll.matches}`}>
                        {roll.matches}/4
                      </span>
                    </td>
                    <td className={parseFloat(roll.payout) > 0 ? 'payout-win' : ''}>
                      {parseFloat(roll.payout) > 0
                        ? `${parseFloat(roll.payout).toLocaleString()} SUIT`
                        : '-'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="no-history">No progressive rolls yet. Try your luck at the jackpot!</p>
        )}
      </div>
    </div>
  );
}

export default PlayerStatsPage;
