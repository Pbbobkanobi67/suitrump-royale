import { useState, useEffect, useCallback } from 'react';

// SUITRUMP mainnet token address
const SUITRUMP_TOKEN = '0xdeb831e796f16f8257681c0d5d4108fa94333060300b2459133a96631bf470b8::suitrump::SUITRUMP';

// DEX Screener API endpoint (aggregates on-chain Cetus/BlueMove pool data)
const DEX_SCREENER_API = `https://api.dexscreener.com/latest/dex/tokens/${SUITRUMP_TOKEN}`;

// Fallback price if API fails (will be updated)
const FALLBACK_PRICE = 0.00003158;

// Cache duration (30 seconds)
const CACHE_DURATION = 30000;

let priceCache = {
  price: null,
  timestamp: 0
};

/**
 * Hook to fetch real-time SUITRUMP price from on-chain DEX pools
 */
export function useSuitrumpPrice() {
  const [price, setPrice] = useState(priceCache.price || FALLBACK_PRICE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [poolData, setPoolData] = useState(null);

  const fetchPrice = useCallback(async () => {
    // Check cache first
    const now = Date.now();
    if (priceCache.price && (now - priceCache.timestamp) < CACHE_DURATION) {
      setPrice(priceCache.price);
      setLoading(false);
      return priceCache.price;
    }

    try {
      setLoading(true);
      const response = await fetch(DEX_SCREENER_API);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.pairs && data.pairs.length > 0) {
        // Get the highest liquidity pool (most reliable price)
        const sortedPairs = data.pairs
          .filter(p => p.liquidity?.usd > 100) // Filter out very low liquidity pools
          .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));

        if (sortedPairs.length > 0) {
          const bestPair = sortedPairs[0];
          const newPrice = parseFloat(bestPair.priceUsd);

          // Update cache
          priceCache = {
            price: newPrice,
            timestamp: now
          };

          setPrice(newPrice);
          setPoolData({
            dex: bestPair.dexId,
            poolAddress: bestPair.pairAddress,
            liquidity: bestPair.liquidity?.usd,
            volume24h: bestPair.volume?.h24,
            priceChange24h: bestPair.priceChange?.h24
          });
          setLastUpdated(new Date());
          setError(null);
          setLoading(false);
          return newPrice;
        }
      }

      throw new Error('No valid price data found');
    } catch (err) {
      console.error('Error fetching SUITRUMP price:', err);
      setError(err.message);
      setLoading(false);
      // Return cached or fallback price
      return priceCache.price || FALLBACK_PRICE;
    }
  }, []);

  // Fetch on mount and every 30 seconds
  useEffect(() => {
    fetchPrice();
    const interval = setInterval(fetchPrice, CACHE_DURATION);
    return () => clearInterval(interval);
  }, [fetchPrice]);

  // Calculate exchange rates based on current price
  const getExchangeRates = useCallback(() => {
    const suitrumpPerDollar = 1 / price;
    const suitrumpPerTicket = suitrumpPerDollar * 0.10; // 1 ticket = $0.10

    return {
      price,                          // USD price per SUITRUMP
      suitrumpPerDollar,             // How many SUITRUMP per $1
      suitrumpPerTicket,             // How many SUITRUMP per 1 ticket
      ticketsPerSuitrump: 1 / suitrumpPerTicket, // How many tickets per 1 SUITRUMP
    };
  }, [price]);

  return {
    price,
    loading,
    error,
    lastUpdated,
    poolData,
    fetchPrice,
    getExchangeRates,
    // Convenience conversions
    suitrumpToUsd: (amount) => amount * price,
    usdToSuitrump: (usd) => usd / price,
    suitrumpToTickets: (amount) => Math.floor((amount * price) / 0.10),
    ticketsToSuitrump: (tickets) => (tickets * 0.10) / price,
  };
}

export default useSuitrumpPrice;
