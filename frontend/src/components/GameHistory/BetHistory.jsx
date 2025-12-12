import React, { useEffect } from 'react';
import { BetTypeLabels, BetStatusLabels, BetStatus } from '../../hooks/useDice';

function BetHistory({ playerBets, fetchPlayerBets, account }) {
  useEffect(() => {
    if (account) {
      fetchPlayerBets(account);
    }
  }, [account, fetchPlayerBets]);

  if (!account) {
    return (
      <div className="bet-history">
        <h3>Your Bet History</h3>
        <p className="no-data">Connect wallet to view history</p>
      </div>
    );
  }

  if (!playerBets || playerBets.length === 0) {
    return (
      <div className="bet-history">
        <h3>Your Bet History</h3>
        <p className="no-data">No bets yet. Place your first bet!</p>
      </div>
    );
  }

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getStatusClass = (status) => {
    switch (status) {
      case BetStatus.Won: return 'status-won';
      case BetStatus.Lost: return 'status-lost';
      case BetStatus.Pending: return 'status-pending';
      case BetStatus.Expired: return 'status-expired';
      case BetStatus.Cancelled: return 'status-cancelled';
      default: return '';
    }
  };

  return (
    <div className="bet-history">
      <h3>Your Recent Bets</h3>

      <div className="history-table-wrapper">
        <table className="history-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Bet Type</th>
              <th>Number</th>
              <th>Amount</th>
              <th>Result</th>
              <th>Payout</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {playerBets.map((bet, index) => (
              <tr key={index} className={getStatusClass(bet.status)}>
                <td>{formatDate(bet.timestamp)}</td>
                <td>{BetTypeLabels[bet.betType]}</td>
                <td>
                  {bet.betType <= 2 ? bet.chosenNumber : '-'}
                </td>
                <td>{parseFloat(bet.amount).toFixed(2)} SUIT</td>
                <td className="result-cell">
                  {bet.rolledNumber > 0 ? (
                    <span className="dice-result">{bet.rolledNumber}</span>
                  ) : '-'}
                </td>
                <td className={bet.status === BetStatus.Won ? 'payout-won' : ''}>
                  {bet.status === BetStatus.Won
                    ? `+${parseFloat(bet.payout).toFixed(2)} SUIT`
                    : '-'}
                </td>
                <td>
                  <span className={`status-badge ${getStatusClass(bet.status)}`}>
                    {BetStatusLabels[bet.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default BetHistory;
