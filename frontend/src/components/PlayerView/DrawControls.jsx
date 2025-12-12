import React, { useState, useEffect } from 'react';

export function DrawControls({ roundInfo, requestDraw, executeDraw, canRequestDraw, canExecuteDraw, loading, contract, signer }) {
  const [drawStatus, setDrawStatus] = useState({ canRequest: false, canExecute: false, reason: '' });

  useEffect(() => {
    const checkDrawStatus = async () => {
      if (roundInfo?.statusCode === 1) {
        const requestStatus = await canRequestDraw();
        setDrawStatus({ ...requestStatus, canExecute: false });
      } else if (roundInfo?.statusCode === 2) {
        const executeStatus = await canExecuteDraw();
        setDrawStatus({ canRequest: false, ...executeStatus });
      } else {
        setDrawStatus({ canRequest: false, canExecute: false, reason: 'Round not ready' });
      }
    };

    checkDrawStatus();
    const interval = setInterval(checkDrawStatus, 3000);
    return () => clearInterval(interval);
  }, [roundInfo, canRequestDraw, canExecuteDraw]);

  const handleRequestDraw = async () => {
    const success = await requestDraw();
    if (success) {
      console.log('Draw requested successfully!');
    }
  };

  const handleExecuteDraw = async () => {
    const success = await executeDraw();
    if (success) {
      console.log('Draw executed successfully!');
    }
  };

  const handleCancelRound = async () => {
    if (!contract || !signer) return;

    try {
      setDrawStatus({ ...drawStatus, reason: 'Cancelling round...' });
      const tx = await contract.cancelRound();
      await tx.wait();
      console.log('Round cancelled successfully!');
      window.location.reload(); // Refresh the page
    } catch (err) {
      console.error('Error cancelling round:', err);
      alert(`Failed to cancel round: ${err.message}`);
    }
  };

  // Check if draw has expired
  const isDrawExpired = roundInfo?.statusCode === 2 && drawStatus.reason &&
    (drawStatus.reason.includes('expired') || drawStatus.reason.includes('Expired'));

  // Only show if round is Active or Drawing
  if (!roundInfo || (roundInfo.statusCode !== 1 && roundInfo.statusCode !== 2)) {
    return null;
  }

  return (
    <div className="raffle-card" style={{ marginTop: '20px' }}>
      <h3>Draw Controls</h3>

      {/* Show expired draw warning */}
      {isDrawExpired && (
        <div style={{
          padding: '15px',
          marginBottom: '15px',
          backgroundColor: '#7f1d1d',
          border: '1px solid #dc2626',
          borderRadius: '8px',
          color: '#fca5a5'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>⚠️ Draw Request Expired</p>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem' }}>
            The draw request has expired and cannot be executed.
            An admin must cancel this round before starting a new round.
          </p>
          <button
            className="btn btn-secondary"
            onClick={handleCancelRound}
            style={{ marginTop: '10px', width: '100%' }}
          >
            Cancel This Round (Admin Only)
          </button>
        </div>
      )}

      {roundInfo.statusCode === 1 && (
        <div>
          <p style={{ marginBottom: '15px', color: '#94a3b8' }}>
            {drawStatus.canRequest ? '✅ Ready to request draw!' : `⏳ ${drawStatus.reason}`}
          </p>
          <button
            className="btn btn-primary"
            onClick={handleRequestDraw}
            disabled={!drawStatus.canRequest || loading}
            style={{ width: '100%', padding: '15px' }}
          >
            {loading ? 'Processing...' : 'Request Draw (Step 1)'}
          </button>
        </div>
      )}

      {roundInfo.statusCode === 2 && (
        <div>
          <p style={{ marginBottom: '15px', color: '#94a3b8' }}>
            {drawStatus.canExecute ? '✅ Ready to execute draw!' : `⏳ ${drawStatus.reason}`}
          </p>
          <button
            className="btn btn-success"
            onClick={handleExecuteDraw}
            disabled={!drawStatus.canExecute || loading || isDrawExpired}
            style={{ width: '100%', padding: '15px' }}
          >
            {loading ? 'Processing...' : isDrawExpired ? 'Draw Expired - Cannot Execute' : 'Execute Draw (Step 2)'}
          </button>
          <p style={{ marginTop: '10px', fontSize: '0.9rem', color: '#f59e0b' }}>
            ⚠️ Must wait 2 blocks after requesting draw
          </p>
        </div>
      )}
    </div>
  );
}
