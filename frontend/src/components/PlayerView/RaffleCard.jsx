import React, { useState, useEffect } from 'react';

export function RaffleCard({ roundInfo, userTickets }) {
  const [localTimeRemaining, setLocalTimeRemaining] = useState(0);

  // Initialize local time from roundInfo when round changes
  useEffect(() => {
    if (roundInfo && roundInfo.timeRemaining !== undefined) {
      setLocalTimeRemaining(roundInfo.timeRemaining);
    }
  }, [roundInfo?.roundId, roundInfo?.timeRemaining]);

  // Local countdown timer
  useEffect(() => {
    if (!roundInfo || roundInfo.statusCode !== 1) {
      return;
    }

    const interval = setInterval(() => {
      setLocalTimeRemaining((prev) => {
        if (prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000); // Count down every 1 second

    return () => clearInterval(interval);
  }, [roundInfo?.statusCode]);

  const formatTime = (seconds) => {
    if (seconds <= 0) return 'Time is up!';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (!roundInfo) {
    return (
      <div className="raffle-card">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading raffle information...</p>
        </div>
      </div>
    );
  }

  const getStatusClass = () => {
    switch (roundInfo.statusCode) {
      case 0: return 'status-waiting';
      case 1: return 'status-active';
      case 2: return 'status-drawing';
      case 3: return 'status-complete';
      default: return 'status-waiting';
    }
  };

  return (
    <div className="raffle-card">
      <h2>Round #{roundInfo.roundId}</h2>
      <span className={`status-badge ${getStatusClass()}`}>
        {roundInfo.status}
      </span>

      {roundInfo.statusCode === 1 && (
        <div className="timer">
          <div className="timer-display">{formatTime(localTimeRemaining)}</div>
          <div className="timer-label">Time Remaining</div>
        </div>
      )}

      <div className="round-stats">
        <div className="stat-item">
          <div className="stat-label">Prize Pool</div>
          <div className="stat-value">{parseFloat(roundInfo.prizePool).toFixed(2)} SUIT</div>
        </div>

        <div className="stat-item">
          <div className="stat-label">Total Tickets</div>
          <div className="stat-value">{parseFloat(roundInfo.totalTickets).toFixed(0)}</div>
        </div>

        <div className="stat-item">
          <div className="stat-label">Participants</div>
          <div className="stat-value">{roundInfo.uniqueWallets}</div>
        </div>

        <div className="stat-item">
          <div className="stat-label">Your Tickets</div>
          <div className="stat-value">{parseFloat(userTickets).toFixed(0)}</div>
        </div>
      </div>

      {roundInfo.statusCode === 0 && (
        <div style={{ textAlign: 'center', marginTop: '20px', color: '#f59e0b' }}>
          <p>⏳ Waiting for {2 - parseInt(roundInfo.uniqueWallets)} more player(s) to start the round</p>
        </div>
      )}

      {roundInfo.statusCode === 2 && (
        <div style={{ textAlign: 'center', marginTop: '20px', color: '#3b82f6' }}>
          <p>🎲 Drawing winner... Please wait for the draw to complete!</p>
        </div>
      )}
    </div>
  );
}
