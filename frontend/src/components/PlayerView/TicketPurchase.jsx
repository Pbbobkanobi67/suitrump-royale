import React, { useState, useEffect } from 'react';

export function TicketPurchase({ roundInfo, userTickets, buyTickets, loading }) {
  const [suitAmount, setSuitAmount] = useState('5');
  const [ticketAmount, setTicketAmount] = useState('5');
  const [message, setMessage] = useState(null);

  // For now, multiplier is 1:1, but can be fetched from contract
  const multiplier = 1;

  const minTickets = 5;
  const maxTickets = 150;

  useEffect(() => {
    const tickets = parseFloat(suitAmount) * multiplier;
    setTicketAmount(tickets.toString());
  }, [suitAmount, multiplier]);

  const handleBuyTickets = async () => {
    setMessage(null);

    // Validation
    const tickets = parseFloat(ticketAmount);
    if (isNaN(tickets) || tickets < minTickets) {
      setMessage({ type: 'error', text: `Minimum ${minTickets} tickets required` });
      return;
    }

    const currentTickets = parseFloat(userTickets);
    if (currentTickets + tickets > maxTickets) {
      setMessage({ type: 'error', text: `Maximum ${maxTickets} tickets per wallet` });
      return;
    }

    const success = await buyTickets(suitAmount);

    if (success) {
      setMessage({ type: 'success', text: 'Tickets purchased successfully!' });
      setSuitAmount('5');
    } else {
      setMessage({ type: 'error', text: 'Failed to purchase tickets' });
    }
  };

  // Can only buy if round is Waiting or Active
  const canBuy = roundInfo && (roundInfo.statusCode === 0 || roundInfo.statusCode === 1);

  if (!canBuy) {
    return (
      <div className="ticket-purchase">
        <p style={{ textAlign: 'center', color: '#94a3b8' }}>
          Ticket purchases are closed for this round
        </p>
      </div>
    );
  }

  return (
    <div className="ticket-purchase">
      <h3>Buy Tickets</h3>

      <div className="ticket-info">
        <p>💰 Your Current Tickets: <strong>{parseFloat(userTickets).toFixed(0)}</strong></p>
        <p>🎟️ Ticket Ratio: <strong>1 SUIT = {multiplier} Ticket(s)</strong></p>
        <p>📊 Min: {minTickets} | Max: {maxTickets} tickets per wallet</p>
      </div>

      <div className="input-group">
        <label htmlFor="suitAmount">SUIT Amount</label>
        <input
          type="number"
          id="suitAmount"
          value={suitAmount}
          onChange={(e) => setSuitAmount(e.target.value)}
          min={minTickets}
          max={maxTickets - parseFloat(userTickets)}
          step="1"
          disabled={loading}
        />
      </div>

      <div className="input-group">
        <label>You will receive</label>
        <div style={{
          padding: '12px',
          background: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '8px',
          fontSize: '1.2rem',
          fontWeight: 'bold',
          color: '#60a5fa',
        }}>
          {ticketAmount} Tickets
        </div>
      </div>

      {message && (
        <div className={message.type === 'error' ? 'error-message' : 'success-message'}>
          {message.text}
        </div>
      )}

      <button
        className="btn btn-primary"
        onClick={handleBuyTickets}
        disabled={loading || !canBuy}
        style={{ width: '100%', padding: '15px', fontSize: '1.1rem' }}
      >
        {loading ? 'Processing...' : 'Buy Tickets'}
      </button>
    </div>
  );
}
