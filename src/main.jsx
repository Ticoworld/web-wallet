import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { createAppKit } from '@reown/appkit/react';
import { BitcoinAdapter } from '@reown/appkit-adapter-bitcoin';
import { bitcoin } from '@reown/appkit/networks';

// Load your project ID from .env
const projectId = import.meta.env.VITE_PROJECT_ID;

if (!projectId) {
  throw new Error('VITE_PROJECT_ID is not defined in .env');
}

// Metadata
// Update metadata configuration
const metadata = {
  name: 'Stacks Mobile Trader',
  description: 'Secure Stacks Trading',
  url: window.location.origin, // Dynamic origin
  icons: [`${window.location.origin}/icon.png`], // Dynamic icon path
};

// Bitcoin Adapter
const bitcoinAdapter = new BitcoinAdapter({
  projectId,
});

const rootUrl = window.location.origin;

// Initialize AppKit
createAppKit({
  adapters: [bitcoinAdapter],
  networks: [bitcoin],
  metadata: {
    name: 'Stacks Mobile Trader',
    description: 'Secure Stacks Trading',
    url: rootUrl,
    icons: [`${rootUrl}/icon.png`],
  },
  projectId,
  features: {
    analytics: true,
    email: false,
    socials: [],
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);