import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { SuiWalletProvider } from './contexts/SuiWalletContext.jsx';
import App from './App.jsx';
import '@mysten/dapp-kit/dist/index.css';
import './styles/raffle.css';
import './styles/dice.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SuiWalletProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </SuiWalletProvider>
  </React.StrictMode>
);
