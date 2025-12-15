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
import CashierPage from './pages/CashierPage';
import PlayerStatsPage from './pages/PlayerStatsPage';
import DocsPage from './pages/DocsPage';
import RoyaleTestPage from './pages/RoyaleTestPage';
import { GameProvider } from './contexts/GameContext';
import { DemoProvider, useDemoContext } from './contexts/DemoContext';
import { useWallet } from './hooks/useWallet';
import { useDice, BetType, BetTypeLabels } from './hooks/useDice';
import { useProgressive } from './hooks/useProgressive';
import { useRaffle } from './hooks/useRaffle';
import { useSuitrumpPrice } from './hooks/useSuitrumpPrice';

// SUITRUMP Token address on Sui mainnet
const SUITRUMP_TOKEN = "0xdeb831e796f16f8257681c0d5d4108fa94333060300b2459133a96631bf470b8::suitrump::SUITRUMP";

// Admin wallets (lowercase for comparison)
const ADMIN_WALLETS = [
  '0x9b66dfcc45d57ed624b4058f2ba52f084af2330a1145087e61ef1eaac4a7cc20'
];

// Component to sync wallet address with DemoContext
function WalletSync({ walletAddress }) {
  const { setConnectedWallet } = useDemoContext();

  useEffect(() => {
    setConnectedWallet(walletAddress || null);
  }, [walletAddress, setConnectedWallet]);

  return null;
}

