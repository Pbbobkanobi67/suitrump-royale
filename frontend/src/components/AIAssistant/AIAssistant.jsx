import React, { useState, useEffect } from 'react';

// Game explanations for non-dice games
const GAME_EXPLANATIONS = {
  progressive: {
    title: 'Progressive Dice',
    description: 'A jackpot game where you roll 4 dice and try to match them all!',
    howToPlay: [
      'Buy a ticket for 100 SUIT tokens',
      'Roll 4 dice simultaneously',
      'Match all 4 dice to win 80% of the jackpot!',
      'Match 3 dice to win 1% of the jackpot',
      'Match 2 or fewer - no win, but the jackpot grows!'
    ],
    tips: [
      'The jackpot grows with every ticket purchased',
      'Odds of matching all 4: about 0.46%',
      'This is a pure chance game - no strategy needed!',
      'Wait for a larger jackpot for bigger potential wins'
    ],
    odds: 'All 4 match: ~0.46% | 3 match: ~7.7%'
  },
  raffle: {
    title: 'SUITRUMP Raffle',
    description: 'A lottery-style game where you buy tickets for a chance to win the prize pool!',
    howToPlay: [
      'Buy raffle tickets (10 SUIT each)',
      'Each ticket is one entry into the drawing',
      'Wait for the draw period to end',
      'If your ticket is drawn, you win the prize pool!'
    ],
    tips: [
      'More tickets = higher chance of winning',
      'Prize pool grows as more people buy tickets',
      'Draws happen regularly - check the countdown!',
      'This is pure luck - every ticket has equal chance'
    ],
    odds: 'Your odds = Your tickets / Total tickets sold'
  },
  default: {
    title: 'SUITRUMP Royale',
    description: 'Welcome to SUITRUMP Royale! Choose a game to get started.',
    howToPlay: [
      'Classic Dice: Bet on dice outcomes with various bet types',
      'Progressive: Roll 4 matching dice to win the jackpot',
      'Raffle: Buy tickets for a chance at the prize pool'
    ],
    tips: [
      'Start with Classic Dice for strategic betting',
      'All games use provably fair blockchain randomness',
      'Only bet what you can afford to lose',
      'Have fun and gamble responsibly!'
    ],
    odds: 'Each game has different odds - check individual games'
  }
};

// Call AI API to analyze user's current bet
const fetchAIAnalysis = async (currentBet, blueBalance, playerStats) => {
  try {
    const response = await fetch('/api/ai-strategy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'analyze',
        balance: blueBalance,
        winRate: playerStats?.winRate || 50,
        recentBets: playerStats?.recentBets || 'None',
        currentBet: {
          betType: currentBet.betTypeName,
          chosenNumber: currentBet.chosenNumber,
          amount: currentBet.betAmount
        }
      }),
    });

    if (!response.ok) {
      throw new Error('API request failed');
    }

    return await response.json();
  } catch (error) {
    console.error('AI API error:', error);
    return null;
  }
};

// Call AI API to suggest a new strategy
const fetchAISuggestion = async (blueBalance, playerStats) => {
  try {
    const timestamp = Date.now();
    const response = await fetch('/api/ai-strategy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify({
        mode: 'suggest',
        balance: blueBalance,
        winRate: playerStats?.winRate || 50,
        recentBets: playerStats?.recentBets || 'None',
        timestamp: timestamp,
      }),
    });

    if (!response.ok) {
      throw new Error('API request failed');
    }

    return await response.json();
  } catch (error) {
    console.error('AI API error:', error);
    return null;
  }
};

