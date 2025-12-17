import React, { useState, useEffect } from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import NeedTickets from '../components/NeedTickets';
import { useDemoContext } from '../contexts/DemoContext';
import '../styles/blackjack.css';

// Card component
function Card({ card, hidden = false, index = 0 }) {
  if (hidden) {
    return (
      <div className="playing-card card-hidden" style={{ '--card-index': index }}>
        <div className="card-back"></div>
      </div>
    );
  }

  const rank = card % 13;
  const suit = Math.floor(card / 13);
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const suits = ['\u2665', '\u2666', '\u2663', '\u2660']; // hearts, diamonds, clubs, spades
  const suitNames = ['hearts', 'diamonds', 'clubs', 'spades'];
  const isRed = suit < 2;

  return (
    <div
      className={`playing-card ${suitNames[suit]} ${isRed ? 'red' : 'black'}`}
      style={{ '--card-index': index }}
    >
      <div className="card-corner top-left">
        <span className="card-rank">{ranks[rank]}</span>
        <span className="card-suit">{suits[suit]}</span>
      </div>
      <div className="card-center">
        <span className="card-suit-large">{suits[suit]}</span>
      </div>
      <div className="card-corner bottom-right">
        <span className="card-rank">{ranks[rank]}</span>
        <span className="card-suit">{suits[suit]}</span>
      </div>
    </div>
  );
}

