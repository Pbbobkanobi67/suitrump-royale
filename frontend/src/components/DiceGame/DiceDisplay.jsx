import React, { useState, useEffect } from 'react';

const DICE_FACES = {
  1: [
    [0, 0, 0],
    [0, 1, 0],
    [0, 0, 0]
  ],
  2: [
    [1, 0, 0],
    [0, 0, 0],
    [0, 0, 1]
  ],
  3: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1]
  ],
  4: [
    [1, 0, 1],
    [0, 0, 0],
    [1, 0, 1]
  ],
  5: [
    [1, 0, 1],
    [0, 1, 0],
    [1, 0, 1]
  ],
  6: [
    [1, 0, 1],
    [1, 0, 1],
    [1, 0, 1]
  ]
};

function DiceDisplay({ value, rolling, size = 'large' }) {
  const [displayValue, setDisplayValue] = useState(value || 1);

  useEffect(() => {
    if (rolling) {
      const interval = setInterval(() => {
        setDisplayValue(Math.floor(Math.random() * 6) + 1);
      }, 100);
      return () => clearInterval(interval);
    } else if (value) {
      setDisplayValue(value);
    }
  }, [rolling, value]);

  const face = DICE_FACES[displayValue];
  const sizeClass = size === 'small' ? 'dice-small' : 'dice-large';

  return (
    <div className={`dice ${sizeClass} ${rolling ? 'rolling' : ''}`}>
      <div className="dice-face">
        {face.map((row, rowIndex) => (
          <div key={rowIndex} className="dice-row">
            {row.map((dot, dotIndex) => (
              <div
                key={dotIndex}
                className={`dice-dot ${dot ? 'visible' : ''}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default DiceDisplay;
