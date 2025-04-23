import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { createAppKit } from '@reown/appkit/react';
import { BitcoinAdapter } from '@reown/appkit-adapter-bitcoin';
import { bitcoin } from '@reown/appkit/networks';

// Load project ID from environment variables
const projectId = import.meta.env.VITE_PROJECT_ID;

if (!projectId) {
  throw new Error('VITE_PROJECT_ID is not defined in .env');
}

// Dynamic metadata based on current origin
const rootUrl = window.location.origin;
const metadata = {
  name: 'Stacks Mobile Trader',
  description: 'Secure Stacks Trading',
  url: rootUrl,
  icons: [`${rootUrl}/icon.png`],
};

// Configure Bitcoin Adapter
const bitcoinAdapter = new BitcoinAdapter({
  projectId,
});

// Initialize AppKit with Bitcoin network and adapter
createAppKit({
  adapters: [bitcoinAdapter],
  networks: [bitcoin],
  metadata,
  projectId,
  features: {
    analytics: true, // Optional, defaults to Cloud configuration
    email: false,
    socials: [],
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);