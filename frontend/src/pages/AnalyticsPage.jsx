import React from 'react';
import { PlayerStats } from '../components/Analytics/PlayerStats';
import { RoundHistory } from '../components/Analytics/RoundHistory';
import { Leaderboard } from '../components/Analytics/Leaderboard';
import { LiveAnalytics } from '../components/Analytics/LiveAnalytics';

export function AnalyticsPage({ contract, account }) {
  return (
    <div className="analytics-page">
      <div className="page-header">
        <h1>📊 Analytics & Statistics</h1>
        <p>Platform insights, leaderboards, and round history</p>
      </div>

      {/* Live Analytics - Always visible */}
      <LiveAnalytics contract={contract} />

      {/* Player Stats - Only show if wallet connected */}
      {account && <PlayerStats contract={contract} account={account} />}

      {/* Leaderboard - Always visible */}
      <Leaderboard contract={contract} />

      {/* Round History - Always visible */}
      <RoundHistory contract={contract} account={account} />
    </div>
  );
}
