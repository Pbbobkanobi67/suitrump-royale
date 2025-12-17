import React, { useState } from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import NeedTickets from '../components/NeedTickets';
import { useDemoContext } from '../contexts/DemoContext';
import { useVideoPoker, GameStatus, HandRank, HandRankNames, PayTable } from '../hooks/useVideoPoker';
import '../styles/videopoker.css';

// Card component
function PokerCard({ card, held, onToggleHold, index, getCardDisplay, canHold }) {
  const display = getCardDisplay(card);

  return (
    <div
      className={`vp-card ${display.suitName} ${display.isRed ? 'red' : 'black'} ${held ? 'held' : ''}`}
      onClick={canHold ? onToggleHold : undefined}
      style={{ '--card-index': index }}
    >
      <div className="vp-card-corner top-left">
        <span className="vp-card-rank">{display.rank}</span>
        <span className="vp-card-suit">{display.suit}</span>
      </div>
      <div className="vp-card-center">
        <span className="vp-card-suit-large">{display.suit}</span>
      </div>
      <div className="vp-card-corner bottom-right">
        <span className="vp-card-rank">{display.rank}</span>
        <span className="vp-card-suit">{display.suit}</span>
      </div>
      {held && <div className="vp-held-badge">HELD</div>}
    </div>
  );
}

// Empty card slot
function EmptyCard({ index }) {
  return (
    <div className="vp-card vp-card-empty" style={{ '--card-index': index }}>
      <div className="vp-card-placeholder">?</div>
    </div>
  );
}

