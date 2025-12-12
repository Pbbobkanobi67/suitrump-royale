// SUITRUMP Royale - Sui Network Configuration

export const SUI_CONFIG = {
  // Network configuration
  network: 'testnet', // 'testnet' | 'mainnet' | 'devnet'

  // RPC endpoints
  rpcUrls: {
    testnet: 'https://fullnode.testnet.sui.io:443',
    mainnet: 'https://fullnode.mainnet.sui.io:443',
    devnet: 'https://fullnode.devnet.sui.io:443'
  },

  // SUITRUMP token address (update with actual address)
  suitrumpToken: '0x_SUITRUMP_TOKEN_ADDRESS',

  // Deployed game package ID (update after deployment)
  packageId: '0x_DEPLOYED_PACKAGE_ID',

  // Game contract object IDs (update after deployment)
  games: {
    dice: '0x_DICE_OBJECT_ID',
    progressive: '0x_PROGRESSIVE_OBJECT_ID',
    raffle: '0x_RAFFLE_OBJECT_ID',
    slots: '0x_SLOTS_OBJECT_ID',
    crash: '0x_CRASH_OBJECT_ID',
    plinko: '0x_PLINKO_OBJECT_ID',
    keno: '0x_KENO_OBJECT_ID',
    roulette: '0x_ROULETTE_OBJECT_ID'
  },

  // House treasury object ID
  treasury: '0x_TREASURY_OBJECT_ID',

  // Admin addresses
  adminAddresses: [
    // Add admin wallet addresses here
  ]
};

// Get current RPC URL based on network
export const getRpcUrl = () => {
  return SUI_CONFIG.rpcUrls[SUI_CONFIG.network];
};

// Chain ID mapping
export const CHAIN_IDS = {
  testnet: 'sui:testnet',
  mainnet: 'sui:mainnet',
  devnet: 'sui:devnet'
};

export const getCurrentChainId = () => {
  return CHAIN_IDS[SUI_CONFIG.network];
};

// Module names for Move contracts
export const MODULES = {
  dice: 'suitrump_dice',
  slots: 'suitrump_slots',
  crash: 'suitrump_crash',
  roulette: 'suitrump_roulette',
  progressive: 'suitrump_progressive',
  raffle: 'suitrump_raffle',
  plinko: 'suitrump_plinko',
  keno: 'suitrump_keno'
};

// Token decimals (SUIT uses 9 decimals like SUI)
export const TOKEN_DECIMALS = 9;

// Format SUIT amount for display
export function formatSuit(amount) {
  if (!amount) return '0';
  const num = typeof amount === 'string' ? BigInt(amount) : BigInt(amount);
  const whole = num / BigInt(10 ** TOKEN_DECIMALS);
  const fraction = num % BigInt(10 ** TOKEN_DECIMALS);
  if (fraction === 0n) return whole.toString();
  return `${whole}.${fraction.toString().padStart(TOKEN_DECIMALS, '0').replace(/0+$/, '')}`;
}

// Parse SUIT amount from user input (returns raw amount with decimals)
export function parseSuit(amount) {
  if (!amount) return 0n;
  const str = amount.toString();
  const [whole, fraction = ''] = str.split('.');
  const paddedFraction = fraction.padEnd(TOKEN_DECIMALS, '0').slice(0, TOKEN_DECIMALS);
  return BigInt(whole || '0') * BigInt(10 ** TOKEN_DECIMALS) + BigInt(paddedFraction);
}

// Random system object for Sui
export const RANDOM_OBJECT_ID = '0x8';

// Clock object for Sui
export const CLOCK_OBJECT_ID = '0x6';

export default SUI_CONFIG;
