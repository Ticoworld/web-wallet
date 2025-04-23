import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { createAppKit } from '@reown/appkit/react';
import { BitcoinAdapter } from '@reown/appkit-adapter-bitcoin';
import { bitcoin } from '@reown/appkit/networks';

const projectId = import.meta.env.VITE_PROJECT_ID;

if (!projectId) {
  throw new Error('VITE_PROJECT_ID is not defined in .env');
}

const metadata = {
  name: 'Stacks Mobile Trader',
  description: 'Secure Stacks Trading',
  url: window.location.origin,
  icons: [`${window.location.origin}/icon.png`],
};

const bitcoinAdapter = new BitcoinAdapter({ projectId });

createAppKit({
  adapters: [bitcoinAdapter],
  networks: [bitcoin],
  metadata,
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