// Hand component
function Hand({ cards, title, value, status, isDealer = false, hideSecondCard = false }) {
  const statusLabels = {
    0: '',
    1: 'Playing',
    2: 'Stand',
    3: 'Doubled',
    4: 'Surrendered',
    5: 'Bust!',
    6: 'Blackjack!'
  };

  return (
    <div className={`blackjack-hand ${isDealer ? 'dealer-hand' : 'player-hand'}`}>
      <div className="hand-header">
        <span className="hand-title">{title}</span>
        <span className={`hand-value ${value > 21 ? 'busted' : value === 21 ? 'blackjack' : ''}`}>
          {hideSecondCard && cards.length > 1 ? '?' : value}
        </span>
        {status > 0 && status !== 1 && (
          <span className={`hand-status status-${status}`}>{statusLabels[status]}</span>
        )}
      </div>
      <div className="cards-container">
        {cards.map((card, index) => (
          <Card
            key={index}
            card={card}
            hidden={isDealer && hideSecondCard && index === 1}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

function BlackjackPage({ blackjack }) {
  const { isDemoMode, demoBalance, setDemoBalance, realTickets, setRealTickets, updateDemoStats, updateWalletStats, connectedWallet } = useDemoContext();
  const account = useCurrentAccount();
  const isWalletConnected = !!account;

  const [betAmount, setBetAmount] = useState(10);
  const [message, setMessage] = useState('');

  const {
    gameState,
    availableActions,
    loading,
    error,
    stats,
    limits,
    deal,
    hit,
    stand,
    double,
    split,
    insurance,
    surrender,
    resetGame,
    GAME_STATUS,
    calculateHandValue
  } = blackjack;

  const currentBalance = isDemoMode ? demoBalance : realTickets;
  const needsTickets = currentBalance <= 0;

  // Calculate hand values for display
  const playerValue = gameState.playerCards.length > 0 ? calculateHandValue(gameState.playerCards) : 0;
  const splitValue = gameState.splitCards.length > 0 ? calculateHandValue(gameState.splitCards) : 0;
  const dealerValue = gameState.dealerCards.length > 0 ? calculateHandValue(gameState.dealerCards) : 0;

  // Should hide dealer's second card?
  const hideSecondCard = gameState.status === GAME_STATUS.PLAYING;

  // Handle deal
  const handleDeal = async () => {
    if (betAmount <= 0) {
      setMessage('Please enter a valid bet amount');
      return;
    }

    if (betAmount > currentBalance) {
      setMessage('Insufficient balance!');
      return;
    }

    // Deduct bet
    if (isDemoMode) {
      setDemoBalance(prev => prev - betAmount);
    } else {
      setRealTickets(prev => prev - betAmount);
    }

    setMessage('');
    const result = await deal(betAmount);

    // If game resolved immediately (blackjack)
    if (result && result.result) {
      handleGameEnd(result);
    }
  };

  // Handle game end
  const handleGameEnd = (result) => {
    const { won, payout, result: outcome } = result;

    // Credit payout
    if (payout > 0) {
      if (isDemoMode) {
        setDemoBalance(prev => prev + payout);
      } else {
        setRealTickets(prev => prev + payout);
      }
    }

    // Update stats
    const totalBet = gameState.bet + gameState.splitBet + gameState.insuranceBet;
    if (isDemoMode) {
      updateDemoStats(totalBet, payout, won);
    } else if (connectedWallet) {
      updateWalletStats(connectedWallet, totalBet, payout, won);
    }

    // Set message
    const messages = {
      'blackjack': 'BLACKJACK! You win!',
      'win': 'You win!',
      'lose': 'Dealer wins',
      'push': 'Push - Bet returned',
      'surrender': 'Surrendered'
    };
    setMessage(messages[outcome] || outcome);
  };

  // Watch for game completion
  useEffect(() => {
    if (gameState.status === GAME_STATUS.COMPLETE && gameState.result) {
      handleGameEnd({
        won: gameState.payout > 0,
        payout: gameState.payout,
        result: gameState.result
      });
    }
  }, [gameState.status, gameState.result]);

  // Handle double - needs extra bet
  const handleDouble = () => {
    const extraBet = gameState.activeHand === 0 ? gameState.bet : gameState.splitBet;
    if (extraBet > currentBalance) {
      setMessage('Insufficient balance to double!');
      return;
    }

    if (isDemoMode) {
      setDemoBalance(prev => prev - extraBet);
    } else {
      setRealTickets(prev => prev - extraBet);
    }
    double();
  };

  // Handle split - needs extra bet
  const handleSplit = () => {
    if (gameState.bet > currentBalance) {
      setMessage('Insufficient balance to split!');
      return;
    }

    if (isDemoMode) {
      setDemoBalance(prev => prev - gameState.bet);
    } else {
      setRealTickets(prev => prev - gameState.bet);
    }
    split();
  };

  // Handle insurance - half bet
  const handleInsurance = () => {
    const insuranceCost = Math.floor(gameState.bet / 2);
    if (insuranceCost > currentBalance) {
      setMessage('Insufficient balance for insurance!');
      return;
    }

    if (isDemoMode) {
      setDemoBalance(prev => prev - insuranceCost);
    } else {
      setRealTickets(prev => prev - insuranceCost);
    }
    insurance();
  };

  // Handle new game
  const handleNewGame = () => {
    resetGame();
    setMessage('');
  };

  // Preset bet buttons
  const presetBets = [10, 25, 50, 100, 250];

  return (
    <div className="blackjack-page">
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
        <NeedTickets gameName="SUITRUMP Blackjack" isWalletConnected={isWalletConnected} />
      )}

      {/* Game title */}
      <div className="game-header">
        <h1>BLACKJACK</h1>
        <p className="game-subtitle">Beat the dealer to 21</p>
      </div>

      {/* Error display */}
      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      {/* Game table */}
      <div className="blackjack-table">
        {/* Dealer's hand */}
        <div className="dealer-section">
          {gameState.dealerCards.length > 0 ? (
            <Hand
              cards={gameState.dealerCards}
              title="Dealer"
              value={dealerValue}
              status={0}
              isDealer={true}
              hideSecondCard={hideSecondCard}
            />
          ) : (
            <div className="empty-hand dealer-hand">
              <div className="hand-title">Dealer</div>
              <div className="empty-cards">Place your bet to start</div>
            </div>
          )}
        </div>

        {/* Message area */}
        {message && (
          <div className={`game-message ${gameState.result === 'blackjack' || gameState.result === 'win' ? 'win' : ''} ${gameState.result === 'lose' ? 'lose' : ''}`}>
            {message}
          </div>
        )}

        {/* Player's hands */}
        <div className="player-section">
          {gameState.playerCards.length > 0 ? (
            <div className="player-hands">
              <Hand
                cards={gameState.playerCards}
                title={gameState.splitCards.length > 0 ? 'Hand 1' : 'Your Hand'}
                value={playerValue}
                status={gameState.playerStatus}
                isDealer={false}
              />
              {gameState.splitCards.length > 0 && (
                <Hand
                  cards={gameState.splitCards}
                  title="Hand 2"
                  value={splitValue}
                  status={gameState.splitStatus}
                  isDealer={false}
                />
              )}
            </div>
          ) : (
            <div className="empty-hand player-hand">
              <div className="hand-title">Your Hand</div>
              <div className="empty-cards">Cards will appear here</div>
            </div>
          )}
        </div>

        {/* Active hand indicator */}
        {gameState.splitCards.length > 0 && gameState.status === GAME_STATUS.PLAYING && (
          <div className="active-hand-indicator">
            Playing: Hand {gameState.activeHand + 1}
          </div>
        )}

        {/* Bet info during play */}
        {gameState.status !== GAME_STATUS.BETTING && (
          <div className="bet-info">
            <span>Bet: {gameState.bet} tickets</span>
            {gameState.splitBet > 0 && <span>Split: {gameState.splitBet} tickets</span>}
            {gameState.insuranceBet > 0 && <span>Insurance: {gameState.insuranceBet} tickets</span>}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="blackjack-controls">
        {gameState.status === GAME_STATUS.BETTING && (
          <div className="betting-controls">
            <div className="bet-amount-section">
              <label>Bet Amount</label>
              <div className="bet-input-group">
                <button
                  className="bet-adjust"
                  onClick={() => setBetAmount(prev => Math.max(1, prev - 10))}
                >
                  -10
                </button>
                <div className="bet-input-wrapper">
                  <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(Math.max(1, parseInt(e.target.value) || 0))}
                    min={limits.minBet}
                    max={Math.min(limits.maxBet, currentBalance)}
                  />
                  <span className="bet-usd">${(betAmount * 0.10).toFixed(2)}</span>
                </div>
                <button
                  className="bet-adjust"
                  onClick={() => setBetAmount(prev => Math.min(currentBalance, prev + 10))}
                >
                  +10
                </button>
              </div>
              <div className="preset-bets">
                {presetBets.map(preset => (
                  <button
                    key={preset}
                    className={`preset-bet ${betAmount === preset ? 'active' : ''}`}
                    onClick={() => setBetAmount(preset)}
                    disabled={preset > currentBalance}
                  >
                    {preset}
                  </button>
                ))}
                <button
                  className="preset-bet max"
                  onClick={() => setBetAmount(Math.min(limits.maxBet, currentBalance))}
                >
                  MAX
                </button>
              </div>
            </div>
            <button
              className="deal-button"
              onClick={handleDeal}
              disabled={loading || betAmount <= 0 || betAmount > currentBalance}
            >
              {loading ? 'Dealing...' : 'DEAL'}
            </button>
          </div>
        )}

        {gameState.status === GAME_STATUS.PLAYING && (
          <div className="action-controls">
            <div className="main-actions">
              <button
                className="action-button hit"
                onClick={hit}
                disabled={!availableActions.canHit || loading}
              >
                HIT
              </button>
              <button
                className="action-button stand"
                onClick={stand}
                disabled={!availableActions.canStand || loading}
              >
                STAND
              </button>
            </div>
            <div className="secondary-actions">
              <button
                className="action-button double"
                onClick={handleDouble}
                disabled={!availableActions.canDouble || loading}
              >
                DOUBLE
              </button>
              <button
                className="action-button split"
                onClick={handleSplit}
                disabled={!availableActions.canSplit || loading}
              >
                SPLIT
              </button>
              <button
                className="action-button insurance"
                onClick={handleInsurance}
                disabled={!availableActions.canInsurance || loading}
              >
                INSURANCE
              </button>
              <button
                className="action-button surrender"
                onClick={surrender}
                disabled={!availableActions.canSurrender || loading}
              >
                SURRENDER
              </button>
            </div>
          </div>
        )}

        {gameState.status === GAME_STATUS.COMPLETE && (
          <div className="bj-game-over">
            <div className={`bj-result-box ${gameState.payout > 0 ? 'bj-win' : 'bj-lose'}`}>
              <div className="bj-result-number">{gameState.payout > 0 ? '+' : '-'}{gameState.payout > 0 ? gameState.payout : (gameState.bet + gameState.splitBet)}</div>
              <div className="bj-result-text">tickets {gameState.payout > 0 ? 'won' : 'lost'}</div>
              <div className="bj-result-usd">${((gameState.payout > 0 ? gameState.payout : (gameState.bet + gameState.splitBet)) * 0.10).toFixed(2)}</div>
            </div>
            <button className="bj-new-game-btn" onClick={handleNewGame}>NEW GAME</button>
          </div>
        )}
      </div>

      {/* Game rules */}
      <div className="blackjack-rules">
        <h3>RULES</h3>
        <div className="rules-grid">
          <div className="rule-item">
            <span className="rule-icon">♠</span>
            <span>Blackjack pays 3:2</span>
          </div>
          <div className="rule-item">
            <span className="rule-icon">♥</span>
            <span>Dealer stands on 17</span>
          </div>
          <div className="rule-item">
            <span className="rule-icon">♦</span>
            <span>Double on any two cards</span>
          </div>
          <div className="rule-item">
            <span className="rule-icon">♣</span>
            <span>Split pairs once</span>
          </div>
          <div className="rule-item">
            <span className="rule-icon">♠</span>
            <span>Insurance pays 2:1</span>
          </div>
          <div className="rule-item">
            <span className="rule-icon">♥</span>
            <span>Surrender returns half</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="game-stats-section">
        <div className="stat-item">
          <span className="stat-label">Games Played</span>
          <span className="stat-value">{stats.totalGames}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">House Bankroll</span>
          <span className="stat-value">{stats.houseBankroll}</span>
        </div>
      </div>
    </div>
  );
}

export default BlackjackPage;
