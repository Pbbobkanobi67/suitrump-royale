import React, { memo } from 'react';

// Pure CSS static dice - no WebGL, no flashing, completely stable
const DICE_DOTS = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]]
};

const StaticDice3D = memo(function StaticDice3D({ value, size = 100 }) {
  const dots = DICE_DOTS[value] || DICE_DOTS[1];
  const dotSize = size / 5;
  const padding = size / 6;

  return (
    <div
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(145deg, #1e3a5f 0%, #0f172a 100%)',
        border: '3px solid #3b82f6',
        borderRadius: size / 8,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(3, 1fr)',
        padding: padding,
        boxSizing: 'border-box',
        margin: '0.5rem auto',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)'
      }}
    >
      {[0, 1, 2].map(row =>
        [0, 1, 2].map(col => {
          const hasDot = dots.some(([r, c]) => r === row && c === col);
          return (
            <div
              key={`${row}-${col}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {hasDot && (
                <div
                  style={{
                    width: dotSize,
                    height: dotSize,
                    background: 'radial-gradient(circle at 30% 30%, #ffffff, #e0e0e0)',
                    borderRadius: '50%',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3), inset 0 -1px 2px rgba(0,0,0,0.2)'
                  }}
                />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if value or size changes
  return prevProps.value === nextProps.value && prevProps.size === nextProps.size;
});

export default StaticDice3D;
