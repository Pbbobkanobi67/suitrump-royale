import React from 'react';
import { Link } from 'react-router-dom';
import { useGameContext } from '../contexts/GameContext';

// Game color mapping
const GAME_COLORS = {
  dice: 'cyan',
  progressive: 'gold',
  raffle: 'purple',
  slots: 'blue',
  keno: 'cyan',
  crash: 'orange',
  plinko: 'teal',
  wheel: 'pink',
  roulette: 'red'
};

function CasinoPage({ wallet, dice, progressive, raffle }) {
  const { featuredGames, getGameIcon } = useGameContext();

  // Calculate aggregated stats
  const diceStats = dice?.stats || {};
  const progressiveStats = progressive?.stats || {};
  const raffleInfo = raffle?.roundInfo || {};

  const totalWagered = (parseFloat(diceStats.totalWagered) || 0) +
                       (parseFloat(progressiveStats.totalPaidOut) || 0);
  const totalPaidOut = (parseFloat(diceStats.totalPaidOut) || 0) +
                       (parseFloat(progressiveStats.totalPaidOut) || 0);
  const totalBets = (diceStats.totalBets || 0) + (progressiveStats.totalRolls || 0);

  // Estimate SUIT token benefits based on house edge distribution
  const estimatedBurned = (parseFloat(diceStats.totalWagered) || 0) * 0.01;
  const estimatedTreasury = (parseFloat(diceStats.totalWagered) || 0) * 0.02;
  const jackpotsBurned = (progressiveStats.totalJackpotsWon || 0) *
                         (parseFloat(progressiveStats.jackpotPool) || 0) * 0.03;
  const jackpotsTreasury = (progressiveStats.totalJackpotsWon || 0) *
                           (parseFloat(progressiveStats.jackpotPool) || 0) * 0.03;

  const totalBurned = estimatedBurned + jackpotsBurned;
  const totalTreasury = estimatedTreasury + jackpotsTreasury;

  // Build game display data from featuredGames
  const getGameDisplayData = (game) => {
    const baseData = {
      id: game.id,
      name: game.name,
      description: game.description,
      icon: getGameIcon(game.id),
      path: game.route,
      color: GAME_COLORS[game.id] || 'cyan',
      houseEdge: game.houseEdge
    };

    // Add game-specific stats
    switch (game.id) {
      case 'dice':
        return {
          ...baseData,
          stats: {
            'House Edge': game.houseEdge || '3%',
            'Max Payout': '5.82x',
            'Bets Placed': diceStats.totalBets?.toLocaleString() || '0'
          },
          highlight: diceStats.houseBankroll ?
            `${parseFloat(diceStats.houseBankroll).toLocaleString()} SUIT Bankroll` : null
        };
      case 'progressive':
        return {
          ...baseData,
          stats: {
            'Ticket Price': `${progressiveStats.ticketPrice || '1'} SUIT`,
            'Jackpot Win': '80%',
            'Total Rolls': progressiveStats.totalRolls?.toLocaleString() || '0'
          },
          highlight: progressiveStats.jackpotPool ?
            `${parseFloat(progressiveStats.jackpotPool).toLocaleString()} SUIT Jackpot` : null
        };
      case 'raffle':
        return {
          ...baseData,
          stats: {
            'Min Entry': '5 SUIT',
            'Prize Pool': '94%',
            'Round': `#${raffleInfo.roundId || 1}`
          },
          highlight: raffleInfo.prizePool ?
            `${parseFloat(raffleInfo.prizePool).toLocaleString()} SUIT Prize Pool` : null
        };
      case 'slots':
        return {
          ...baseData,
          stats: {
            'House Edge': game.houseEdge || '5%',
            'Max Payout': '50x',
            'Min Bet': game.minBet || '1 SUIT'
          },
          highlight: 'Provably Fair Slots'
        };
      case 'keno':
        return {
          ...baseData,
          stats: {
            'House Edge': game.houseEdge || '10%',
            'Max Payout': '100x',
            'Min Bet': game.minBet || '1 SUIT'
          },
          highlight: 'Pick & Match Numbers'
        };
      case 'roulette':
        return {
          ...baseData,
          stats: {
            'House Edge': game.houseEdge || '2.7%',
            'Max Payout': '35x',
            'Min Bet': game.minBet || '1 SUIT'
          },
          highlight: 'European Single Zero'
        };
      default:
        return {
          ...baseData,
          stats: { 'House Edge': game.houseEdge || 'TBD' },
          highlight: null
        };
    }
  };

  const games = featuredGames.map(getGameDisplayData);

  return (
    <div className="casino-page">
      {/* Combined Hero Section */}
      <section className="casino-hero-combined">
        <div className="hero-main">
          <h2>Welcome to SUITRUMP Royale</h2>
          <p className="hero-subtitle">Provably fair gaming powered by SUIT token on Sui</p>

          <div className="hero-highlights">
            <div className="hero-highlight">
              <span className="highlight-icon">🏆</span>
              <div className="highlight-content">
                <span className="highlight-value gold">{parseFloat(progressiveStats.jackpotPool || 0).toLocaleString()}</span>
                <span className="highlight-label">SUIT Jackpot</span>
              </div>
            </div>
            <div className="hero-highlight">
              <span className="highlight-icon">💎</span>
              <div className="highlight-content">
                <span className="highlight-value">5.82x</span>
                <span className="highlight-label">Max Payout</span>
              </div>
            </div>
            <div className="hero-highlight">
              <span className="highlight-icon">⚡</span>
              <div className="highlight-content">
                <span className="highlight-value">Instant</span>
                <span className="highlight-label">Payouts</span>
              </div>
            </div>
            <div className="hero-highlight">
              <span className="highlight-icon">🔒</span>
              <div className="highlight-content">
                <span className="highlight-value">100%</span>
                <span className="highlight-label">On-Chain</span>
              </div>
            </div>
          </div>
        </div>

        <div className="hero-ecosystem">
          <h4>Supporting the SUITRUMP Ecosystem</h4>
          <div className="ecosystem-benefits">
            <div className="eco-benefit">
              <span className="eco-icon">🔥</span>
              <span className="eco-text">1-3% of bets <strong>burned</strong></span>
            </div>
            <div className="eco-benefit">
              <span className="eco-icon">🏛️</span>
              <span className="eco-text">2-3% to <strong>treasury</strong></span>
            </div>
            <div className="eco-benefit">
              <span className="eco-icon">🌊</span>
              <span className="eco-text">{((parseFloat(diceStats.houseBankroll) || 0) + (parseFloat(progressiveStats.jackpotPool) || 0)).toLocaleString()} SUIT <strong>liquidity</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* Games Grid */}
      <section className="games-section">
        <h3>SUITRUMP Royale Game Room</h3>
        <div className="games-grid">
          {games.map(game => (
            <div key={game.id} className={`game-card ${game.color}`}>
              <div className="game-icon">{game.icon}</div>
              <h4>{game.name}</h4>
              <p className="game-desc">{game.description}</p>

              {game.highlight && (
                <div className="game-highlight">{game.highlight}</div>
              )}

              <div className="game-stats">
                {Object.entries(game.stats).map(([label, value]) => (
                  <div key={label} className="game-stat-row">
                    <span>{label}</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>

              {game.comingSoon ? (
                <button className="btn btn-secondary game-btn" disabled>
                  Coming Soon
                </button>
              ) : game.externalUrl ? (
                <a
                  href={game.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary game-btn"
                >
                  Play {game.name}
                </a>
              ) : (
                <Link
                  to={game.path}
                  className="btn btn-primary game-btn"
                  onClick={() => window.scrollTo(0, 0)}
                >
                  Play {game.name}
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works">
        <h3>How SUITRUMP Royale Works</h3>
        <div className="steps-grid">
          <div className="step">
            <div className="step-number">1</div>
            <h4>Connect Wallet</h4>
            <p>Connect your Sui wallet to the Sui Network</p>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <h4>Get SUIT Tokens</h4>
            <p>Acquire SUIT tokens to use across all games</p>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <h4>Choose a Game</h4>
            <p>Pick from Classic Dice, Progressive Jackpot, Raffle, and more</p>
          </div>
          <div className="step">
            <div className="step-number">4</div>
            <h4>Play & Win</h4>
            <p>All games use provably fair on-chain randomness</p>
          </div>
        </div>
      </section>

      {/* Provably Fair */}
      <section className="provably-fair">
        <h3>Provably Fair Gaming</h3>
        <p>
          All SUITRUMP Royale games use Sui's on-chain randomness module.
          Results are determined by blockchain data that cannot be manipulated.
          Every bet, roll, and draw can be independently verified on the blockchain.
        </p>
      </section>
    </div>
  );
}

export default CasinoPage;
