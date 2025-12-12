import React from 'react';
import { Link } from 'react-router-dom';

// Blue Theme Test Page for SUITRUMP Royale
// Experiment with more Sui-inspired blue colors

const styles = {
  // Color palette options to test
  palette: {
    // Option A: Deep Ocean Blue (Sui-inspired)
    optionA: {
      bgDark: '#0a1628',
      bgCard: '#162035',
      primary: '#4da2ff',
      primaryDark: '#2d7dd2',
      accent: '#7dd3fc',
      accentBright: '#3b82f6',
      text: '#e2e8f0',
      textMuted: '#94a3b8',
      success: '#3b82f6',
      gold: '#fbbf24',
    },
    // Option B: Midnight Teal-Blue (Blend of current + blue)
    optionB: {
      bgDark: '#0c1929',
      bgCard: '#1a2d42',
      primary: '#3b82f6',
      primaryDark: '#0284c7',
      accent: '#67e8f9',
      accentBright: '#22d3ee',
      text: '#f0f9ff',
      textMuted: '#7dd3fc',
      success: '#60a5fa',
      gold: '#fcd34d',
    },
    // Option C: Royal Blue (Rich, casino-like)
    optionC: {
      bgDark: '#0f172a',
      bgCard: '#1e293b',
      primary: '#6366f1',
      primaryDark: '#4f46e5',
      accent: '#a5b4fc',
      accentBright: '#818cf8',
      text: '#f1f5f9',
      textMuted: '#94a3b8',
      success: '#3b82f6',
      gold: '#f59e0b',
    }
  }
};

// Using Option B as the primary test theme
const theme = styles.palette.optionB;

function RoyaleTestPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(180deg, ${theme.bgDark} 0%, #0d1f35 50%, ${theme.bgDark} 100%)`,
      padding: '20px',
      fontFamily: '"Bricolage Grotesque", "Inter", sans-serif',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Theme Selector */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '12px',
          padding: '15px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
          flexWrap: 'wrap',
        }}>
          <span style={{ color: theme.textMuted, fontSize: '0.9rem' }}>
            Theme Test Page - Compare with:
          </span>
          <Link to="/" style={{
            color: theme.accent,
            textDecoration: 'none',
            padding: '8px 16px',
            background: 'rgba(77, 162, 255, 0.1)',
            borderRadius: '6px',
            fontSize: '0.85rem',
          }}>
            Current Theme
          </Link>
        </div>

        {/* Hero Section */}
        <section style={{
          background: `linear-gradient(135deg, ${theme.bgCard} 0%, rgba(77, 162, 255, 0.1) 100%)`,
          border: `2px solid ${theme.primary}`,
          borderRadius: '20px',
          padding: '40px',
          marginBottom: '30px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative glow */}
          <div style={{
            position: 'absolute',
            top: '-50%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '400px',
            height: '400px',
            background: `radial-gradient(circle, ${theme.primary}20 0%, transparent 70%)`,
            pointerEvents: 'none',
          }} />

          <h1 style={{
            fontFamily: '"Dela Gothic One", sans-serif',
            fontSize: '3rem',
            color: theme.primary,
            marginBottom: '10px',
            textShadow: `0 0 40px ${theme.primary}40`,
            position: 'relative',
          }}>
            SUITRUMP Royale
          </h1>
          <p style={{
            color: theme.accent,
            fontSize: '1.2rem',
            marginBottom: '30px',
          }}>
            Provably Fair Gaming on Sui Blockchain
          </p>

          {/* Highlight Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '15px',
            marginTop: '30px',
          }}>
            {[
              { icon: '🏆', value: '50,000', label: 'SUIT Jackpot', color: theme.gold },
              { icon: '💎', value: '5.82x', label: 'Max Payout', color: theme.accent },
              { icon: '⚡', value: 'Instant', label: 'Payouts', color: theme.accentBright },
              { icon: '🔒', value: '100%', label: 'On-Chain', color: theme.success },
            ].map((item, i) => (
              <div key={i} style={{
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '12px',
                padding: '20px 15px',
                border: `1px solid ${theme.primary}30`,
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>{item.icon}</div>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: item.color,
                  marginBottom: '4px',
                }}>{item.value}</div>
                <div style={{
                  fontSize: '0.85rem',
                  color: theme.textMuted,
                }}>{item.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Games Grid */}
        <section style={{ marginBottom: '30px' }}>
          <h2 style={{
            fontFamily: '"Dela Gothic One", sans-serif',
            fontSize: '1.8rem',
            color: theme.text,
            marginBottom: '20px',
            textAlign: 'center',
          }}>
            Game Room
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
          }}>
            {[
              { name: 'Classic Dice', icon: '🎲', desc: 'Roll the dice with multiple bet types', edge: '3%', color: '#3b82f6' },
              { name: 'Progressive', icon: '💰', desc: 'Chase the growing jackpot', edge: '6%', color: '#fbbf24' },
              { name: 'Raffle', icon: '🎟️', desc: 'Weekly draws with big prizes', edge: '6%', color: '#a855f7' },
              { name: 'Slots', icon: '🎰', desc: 'Spin to win with multipliers', edge: '5%', color: '#ef4444' },
              { name: 'Crash', icon: '📈', desc: 'Cash out before it crashes', edge: '4%', color: '#f97316' },
              { name: 'Roulette', icon: '🎡', desc: 'European single zero wheel', edge: '2.7%', color: '#ec4899' },
            ].map((game, i) => (
              <div key={i} style={{
                background: theme.bgCard,
                borderRadius: '16px',
                padding: '25px',
                border: `1px solid ${theme.primary}20`,
                transition: 'all 0.3s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = theme.primary;
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = `0 10px 40px ${theme.primary}20`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = `${theme.primary}20`;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              >
                <div style={{
                  fontSize: '3rem',
                  marginBottom: '15px',
                }}>{game.icon}</div>
                <h3 style={{
                  color: theme.text,
                  fontSize: '1.3rem',
                  marginBottom: '8px',
                  fontWeight: '600',
                }}>{game.name}</h3>
                <p style={{
                  color: theme.textMuted,
                  fontSize: '0.9rem',
                  marginBottom: '15px',
                }}>{game.desc}</p>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '15px',
                  borderTop: `1px solid ${theme.primary}15`,
                }}>
                  <span style={{
                    color: theme.textMuted,
                    fontSize: '0.85rem',
                  }}>House Edge: <span style={{ color: game.color }}>{game.edge}</span></span>
                  <button style={{
                    background: theme.primary,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = theme.primaryDark}
                  onMouseLeave={(e) => e.currentTarget.style.background = theme.primary}
                  >
                    Play
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Stats Bar */}
        <section style={{
          background: theme.bgCard,
          borderRadius: '16px',
          padding: '25px 30px',
          marginBottom: '30px',
          border: `1px solid ${theme.primary}20`,
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '20px',
          }}>
            {[
              { label: 'Total Wagered', value: '1,250,000 SUIT' },
              { label: 'Total Paid Out', value: '1,180,000 SUIT' },
              { label: 'Tokens Burned', value: '25,000 SUIT' },
              { label: 'Active Players', value: '847' },
            ].map((stat, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  color: theme.accent,
                  fontSize: '1.4rem',
                  fontWeight: '700',
                }}>{stat.value}</div>
                <div style={{
                  color: theme.textMuted,
                  fontSize: '0.85rem',
                  marginTop: '4px',
                }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Color Palette Display */}
        <section style={{
          background: theme.bgCard,
          borderRadius: '16px',
          padding: '25px',
          border: `1px solid ${theme.primary}20`,
        }}>
          <h3 style={{
            color: theme.text,
            marginBottom: '20px',
            fontSize: '1.2rem',
          }}>Theme Colors (Option A: Deep Ocean Blue)</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '10px',
          }}>
            {Object.entries(theme).map(([name, color]) => (
              <div key={name} style={{
                background: color,
                padding: '15px 10px',
                borderRadius: '8px',
                textAlign: 'center',
              }}>
                <div style={{
                  color: ['bgDark', 'bgCard', 'primaryDark'].includes(name) ? '#fff' : '#000',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                }}>{name}</div>
                <div style={{
                  color: ['bgDark', 'bgCard', 'primaryDark'].includes(name) ? '#ccc' : '#333',
                  fontSize: '0.65rem',
                  marginTop: '4px',
                  fontFamily: 'monospace',
                }}>{color}</div>
              </div>
            ))}
          </div>

          {/* Other palette options */}
          <h4 style={{ color: theme.textMuted, marginTop: '30px', marginBottom: '15px' }}>
            Alternative Palettes:
          </h4>

          {/* Option B */}
          <div style={{ marginBottom: '20px' }}>
            <p style={{ color: theme.text, fontSize: '0.9rem', marginBottom: '10px' }}>
              Option B: Midnight Teal-Blue
            </p>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {Object.entries(styles.palette.optionB).map(([name, color]) => (
                <div key={name} style={{
                  background: color,
                  width: '40px',
                  height: '40px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.1)',
                }} title={`${name}: ${color}`} />
              ))}
            </div>
          </div>

          {/* Option C */}
          <div>
            <p style={{ color: theme.text, fontSize: '0.9rem', marginBottom: '10px' }}>
              Option C: Royal Blue (Indigo)
            </p>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {Object.entries(styles.palette.optionC).map(([name, color]) => (
                <div key={name} style={{
                  background: color,
                  width: '40px',
                  height: '40px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.1)',
                }} title={`${name}: ${color}`} />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default RoyaleTestPage;
