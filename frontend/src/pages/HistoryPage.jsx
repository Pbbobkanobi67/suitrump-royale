import React from 'react';
import BetHistory from '../components/GameHistory/BetHistory';

function HistoryPage({ wallet, dice }) {
  return (
    <div className="history-page">
      <h2>Bet History</h2>

      <BetHistory
        playerBets={dice.playerBets}
        fetchPlayerBets={dice.fetchPlayerBets}
        account={wallet.account}
      />

      {wallet.account && dice.playerBets.length > 0 && (
        <div className="history-summary">
          <h3>Your Statistics</h3>
          <div className="summary-stats">
            {(() => {
              const wins = dice.playerBets.filter(b => b.status === 1).length;
              const losses = dice.playerBets.filter(b => b.status === 2).length;
              const totalBet = dice.playerBets.reduce((sum, b) => sum + parseFloat(b.amount), 0);
              const totalWon = dice.playerBets
                .filter(b => b.status === 1)
                .reduce((sum, b) => sum + parseFloat(b.payout), 0);

              return (
                <>
                  <div className="summary-stat">
                    <span className="label">Total Bets</span>
                    <span className="value">{dice.playerBets.length}</span>
                  </div>
                  <div className="summary-stat">
                    <span className="label">Wins / Losses</span>
                    <span className="value">{wins} / {losses}</span>
                  </div>
                  <div className="summary-stat">
                    <span className="label">Win Rate</span>
                    <span className="value">
                      {wins + losses > 0
                        ? ((wins / (wins + losses)) * 100).toFixed(1)
                        : 0}%
                    </span>
                  </div>
                  <div className="summary-stat">
                    <span className="label">Total Wagered</span>
                    <span className="value">{totalBet.toFixed(2)} SUIT</span>
                  </div>
                  <div className="summary-stat">
                    <span className="label">Total Won</span>
                    <span className="value">{totalWon.toFixed(2)} SUIT</span>
                  </div>
                  <div className="summary-stat highlight">
                    <span className="label">Net Profit/Loss</span>
                    <span className={`value ${totalWon - totalBet >= 0 ? 'positive' : 'negative'}`}>
                      {(totalWon - totalBet).toFixed(2)} SUIT
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

export default HistoryPage;
