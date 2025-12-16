import React, { useState, useEffect, useRef } from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { useDemoContext } from '../contexts/DemoContext';
import { useGameWallet } from '../hooks/useGameWallet';
import { CURRENT_NETWORK, getContract, formatTickets } from '../config/sui-config';

// Helper to format ticket count with USD value
const formatTicketsWithUSD = (tickets) => {
  const num = parseFloat(tickets) || 0;
  const usd = (num * 0.10).toFixed(2);
  return { count: num.toLocaleString(), usd: `$${usd}` };
};

// Get raffle contract address
const RAFFLE_CONTRACT = getContract('raffle');

function RafflePage({ raffle }) {
  const gameWallet = useGameWallet();
  const { isDemoMode, demoBalance } = useDemoContext();
  const account = useCurrentAccount();
  const isWalletConnected = !!account;
  const [ticketAmount, setTicketAmount] = useState('10');
  const [drawStatus, setDrawStatus] = useState({ canRequest: false, canExecute: false });
  const [previousWinner, setPreviousWinner] = useState(null);
  const [localTimeRemaining, setLocalTimeRemaining] = useState(0);
  const lastBlockchainTime = useRef(null);

  const { roundInfo, escrowInfo, userTickets, loading, error, ROUND_STATUS } = raffle;

  // Sync local countdown with blockchain time and tick locally every second
  useEffect(() => {
    if (roundInfo?.timeRemaining !== undefined && roundInfo?.timeRemaining !== null) {
      // Only update from blockchain if it's a new value (not just re-render)
      if (lastBlockchainTime.current !== roundInfo.timeRemaining) {
        lastBlockchainTime.current = roundInfo.timeRemaining;
        setLocalTimeRemaining(roundInfo.timeRemaining);
      }
    }
  }, [roundInfo?.timeRemaining]);

  // Local countdown timer - ticks every second
  useEffect(() => {
    if (localTimeRemaining <= 0) return;

    const timer = setInterval(() => {
      setLocalTimeRemaining(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [localTimeRemaining > 0]);

  // Check draw status
  useEffect(() => {
    const checkDrawStatus = async () => {
      if (raffle.contract) {
        const [requestStatus, executeStatus] = await Promise.all([
          raffle.canRequestDraw(),
          raffle.canExecuteDraw()
        ]);
        setDrawStatus({
          canRequest: requestStatus.canRequest,
          requestReason: requestStatus.reason,
          canExecute: executeStatus.canExecute,
          executeReason: executeStatus.reason
        });
      }
    };
    checkDrawStatus();
    const interval = setInterval(checkDrawStatus, 5000);
    return () => clearInterval(interval);
  }, [raffle.contract, roundInfo]);

  // Fetch previous winner
  useEffect(() => {
    const fetchPreviousWinner = async () => {
      if (raffle.contract && roundInfo?.roundId > 1) {
        const winner = await raffle.getPreviousRoundWinner();
        if (winner && winner.winner !== '0x0000000000000000000000000000000000000000') {
          setPreviousWinner(winner);
        }
      }
    };
    fetchPreviousWinner();
  }, [raffle.contract, roundInfo?.roundId]);

  const handleBuyTickets = async (e) => {
    e.preventDefault();
    if (!ticketAmount) return;
    await raffle.buyTickets(parseInt(ticketAmount), roundInfo?.status);
  };

  const handleWithdrawEscrow = async () => {
    await raffle.withdrawEscrow();
  };

  const formatTime = (seconds) => {
    if (!seconds || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Waiting for Players': return 'status-waiting';
      case 'Active': return 'status-active';
      case 'Drawing...': return 'status-drawing';
      case 'Complete': return 'status-complete';
      default: return '';
    }
  };

  // Helper to check if we're in escrow/waiting phase
  const isWaitingPhase = roundInfo?.status === ROUND_STATUS?.WAITING;
  const isActivePhase = roundInfo?.status === ROUND_STATUS?.ACTIVE;
  const userEscrowTickets = escrowInfo?.userTickets || 0;

  // Demo mode message for raffle
  if (isDemoMode) {
    return (
      <div className="raffle-page">
        <div className="demo-mode-banner">
          <span className="demo-icon">🎮</span>
          <span className="demo-text">
            <strong>FREE PLAY MODE</strong> - Demo Balance: {demoBalance.toLocaleString()} SUIT
          </span>
        </div>

        <div className="card" style={{ marginTop: '20px' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '10px' }}>🎟️ SUITRUMP Raffle</h2>
            <p style={{ color: '#94a3b8' }}>
              Win the entire prize pool with a lucky ticket!
            </p>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(109, 40, 217, 0.15))',
            border: '2px solid #8b5cf6',
            borderRadius: '16px',
            padding: '25px',
            marginBottom: '25px'
          }}>
            <h3 style={{ color: '#c4b5fd', marginBottom: '20px', textAlign: 'center', fontSize: '1.2rem' }}>
              📖 How Raffle Works
            </h3>
            <div style={{ display: 'grid', gap: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', color: '#e2e8f0' }}>
                <span style={{ background: '#8b5cf6', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>1</span>
                <span><strong>Buy Tickets</strong> - Each ticket costs 1 SUIT token</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', color: '#e2e8f0' }}>
                <span style={{ background: '#8b5cf6', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>2</span>
                <span><strong>Wait for Countdown</strong> - Round timer counts down</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', color: '#e2e8f0' }}>
                <span style={{ background: '#8b5cf6', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>3</span>
                <span><strong>Random Draw</strong> - Anyone can trigger the provably fair draw</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', color: '#e2e8f0' }}>
                <span style={{ background: '#8b5cf6', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>4</span>
                <span><strong>Winner Takes All!</strong> - One lucky ticket wins the entire pool</span>
              </div>
            </div>
          </div>

          <div style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid #3b82f6',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center'
          }}>
            <p style={{ color: '#93c5fd', marginBottom: '10px' }}>
              <strong>💡 Tip:</strong> More tickets = Higher chance to win!
            </p>
            <p style={{ color: '#8b5cf6', fontStyle: 'italic', fontSize: '0.9rem' }}>
              Raffle requires real participants. Exit demo mode to join!
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isWalletConnected) {
    return (
      <div className="raffle-page">
        <div className="card" style={{ textAlign: 'center' }}>
          <h2>SUITRUMP Raffle</h2>
          <p style={{ color: 'var(--text-gray)', margin: '20px 0' }}>
            Connect your wallet to participate in the raffle
          </p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  if (!raffle.contract) {
    return (
      <div className="raffle-page">
        <div className="card" style={{ textAlign: 'center' }}>
          <h2>SUITRUMP Raffle</h2>
          <p style={{ color: 'var(--text-gray)', margin: '20px 0' }}>
            Raffle contract not deployed yet. Deploy using the deploy script.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="raffle-page">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="demo-mode-banner">
          <span className="demo-icon">🎮</span>
          <span className="demo-text">
            <strong>FREE PLAY MODE</strong> - Practice with {demoBalance.toLocaleString()} tickets. No wallet needed!
          </span>
        </div>
      )}

      {/* Real Mode - Not Connected Banner */}
      {!isDemoMode && !isWalletConnected && (
        <div className="connect-wallet-banner">
          <span className="wallet-icon">🔗</span>
          <span className="wallet-text">
            <strong>TESTNET MODE</strong> - Connect your Sui wallet to play with test tokens
          </span>
          <ConnectButton />
        </div>
      )}

      {/* Real Mode - Connected Banner */}
      {!isDemoMode && isWalletConnected && (
        <div className="testnet-mode-banner">
          <span className="testnet-icon">🧪</span>
          <span className="testnet-text">
            <strong>TESTNET MODE</strong> - Playing with TEST_SUITRUMP on {CURRENT_NETWORK}
          </span>
          <span className="wallet-address">
            {account?.address?.slice(0, 6)}...{account?.address?.slice(-4)}
          </span>
        </div>
      )}

      {/* Previous Winner Banner */}
      {previousWinner && (
        <div className="winner-banner">
          <span>Round #{previousWinner.roundId} Winner:</span>
          <span className="winner-address">
            {previousWinner.winner.slice(0, 6)}...{previousWinner.winner.slice(-4)}
          </span>
          <span className="winner-prize">{parseFloat(previousWinner.prize).toLocaleString()} SUIT</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={raffle.clearError}>Dismiss</button>
        </div>
      )}

      {/* Escrow Info - Show during waiting phase */}
      {isWaitingPhase && (
        <div className="card escrow-info-card">
          <h3>🔒 Escrow Phase</h3>
          <p className="escrow-desc">
            Funds are held in escrow until 2+ players join. Round starts automatically when the second player enters!
          </p>

          <div className="escrow-stats">
            <div className="escrow-stat">
              <span className="stat-label">Players Waiting</span>
              <span className="stat-value">{escrowInfo?.participants || 0} / 2</span>
            </div>
            <div className="escrow-stat">
              <span className="stat-label">Escrow Pool</span>
              <span className="stat-value">
                {formatTicketsWithUSD(escrowInfo?.totalPool || 0).count}
                <span className="usd-sub">{formatTicketsWithUSD(escrowInfo?.totalPool || 0).usd}</span>
              </span>
            </div>
            <div className="escrow-stat">
              <span className="stat-label">Your Escrow Tickets</span>
              <span className="stat-value highlight">
                {formatTicketsWithUSD(userEscrowTickets).count}
                <span className="usd-sub">{formatTicketsWithUSD(userEscrowTickets).usd}</span>
              </span>
            </div>
          </div>

          {userEscrowTickets > 0 && (
            <div className="escrow-withdraw-section">
              <p className="withdraw-info">You can withdraw your escrow tickets anytime before round starts (100% refund, only gas fees)</p>
              <button
                className="btn btn-warning"
                onClick={handleWithdrawEscrow}
                disabled={loading}
              >
                {loading ? 'Processing...' : `Withdraw ${userEscrowTickets} Tickets (${formatTicketsWithUSD(userEscrowTickets).usd})`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Draw Controls - Moved to top, highlighted when action needed */}
      <div className={`card draw-controls-card ${drawStatus.canRequest || drawStatus.canExecute ? 'action-required' : ''}`}>
        <h3>🎯 Round Status</h3>

        {isWaitingPhase && escrowInfo?.participants === 0 && (
          <p className="draw-info">
            🎟️ Be the first to enter the raffle! Your funds stay in escrow until a second player joins.
          </p>
        )}

        {isWaitingPhase && escrowInfo?.participants === 1 && (
          <p className="draw-info">
            ⏳ 1 player waiting in escrow. When you join, the 5-minute round starts automatically!
          </p>
        )}

        {isActivePhase && localTimeRemaining > 0 && (
          <p className="draw-info">
            ⏱️ Round is LIVE! {roundInfo.totalTickets} tickets sold, {roundInfo.participants} participants. Draw after timer ends.
          </p>
        )}

        {isActivePhase && localTimeRemaining <= 0 && roundInfo?.participants >= 2 && (
          <div className="draw-action action-highlight">
            <p className="draw-info success">🚨 Round ended with {roundInfo.participants} participants! Someone must trigger the draw!</p>
            <button
              className="btn btn-primary btn-large pulse-animation"
              onClick={raffle.drawWinner}
              disabled={loading}
            >
              {loading ? 'Processing...' : '🎲 Draw Winner Now!'}
            </button>
          </div>
        )}

        {roundInfo?.statusText === 'Drawing...' && (
          <p className="draw-info">
            ⏳ Drawing winner using on-chain randomness...
          </p>
        )}

        {roundInfo?.statusText === 'Complete' && (
          <p className="draw-info">
            ✅ Round complete! Winner has been selected. Admin will start a new round soon.
          </p>
        )}
      </div>

      {/* Round Info Card */}
      <div className="raffle-card">
        <div className="raffle-header">
          <h2>Round #{roundInfo?.roundId || 1}</h2>
          <span className={`raffle-status ${getStatusColor(roundInfo?.statusText)}`}>
            {roundInfo?.statusText || 'Active'}
          </span>
        </div>

        <div className="prize-pool">
          <span className="prize-label">Prize Pool</span>
          <span className="prize-value">
            {formatTicketsWithUSD(roundInfo?.totalTickets || 0).count} tickets
            <span className="usd-value">({formatTicketsWithUSD(roundInfo?.totalTickets || 0).usd})</span>
          </span>
        </div>

        {isActivePhase && localTimeRemaining > 0 && (
          <div className="countdown-section">
            <span className="countdown-label">Time Remaining</span>
            <span className="countdown-value">{formatTime(localTimeRemaining)}</span>
          </div>
        )}

        <div className="raffle-stats">
          <div className="raffle-stat">
            <span className="stat-label">Participants</span>
            <span className="stat-value">{roundInfo?.participants || 0}</span>
          </div>
          <div className="raffle-stat">
            <span className="stat-label">Total Tickets</span>
            <span className="stat-value">
              {formatTicketsWithUSD(roundInfo?.totalTickets || 0).count}
              <span className="usd-sub">{formatTicketsWithUSD(roundInfo?.totalTickets || 0).usd}</span>
            </span>
          </div>
          <div className="raffle-stat">
            <span className="stat-label">Your Tickets</span>
            <span className="stat-value highlight">
              {formatTicketsWithUSD(userTickets || 0).count}
              <span className="usd-sub">{formatTicketsWithUSD(userTickets || 0).usd}</span>
            </span>
          </div>
        </div>

        {parseFloat(userTickets) > 0 && parseFloat(roundInfo?.totalTickets) > 0 && (
          <div className="win-chance">
            Your win chance: {((parseFloat(userTickets) / parseFloat(roundInfo.totalTickets)) * 100).toFixed(2)}%
          </div>
        )}
      </div>

      {/* Buy Tickets / Deposit to Escrow */}
      {(isWaitingPhase || isActivePhase) && (
        <div className="card blue-outline">
          <h3>{isWaitingPhase ? 'Deposit to Escrow' : 'Buy More Tickets'}</h3>
          <p className="section-desc">
            {isWaitingPhase
              ? '1 Ticket = $0.10. Held in escrow until round starts. 100% refundable!'
              : '1 Ticket = $0.10 (94% goes to prize pool)'
            }
          </p>

          <form onSubmit={handleBuyTickets}>
            <div className="ticket-input-section">
              <input
                type="number"
                value={ticketAmount}
                onChange={(e) => setTicketAmount(e.target.value)}
                placeholder="Number of Tickets"
                min="1"
                max="1000"
                step="1"
              />
              <div className="ticket-usd-preview">
                {ticketAmount && parseInt(ticketAmount) > 0 && (
                  <span className="usd-preview">= {formatTicketsWithUSD(ticketAmount).usd}</span>
                )}
              </div>
              <div className="quick-amounts">
                <button type="button" onClick={() => setTicketAmount('1')}>1</button>
                <button type="button" onClick={() => setTicketAmount('5')}>5</button>
                <button type="button" onClick={() => setTicketAmount('10')}>10</button>
                <button type="button" onClick={() => setTicketAmount('25')}>25</button>
                <button type="button" onClick={() => setTicketAmount('50')}>50</button>
                <button type="button" onClick={() => setTicketAmount('100')}>100</button>
                <button type="button" onClick={() => setTicketAmount('500')}>500</button>
                <button type="button" onClick={() => setTicketAmount('1000')}>1000</button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-large"
              disabled={loading || !ticketAmount}
            >
              {loading ? 'Processing...' : isWaitingPhase
                ? `Deposit ${ticketAmount} Tickets (${formatTicketsWithUSD(ticketAmount).usd})`
                : `Buy ${ticketAmount} Tickets (${formatTicketsWithUSD(ticketAmount).usd})`}
            </button>
          </form>

          <p className="limit-info">Min: 1 ticket ($0.10) | Max: 1000 tickets ($100)</p>
        </div>
      )}


      {/* How It Works */}
      <div className="card blue-outline">
        <h3>How SUITRUMP Raffle Works</h3>
        <div className="how-it-works-list">
          <div className="step-item">
            <span className="step-num">1</span>
            <div>
              <strong>Buy Tickets</strong>
              <p>Purchase tickets with SUIT tokens (1-1000 per transaction)</p>
            </div>
          </div>
          <div className="step-item">
            <span className="step-num">2</span>
            <div>
              <strong>Wait for Participants</strong>
              <p>Round activates when 2+ players join, starting 5-minute countdown</p>
            </div>
          </div>
          <div className="step-item">
            <span className="step-num">3</span>
            <div>
              <strong>Draw Requested</strong>
              <p>Anyone can trigger the draw after countdown ends</p>
            </div>
          </div>
          <div className="step-item">
            <span className="step-num">4</span>
            <div>
              <strong>Winner Selected</strong>
              <p>Blockhash randomness picks winner - more tickets = higher chance</p>
            </div>
          </div>
        </div>

        <div className="distribution-info">
          <h4>Ticket Distribution</h4>
          <div className="distribution-grid">
            <div className="dist-item prize">94% Prize Pool</div>
            <div className="dist-item burn">2% Burned</div>
            <div className="dist-item dev">2% Developer</div>
            <div className="dist-item seed">1% Next Round Seed</div>
            <div className="dist-item treasury">1% Treasury</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RafflePage;
