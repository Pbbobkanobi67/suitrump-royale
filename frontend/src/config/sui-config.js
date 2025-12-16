// SUITRUMP Royale - Sui Network Configuration

// Current active network - change this to switch between testnet/mainnet
export const CURRENT_NETWORK = 'testnet'; // 'testnet' | 'mainnet'

// Network-specific configurations
export const NETWORKS = {
  testnet: {
    name: 'Sui Testnet',
    rpcUrl: 'https://fullnode.testnet.sui.io:443',

    // TEST TOKENS (fake tokens for testing)
    // Both tokens deployed in same package: 0xe8fd4cdccd697947bdb84f357eadb626bafac3db769c228336ebcd1ad6ca9081
    tokens: {
      // Full coin type paths for Sui
      SUITRUMP: '0xe8fd4cdccd697947bdb84f357eadb626bafac3db769c228336ebcd1ad6ca9081::test_suitrump::TEST_SUITRUMP',
      VICTORY: '0xe8fd4cdccd697947bdb84f357eadb626bafac3db769c228336ebcd1ad6ca9081::test_victory::TEST_VICTORY',

      // Package IDs (for calling functions) - same package for both
      suitrumpPackage: '0xe8fd4cdccd697947bdb84f357eadb626bafac3db769c228336ebcd1ad6ca9081',
      victoryPackage: '0xe8fd4cdccd697947bdb84f357eadb626bafac3db769c228336ebcd1ad6ca9081',

      // Public faucets - shared objects for minting test tokens
      publicFaucets: {
        suitrump: '0xa5746991f5e85534455951ba8b90b98dcd5f30b0a11f23df6d5df8e385673f4f',
        victory: '0x4b4adf693592e9a2cb5390b9f97657f606d4fd3b753a4c58bafac873f34200a0'
      }
    },

    // Game contracts (testnet deployments) - All deployed in package 0x37fea8e22034d649d312806aa2a311fe728f793e09d52db7887ae5803ca2a677
    contracts: {
      raffle: '0x37fea8e22034d649d312806aa2a311fe728f793e09d52db7887ae5803ca2a677',
      dice: '0x37fea8e22034d649d312806aa2a311fe728f793e09d52db7887ae5803ca2a677',
      slots: '0x37fea8e22034d649d312806aa2a311fe728f793e09d52db7887ae5803ca2a677',
      crash: '0x37fea8e22034d649d312806aa2a311fe728f793e09d52db7887ae5803ca2a677',
      plinko: '0x37fea8e22034d649d312806aa2a311fe728f793e09d52db7887ae5803ca2a677',
      keno: '0x37fea8e22034d649d312806aa2a311fe728f793e09d52db7887ae5803ca2a677',
      roulette: '0x37fea8e22034d649d312806aa2a311fe728f793e09d52db7887ae5803ca2a677',
      progressive: '0x37fea8e22034d649d312806aa2a311fe728f793e09d52db7887ae5803ca2a677'
    }
  },

  mainnet: {
    name: 'Sui Mainnet',
    rpcUrl: 'https://fullnode.mainnet.sui.io:443',

    // REAL TOKENS (actual SUITRUMP and VICTORY on mainnet)
    tokens: {
      SUITRUMP: null, // TODO: Add real SUITRUMP token type
      VICTORY: null,  // TODO: Add real VICTORY token type
      suitrumpPackage: null,
      victoryPackage: null
    },

    // Game contracts (mainnet deployments)
    contracts: {
      raffle: null,
      dice: null,
      slots: null,
      crash: null,
      plinko: null,
      keno: null,
      roulette: null,
      progressive: null
    }
  }
};

// Helper to get current network config
export const getNetworkConfig = () => NETWORKS[CURRENT_NETWORK];
export const getTokenType = (token) => NETWORKS[CURRENT_NETWORK].tokens[token];
export const getContract = (game) => NETWORKS[CURRENT_NETWORK].contracts[game];

