import React, { useState, useEffect } from 'react';
import { BetType, BetTypeLabels } from '../../hooks/useDice';

function BetControls({
  limits,
  onPlaceBet,
  calculatePayout,
  loading,
  disabled
}) {
  const [betType, setBetType] = useState(BetType.ODD);
  const [chosenNumber, setChosenNumber] = useState(3);
  const [betAmount, setBetAmount] = useState('');
  const [potentialPayout, setPotentialPayout] = useState('0');

  // Calculate potential payout when inputs change
  useEffect(() => {
    const updatePayout = async () => {
      if (betAmount && parseFloat(betAmount) > 0) {
        const payout = await calculatePayout(betAmount, betType, chosenNumber);
        setPotentialPayout(payout);
      } else {
        setPotentialPayout('0');
      }
    };
    updatePayout();
  }, [betAmount, betType, chosenNumber, calculatePayout]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (betAmount && parseFloat(betAmount) >= parseFloat(limits?.minBet || 0)) {
      onPlaceBet(betAmount, betType, chosenNumber);
    }
  };

  const getNumberOptions = () => {
    switch (betType) {
      case BetType.EXACT:
        return [1, 2, 3, 4, 5, 6];
      case BetType.OVER:
        return [1, 2, 3, 4, 5]; // Can't bet OVER 6
      case BetType.UNDER:
        return [2, 3, 4, 5]; // Can't bet UNDER 1 or UNDER 6 (5/6 too easy)
      default:
        return [];
    }
  };

  const needsNumberSelection = [BetType.EXACT, BetType.OVER, BetType.UNDER].includes(betType);

  const getMultiplierDisplay = () => {
    if (betType === BetType.EXACT) return '5.82x';
    if (betType === BetType.ODD || betType === BetType.EVEN) return '1.94x';
    if (betType === BetType.OVER) {
      const winningOutcomes = 6 - chosenNumber;
      const multiplier = (6 * 0.97) / winningOutcomes;
      return `${multiplier.toFixed(2)}x`;
    }
    if (betType === BetType.UNDER) {
      const winningOutcomes = chosenNumber - 1;
      const multiplier = (6 * 0.97) / winningOutcomes;
      return `${multiplier.toFixed(2)}x`;
    }
    return '';
  };

  const getWinCondition = () => {
    switch (betType) {
      case BetType.EXACT:
        return `Roll exactly ${chosenNumber}`;
      case BetType.OVER:
        return `Roll > ${chosenNumber} (${6 - chosenNumber}/6 chance)`;
      case BetType.UNDER:
        return `Roll < ${chosenNumber} (${chosenNumber - 1}/6 chance)`;
      case BetType.ODD:
        return 'Roll 1, 3, or 5 (3/6 chance)';
      case BetType.EVEN:
        return 'Roll 2, 4, or 6 (3/6 chance)';
      default:
        return '';
    }
  };

  return (
    <div className="bet-controls">
      <h3>Place Your Bet</h3>

      <form onSubmit={handleSubmit}>
        {/* Submit Button - at top for visibility */}
        <button
          type="submit"
          className="btn btn-primary btn-large place-bet-top"
          disabled={disabled || loading || !betAmount || parseFloat(betAmount) < parseFloat(limits?.minBet || 0)}
        >
          {loading ? 'Processing...' : 'Place Bet'}
        </button>

        {/* Bet Type Selection */}
        <div className="bet-type-section">
          <label>Bet Type</label>
          <div className="bet-type-buttons">
            {Object.entries(BetType).map(([key, value]) => (
              <button
                key={key}
                type="button"
                className={`bet-type-btn ${betType === value ? 'active' : ''}`}
                onClick={() => {
                  setBetType(value);
                  // Reset chosen number when changing bet type
                  if (value === BetType.UNDER) setChosenNumber(4);
                  else if (value === BetType.OVER) setChosenNumber(3);
                  else setChosenNumber(3);
                }}
                disabled={disabled}
              >
                {BetTypeLabels[value]}
              </button>
            ))}
          </div>
        </div>

        {/* Number Selection (for EXACT, OVER, UNDER) */}
        {needsNumberSelection && (
          <div className="number-section">
            <label>
              {betType === BetType.EXACT ? 'Choose Number' :
               betType === BetType.OVER ? 'Roll Over' : 'Roll Under'}
            </label>
            <div className="number-buttons">
              {getNumberOptions().map(num => (
                <button
                  key={num}
                  type="button"
                  className={`number-btn ${chosenNumber === num ? 'active' : ''}`}
                  onClick={() => setChosenNumber(num)}
                  disabled={disabled}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bet Amount */}
        <div className="amount-section">
          <label>Bet Amount (Tickets) {betAmount && parseFloat(betAmount) > 0 && <span className="usd-value">= ${(parseFloat(betAmount) * 0.10).toFixed(2)} USD</span>}</label>
          <div className="amount-input-wrapper">
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              placeholder={`Min: ${limits?.minBet || '1'}`}
              min={limits?.minBet || '1'}
              max={limits?.maxBet || '10000'}
              step="1"
              disabled={disabled}
            />
            <div className="quick-amounts">
              {[1, 5, 10, 25, 50, 100, 500].map(amount => (
                <button
                  key={amount}
                  type="button"
                  className="quick-amount-btn"
                  onClick={() => setBetAmount(amount.toString())}
                  disabled={disabled}
                >
                  {amount}
                </button>
              ))}
            </div>
          </div>
          {limits && (
            <span className="limit-info">
              Min: {limits.minBet} | Max: {limits.maxBet} tickets (1 ticket = $0.10)
            </span>
          )}
        </div>

        {/* Bet Info */}
        <div className="bet-info">
          <div className="info-row">
            <span>Win Condition:</span>
            <span className="condition">{getWinCondition()}</span>
          </div>
          <div className="info-row">
            <span>Multiplier:</span>
            <span className="multiplier">{getMultiplierDisplay()}</span>
          </div>
          <div className="info-row highlight">
            <span>Potential Payout:</span>
            <span className="payout">{parseFloat(potentialPayout).toFixed(0)} tickets</span>
          </div>
        </div>

        
      </form>
    </div>
  );
}

export default BetControls;
