import React from 'react';

function JackpotDisplay({ stats, payouts }) {
  if (!stats) {
    return (
      <div className="jackpot-display loading">
        <p>Loading jackpot...</p>
      </div>
    );
  }

  return (
    <div className="jackpot-display">
      <div className="jackpot-amount">
        <span className="jackpot-label">JACKPOT</span>
        <span className="jackpot-value">
          {parseFloat(stats.jackpotPool).toLocaleString()} SUIT
        </span>
      </div>

      <div className="payout-tiers">
        <div className="payout-tier jackpot-tier">
          <span className="tier-match">4/4 Match</span>
          <span className="tier-payout">{parseFloat(payouts?.jackpot || 0).toLocaleString()} SUIT</span>
        </div>
        <div className="payout-tier">
          <span className="tier-match">3/4 Match</span>
          <span className="tier-payout">{parseFloat(payouts?.match3 || 0).toLocaleString()} SUIT</span>
        </div>
        <div className="payout-tier">
          <span className="tier-match">2/4 Match</span>
          <span className="tier-payout">{parseFloat(payouts?.match2 || 0)} SUIT</span>
        </div>
      </div>

      <div className="jackpot-stats">
        <div className="stat-item">
          <span>Total Rolls</span>
          <span>{stats.totalRolls.toLocaleString()}</span>
        </div>
        <div className="stat-item">
          <span>Jackpots Won</span>
          <span>{stats.totalJackpotsWon}</span>
        </div>
        <div className="stat-item">
          <span>Ticket Price</span>
          <span>{stats.ticketPrice} SUIT</span>
        </div>
      </div>
    </div>
  );
}

export default JackpotDisplay;