export const SUI_CONFIG = {
  // Network configuration
  network: CURRENT_NETWORK,

  // RPC endpoints
  rpcUrls: {
    testnet: 'https://fullnode.testnet.sui.io:443',
    mainnet: 'https://fullnode.mainnet.sui.io:443',
    devnet: 'https://fullnode.devnet.sui.io:443'
  },

  // Current network tokens (for backwards compatibility)
  tokens: {
    suitrump: NETWORKS[CURRENT_NETWORK].tokens.suitrumpPackage,
    victory: NETWORKS[CURRENT_NETWORK].tokens.victoryPackage,
    // Full type paths
    SUITRUMP_TYPE: NETWORKS[CURRENT_NETWORK].tokens.SUITRUMP,
    VICTORY_TYPE: NETWORKS[CURRENT_NETWORK].tokens.VICTORY,
    // Public faucets
    publicFaucets: NETWORKS[CURRENT_NETWORK].tokens.publicFaucets
  },

  suitrumpToken: NETWORKS[CURRENT_NETWORK].tokens.suitrumpPackage,

  packageIds: {
    tokens: '0xe8fd4cdccd697947bdb84f357eadb626bafac3db769c228336ebcd1ad6ca9081',
    games: '0x37fea8e22034d649d312806aa2a311fe728f793e09d52db7887ae5803ca2a677',
    cashier: '0x_CASHIER_PACKAGE_ID',
    raffle: '0x13257d34d094af055797f9089c6bc6d5be401e031be3f16841806e71ab877e65',
    dice: '0x37fea8e22034d649d312806aa2a311fe728f793e09d52db7887ae5803ca2a677',
    progressive: '0x37fea8e22034d649d312806aa2a311fe728f793e09d52db7887ae5803ca2a677',
    slots: '0x37fea8e22034d649d312806aa2a311fe728f793e09d52db7887ae5803ca2a677',
    crash: '0x37fea8e22034d649d312806aa2a311fe728f793e09d52db7887ae5803ca2a677',
    plinko: '0x37fea8e22034d649d312806aa2a311fe728f793e09d52db7887ae5803ca2a677',
    keno: '0x37fea8e22034d649d312806aa2a311fe728f793e09d52db7887ae5803ca2a677',
    roulette: '0x37fea8e22034d649d312806aa2a311fe728f793e09d52db7887ae5803ca2a677'
  },

  adminCaps: {
    raffle: '0x78878adc57a677d7c189ea51063d7e43ad82696d9838b6efd93a0bb6af2b4443',
    dice: '0x169aa34a59a288feaa610c1561ce21abf1f5cc4c24b982718a9336ecd829b571',
    slots: '0x1ed8daa44f95751371723b1d50b589f5fc9774ecd19f28c15c6fb7b0b13ab98c',
    crash: '0x94f2b7d2bfb08d32f70ca83c0495614db384b1eada0c5cc2691cfd2d30aad384',
    plinko: '0x0242e85e2e1bf87a9c515602ab2517e85171686627c7136633ece1f1f286e72f',
    keno: '0xd9ac169d9e518fd866f1c28beb0d3f69a7ef154c6f8604eed5b10c2f55d7f43a',
    roulette: '0x7a92dea072889becb8e60294b23b847354687dbd54aa4155d7146a46319bbfa7',
    progressive: '0x36e1415b028a717f933b4f570fbb98d681d2cef7937652c313bfa6b239fa1e8e',
    cashier: '0x_CASHIER_ADMIN_CAP'
  },

  games: {
    cashier: '0x_CASHIER_OBJECT_ID',
    dice: '0x_DICE_OBJECT_ID',
    progressive: '0x_PROGRESSIVE_OBJECT_ID',
    raffle: '0x8ae94a481aefbac6eceb7a5a539b033d09ba2307bfa7261c0604f443be74f909',
    slots: '0x_SLOTS_OBJECT_ID',
    crash: '0x_CRASH_OBJECT_ID',
    plinko: '0x_PLINKO_OBJECT_ID',
    keno: '0x_KENO_OBJECT_ID',
    roulette: '0x_ROULETTE_OBJECT_ID'
  },

  // ECOSYSTEM WALLETS
  wallets: {
    devA: '0x9b66dfcc45d57ed624b4058f2ba52f084af2330a1145087e61ef1eaac4a7cc20',
    devB: '0x_PROJECT_OWNER_WALLET',
    treasury: '0x9b66dfcc45d57ed624b4058f2ba52f084af2330a1145087e61ef1eaac4a7cc20',
    burn: '0x0000000000000000000000000000000000000000000000000000000000000000'
  },

  // FEE DISTRIBUTION (5% Total House Edge)
  fees: {
    totalHouseEdge: 500,
    distribution: {
      burn: 100,
      treasury: 200,
      devA: 100,
      devB: 100
    }
  },

  // BETTING LIMITS (in tickets, 1 ticket = $0.10)
  bettingLimits: {
    global: { minBet: 1, maxBet: 10000 },
    dice: { minBet: 1, maxBet: 10000 },
    slots: { minBet: 1, maxBet: 5000 },
    crash: { minBet: 1, maxBet: 10000 },
    roulette: { minBet: 1, maxBet: 10000 },
    plinko: { minBet: 1, maxBet: 5000 },
    keno: { minBet: 1, maxBet: 2000 },
    progressive: { minBet: 1, maxBet: 100 },
    raffle: { minBet: 1, maxBet: 10000 }
  },

  tickets: {
    valueInCents: 10,  // 1 ticket = $0.10
    decimals: 0
  },

  adminAddresses: [
    '0x9b66dfcc45d57ed624b4058f2ba52f084af2330a1145087e61ef1eaac4a7cc20'
  ]
};

