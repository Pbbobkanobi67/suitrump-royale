import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDemoContext } from '../contexts/DemoContext';

function NeedTickets({ gameName, isWalletConnected = false }) {
  const navigate = useNavigate();
  const {
    isDemoMode,
    demoBalance,
    demoWalletBalance,
    resetDemoMode,
    DEFAULT_WALLET_BALANCE,
    realTickets,
    adminSettings
  } = useDemoContext();

  const goToCashier = () => {
    navigate('/cashier');
  };

  // Determine ticket balance based on mode
  const ticketBalance = isDemoMode ? demoBalance : realTickets;
  const walletBalance = isDemoMode ? demoWalletBalance : 0; // Real wallet balance shown separately

  // If user has tickets, don't show this overlay
  if (ticketBalance > 0) {
    return null;
  }

  // Check if demo mode is available (global switch must be on)
  const demoModeAvailable = adminSettings?.demoModeEnabled?.global;

  // Check if user is broke in demo mode
  const isBrokeDemo = isDemoMode && demoWalletBalance <= 0 && demoBalance <= 0;

  const handleReset = () => {
    if (resetDemoMode) {
      resetDemoMode();
    }
  };

  return (
    <div className="need-tickets-overlay">
      <div className="need-tickets-card">
        <div className="need-tickets-icon">🎟️</div>
        <h2>Get Tickets to Play</h2>

        {isDemoMode ? (
          // Demo Mode Message
          <>
            <p>
              You need tickets to play {gameName || 'this game'}.
              {isBrokeDemo
                ? ' Reset your demo account to get fresh SUITRUMP tokens!'
                : ' Visit the Cashier to exchange your demo SUITRUMP for tickets.'}
            </p>

            <div className="need-tickets-info">
              <div className="info-row">
                <span>Demo SUITRUMP Balance:</span>
                <span className={`value ${demoWalletBalance <= 0 ? 'highlight' : ''}`}>
                  {demoWalletBalance.toLocaleString()} SUIT
                </span>
              </div>
              <div className="info-row">
                <span>Demo Ticket Balance:</span>
                <span className="value highlight">{demoBalance} tickets</span>
              </div>
            </div>

            {isBrokeDemo ? (
              <>
                <button onClick={handleReset} className="btn btn-primary btn-large get-tickets-btn reset-btn">
                  Reset Demo Account
                </button>
                <p className="need-tickets-hint">
                  Get {DEFAULT_WALLET_BALANCE?.toLocaleString() || '10,000,000'} fresh demo SUITRUMP tokens
                </p>
              </>
            ) : (
              <>
                <button onClick={goToCashier} className="btn btn-primary btn-large get-tickets-btn">
                  Go to Cashier
                </button>
                <p className="need-tickets-hint">
                  Exchange demo SUITRUMP for demo tickets
                </p>
              </>
            )}
          </>
        ) : isWalletConnected ? (
          // Real Mode - Wallet Connected but No Tickets
          <>
            <p>
              You need tickets to play {gameName || 'this game'}.
              Visit the Cashier to exchange your SUITRUMP tokens for tickets.
            </p>

            <div className="need-tickets-info">
              <div className="info-row">
                <span>Your Ticket Balance:</span>
                <span className="value highlight">0 tickets</span>
              </div>
              <div className="info-row rate">
                <span>Ticket Price:</span>
                <span className="value">$0.10 each (in SUITRUMP)</span>
              </div>
            </div>

            <button onClick={goToCashier} className="btn btn-primary btn-large get-tickets-btn">
              Go to Cashier
            </button>
            <p className="need-tickets-hint">
              Exchange your SUITRUMP tokens for tickets to play
            </p>
          </>
        ) : (
          // Not Connected - Prompt to Connect or Try Demo
          <>
            <p>
              Connect your wallet and get tickets to play {gameName || 'this game'}.
            </p>

            <div className="need-tickets-info">
              <div className="info-row rate">
                <span>Ticket Price:</span>
                <span className="value">$0.10 each (in SUITRUMP)</span>
              </div>
              <div className="info-row">
                <span>Network:</span>
                <span className="value">Sui Testnet</span>
              </div>
            </div>

            <button onClick={goToCashier} className="btn btn-primary btn-large get-tickets-btn">
              Go to Cashier
            </button>
            <p className="need-tickets-hint" style={{ marginBottom: '12px' }}>
              Connect your Sui wallet at the Cashier to buy tickets
            </p>
            {demoModeAvailable && (
              <p className="need-tickets-hint">
                Or click "FREE PLAY" in the header to try demo mode
              </p>
            )}
          </>
        )}
      </div>

      <style>{`
        .need-tickets-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(10, 22, 40, 0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .need-tickets-card {
          background: linear-gradient(135deg, #1e3a5f 0%, #0a1628 100%);
          border: 2px solid #3b82f6;
          border-radius: 20px;
          padding: 40px;
          max-width: 500px;
          width: 100%;
          text-align: center;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .need-tickets-icon {
          font-size: 4rem;
          margin-bottom: 16px;
        }

        .need-tickets-card h2 {
          font-family: 'Dela Gothic One', cursive;
          color: #60a5fa;
          font-size: 1.8rem;
          margin: 0 0 12px 0;
        }

        .need-tickets-card > p {
          color: #94a3b8;
          font-size: 1rem;
          margin-bottom: 24px;
          line-height: 1.5;
        }

        .need-tickets-info {
          background: rgba(10, 22, 40, 0.5);
          border: 1px solid #3b82f6;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
        }

        .need-tickets-info .info-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid rgba(59, 130, 246, 0.2);
        }

        .need-tickets-info .info-row:last-child {
          border-bottom: none;
        }

        .need-tickets-info .info-row span:first-child {
          color: #94a3b8;
        }

        .need-tickets-info .info-row .value {
          color: #e0f2fe;
          font-weight: 600;
        }

        .need-tickets-info .info-row .value.highlight {
          color: #f59e0b;
        }

        .need-tickets-info .info-row.rate .value {
          color: #60a5fa;
          font-size: 0.9rem;
        }

        .get-tickets-btn {
          width: 100%;
          padding: 16px 32px;
          font-size: 1.2rem;
          margin-bottom: 16px;
          text-decoration: none;
          display: inline-block;
        }

        .need-tickets-hint {
          color: #64748b;
          font-size: 0.85rem;
          margin: 0;
        }

        .need-tickets-actions {
          margin-top: 16px;
        }

        .reset-btn {
          background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .reset-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(139, 92, 246, 0.4);
        }

        @media (max-width: 480px) {
          .need-tickets-card {
            padding: 24px;
          }

          .need-tickets-icon {
            font-size: 3rem;
          }

          .need-tickets-card h2 {
            font-size: 1.4rem;
          }

          .get-tickets-btn {
            padding: 14px 24px;
            font-size: 1rem;
          }
        }
      `}</style>
    </div>
  );
}

export default NeedTickets;
