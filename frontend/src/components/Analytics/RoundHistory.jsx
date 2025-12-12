import React, { useState, useEffect } from 'react';
// TODO: Replace ethers with Sui SDK

const STATUS_NAMES = {
  0: 'Waiting',
  1: 'Active',
  2: 'Drawing',
  3: 'Complete',
  4: 'Cancelled',
};

export function RoundHistory({ contract, account }) {
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [debugInfo, setDebugInfo] = useState(null);
  const roundsPerPage = 10;

  useEffect(() => {
    if (contract) {
      loadRoundHistory();
    }
  }, [contract, page]);

  const loadRoundHistory = async () => {
    if (!contract) return;

    try {
      setLoading(true);
      console.log('🔍 RoundHistory: Starting to load round history...');

      const currentRoundId = await contract.currentRoundId();
      const currentRoundNum = Number(currentRoundId);
      const total = currentRoundNum - 1; // Exclude current round

      console.log(`📊 RoundHistory: Current round is #${currentRoundNum}, checking ${total} completed rounds`);

      if (total <= 0) {
        console.log('⚠️ RoundHistory: No completed rounds found');
        setRounds([]);
        setDebugInfo('No completed rounds yet (current round is #1)');
        setLoading(false);
        return;
      }

      // Calculate which rounds to fetch for this page
      const startRound = Math.max(1, total - (page * roundsPerPage) + 1);
      const endRound = Math.min(total, total - ((page - 1) * roundsPerPage));

      console.log(`📄 RoundHistory: Page ${page} - Checking rounds ${startRound} to ${endRound}`);

      const roundsData = [];
      const statusCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
      const errors = [];

      for (let i = endRound; i >= startRound; i--) {
        try {
          console.log(`🔎 RoundHistory: Fetching round #${i}...`);
          const details = await contract.getRoundDetails(i);

          const status = Number(details.status);
          const statusName = STATUS_NAMES[status] || 'Unknown';
          statusCounts[status]++;

          console.log(`  ✓ Round #${i}: Status=${status} (${statusName}), Winner=${details.winner}, Prize=${ethers.formatEther(details.winnerPrize)} SUIT`);

          // Show completed rounds (status 3) AND cancelled rounds with winners (status 4)
          if (status === 3 || (status === 4 && details.winner !== ethers.ZeroAddress)) {
            // Try to get participants, but don't fail if it errors
            let participantCount = 0;
            try {
              const participants = await contract.getRoundParticipants(i);
              participantCount = participants.length;
              console.log(`  ✓ Round #${i}: ${participantCount} participants`);
            } catch (participantErr) {
              console.warn(`  ⚠️ Round #${i}: Could not fetch participants (${participantErr.message}), using 0`);
              participantCount = 0; // Fallback to 0 if getRoundParticipants fails
            }

            // Try to get transaction hash from WinnerSelected event
            let transactionHash = null;
            try {
              const roundData = await contract.rounds(i);
              const drawRequestBlock = Number(roundData.drawRequestBlock);
              if (drawRequestBlock > 0) {
                const fromBlock = drawRequestBlock;
                const toBlock = drawRequestBlock + 1000;
                const filter = contract.filters.WinnerSelected(i);
                const events = await contract.queryFilter(filter, fromBlock, toBlock);
                if (events.length > 0) {
                  transactionHash = events[0].transactionHash;
                  console.log(`  ✓ Round #${i}: Transaction hash ${transactionHash}`);
                }
              }
            } catch (txErr) {
              console.warn(`  ⚠️ Round #${i}: Could not fetch transaction hash (${txErr.message})`);
            }

            roundsData.push({
              roundId: i,
              winner: details.winner,
              prize: ethers.formatEther(details.winnerPrize),
              totalTickets: ethers.formatEther(details.totalTickets),
              participants: participantCount,
              isUserWinner: account && details.winner.toLowerCase() === account.toLowerCase(),
              randomSeed: details.randomSeed.toString(),
              status: statusName,
              isCancelled: status === 4,
              transactionHash: transactionHash,
            });
          } else {
            console.log(`  ⊘ Round #${i}: Skipped (status ${status} - ${statusName})`);
          }
        } catch (err) {
          const errorMsg = `Round #${i}: ${err.message}`;
          console.error(`❌ RoundHistory: Error loading ${errorMsg}`, err);
          errors.push(errorMsg);
        }
      }

      console.log(`📊 RoundHistory: Status breakdown:`, statusCounts);
      console.log(`✅ RoundHistory: Loaded ${roundsData.length} displayable rounds`);

      if (errors.length > 0) {
        console.warn(`⚠️ RoundHistory: ${errors.length} errors occurred:`, errors);
      }

      // Set debug info
      const debugMsg = `Scanned rounds ${startRound}-${endRound}. Status counts: ${Object.entries(statusCounts).map(([s, c]) => `${STATUS_NAMES[s]}=${c}`).join(', ')}. Found ${roundsData.length} displayable rounds.${errors.length > 0 ? ` Errors: ${errors.length}` : ''}`;
      setDebugInfo(debugMsg);

      setRounds(roundsData);
    } catch (err) {
      console.error('❌ RoundHistory: Error loading round history:', err);
      setDebugInfo(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && rounds.length === 0) {
    return (
      <div className="history-card">
        <h3>📜 Round History</h3>
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading round history...</p>
          {debugInfo && (
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '10px' }}>
              {debugInfo}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (rounds.length === 0) {
    return (
      <div className="history-card">
        <h3>📜 Round History</h3>
        <p style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
          No completed rounds found.
        </p>
        {debugInfo && (
          <div style={{
            padding: '15px',
            background: 'rgba(100, 116, 139, 0.1)',
            borderRadius: '8px',
            marginTop: '20px',
            fontSize: '0.85rem',
            color: '#94a3b8'
          }}>
            <strong>Debug Info:</strong><br />
            {debugInfo}
            <br /><br />
            <em>Check browser console for detailed logs</em>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="history-card">
      <h3>📜 Round History</h3>

      {debugInfo && (
        <div style={{
          padding: '10px',
          background: 'rgba(34, 197, 94, 0.1)',
          borderRadius: '6px',
          marginBottom: '20px',
          fontSize: '0.8rem',
          color: '#86efac'
        }}>
          {debugInfo}
        </div>
      )}

      <div className="round-history-list">
        {rounds.map((round) => (
          <div
            key={round.roundId}
            className={`history-item ${round.isUserWinner ? 'history-item-winner' : ''} ${round.isCancelled ? 'history-item-cancelled' : ''}`}
            style={{ padding: '12px 16px', marginBottom: '10px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#60a5fa' }}>
                  Round #{round.roundId}
                </span>
                {round.isCancelled && <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>(Cancelled)</span>}
                {round.isUserWinner && <span style={{ fontSize: '0.85rem', color: '#10b981' }}>🏆 You Won!</span>}
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#10b981' }}>
                {parseFloat(round.prize).toFixed(2)} SUIT
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: '#94a3b8' }}>Winner: </span>
                <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>
                  {round.winner.slice(0, 6)}...{round.winner.slice(-4)}
                </span>
              </div>

              <div>
                <span style={{ color: '#94a3b8' }}>Tickets: </span>
                <span style={{ color: '#e2e8f0' }}>{parseFloat(round.totalTickets).toFixed(0)}</span>
              </div>

              <div>
                <span style={{ color: '#94a3b8' }}>Players: </span>
                <span style={{ color: '#e2e8f0' }}>
                  {round.participants > 0 ? round.participants : 'N/A'}
                </span>
              </div>

              {round.transactionHash && (
                <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
                  <span style={{ color: '#94a3b8' }}>TX: </span>
                  <span
                    style={{
                      color: '#60a5fa',
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      wordBreak: 'break-all',
                      userSelect: 'all'
                    }}
                  >
                    {round.transactionHash}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="pagination">
        <button
          className="btn btn-secondary"
          onClick={() => setPage(p => p + 1)}
          disabled={loading}
        >
          ← Older
        </button>
        <span style={{ margin: '0 20px', color: '#94a3b8' }}>Page {page}</span>
        <button
          className="btn btn-secondary"
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1 || loading}
        >
          Newer →
        </button>
      </div>
    </div>
  );
}