export const getRpcUrl = () => SUI_CONFIG.rpcUrls[SUI_CONFIG.network];

export const CHAIN_IDS = {
  testnet: 'sui:testnet',
  mainnet: 'sui:mainnet',
  devnet: 'sui:devnet'
};

export const getCurrentChainId = () => CHAIN_IDS[SUI_CONFIG.network];

export const MODULES = {
  testSuitrump: 'test_suitrump',
  testVictory: 'test_victory',
  cashier: 'suitrump_cashier',
  dice: 'suitrump_dice',
  slots: 'suitrump_slots',
  crash: 'suitrump_crash',
  roulette: 'suitrump_roulette',
  progressive: 'suitrump_progressive',
  raffle: 'suitrump_raffle',
  plinko: 'suitrump_plinko',
  keno: 'suitrump_keno'
};

export const TOKEN_DECIMALS = 9;

export function formatSuit(amount) {
  if (!amount) return '0';
  const num = typeof amount === 'string' ? BigInt(amount) : BigInt(amount);
  const whole = num / BigInt(10 ** TOKEN_DECIMALS);
  const fraction = num % BigInt(10 ** TOKEN_DECIMALS);
  if (fraction === 0n) return whole.toString();
  return whole + '.' + fraction.toString().padStart(TOKEN_DECIMALS, '0').replace(/0+$/, '');
}

export function parseSuit(amount) {
  if (!amount) return 0n;
  const str = amount.toString();
  const parts = str.split('.');
  const whole = parts[0] || '0';
  const fraction = (parts[1] || '').padEnd(TOKEN_DECIMALS, '0').slice(0, TOKEN_DECIMALS);
  return BigInt(whole) * BigInt(10 ** TOKEN_DECIMALS) + BigInt(fraction);
}

export function formatTickets(tickets) {
  if (!tickets) return '$0.00';
  const dollars = Number(tickets) * 0.10;  // 1 ticket = $0.10
  return '$' + dollars.toFixed(2);
}

export function parseToTickets(dollarAmount) {
  if (!dollarAmount) return 0;
  return Math.floor(Number(dollarAmount) / 0.10);  // $0.10 per ticket
}

export const RANDOM_OBJECT_ID = '0x8';
export const CLOCK_OBJECT_ID = '0x6';

export default SUI_CONFIG;

