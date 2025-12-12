import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { ConnectButton, useCurrentAccount, useDisconnectWallet, useSuiClient } from '@mysten/dapp-kit';
import Navigation from './components/Navigation/Navigation';
import CasinoPage from './pages/CasinoPage';
import HomePage from './pages/HomePage';
import AdminPage from './pages/AdminPage';
import ProgressivePage from './pages/ProgressivePage';
import RafflePage from './pages/RafflePage';
import SlotsPage from './pages/SlotsPage';
import CrashPage from './pages/CrashPage';
import KenoPage from './pages/KenoPage';
import PlinkoPage from './pages/PlinkoPage';
import RoulettePage from './pages/RoulettePage';
import FaucetPage from './pages/FaucetPage';
import PlayerStatsPage from './pages/PlayerStatsPage';
import DocsPage from './pages/DocsPage';
import { GameProvider } from './contexts/GameContext';
import { DemoProvider, useDemoContext } from './contexts/DemoContext';
import { useWallet } from './hooks/useWallet';
import { useDice, BetType, BetTypeLabels } from './hooks/useDice';
import { useProgressive } from './hooks/useProgressive';
import { useRaffle } from './hooks/useRaffle';

// SUITRUMP Token address on Sui (placeholder - update with actual address)
const SUITRUMP_TOKEN = "0x_SUITRUMP_TOKEN_ADDRESS_ON_SUI";

// Admin wallets (lowercase for comparison)
const ADMIN_WALLETS = [
  // Add admin wallet addresses here
];

// Demo Mode Header Component (needs DemoContext)
function DemoModeHeader({ wallet, suitBalance, isAdmin }) {
  const { isDemoMode, isDemoOnly, demoBalance, toggleDemoMode, resetDemoBalance } = useDemoContext();

  return (
    <header className="header">
      <div className="header-branding">
        <h1><img src="/suitrump-mascot.png" alt="SUITRUMP" className="header-mascot" /> SUITRUMP Royale</h1>
        <p>{isDemoOnly ? 'Free Demo Mode' : 'On-Chain Gaming on Sui'}</p>
      </div>
      <div className="header-wallet">
        {/* Demo Mode Toggle - hide exit button if demo-only mode via URL */}
        {!isDemoOnly && (
          <button
            className={`btn btn-demo-toggle ${isDemoMode ? 'demo-active' : ''}`}
            onClick={toggleDemoMode}
            title={isDemoMode ? 'Switch to Real Mode' : 'Try Free Demo Mode'}
          >
            {isDemoMode ? 'EXIT DEMO' : 'FREE PLAY'}
          </button>
        )}

        {isDemoMode && (
          <div className="demo-balance-display">
            <span className="demo-badge">DEMO</span>
            <span className="demo-balance">
              {parseFloat(demoBalance).toLocaleString()} SUIT
            </span>
            <button
              className="btn btn-demo-reset"
              onClick={resetDemoBalance}
              title="Reset Demo Balance to 10,000"
            >
              Reset
            </button>
          </div>
        )}

        {!isDemoMode && !isDemoOnly && (
          <>
            {isAdmin && (
              <Link to="/admin" className="btn btn-admin">
                Admin
              </Link>
            )}
            <a
              href="https://sui-trump.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-buy"
            >
              Buy SUITRUMP
            </a>
            {wallet.isCorrectNetwork === false && wallet.account && (
              <button className="btn btn-warning" onClick={wallet.switchNetwork}>
                Switch to Sui Network
              </button>
            )}
            {wallet.account ? (
              <div className="wallet-connected">
                <span className="suit-balance-header">
                  {parseFloat(suitBalance).toLocaleString()} SUIT
                </span>
                <ConnectButton />
              </div>
            ) : (
              <ConnectButton />
            )}
          </>
        )}

        {/* Demo-only mode: show link to full site */}
        {isDemoOnly && (
          <a
            href={window.location.origin + window.location.pathname}
            className="btn btn-primary"
            title="Visit the full casino site"
          >
            Play for Real
          </a>
        )}
      </div>
    </header>
  );
}

function App() {
  const wallet = useWallet();
  const dice = useDice(wallet.signer);
  const progressive = useProgressive(wallet.signer);
  const raffle = useRaffle(wallet.signer, wallet.account);
  const [suitBalance, setSuitBalance] = useState('0');
  const [isAdmin, setIsAdmin] = useState(false);
  const [aiStrategy, setAiStrategy] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Current bet settings (lifted from BetControls for AI to see)
  const [currentBet, setCurrentBet] = useState({
    betType: BetType.ODD,
    betTypeName: 'Odd',
    chosenNumber: 3,
    betAmount: ''
  });

  // Handle AI strategy application - navigate to dice page and set values
  const handleApplyAIStrategy = (strategy) => {
    setAiStrategy(strategy);
    navigate('/dice');
  };

  // Check if connected wallet is admin
  useEffect(() => {
    if (wallet.account) {
      const walletLower = wallet.account.toLowerCase();
      const adminCheck = ADMIN_WALLETS.includes(walletLower);
      console.log('Admin check:', { wallet: walletLower, adminWallets: ADMIN_WALLETS, isAdmin: adminCheck });
      setIsAdmin(adminCheck);
    } else {
      setIsAdmin(false);
    }
  }, [wallet.account]);

  // Fetch SUIT balance (placeholder - will be updated for Sui)
  useEffect(() => {
    const fetchBalance = async () => {
      if (!wallet.account) {
        setSuitBalance('0');
        return;
      }

      // TODO: Implement Sui balance fetching
      // For now, use demo balance or placeholder
      setSuitBalance('10000');
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [wallet.account]);

  return (
    <DemoProvider>
      <GameProvider provider={wallet.provider} signer={wallet.signer} account={wallet.account}>
        <div className="app">
          <div className="container">
            <DemoModeHeader
            wallet={wallet}
            suitBalance={suitBalance}
            isAdmin={isAdmin}
          />

          <Navigation />

          <main className="main-content">
            <Routes>
              <Route path="/" element={<CasinoPage wallet={wallet} dice={dice} progressive={progressive} raffle={raffle} />} />
              <Route path="/dice" element={<HomePage wallet={wallet} dice={dice} aiStrategy={aiStrategy} clearAiStrategy={() => setAiStrategy(null)} currentBet={currentBet} onBetChange={setCurrentBet} />} />
              <Route path="/progressive" element={<ProgressivePage wallet={wallet} progressive={progressive} />} />
              <Route path="/raffle" element={<RafflePage wallet={wallet} raffle={raffle} />} />
              <Route path="/slots" element={<SlotsPage wallet={wallet} />} />
              <Route path="/crash" element={<CrashPage wallet={wallet} />} />
              <Route path="/keno" element={<KenoPage wallet={{ ...wallet, suitBalance }} />} />
              <Route path="/plinko" element={<PlinkoPage wallet={wallet} />} />
              <Route path="/roulette" element={<RoulettePage wallet={wallet} />} />
              <Route path="/history" element={<PlayerStatsPage wallet={wallet} dice={dice} progressive={progressive} raffle={raffle} />} />
              <Route path="/admin" element={<AdminPage wallet={wallet} dice={dice} progressive={progressive} raffle={raffle} />} />
              <Route path="/faucet" element={<FaucetPage wallet={wallet} />} />
              <Route path="/docs" element={<DocsPage />} />
              </Routes>
            </main>
          </div>
        </div>
      </GameProvider>
    </DemoProvider>
  );
}

export default App;