// Demo Mode Header Component (needs DemoContext)
function DemoModeHeader({ wallet, suitBalance, victoryBalance, isAdmin }) {
  const {
    isDemoMode,
    isDemoOnly,
    demoBalance,
    toggleDemoMode,
    resetDemoBalance,
    getTickets,
    getCurrentStats,
    resetDemoStats,
    resetWalletStats,
    adminSettings,
    connectedWallet
  } = useDemoContext();

  // Get live SUITRUMP price
  const { price: suitrumpPrice, poolData, loading: priceLoading } = useSuitrumpPrice();

  const [showStats, setShowStats] = React.useState(false);

  // Get tickets for connected wallet (0 if not connected)
  const walletTickets = wallet.account ? getTickets(wallet.account) : 0;

  // Get stats based on mode
  const stats = isDemoMode
    ? getCurrentStats()
    : (wallet.account ? getCurrentStats(wallet.account) : { totalBets: 0, totalWins: 0, totalLosses: 0, netProfit: 0, biggestWin: 0, totalWagered: 0 });

  // Token USD values based on live price
  const suitUsdValue = (parseFloat(suitBalance || 0) * suitrumpPrice).toFixed(2);
  const victoryUsdValue = (parseFloat(victoryBalance || 0) / 1000).toFixed(2);

  // Check if demo mode is available (global switch must be on)
  const demoModeAvailable = adminSettings?.demoModeEnabled?.global || isDemoOnly;

  // Note: DemoContext auto-disables isDemoMode when not available, so we can use it directly
  // Determine what to show in ticket display
  const showTicketDisplay = isDemoMode || wallet.account;
  const displayTickets = isDemoMode ? demoBalance : walletTickets;

  return (
    <header className="header">
      <div className="header-main-row">
        {/* LEFT: Branding */}
        <div className="header-branding">
          <h1><img src="/suitrump-mascot.png" alt="SUITRUMP" className="header-mascot" /> SUITRUMP Royale</h1>
          <p>{isDemoOnly ? 'Free Demo Mode' : 'On-Chain Gaming on Sui'}</p>
        </div>

        {/* CENTER: Stacked Price + Cashier Card */}
        {!isDemoOnly && (
          <div className="header-center-stack">
            {/* Price Ticker Row */}
            <div className="price-ticker-row">
              <span className="price-label">SUITRUMP</span>
              <span className="price-value">${suitrumpPrice?.toFixed(8) || '...'}</span>
              {poolData?.priceChange24h !== undefined && (
                <span className={`price-change ${poolData.priceChange24h >= 0 ? 'positive' : 'negative'}`}>
                  {poolData.priceChange24h >= 0 ? '+' : ''}{poolData.priceChange24h.toFixed(2)}%
                </span>
              )}
            </div>

            {/* Cashier Button Row */}
            {showTicketDisplay && (
              <Link to="/cashier" className="cashier-button-row" title="Go to Cashier">
                <span className="ticket-icon">🎟️</span>
                <span className="ticket-amount">{displayTickets.toLocaleString()}</span>
                <span className="ticket-value">(${(displayTickets * 0.10).toFixed(2)})</span>
              </Link>
            )}
          </div>
        )}

        {/* Demo mode indicator */}
        {isDemoMode && (
          <div className="header-center-stack demo-mode">
            <div className="demo-indicator">
              <span className="demo-badge">DEMO MODE</span>
              <button className="demo-reset-btn" onClick={resetDemoBalance} title="Reset Balance">
                Reset
              </button>
            </div>
            <Link to="/cashier" className="cashier-button-row demo" title="Go to Cashier">
              <span className="ticket-icon">🎟️</span>
              <span className="ticket-amount">{demoBalance.toLocaleString()}</span>
              <span className="ticket-value">(${(demoBalance * 0.10).toFixed(2)})</span>
            </Link>
          </div>
        )}

        {/* RIGHT: Wallet Section */}
        <div className="header-wallet-section">
          {!isDemoMode && !isDemoOnly && (
            <>
              <ConnectButton />
              {wallet.account && (
                <div className="wallet-balance-card">
                  <span className="wallet-label">SUIT</span>
                  <span className="wallet-amount">{parseFloat(suitBalance || 0).toLocaleString()}</span>
                  <span className="wallet-usd">${suitUsdValue}</span>
                </div>
              )}
            </>
          )}

          {/* Demo Mode Toggle */}
          {demoModeAvailable && !isDemoOnly && !isDemoMode && (
            <button
              className="demo-toggle-btn"
              onClick={toggleDemoMode}
              title="Try Free Demo Mode"
            >
              FREE PLAY
            </button>
          )}

          {isDemoMode && !isDemoOnly && (
            <button
              className="demo-toggle-btn active"
              onClick={toggleDemoMode}
              title="Exit Demo Mode"
            >
              EXIT DEMO
            </button>
          )}

          {/* Network warning */}
          {!isDemoMode && wallet.isCorrectNetwork === false && wallet.account && (
            <button className="btn btn-warning" onClick={wallet.switchNetwork}>
              Switch to Sui Network
            </button>
          )}

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
  const [victoryBalance, setVictoryBalance] = useState('0');
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

  // Fetch real token balances from Sui
  useEffect(() => {
    const fetchBalances = async () => {
      if (!wallet.account || !wallet.suiClient) {
        setSuitBalance('0');
        setVictoryBalance('0');
        return;
      }

      try {
        // Token package ID
        const tokenPackage = '0xe8fd4cdccd697947bdb84f357eadb626bafac3db769c228336ebcd1ad6ca9081';

        // Fetch SUITRUMP balance
        const suitCoins = await wallet.suiClient.getCoins({
          owner: wallet.account,
          coinType: `${tokenPackage}::test_suitrump::TEST_SUITRUMP`
        });
        const totalSuit = suitCoins.data.reduce((sum, coin) => sum + BigInt(coin.balance), 0n);
        setSuitBalance((Number(totalSuit) / 1e9).toFixed(0));

        // Fetch VICTORY balance
        const victCoins = await wallet.suiClient.getCoins({
          owner: wallet.account,
          coinType: `${tokenPackage}::test_victory::TEST_VICTORY`
        });
        const totalVict = victCoins.data.reduce((sum, coin) => sum + BigInt(coin.balance), 0n);
        setVictoryBalance((Number(totalVict) / 1e9).toFixed(0));
      } catch (err) {
        console.error('Error fetching token balances:', err);
        setSuitBalance('0');
        setVictoryBalance('0');
      }
    };

    fetchBalances();
    const interval = setInterval(fetchBalances, 10000);
    return () => clearInterval(interval);
  }, [wallet.account, wallet.suiClient]);

  return (
    <DemoProvider>
      <WalletSync walletAddress={wallet.account} />
      <GameProvider provider={wallet.provider} signer={wallet.signer} account={wallet.account}>
        <div className="app">
          <div className="container">
            <DemoModeHeader
              wallet={wallet}
              suitBalance={suitBalance}
              victoryBalance={victoryBalance}
              isAdmin={isAdmin}
            />

            <Navigation isAdmin={isAdmin} />

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
                <Route path="/admin" element={<AdminPage wallet={wallet} dice={dice} progressive={progressive} raffle={raffle} isAdmin={isAdmin} />} />
                <Route path="/faucet" element={<FaucetPage wallet={wallet} />} />
                <Route path="/cashier" element={<CashierPage wallet={wallet} suitBalance={suitBalance} />} />
                <Route path="/docs" element={<DocsPage />} />
                <Route path="/royale-test" element={<RoyaleTestPage />} />
              </Routes>
            </main>
          </div>
        </div>
      </GameProvider>
    </DemoProvider>
  );
}

export default App;
