import React from 'react';
import Dice3D from '../DiceGame/Dice3D';

function TargetDice({ targetDice, loading }) {
  const isRevealed = targetDice?.isRevealed;
  // Only need new target when no round exists (roundId is 0 or undefined)
  const needsNewTarget = !targetDice || !targetDice.roundId;
  // Waiting for reveal when roundId exists but not yet revealed
  const waitingForReveal = targetDice?.roundId > 0 && !isRevealed;

  return (
    <div className="target-dice-section">
      <h3>Target Dice - Round #{targetDice?.roundId || 0}</h3>

      <div className="target-dice-display">
        {isRevealed && targetDice ? (
          <div className="dice-row-4">
            <Dice3D targetValue={targetDice.die1} size={110} />
            <Dice3D targetValue={targetDice.die2} size={110} />
            <Dice3D targetValue={targetDice.die3} size={110} />
            <Dice3D targetValue={targetDice.die4} size={110} />
          </div>
        ) : (
          <div className="dice-row-4 unrevealed">
            <div className="dice-placeholder medium">?</div>
            <div className="dice-placeholder medium">?</div>
            <div className="dice-placeholder medium">?</div>
            <div className="dice-placeholder medium">?</div>
          </div>
        )}
      </div>

      {needsNewTarget && (
        <div className="target-status">
          <p className="waiting-message">
            {loading ? 'Setting up new round...' : 'Waiting for new round to start...'}
          </p>
        </div>
      )}

      {waitingForReveal && (
        <div className="target-status">
          <p className="waiting-message">
            {loading ? 'Revealing target...' : 'Target set, waiting for reveal...'}
          </p>
        </div>
      )}

      {isRevealed && (
        <p className="target-hint">
          Match all 4 dice to win the jackpot!
        </p>
      )}
    </div>
  );
}

export default TargetDice;
