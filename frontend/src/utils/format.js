// Utility functions for SUITRUMP Royale
// Replaces ethers.js formatting utilities

/**
 * Format a token amount from smallest unit to display format
 * SUIT token has 9 decimals (Sui standard)
 */
export const formatSuit = (amount, decimals = 9) => {
  if (!amount) return '0';
  const value = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  const wholePart = value / divisor;
  const fractionalPart = value % divisor;

  if (fractionalPart === 0n) {
    return wholePart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  // Remove trailing zeros
  const trimmed = fractionalStr.replace(/0+$/, '');

  return `${wholePart}.${trimmed}`;
};

/**
 * Parse a display amount to smallest unit
 * @param amount - String amount like "1.5"
 * @param decimals - Number of decimals (default 9 for Sui)
 */
export const parseSuit = (amount, decimals = 9) => {
  if (!amount) return BigInt(0);

  const [whole, fraction = ''] = amount.toString().split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);

  return BigInt(whole + paddedFraction);
};

/**
 * Format a number with commas for display
 */
export const formatNumber = (num) => {
  if (!num) return '0';
  return parseFloat(num).toLocaleString();
};

/**
 * Shorten an address for display
 */
export const shortenAddress = (address, chars = 4) => {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
};

/**
 * Legacy compatibility - mimics ethers.formatEther for 18 decimal tokens
 * Some code may still reference this
 */
export const formatEther = (amount) => {
  return formatSuit(amount, 18);
};

export default {
  formatSuit,
  parseSuit,
  formatNumber,
  shortenAddress,
  formatEther
};
