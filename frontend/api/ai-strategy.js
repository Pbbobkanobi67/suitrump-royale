// Vercel Serverless Function - AI Strategy Generator using Groq
// Supports two modes: 'analyze' (analyze current bet) and 'suggest' (suggest new strategy)

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  if (!GROQ_API_KEY) {
    console.error('GROQ_API_KEY not configured');
    return res.status(500).json({ error: 'AI service not configured' });
  }

  try {
    const { mode, balance, recentBets, winRate, currentBet } = req.body;

    let systemPrompt, userPrompt;

    if (mode === 'analyze') {
      // ANALYZE MODE - Analyze the user's current bet
      const betAmount = parseFloat(currentBet?.amount) || 0;
      const playerBalance = parseFloat(balance) || 0;
      const betType = currentBet?.betType || 'Odd';
      const betPercentage = playerBalance > 0 ? ((betAmount / playerBalance) * 100).toFixed(1) : 0;

      // Calculate actual odds based on bet type
      let winChance, multiplier, riskLevel;
      if (betType === 'Exact') {
        winChance = 16.67;
        multiplier = '5.82x';
        riskLevel = 'High';
      } else if (betType === 'Odd' || betType === 'Even') {
        winChance = 50;
        multiplier = '1.94x';
        riskLevel = 'Low';
      } else if (betType === 'Over') {
        const num = parseInt(currentBet?.chosenNumber) || 3;
        winChance = ((6 - num) / 6 * 100).toFixed(1);
        multiplier = ((6 * 0.97) / (6 - num)).toFixed(2) + 'x';
        riskLevel = (6 - num) >= 3 ? 'Low' : 'High';
      } else if (betType === 'Under') {
        const num = parseInt(currentBet?.chosenNumber) || 4;
        winChance = ((num - 1) / 6 * 100).toFixed(1);
        multiplier = ((6 * 0.97) / (num - 1)).toFixed(2) + 'x';
        riskLevel = (num - 1) >= 3 ? 'Low' : 'High';
      } else {
        winChance = 50;
        multiplier = '1.94x';
        riskLevel = 'Low';
      }

      // Determine rating based on bet percentage of balance
      let overallRating = 'Good';
      let analysis = '';

      if (betAmount <= 0) {
        overallRating = 'Incomplete';
        analysis = 'Enter a bet amount to get analysis.';
      } else if (betPercentage > 20) {
        overallRating = 'Risky';
        analysis = `Betting ${betPercentage}% of your balance is very aggressive. Consider smaller bets to last longer.`;
      } else if (betPercentage > 10 && riskLevel === 'High') {
        overallRating = 'Risky';
        analysis = `High risk bet with ${betPercentage}% of balance. ${betType} has only ${winChance}% win chance.`;
      } else if (riskLevel === 'High') {
        overallRating = 'Good';
        analysis = `${betType} is high risk but your bet size (${betPercentage}% of balance) is reasonable.`;
      } else {
        overallRating = 'Good';
        analysis = `Solid ${betType} bet with ${winChance}% win chance. Good bankroll management.`;
      }

      // Generate suggestion
      let suggestion = null;
      if (riskLevel === 'High' && betPercentage > 5) {
        suggestion = 'Consider Odd/Even for safer 50/50 odds';
      } else if (betPercentage > 15) {
        suggestion = 'Smaller bets help you play longer';
      }

      // Return pre-calculated response (skip AI call for analyze mode)
      return res.status(200).json({
        mode: 'analyze',
        analysis,
        winChance: parseFloat(winChance),
        multiplier,
        risk: riskLevel,
        overallRating,
        suggestion
      });

    } else {
      // SUGGEST MODE - Suggest a new strategy (original behavior)
      // Force variety by randomly pre-selecting bet type categories
      const betTypeOptions = ['Odd', 'Even', 'Exact', 'Over', 'Under'];
      const forcedBetType = betTypeOptions[Math.floor(Math.random() * betTypeOptions.length)];
      const forcedNumber = Math.floor(Math.random() * 6) + 1; // 1-6
      const playerBalance = parseFloat(balance) || 100;
      const suggestedBet = Math.max(5, Math.min(Math.floor(playerBalance * 0.05), 50));

      systemPrompt = `You are an AI betting assistant for Blue Casino dice game.

CRITICAL INSTRUCTION: You MUST suggest "${forcedBetType}" as the bet type for this response.
${['Exact', 'Over', 'Under'].includes(forcedBetType) ? `Use number ${forcedNumber} for the betNumber.` : ''}

Bet types and payouts:
- Exact (1-6): 5.82x payout, 16.67% win chance, HIGH RISK
- Odd: 1.94x payout, 50% win chance, SAFE
- Even: 1.94x payout, 50% win chance, SAFE
- Over X: Variable payout based on X, VARIABLE RISK
- Under X: Variable payout based on X, VARIABLE RISK

House edge: 3%. Suggest betting 3-5% of balance (around ${suggestedBet} BLUE).

Respond with ONLY valid JSON:
{
  "betType": "${forcedBetType}",
  "betNumber": ${['Exact', 'Over', 'Under'].includes(forcedBetType) ? forcedNumber : 'null'},
  "suggestedAmount": ${suggestedBet},
  "reasoning": "brief explanation for ${forcedBetType}",
  "confidence": "High|Medium|Low",
  "risk": "${forcedBetType === 'Exact' ? 'High' : forcedBetType === 'Odd' || forcedBetType === 'Even' ? 'Low' : 'Medium'}",
  "aiMessage": "fun message about ${forcedBetType}"
}`;

      userPrompt = `Generate a ${forcedBetType} bet suggestion for a player with ${playerBalance} BLUE balance. Make your aiMessage fun and unique!`;
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.9,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API error:', errorText);
      return res.status(500).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content;

    if (!aiResponse) {
      return res.status(500).json({ error: 'No response from AI' });
    }

    // Parse the JSON response from the AI
    try {
      // Clean up the response - remove any markdown code blocks if present
      let cleanResponse = aiResponse.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.slice(7);
      }
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.slice(3);
      }
      if (cleanResponse.endsWith('```')) {
        cleanResponse = cleanResponse.slice(0, -3);
      }
      cleanResponse = cleanResponse.trim();

      const result = JSON.parse(cleanResponse);

      if (mode === 'analyze') {
        // Validate analyze response
        return res.status(200).json({
          mode: 'analyze',
          analysis: result.analysis || 'Unable to analyze bet.',
          winChance: result.winChance || 50,
          multiplier: result.multiplier || '1.94x',
          risk: result.risk || 'Medium',
          overallRating: result.overallRating || 'Good',
          suggestion: result.suggestion || null
        });
      } else {
        // Validate suggest response
        const validBetTypes = ['Odd', 'Even', 'Exact', 'Over', 'Under'];
        if (!validBetTypes.includes(result.betType)) {
          result.betType = 'Odd';
        }

        if (result.betNumber !== null) {
          result.betNumber = Math.max(1, Math.min(6, parseInt(result.betNumber) || 3));
        }

        result.suggestedAmount = Math.max(1, Math.min(100, parseInt(result.suggestedAmount) || 5));

        // Add odds info
        const oddsMap = {
          'Exact': { odds: '5.82x', winChance: 16.67 },
          'Odd': { odds: '1.94x', winChance: 50 },
          'Even': { odds: '1.94x', winChance: 50 },
          'Over': { odds: '1.94x', winChance: 50 },
          'Under': { odds: '1.94x', winChance: 50 },
        };

        result.odds = oddsMap[result.betType]?.odds || '1.94x';
        result.winChance = oddsMap[result.betType]?.winChance || 50;
        result.mode = 'suggest';

        return res.status(200).json(result);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse, parseError);
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }
  } catch (error) {
    console.error('AI Strategy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