// Local fallback analysis
const generateLocalAnalysis = (currentBet, blueBalance) => {
  const balance = parseFloat(blueBalance) || 0;
  const betAmount = parseFloat(currentBet.betAmount) || 0;
  const betType = currentBet.betTypeName || 'Odd';

  let winChance, multiplier, risk;

  if (betType === 'Exact') {
    winChance = 16.67;
    multiplier = '5.82x';
    risk = 'High';
  } else if (betType === 'Over' || betType === 'Under') {
    const num = currentBet.chosenNumber;
    if (betType === 'Over') {
      winChance = ((6 - num) / 6) * 100;
    } else {
      winChance = ((num - 1) / 6) * 100;
    }
    multiplier = 'Variable';
    risk = winChance > 40 ? 'Low' : 'High';
  } else {
    winChance = 50;
    multiplier = '1.94x';
    risk = 'Low';
  }

  const betPercentage = balance > 0 ? (betAmount / balance) * 100 : 0;

  let advice = [];
  let overallRating = 'Good';

  if (betPercentage > 10) {
    advice.push(`Betting ${betPercentage.toFixed(1)}% of your balance is risky. Consider betting 3-5% max.`);
    overallRating = 'Risky';
  } else if (betPercentage > 5) {
    advice.push(`Betting ${betPercentage.toFixed(1)}% is moderate. Safe players bet under 5%.`);
  } else if (betAmount > 0) {
    advice.push(`Good bankroll management at ${betPercentage.toFixed(1)}% of balance.`);
  }

  if (risk === 'High' && betAmount > balance * 0.05) {
    advice.push(`${betType} bets are high risk. Consider smaller amounts.`);
    overallRating = 'Risky';
  } else if (risk === 'Low') {
    advice.push(`${betType} is a safe bet with ~${winChance.toFixed(0)}% win chance.`);
  }

  if (!betAmount || betAmount <= 0) {
    advice = ['Enter a bet amount to get personalized advice.'];
    overallRating = 'Incomplete';
  }

  return {
    mode: 'analyze',
    analysis: advice.join(' '),
    winChance,
    multiplier,
    risk,
    overallRating,
    betType,
    betAmount,
    suggestion: risk === 'High' ? 'Consider Odd/Even for better odds' : null
  };
};