// Pay table display
function PayTableDisplay({ currentBet, highlightRank }) {
  const hands = [
    { rank: HandRank.ROYAL_FLUSH, name: 'Royal Flush' },
    { rank: HandRank.STRAIGHT_FLUSH, name: 'Straight Flush' },
    { rank: HandRank.FOUR_OF_A_KIND, name: 'Four of a Kind' },
    { rank: HandRank.FULL_HOUSE, name: 'Full House' },
    { rank: HandRank.FLUSH, name: 'Flush' },
    { rank: HandRank.STRAIGHT, name: 'Straight' },
    { rank: HandRank.THREE_OF_A_KIND, name: 'Three of a Kind' },
    { rank: HandRank.TWO_PAIR, name: 'Two Pair' },
    { rank: HandRank.JACKS_OR_BETTER, name: 'Jacks or Better' }
  ];

  return (
    <div className="vp-paytable">
      <div className="vp-paytable-header">
        <span className="vp-paytable-hand">Hand</span>
        <span className="vp-paytable-payout">Payout</span>
      </div>
      {hands.map(hand => (
        <div
          key={hand.rank}
          className={`vp-paytable-row ${highlightRank === hand.rank ? 'highlight' : ''}`}
        >
          <span className="vp-paytable-hand">{hand.name}</span>
          <span className="vp-paytable-payout">
            {PayTable[hand.rank]}x
            {currentBet > 0 && (
              <span className="vp-paytable-amount">
                ({PayTable[hand.rank] * currentBet})
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function VideoPokerPage() {
  const { isDemoMode, demoBalance, setDemoBalance, realTickets, setRealTickets, updateDemoStats, updateWalletStats, connectedWallet } = useDemoContext();
  const account = useCurrentAccount();
  const isWalletConnected = !!account;

  const [betAmount, setBetAmount] = useState(5);

  const {
    gameState,
    loading,
    error,
    stats,
    limits,
    deal,
    toggleHold,
    draw,
    resetGame,
    getCardDisplay,
    GameStatus: GS
  } = useVideoPoker();

  const currentBalance = isDemoMode ? demoBalance : realTickets;
  const needsTickets = currentBalance <= 0;

  // Handle deal
  const handleDeal = async () => {
    if (betAmount <= 0) return;
    if (betAmount > currentBalance) return;

    // Deduct bet
    if (isDemoMode) {
      setDemoBalance(prev => prev - betAmount);
    } else {
      setRealTickets(prev => prev - betAmount);
    }

    await deal(betAmount);
  };

  // Handle draw
  const handleDraw = async () => {
    const result = await draw();

    if (result && result.payout > 0) {
      // Credit payout
      if (isDemoMode) {
        setDemoBalance(prev => prev + result.payout);
      } else {
        setRealTickets(prev => prev + result.payout);
      }

      // Update stats
      if (isDemoMode) {
        updateDemoStats(gameState.bet, result.payout, true);
      } else if (connectedWallet) {
        updateWalletStats(connectedWallet, gameState.bet, result.payout, true);
      }
    } else {
      // Lost
      if (isDemoMode) {
        updateDemoStats(gameState.bet, 0, false);
      } else if (connectedWallet) {
        updateWalletStats(connectedWallet, gameState.bet, 0, false);
      }
    }
  };

  // Handle new game
  const handleNewGame = () => {
    resetGame();
  };

  // Preset bet buttons
  const presetBets = [1, 5, 10, 25, 50];

  return (
    <div className="videopoker-page">
      {/* Mode banners */}
      {isDemoMode && (
        <div className="demo-mode-banner">
          <span className="demo-icon">FREE</span>
          <span className="demo-text">
            <strong>FREE PLAY MODE</strong> - {currentBalance.toLocaleString()} tickets
          </span>
        </div>
      )}

      {!isDemoMode && !isWalletConnected && (
        <div className="connect-wallet-banner">
          <span>Connect wallet to play with real tickets</span>
          <ConnectButton />
        </div>
      )}

      {!isDemoMode && isWalletConnected && (
        <div className="testnet-mode-banner">
          <span>TESTNET</span>
          <strong>TESTNET MODE</strong> - {currentBalance.toLocaleString()} tickets
        </div>
      )}

      {/* Need tickets overlay */}
      {needsTickets && (
        <NeedTickets gameName="Video Poker" isWalletConnected={isWalletConnected} />
      )}

      {/* Game title */}
      <div className="vp-header">
        <h1>VIDEO POKER</h1>
        <p className="vp-subtitle">Jacks or Better</p>
      </div>

      {/* Error display */}
      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      {/* Main game area */}
      <div className="vp-game-container">
        {/* Card area */}
        <div className="vp-machine">
          <div className="vp-screen">
            {/* Result display */}
            {gameState.status === GS.COMPLETE && (
              <div className={`vp-result ${gameState.payout > 0 ? 'win' : 'lose'}`}>
                <span className="vp-result-hand">{HandRankNames[gameState.handRank]}</span>
                {gameState.payout > 0 ? (
                  <span className="vp-result-payout">WIN {gameState.payout} TICKETS!</span>
                ) : (
                  <span className="vp-result-payout">No Win</span>
                )}
              </div>
            )}

            {/* Cards */}
            <div className="vp-cards">
              {gameState.cards.length > 0 ? (
                gameState.cards.map((card, index) => (
                  <PokerCard
                    key={index}
                    card={card}
                    held={gameState.held[index]}
                    onToggleHold={() => toggleHold(index)}
                    index={index}
                    getCardDisplay={getCardDisplay}
                    canHold={gameState.status === GS.HOLDING}
                  />
                ))
              ) : (
                Array.from({ length: 5 }).map((_, index) => (
                  <EmptyCard key={index} index={index} />
                ))
              )}
            </div>

            {/* Hold instruction */}
            {gameState.status === GS.HOLDING && (
              <div className="vp-instruction">
                Click cards to HOLD, then click DRAW
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="vp-controls">
            {gameState.status === GS.BETTING && (
              <div className="vp-betting">
                <div className="vp-bet-section">
                  <label>Bet Amount</label>
                  <div className="vp-bet-input-row">
                    <button
                      className="vp-bet-adjust"
                      onClick={() => setBetAmount(prev => Math.max(1, prev - 1))}
                    >
                      -
                    </button>
                    <div className="vp-bet-display">
                      <span className="vp-bet-amount">{betAmount}</span>
                      <span className="vp-bet-usd">${(betAmount * 0.10).toFixed(2)}</span>
                    </div>
                    <button
                      className="vp-bet-adjust"
                      onClick={() => setBetAmount(prev => Math.min(currentBalance, limits.maxBet, prev + 1))}
                    >
                      +
                    </button>
                  </div>
                  <div className="vp-preset-bets">
                    {presetBets.map(preset => (
                      <button
                        key={preset}
                        className={`vp-preset ${betAmount === preset ? 'active' : ''}`}
                        onClick={() => setBetAmount(preset)}
                        disabled={preset > currentBalance}
                      >
                        {preset}
                      </button>
                    ))}
                    <button
                      className="vp-preset max"
                      onClick={() => setBetAmount(Math.min(limits.maxBet, currentBalance))}
                    >
                      MAX
                    </button>
                  </div>
                </div>
                <button
                  className="vp-deal-btn"
                  onClick={handleDeal}
                  disabled={loading || betAmount <= 0 || betAmount > currentBalance}
                >
                  {loading ? 'DEALING...' : 'DEAL'}
                </button>
              </div>
            )}

            {gameState.status === GS.HOLDING && (
              <div className="vp-draw-controls">
                <button
                  className="vp-draw-btn"
                  onClick={handleDraw}
                  disabled={loading}
                >
                  {loading ? 'DRAWING...' : 'DRAW'}
                </button>
              </div>
            )}

            {gameState.status === GS.COMPLETE && (
              <div className="vp-complete-controls">
                <div className={`vp-result-box ${gameState.payout > 0 ? 'win' : 'lose'}`}>
                  <div className="vp-result-number">
                    {gameState.payout > 0 ? `+${gameState.payout}` : `-${gameState.bet}`}
                  </div>
                  <div className="vp-result-label">
                    tickets {gameState.payout > 0 ? 'won' : 'lost'}
                  </div>
                  <div className="vp-result-usd">
                    ${((gameState.payout > 0 ? gameState.payout : gameState.bet) * 0.10).toFixed(2)}
                  </div>
                </div>
                <button className="vp-new-game-btn" onClick={handleNewGame}>
                  NEW GAME
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Pay table */}
        <PayTableDisplay
          currentBet={gameState.bet || betAmount}
          highlightRank={gameState.status === GS.COMPLETE ? gameState.handRank : null}
        />
      </div>

      {/* Rules */}
      <div className="vp-rules">
        <h3>HOW TO PLAY</h3>
        <div className="vp-rules-grid">
          <div className="vp-rule-item">
            <span className="vp-rule-num">1</span>
            <span>Place your bet and click DEAL</span>
          </div>
          <div className="vp-rule-item">
            <span className="vp-rule-num">2</span>
            <span>Click cards you want to HOLD</span>
          </div>
          <div className="vp-rule-item">
            <span className="vp-rule-num">3</span>
            <span>Click DRAW to replace other cards</span>
          </div>
          <div className="vp-rule-item">
            <span className="vp-rule-num">4</span>
            <span>Win with Jacks or Better!</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="vp-stats">
        <div className="vp-stat">
          <span className="vp-stat-label">Games Played</span>
          <span className="vp-stat-value">{stats.totalGames}</span>
        </div>
        <div className="vp-stat">
          <span className="vp-stat-label">Total Wagered</span>
          <span className="vp-stat-value">{stats.totalWagered}</span>
        </div>
        <div className="vp-stat">
          <span className="vp-stat-label">Total Won</span>
          <span className="vp-stat-value">{stats.totalWon}</span>
        </div>
        <div className="vp-stat">
          <span className="vp-stat-label">Royal Flushes</span>
          <span className="vp-stat-value">{stats.royalFlushes}</span>
        </div>
      </div>
    </div>
  );
}

export default VideoPokerPage;
