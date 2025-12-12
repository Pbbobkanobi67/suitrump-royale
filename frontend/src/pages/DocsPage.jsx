import React from 'react';
import { useGameContext } from '../contexts/GameContext';

export function DocsPage() {
  const { games, getGameIcon } = useGameContext();

  // Helper to check if a game is enabled
  const isGameEnabled = (gameId) => {
    const game = games.find(g => g.id === gameId);
    return game?.enabled && game?.visible;
  };

  return (
    <div className="docs-page-v2">
      {/* Header */}
      <div className="docs-header">
        <h1>SUITRUMP Royale Documentation</h1>
        <p>Learn how provably fair games work and how they benefit the SUIT ecosystem</p>
      </div>

      {/* Why SUITRUMP Royale Benefits SUIT Protocol */}
      <div className="docs-section">
        <h2>Why SUITRUMP Royale Benefits SUIT Protocol</h2>
        <p className="section-intro">
          SUITRUMP Royale isn't just about gaming - it's designed to create sustainable value for the entire SUIT ecosystem. Every bet, roll, and ticket purchase contributes to the health of the protocol.
        </p>

        <div className="benefits-grid">
          <div className="benefit-card">
            <div className="benefit-icon fire">🔥</div>
            <div className="benefit-content">
              <h4>Token Burns</h4>
              <p>1-3% of all wagers are permanently burned, reducing supply and increasing scarcity</p>
            </div>
            <span className="benefit-badge green">1-3% per bet</span>
          </div>

          <div className="benefit-card">
            <div className="benefit-icon treasury">🏛️</div>
            <div className="benefit-content">
              <h4>Treasury Growth</h4>
              <p>1-2% flows to the SUIT treasury for ecosystem development and project growth</p>
            </div>
            <span className="benefit-badge blue">2% to treasury</span>
          </div>

          <div className="benefit-card">
            <div className="benefit-icon lock">🔒</div>
            <div className="benefit-content">
              <h4>Locked Liquidity</h4>
              <p>Jackpot pools and prizes are held in smart contracts, ensuring locked liquidity</p>
            </div>
            <span className="benefit-badge purple">TVL Growing</span>
          </div>

          <div className="benefit-card">
            <div className="benefit-icon utility">⚡</div>
            <div className="benefit-content">
              <h4>Real Utility</h4>
              <p>Games provide real use for token - people want them to participate</p>
            </div>
            <span className="benefit-badge orange">Gaming</span>
          </div>
        </div>
      </div>

      {/* Classic Dice */}
      <div className={`docs-section ${!isGameEnabled('dice') ? 'game-disabled' : ''}`}>
        <div className="section-header">
          <span className="section-icon">🎲</span>
          <h2>Classic Dice</h2>
          {!isGameEnabled('dice') && <span className="game-status-badge disabled">Not Active</span>}
        </div>

        <div className="subsection">
          <h3>Overview</h3>
          <p>Classic Dice is a simple provably-fair dice game where you predict the outcome of a single die roll (1-6). Choose from 5 different bet types, each with different odds and payouts.</p>
        </div>

        <div className="subsection">
          <h3>How to Play</h3>
          <ol className="steps-list">
            <li><strong>Connect your wallet</strong> - Make sure you're on Sui and have SUIT tokens</li>
            <li><strong>Choose a bet type</strong> - Select from Exact, Over, Under, Odd, or Even</li>
            <li><strong>Set your bet amount</strong> - Enter how much SUIT you want to wager</li>
            <li><strong>Place your bet</strong> - Approve the transaction and wait for the result</li>
            <li><strong>Collect winnings</strong> - If you win, payouts are instant and automatic</li>
          </ol>
        </div>

        <div className="subsection">
          <h3>Bet Types & Payouts</h3>
          <table className="docs-table">
            <thead>
              <tr>
                <th>Bet Type</th>
                <th>Win Condition</th>
                <th>Win Chance</th>
                <th>Payout</th>
              </tr>
            </thead>
            <tbody>
              <tr className="highlight-row exact">
                <td><span className="bet-badge exact">EXACT</span></td>
                <td>Predict the exact number (1-6)</td>
                <td>16.67%</td>
                <td>5.5x</td>
              </tr>
              <tr className="highlight-row over">
                <td><span className="bet-badge over">OVER</span></td>
                <td>Roll higher than your chosen number</td>
                <td>Varies</td>
                <td>1.16x - 5.5x</td>
              </tr>
              <tr className="highlight-row under">
                <td><span className="bet-badge under">UNDER</span></td>
                <td>Roll lower than your chosen number</td>
                <td>Varies</td>
                <td>1.16x - 5.5x</td>
              </tr>
              <tr className="highlight-row odd">
                <td><span className="bet-badge odd">ODD</span></td>
                <td>Roll lands on 1, 3, or 5</td>
                <td>50%</td>
                <td>1.94x</td>
              </tr>
              <tr className="highlight-row even">
                <td><span className="bet-badge even">EVEN</span></td>
                <td>Roll lands on 2, 4, or 6</td>
                <td>50%</td>
                <td>1.94x</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="subsection">
          <h3>House Edge Distribution</h3>
          <p>Classic Dice has a 3% house edge, distributed as follows:</p>
          <div className="distribution-boxes">
            <div className="dist-box burn">
              <span className="dist-value">1%</span>
              <span className="dist-label">Burned (deflationary)</span>
            </div>
            <div className="dist-box treasury">
              <span className="dist-value">2%</span>
              <span className="dist-label">Treasury (ecosystem growth)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progressive Jackpot */}
      <div className={`docs-section ${!isGameEnabled('progressive') ? 'game-disabled' : ''}`}>
        <div className="section-header">
          <span className="section-icon">🎰</span>
          <h2>Progressive Jackpot</h2>
          {!isGameEnabled('progressive') && <span className="game-status-badge disabled">Not Active</span>}
        </div>

        <div className="subsection">
          <h3>Overview</h3>
          <p>Progressive Jackpot is an exciting 4-dice matching game where you try to match the target dice combination. The jackpot grows with every roll until someone hits the jackpot!</p>
        </div>

        <div className="subsection">
          <h3>How to Play</h3>
          <ol className="steps-list">
            <li><strong>View the target</strong> - See the 4 target dice you need to match</li>
            <li><strong>Buy a roll</strong> - Pay the ticket price (1 SUIT) to generate your roll</li>
            <li><strong>Wait for confirmation</strong> - The blockchain needs a few blocks for randomness</li>
            <li><strong>Reveal your roll</strong> - Click reveal to see your 4 dice</li>
            <li><strong>Win based on matches</strong> - More matches = bigger payout!</li>
          </ol>
        </div>

        <div className="subsection">
          <h3>Payout Structure</h3>
          <table className="docs-table">
            <thead>
              <tr>
                <th>Match Level</th>
                <th>Payout</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="jackpot-row">
                <td><span className="match-badge jackpot">4/4 Matches</span></td>
                <td>80% of Jackpot Pool</td>
                <td className="highlight-gold">Hit the jackpot! Target dice reset after win</td>
              </tr>
              <tr>
                <td><span className="match-badge match3">3/4 Matches</span></td>
                <td>1% of Jackpot Pool</td>
                <td className="highlight-green">Great match! Solid consolation prize</td>
              </tr>
              <tr>
                <td><span className="match-badge match2">2/4 Matches</span></td>
                <td>Ticket Refund</td>
                <td className="highlight-blue">Get your entry fee back</td>
              </tr>
              <tr>
                <td><span className="match-badge match01">0-1 Matches</span></td>
                <td>No Prize</td>
                <td>Better luck next time!</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="subsection">
          <h3>How the Jackpot Works</h3>
          <div className="info-list">
            <div className="info-item">
              <span className="info-label">Growth:</span>
              <span>20% of each ticket adds to the jackpot pool</span>
            </div>
            <div className="info-item">
              <span className="info-label">Persistence:</span>
              <span>The jackpot keeps growing until someone wins</span>
            </div>
            <div className="info-item">
              <span className="info-label">Reset:</span>
              <span>After a jackpot win, 10% remains to seed the next round</span>
            </div>
            <div className="info-item">
              <span className="info-label">New Target:</span>
              <span>When jackpot is won, new random target dice are set</span>
            </div>
          </div>
        </div>
      </div>

      {/* SUITRUMP Raffle */}
      <div className={`docs-section ${!isGameEnabled('raffle') ? 'game-disabled' : ''}`}>
        <div className="section-header">
          <span className="section-icon raffle">🎟️</span>
          <h2>SUITRUMP Raffle</h2>
          {!isGameEnabled('raffle') && <span className="game-status-badge disabled">Not Active</span>}
        </div>

        <div className="subsection">
          <h3>Overview</h3>
          <p>SUITRUMP Raffle is a fair lottery system where players buy tickets for a chance to win the prize pool. One lucky winner takes home 94% of the total pool, with the remaining 6% supporting the ecosystem.</p>
        </div>

        <div className="subsection">
          <h3>How to Play</h3>
          <ol className="steps-list">
            <li><strong>Check the round</strong> - See the current prize pool and participant count</li>
            <li><strong>Buy tickets</strong> - Enter your desired SUIT amount (min 5 SUIT)</li>
            <li><strong>Get tickets</strong> - 1x your 1 ticket per 1 SUIT token spent</li>
            <li><strong>Wait for draw</strong> - Raffle triggers when the timer ends</li>
            <li><strong>Check results</strong> - Winner is selected randomly and paid automatically</li>
          </ol>
        </div>

        <div className="subsection">
          <h3>Raffle Mechanics</h3>
          <div className="mechanics-grid">
            <div className="mechanic-box">
              <h4>Fair Selection</h4>
              <p>Winners are chosen using blockchain randomness - completely on-chain and verifiable.</p>
            </div>
            <div className="mechanic-box">
              <h4>Weighted Odds</h4>
              <p>Your chance to win is proportional to tickets owned - more tickets = better odds.</p>
            </div>
            <div className="mechanic-box">
              <h4>Prize Split</h4>
              <p>94% to winner, 2% to dev team (1%), 1% to treasury, 1% burned, 1% seeds next round.</p>
            </div>
            <div className="mechanic-box">
              <h4>Bonus Rounds</h4>
              <p>Admins can activate bonus multipliers (e.g. 2x) where pot is 2x+ before open up purchase.</p>
            </div>
          </div>
        </div>
      </div>

      {/* SUITRUMP Slots */}
      <div className={`docs-section ${!isGameEnabled('slots') ? 'game-disabled' : ''}`}>
        <div className="section-header">
          <span className="section-icon">🍒</span>
          <h2>SUITRUMP Slots</h2>
          {!isGameEnabled('slots') && <span className="game-status-badge disabled">Not Active</span>}
        </div>

        <div className="subsection">
          <h3>Overview</h3>
          <p>SUITRUMP Slots is a classic 3-reel slot machine where you spin to match symbols on the payline. Match 3 symbols for the jackpot or 2 symbols for a smaller payout.</p>
        </div>

        <div className="subsection">
          <h3>How to Play</h3>
          <ol className="steps-list">
            <li><strong>Connect your wallet</strong> - Make sure you have SUIT tokens</li>
            <li><strong>Set your bet</strong> - Choose from preset amounts or enter custom</li>
            <li><strong>Spin the reels</strong> - Click the spin button and watch the magic</li>
            <li><strong>Win on matches</strong> - Matching symbols pay out instantly</li>
          </ol>
        </div>

        <div className="subsection">
          <h3>Symbols & Payouts</h3>
          <table className="docs-table">
            <thead>
              <tr>
                <th>Combination</th>
                <th>Payout</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="jackpot-row">
                <td>🔵🔵🔵</td>
                <td>50x</td>
                <td className="highlight-gold">JACKPOT - Triple SUIT!</td>
              </tr>
              <tr>
                <td>💎💎💎</td>
                <td>25x</td>
                <td className="highlight-green">Triple Diamonds</td>
              </tr>
              <tr>
                <td>🎰🎰🎰</td>
                <td>15x</td>
                <td>Triple Sevens</td>
              </tr>
              <tr>
                <td>🔥🔥🔥</td>
                <td>10x</td>
                <td>Triple Fire</td>
              </tr>
              <tr>
                <td>🍀🍀🍀</td>
                <td>8x</td>
                <td>Triple Lucky</td>
              </tr>
              <tr>
                <td>⭐⭐⭐</td>
                <td>5x</td>
                <td>Triple Stars</td>
              </tr>
              <tr>
                <td>XX_</td>
                <td>1.5x</td>
                <td>Any two matching</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="subsection">
          <h3>House Edge Distribution</h3>
          <p>SUITRUMP Slots has a 5% house edge, distributed as follows:</p>
          <div className="distribution-boxes">
            <div className="dist-box burn">
              <span className="dist-value">2%</span>
              <span className="dist-label">Burned (deflationary)</span>
            </div>
            <div className="dist-box treasury">
              <span className="dist-value">3%</span>
              <span className="dist-label">Treasury (ecosystem growth)</span>
            </div>
          </div>
        </div>
      </div>

      {/* SUITRUMP Keno */}
      <div className={`docs-section ${!isGameEnabled('keno') ? 'game-disabled' : ''}`}>
        <div className="section-header">
          <span className="section-icon">🎱</span>
          <h2>SUITRUMP Keno</h2>
          {!isGameEnabled('keno') && <span className="game-status-badge disabled">Not Active</span>}
        </div>

        <div className="subsection">
          <h3>Overview</h3>
          <p>SUITRUMP Keno is a lottery-style game where you pick numbers and watch the draw reveal winning numbers. Match your picks to the drawn numbers to win up to 100x your bet!</p>
        </div>

        <div className="subsection">
          <h3>How to Play</h3>
          <ol className="steps-list">
            <li><strong>Pick your numbers</strong> - Select 1-5 numbers from the grid (1-40)</li>
            <li><strong>Set your bet</strong> - Choose your bet amount (1, 5, 10, 25, 50, or 100 SUIT)</li>
            <li><strong>Click DRAW</strong> - Watch as 10 winning numbers are revealed</li>
            <li><strong>Match to win</strong> - The more numbers you match, the bigger your payout!</li>
          </ol>
        </div>

        <div className="subsection">
          <h3>Payout Structure</h3>
          <table className="docs-table">
            <thead>
              <tr>
                <th>Picks</th>
                <th>Matches</th>
                <th>Payout</th>
              </tr>
            </thead>
            <tbody>
              <tr className="jackpot-row">
                <td>5 numbers</td>
                <td>5 matches</td>
                <td className="highlight-gold">100x</td>
              </tr>
              <tr>
                <td>5 numbers</td>
                <td>4 matches</td>
                <td>10x</td>
              </tr>
              <tr>
                <td>5 numbers</td>
                <td>3 matches</td>
                <td>2x</td>
              </tr>
              <tr>
                <td>4 numbers</td>
                <td>4 matches</td>
                <td className="highlight-green">50x</td>
              </tr>
              <tr>
                <td>4 numbers</td>
                <td>3 matches</td>
                <td>5x</td>
              </tr>
              <tr>
                <td>3 numbers</td>
                <td>3 matches</td>
                <td className="highlight-blue">25x</td>
              </tr>
              <tr>
                <td>2 numbers</td>
                <td>2 matches</td>
                <td>9x</td>
              </tr>
              <tr>
                <td>1 number</td>
                <td>1 match</td>
                <td>3.5x</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="subsection">
          <h3>Tips & Strategy</h3>
          <div className="info-list">
            <div className="info-item">
              <span className="info-label">Risk vs Reward:</span>
              <span>Picking fewer numbers has better odds but lower max payouts</span>
            </div>
            <div className="info-item">
              <span className="info-label">Quick Pick:</span>
              <span>Use Quick Pick to randomly select 5 numbers for you</span>
            </div>
            <div className="info-item">
              <span className="info-label">Best Odds:</span>
              <span>Single number picks have the highest hit rate at ~25% (10 draws from 40)</span>
            </div>
          </div>
        </div>

        <div className="subsection">
          <h3>House Edge Distribution</h3>
          <p>SUITRUMP Keno has a 10% house edge, distributed as follows:</p>
          <div className="distribution-boxes">
            <div className="dist-box burn">
              <span className="dist-value">3%</span>
              <span className="dist-label">Burned (deflationary)</span>
            </div>
            <div className="dist-box treasury">
              <span className="dist-value">7%</span>
              <span className="dist-label">Treasury (ecosystem growth)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Provably Fair Gaming */}
      <div className="docs-section">
        <div className="section-header">
          <span className="section-icon">🛡️</span>
          <h2>Provably Fair Gaming</h2>
        </div>

        <p className="section-intro">
          All SUITRUMP Royale games use blockchain-based randomness that cannot be manipulated by anyone - not the house, not the players, and even the developers.
        </p>

        <div className="subsection">
          <h3>How It Works</h3>
          <div className="provably-fair-steps">
            <div className="pf-step">
              <div className="pf-number">1</div>
              <div className="pf-content">
                <h4>Commit</h4>
                <p>Your bet/roll is recorded on the blockchain at a specific block number</p>
              </div>
            </div>
            <div className="pf-step">
              <div className="pf-number">2</div>
              <div className="pf-content">
                <h4>Wait</h4>
                <p>The system waits for future blocks to be mined (typically 1-2 blocks)</p>
              </div>
            </div>
            <div className="pf-step">
              <div className="pf-number">3</div>
              <div className="pf-content">
                <h4>Reveal</h4>
                <p>The result is determined using the blockhash of a future block - impossible to predict or manipulate</p>
              </div>
            </div>
          </div>
        </div>

        <div className="verify-box">
          <h4>Verify Any Result</h4>
          <p>Every game result can be independently verified on the blockchain. Check the transaction on SuiScan to see the exact blockhash used and verify the outcome calculation.</p>
        </div>
      </div>

      {/* Security Audit */}
      <div className="docs-section">
        <div className="section-header">
          <span className="section-icon">🔐</span>
          <h2>Security Audit</h2>
        </div>

        <p className="section-intro">
          SUITRUMP Royale smart contracts have undergone comprehensive security testing to ensure safe and fair gaming for all players.
        </p>

        <div className="subsection">
          <h3>Audit Results</h3>
          <div className="audit-summary">
            <div className="audit-badge passed">
              <span className="audit-icon">✓</span>
              <span className="audit-text">80/80 Tests Passing</span>
            </div>
            <div className="audit-meta">
              <span>Solidity 0.8.20</span>
              <span>Sui Network</span>
              <span>December 2025</span>
            </div>
          </div>
        </div>

        <div className="subsection">
          <h3>Security Testing Coverage</h3>
          <div className="security-grid">
            <div className="security-item">
              <span className="security-check">✓</span>
              <span>Reentrancy Protection</span>
            </div>
            <div className="security-item">
              <span className="security-check">✓</span>
              <span>Access Control</span>
            </div>
            <div className="security-item">
              <span className="security-check">✓</span>
              <span>Fund Handling</span>
            </div>
            <div className="security-item">
              <span className="security-check">✓</span>
              <span>Randomness Fairness</span>
            </div>
            <div className="security-item">
              <span className="security-check">✓</span>
              <span>Edge Case Testing</span>
            </div>
            <div className="security-item">
              <span className="security-check">✓</span>
              <span>DoS Resistance</span>
            </div>
          </div>
        </div>

        <div className="subsection">
          <h3>Vulnerabilities Found & Fixed</h3>
          <div className="vuln-list">
            <div className="vuln-item fixed">
              <div className="vuln-header">
                <span className="vuln-severity high">HIGH</span>
                <span className="vuln-name">Single Player Fund Lock</span>
                <span className="vuln-status">FIXED</span>
              </div>
              <p>Added withdrawFromWaiting() function allowing players to exit waiting rounds without owner intervention.</p>
            </div>
            <div className="vuln-item fixed">
              <div className="vuln-header">
                <span className="vuln-severity high">HIGH</span>
                <span className="vuln-name">Incomplete Refund on Cancel</span>
                <span className="vuln-status">FIXED</span>
              </div>
              <p>Changed to proportional prize pool refunds ensuring all players receive fair 94% refunds.</p>
            </div>
            <div className="vuln-item fixed">
              <div className="vuln-header">
                <span className="vuln-severity medium">MEDIUM</span>
                <span className="vuln-name">Refund Math Error</span>
                <span className="vuln-status">FIXED</span>
              </div>
              <p>Updated single player refund to return entire prize pool instead of incorrect ticket-based calculation.</p>
            </div>
          </div>
        </div>

        <div className="subsection">
          <h3>Security Features</h3>
          <div className="info-list">
            <div className="info-item">
              <span className="info-label">ReentrancyGuard:</span>
              <span>All state-changing functions protected against reentrancy attacks</span>
            </div>
            <div className="info-item">
              <span className="info-label">Pausable:</span>
              <span>Emergency pause controls for owner to halt operations if needed</span>
            </div>
            <div className="info-item">
              <span className="info-label">Access Control:</span>
              <span>Admin functions restricted to owner address only</span>
            </div>
            <div className="info-item">
              <span className="info-label">Input Validation:</span>
              <span>Comprehensive checks on all user inputs and parameters</span>
            </div>
          </div>
        </div>

        <div className="verify-box">
          <h4>Verify Contracts</h4>
          <p>All contracts are verified on SuiScan. You can review the source code and audit the logic yourself. Transparency is fundamental to provably fair gaming.</p>
        </div>
      </div>

      {/* Getting Started */}
      <div className="docs-section">
        <div className="section-header">
          <span className="section-icon">🚀</span>
          <h2>Getting Started</h2>
        </div>

        <div className="getting-started-steps">
          <div className="gs-step">
            <div className="gs-number">1</div>
            <div className="gs-content">
              <h4>Get a Wallet</h4>
              <p>Install MetaMask or any Sui compatible wallet</p>
            </div>
          </div>
          <div className="gs-step">
            <div className="gs-number">2</div>
            <div className="gs-content">
              <h4>Connect to Sui Testnet</h4>
              <p>SUITRUMP Royale currently runs on Sui Testnet for testing</p>
            </div>
          </div>
          <div className="gs-step">
            <div className="gs-number">3</div>
            <div className="gs-content">
              <h4>Get SUIT Tokens</h4>
              <p>Use the Faucet to get free SUIT to start playing</p>
            </div>
          </div>
          <div className="gs-step">
            <div className="gs-number">4</div>
            <div className="gs-content">
              <h4>Start Playing</h4>
              <p>Choose a game and bet</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocsPage;