function AIAssistant({ blueBalance, playerStats, onApplyStrategy, currentBet, currentPage }) {
  const [isOpen, setIsOpen] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [isThinking, setIsThinking] = useState(false);
  const [mode, setMode] = useState('analyze'); // 'analyze' or 'suggest'
  const [suggestionKey, setSuggestionKey] = useState(0);
  const [panelSize, setPanelSize] = useState({ width: 380, height: 450 });
  const [panelPosition, setPanelPosition] = useState({ x: window.innerWidth - 400, y: window.innerHeight - 520 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Handle window drag (move)
  const handleDragStart = (e) => {
    if (e.target.closest('.ai-close') || e.target.closest('.mode-btn') || e.target.closest('.btn')) return;
    e.preventDefault();
    setIsDragging(true);
    const startX = e.clientX || e.touches?.[0]?.clientX;
    const startY = e.clientY || e.touches?.[0]?.clientY;
    const startPos = { ...panelPosition };

    const handleDrag = (moveEvent) => {
      const currentX = moveEvent.clientX || moveEvent.touches?.[0]?.clientX;
      const currentY = moveEvent.clientY || moveEvent.touches?.[0]?.clientY;
      const newX = Math.max(0, Math.min(startPos.x + (currentX - startX), window.innerWidth - panelSize.width));
      const newY = Math.max(0, Math.min(startPos.y + (currentY - startY), window.innerHeight - panelSize.height));
      setPanelPosition({ x: newX, y: newY });
    };

    const handleDragEnd = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchmove', handleDrag);
      document.removeEventListener('touchend', handleDragEnd);
    };

    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchmove', handleDrag);
    document.addEventListener('touchend', handleDragEnd);
  };

  // Handle resize from corner (both width and height)
  const handleResizeStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const startX = e.clientX || e.touches?.[0]?.clientX;
    const startY = e.clientY || e.touches?.[0]?.clientY;
    const startSize = { ...panelSize };

    const handleResize = (moveEvent) => {
      const currentX = moveEvent.clientX || moveEvent.touches?.[0]?.clientX;
      const currentY = moveEvent.clientY || moveEvent.touches?.[0]?.clientY;
      const newWidth = Math.max(320, Math.min(startSize.width + (currentX - startX), 600));
      const newHeight = Math.max(300, Math.min(startSize.height + (currentY - startY), window.innerHeight - 50));
      setPanelSize({ width: newWidth, height: newHeight });
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.removeEventListener('touchmove', handleResize);
      document.removeEventListener('touchend', handleResizeEnd);
    };

    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', handleResizeEnd);
    document.addEventListener('touchmove', handleResize);
    document.addEventListener('touchend', handleResizeEnd);
  };

  // Handle vertical-only resize from bottom edge
  const handleVerticalResizeStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const startY = e.clientY || e.touches?.[0]?.clientY;
    const startHeight = panelSize.height;

    const handleResize = (moveEvent) => {
      const currentY = moveEvent.clientY || moveEvent.touches?.[0]?.clientY;
      const newHeight = Math.max(300, Math.min(startHeight + (currentY - startY), window.innerHeight - 50));
      setPanelSize(prev => ({ ...prev, height: newHeight }));
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.removeEventListener('touchmove', handleResize);
      document.removeEventListener('touchend', handleResizeEnd);
    };

    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', handleResizeEnd);
    document.addEventListener('touchmove', handleResize);
    document.addEventListener('touchend', handleResizeEnd);
  };

  // Determine current game context
  const isOnDicePage = currentPage === '/dice';
  const isOnProgressivePage = currentPage === '/progressive';
  const isOnRafflePage = currentPage === '/raffle';
  const isOnGamePage = isOnDicePage || isOnProgressivePage || isOnRafflePage;

  // Get game explanation for current page
  const getGameExplanation = () => {
    if (isOnProgressivePage) return GAME_EXPLANATIONS.progressive;
    if (isOnRafflePage) return GAME_EXPLANATIONS.raffle;
    return GAME_EXPLANATIONS.default;
  };

  // Analyze current bet (Classic Dice only)
  const analyzeCurrentBet = async () => {
    if (!currentBet || !isOnDicePage) return;

    setIsThinking(true);
    const aiAnalysis = await fetchAIAnalysis(currentBet, blueBalance, playerStats);

    if (aiAnalysis && aiAnalysis.analysis) {
      setAnalysis(aiAnalysis);
    } else {
      setAnalysis(generateLocalAnalysis(currentBet, blueBalance));
    }
    setIsThinking(false);
  };

  // Get new strategy suggestion (Classic Dice only)
  const getSuggestion = async () => {
    if (!isOnDicePage) return;

    setIsThinking(true);

    const aiSuggestion = await fetchAISuggestion(blueBalance, playerStats);

    if (aiSuggestion && aiSuggestion.betType) {
      setSuggestion(aiSuggestion);
      setSuggestionKey(prev => prev + 1);
    } else {
      const balance = parseFloat(blueBalance) || 0;
      const betTypes = ['Odd', 'Even', 'Over', 'Under'];
      const randomType = betTypes[Math.floor(Math.random() * betTypes.length)];
      const randomNumber = Math.floor(Math.random() * 5) + 1;

      setSuggestion({
        mode: 'suggest',
        betType: randomType,
        betNumber: ['Over', 'Under'].includes(randomType) ? randomNumber : null,
        suggestedAmount: Math.max(5, Math.min(100, Math.floor(balance * 0.03))),
        odds: randomType === 'Exact' ? '5.82x' : '1.94x',
        winChance: randomType === 'Exact' ? 16.67 : 50,
        risk: randomType === 'Exact' ? 'High' : 'Low',
        reasoning: 'Local suggestion while AI service loads.',
        aiMessage: `Try ${randomType} for a balanced approach!`
      });
      setSuggestionKey(prev => prev + 1);
    }
    setIsThinking(false);
  };

  // Auto-analyze when bet changes (debounced, Classic Dice only)
  useEffect(() => {
    if (isOpen && mode === 'analyze' && isOnDicePage) {
      const timer = setTimeout(() => {
        analyzeCurrentBet();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentBet, isOpen, mode, isOnDicePage]);

  // Initial load based on mode and page
  useEffect(() => {
    if (isOpen && isOnDicePage) {
      if (mode === 'analyze') {
        analyzeCurrentBet();
      } else if (mode === 'suggest') {
        getSuggestion();
      }
    }
  }, [isOpen, mode, isOnDicePage]);

  const handleApply = () => {
    if (suggestion && onApplyStrategy) {
      onApplyStrategy({
        betType: suggestion.betType,
        betNumber: suggestion.betNumber,
        amount: suggestion.suggestedAmount,
      });
    }
  };

  const getRatingColor = (rating) => {
    switch (rating) {
      case 'Good': return 'green';
      case 'Risky': return 'orange';
      case 'Incomplete': return 'gray';
      default: return 'blue';
    }
  };

  const gameExplanation = getGameExplanation();

  return (
    <div className={`ai-assistant ${isOpen ? 'open' : ''}`}>
      <button
        className="ai-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="AI Betting Assistant"
      >
        <span className="ai-icon">🤖</span>
        {!isOpen && <span className="ai-label">AI</span>}
      </button>

      {isOpen && (
        <div
          className={`ai-panel floating ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''}`}
          style={{
            width: panelSize.width,
            height: panelSize.height,
            left: panelPosition.x,
            top: panelPosition.y
          }}
        >
          {/* Draggable header */}
          <div
            className="ai-header draggable"
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
          >
            <h3>🤖 AI Assistant</h3>
            <button className="ai-close" onClick={() => setIsOpen(false)}>×</button>
          </div>

          {/* Mode Toggle - Only show for Classic Dice */}
          {isOnDicePage && (
            <div className="ai-mode-toggle">
              <button
                className={`mode-btn ${mode === 'analyze' ? 'active' : ''}`}
                onClick={() => setMode('analyze')}
              >
                Analyze My Bet
              </button>
              <button
                className={`mode-btn ${mode === 'suggest' ? 'active' : ''}`}
                onClick={() => setMode('suggest')}
              >
                Suggest Strategy
              </button>
            </div>
          )}

          <div className="ai-content">
            {/* NON-DICE PAGES: Show game explanation */}
            {!isOnDicePage ? (
              <div className="game-explanation">
                <h4>{gameExplanation.title}</h4>
                <p className="game-desc">{gameExplanation.description}</p>

                <div className="explanation-section">
                  <h5>How to Play</h5>
                  <ol>
                    {gameExplanation.howToPlay.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>

                <div className="explanation-section">
                  <h5>Tips</h5>
                  <ul>
                    {gameExplanation.tips.map((tip, i) => (
                      <li key={i}>{tip}</li>
                    ))}
                  </ul>
                </div>

                <div className="odds-info">
                  <strong>Odds:</strong> {gameExplanation.odds}
                </div>

                {(isOnProgressivePage || isOnRafflePage) && (
                  <div className="pure-chance-notice">
                    <span className="notice-icon">🎲</span>
                    <p>This is a <strong>pure chance</strong> game. No strategy can improve your odds - just have fun!</p>
                  </div>
                )}
              </div>
            ) : isThinking ? (
              <div className="ai-thinking">
                <div className="thinking-dots">
                  <span></span><span></span><span></span>
                </div>
                <p>{mode === 'analyze' ? 'Analyzing your bet...' : 'Generating strategy...'}</p>
              </div>
            ) : mode === 'analyze' ? (
              /* ANALYZE MODE - Classic Dice */
              analysis ? (
                <>
                  <div className="current-bet-display">
                    <h4>Your Current Bet</h4>
                    <div className="bet-summary">
                      <span className="bet-detail">
                        <strong>Type:</strong> {currentBet?.betTypeName || 'Not set'}
                      </span>
                      {['Exact', 'Over', 'Under'].includes(currentBet?.betTypeName) && (
                        <span className="bet-detail">
                          <strong>Number:</strong> {currentBet?.chosenNumber}
                        </span>
                      )}
                      <span className="bet-detail">
                        <strong>Amount:</strong> {currentBet?.betAmount || '0'} SUIT
                      </span>
                    </div>
                  </div>

                  <div className="analysis-card">
                    <div className="analysis-header">
                      <span className={`rating ${getRatingColor(analysis.overallRating)}`}>
                        {analysis.overallRating}
                      </span>
                      <span className={`risk ${analysis.risk?.toLowerCase()}`}>
                        {analysis.risk} Risk
                      </span>
                    </div>

                    <div className="analysis-stats">
                      <div className="stat-item">
                        <span className="stat-label">Win Chance</span>
                        <span className="stat-value">{analysis.winChance?.toFixed(1)}%</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Multiplier</span>
                        <span className="stat-value">{analysis.multiplier}</span>
                      </div>
                    </div>

                    <div className="win-probability">
                      <div className="prob-bar">
                        <div
                          className="prob-fill"
                          style={{ width: `${analysis.winChance || 0}%` }}
                        ></div>
                      </div>
                    </div>

                    <p className="analysis-text">{analysis.analysis}</p>

                    {analysis.suggestion && (
                      <p className="ai-suggestion">💡 {analysis.suggestion}</p>
                    )}
                  </div>

                  <button className="btn btn-secondary" onClick={analyzeCurrentBet}>
                    🔄 Re-analyze
                  </button>
                </>
              ) : null
            ) : (
              /* SUGGEST MODE - Classic Dice */
              suggestion ? (
                <div key={suggestionKey}>
                  <div className="ai-message">
                    <p>{suggestion.aiMessage}</p>
                  </div>

                  <div className="strategy-card">
                    <div className="strategy-header">
                      <span className={`confidence ${(suggestion.confidence || 'medium').toLowerCase()}`}>
                        {suggestion.confidence || 'Medium'} Confidence
                      </span>
                      <span className={`risk ${(suggestion.risk || 'low').toLowerCase()}`}>
                        {suggestion.risk} Risk
                      </span>
                    </div>

                    <div className="strategy-recommendation">
                      <div className="rec-item">
                        <span className="rec-label">Bet Type</span>
                        <span className="rec-value">{suggestion.betType}</span>
                      </div>
                      {suggestion.betNumber && (
                        <div className="rec-item">
                          <span className="rec-label">Number</span>
                          <span className="rec-value">{suggestion.betNumber}</span>
                        </div>
                      )}
                      <div className="rec-item">
                        <span className="rec-label">Amount</span>
                        <span className="rec-value">{suggestion.suggestedAmount} SUIT</span>
                      </div>
                      <div className="rec-item">
                        <span className="rec-label">Potential</span>
                        <span className="rec-value highlight">{suggestion.odds}</span>
                      </div>
                    </div>

                    <p className="strategy-reasoning">{suggestion.reasoning}</p>

                    <div className="win-probability">
                      <div className="prob-bar">
                        <div
                          className="prob-fill"
                          style={{ width: `${suggestion.winChance}%` }}
                        ></div>
                      </div>
                      <span className="prob-text">{suggestion.winChance?.toFixed(1)}% win chance</span>
                    </div>
                  </div>

                  <div className="ai-actions">
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        getSuggestion();
                      }}
                      type="button"
                    >
                      🔄 New Strategy
                    </button>
                    <button className="btn btn-primary" onClick={handleApply} type="button">
                      ✓ Apply to Bet
                    </button>
                  </div>
                </div>
              ) : null
            )}
          </div>

          <div className="ai-disclaimer">
            ⚠️ For entertainment only. Gambling involves risk.
          </div>

          {/* Bottom edge resize handle for vertical expansion */}
          <div
            className="ai-resize-bottom"
            onMouseDown={handleVerticalResizeStart}
            onTouchStart={handleVerticalResizeStart}
            title="Drag to expand vertically"
          />

          {/* Resize handle at bottom-right corner */}
          <div
            className="ai-resize-corner"
            onMouseDown={handleResizeStart}
            onTouchStart={handleResizeStart}
            title="Drag to resize"
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path d="M10 2L2 10M10 6L6 10M10 10L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

export default AIAssistant;
