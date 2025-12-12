/**
 * Game Registry - Central configuration for all casino games
 *
 * Each game has:
 * - id: unique identifier (used for storage keys)
 * - name: display name
 * - icon: emoji icon for navigation
 * - route: URL path
 * - component: lazy-loaded component name
 * - description: short description for docs
 * - enabled: default enabled state
 * - category: 'core' (always available) or 'game' (can be toggled)
 * - docsSection: documentation content for the game
 */

export const GAME_REGISTRY = {
  // Core pages (always visible, not toggleable)
  casino: {
    id: 'casino',
    name: 'Casino',
    icon: '🎰',
    route: '/',
    category: 'core',
    enabled: true,
    showInNav: true,
    description: 'Main casino lobby'
  },
  faucet: {
    id: 'faucet',
    name: 'Faucet',
    icon: '🚰',
    route: '/faucet',
    category: 'core',
    enabled: true,
    showInNav: true,
    description: 'Get free SUIT tokens for testing'
  },
  docs: {
    id: 'docs',
    name: 'Docs',
    icon: '📖',
    route: '/docs',
    category: 'core',
    enabled: true,
    showInNav: true,
    description: 'Documentation and guides'
  },
  history: {
    id: 'history',
    name: 'History',
    icon: '📊',
    route: '/history',
    category: 'core',
    enabled: true,
    showInNav: false, // Only shown in Pro Mode
    proModeOnly: true,
    description: 'Player statistics and history'
  },

  // Games (can be toggled on/off)
  dice: {
    id: 'dice',
    name: 'Classic Dice',
    icon: '🎲',
    route: '/dice',
    category: 'game',
    enabled: true,
    showInNav: true,
    description: 'Predict dice outcomes with 5 bet types',
    houseEdge: '3%',
    minBet: '1 SUIT',
    maxBet: '1000 SUIT',
    docsContent: {
      title: 'Classic Dice',
      overview: 'Classic Dice is a simple provably-fair dice game where you predict the outcome of a single die roll (1-6). Choose from 5 different bet types, each with different odds and payouts.',
      howToPlay: [
        'Connect your wallet - Make sure you\'re on Sui and have SUIT tokens',
        'Choose a bet type - Select from Exact, Over, Under, Odd, or Even',
        'Set your bet amount - Enter how much SUIT you want to wager',
        'Place your bet - Approve the transaction and wait for the result',
        'Collect winnings - If you win, payouts are instant and automatic'
      ],
      betTypes: [
        { type: 'EXACT', condition: 'Predict the exact number (1-6)', chance: '16.67%', payout: '5.5x' },
        { type: 'OVER', condition: 'Roll higher than your chosen number', chance: 'Varies', payout: '1.16x - 5.5x' },
        { type: 'UNDER', condition: 'Roll lower than your chosen number', chance: 'Varies', payout: '1.16x - 5.5x' },
        { type: 'ODD', condition: 'Roll lands on 1, 3, or 5', chance: '50%', payout: '1.94x' },
        { type: 'EVEN', condition: 'Roll lands on 2, 4, or 6', chance: '50%', payout: '1.94x' }
      ],
      distribution: { burn: '1%', treasury: '2%' }
    }
  },

  progressive: {
    id: 'progressive',
    name: 'Progressive',
    icon: '💎',
    route: '/progressive',
    category: 'game',
    enabled: true,
    showInNav: true,
    description: 'Match 4 dice for the jackpot',
    houseEdge: '20%',
    ticketPrice: '1 SUIT',
    docsContent: {
      title: 'Progressive Jackpot',
      overview: 'Progressive Jackpot is an exciting 4-dice matching game where you try to match the target dice combination. The jackpot grows with every roll until someone hits the jackpot!',
      howToPlay: [
        'View the target - See the 4 target dice you need to match',
        'Buy a roll - Pay the ticket price (1 SUIT) to generate your roll',
        'Wait for confirmation - The blockchain needs a few blocks for randomness',
        'Reveal your roll - Click reveal to see your 4 dice',
        'Win based on matches - More matches = bigger payout!'
      ],
      payouts: [
        { matches: '4/4', payout: '80% of Jackpot Pool', description: 'Hit the jackpot! Target dice reset after win' },
        { matches: '3/4', payout: '1% of Jackpot Pool', description: 'Great match! Solid consolation prize' },
        { matches: '2/4', payout: 'Ticket Refund', description: 'Get your entry fee back' },
        { matches: '0-1', payout: 'No Prize', description: 'Better luck next time!' }
      ]
    }
  },

  raffle: {
    id: 'raffle',
    name: 'Raffle',
    icon: '🎟️',
    route: '/raffle',
    category: 'game',
    enabled: true,
    showInNav: true,
    description: 'Buy tickets for a chance to win the pool',
    houseEdge: '6%',
    minTickets: '5 SUIT',
    docsContent: {
      title: 'SUITRUMP Raffle',
      overview: 'SUITRUMP Raffle is a fair lottery system where players buy tickets for a chance to win the prize pool. One lucky winner takes home 94% of the total pool, with the remaining 6% supporting the ecosystem.',
      howToPlay: [
        'Check the round - See the current prize pool and participant count',
        'Buy tickets - Enter your desired SUIT amount (min 5 SUIT)',
        'Get tickets - 1 ticket per 1 SUIT token spent',
        'Wait for draw - Raffle triggers when the timer ends',
        'Check results - Winner is selected randomly and paid automatically'
      ],
      mechanics: [
        { title: 'Fair Selection', description: 'Winners are chosen using blockchain randomness - completely on-chain and verifiable.' },
        { title: 'Weighted Odds', description: 'Your chance to win is proportional to tickets owned - more tickets = better odds.' },
        { title: 'Prize Split', description: '94% to winner, 2% to dev team, 1% to treasury, 1% burned, 1% seeds next round.' },
        { title: 'Bonus Rounds', description: 'Admins can activate bonus multipliers where pot is 2x+ before opening purchase.' }
      ]
    }
  },

  slots: {
    id: 'slots',
    name: 'SUITRUMP Slots',
    icon: '🍒',
    route: '/slots',
    category: 'game',
    enabled: false, // Disabled until built
    showInNav: true,
    description: 'Classic 3-reel slot machine',
    houseEdge: '5%',
    minBet: '1 SUIT',
    maxBet: '100 SUIT',
    docsContent: {
      title: 'SUITRUMP Slots',
      overview: 'SUITRUMP Slots is a classic 3-reel slot machine with multiple winning combinations. Match symbols across the payline to win!',
      howToPlay: [
        'Connect your wallet - Make sure you have SUIT tokens',
        'Set your bet - Choose your wager amount',
        'Spin the reels - Click spin and watch the magic',
        'Win on matches - Matching symbols pay out instantly'
      ],
      symbols: [
        { symbol: '💎💎💎', payout: '50x', description: 'Triple Diamonds - JACKPOT!' },
        { symbol: '7️⃣7️⃣7️⃣', payout: '25x', description: 'Triple Sevens' },
        { symbol: '🍒🍒🍒', payout: '10x', description: 'Triple Cherries' },
        { symbol: '🔔🔔🔔', payout: '5x', description: 'Triple Bells' },
        { symbol: '⭐⭐⭐', payout: '3x', description: 'Triple Stars' },
        { symbol: 'Any 2 matching', payout: '1.5x', description: 'Two of a kind' }
      ]
    }
  }
};

// Helper to get all games (excluding core pages)
export const getGames = () => {
  return Object.values(GAME_REGISTRY).filter(g => g.category === 'game');
};

// Helper to get all enabled games
export const getEnabledGames = (settings = {}) => {
  return Object.values(GAME_REGISTRY).filter(g => {
    if (g.category === 'core') return true;
    const settingValue = settings[g.id];
    return settingValue !== undefined ? settingValue : g.enabled;
  });
};

// Helper to get nav items
export const getNavItems = (settings = {}, proMode = false) => {
  return Object.values(GAME_REGISTRY).filter(g => {
    // Check if enabled in settings or default
    const isEnabled = g.category === 'core'
      ? true
      : (settings[g.id] !== undefined ? settings[g.id] : g.enabled);

    if (!isEnabled) return false;
    if (!g.showInNav) return false;
    if (g.proModeOnly && !proMode) return false;

    return true;
  });
};

// Helper to get docs for enabled games
export const getGameDocs = (settings = {}) => {
  return Object.values(GAME_REGISTRY)
    .filter(g => g.category === 'game' && g.docsContent)
    .filter(g => settings[g.id] !== undefined ? settings[g.id] : g.enabled);
};

export default GAME_REGISTRY;
