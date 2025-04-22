// src/WalletConnectPage.jsx

import React, { useEffect, useState } from 'react';
import WalletConnect from '@walletconnect/client';

export default function WalletConnectPage() {
  const [connector, setConnector] = useState(null);
  const [uri, setUri]         = useState('');
  const [error, setError]     = useState('');
  const [address, setAddress] = useState('');

  // Read your web‑wallet URL from env
  const WALLET_URL = import.meta.env.VITE_WALLET_URL;

  useEffect(() => {
    async function initWalletConnect() {
      // Grab any URI passed via query string
      const params   = new URLSearchParams(window.location.search);
      const uriParam = params.get('uri');

      // Create a WalletConnect connector
      const wc = new WalletConnect({
        bridge: 'wss://bridge.walletconnect.org',
        clientMeta: {
          name:        'Stacks Mobile Trader',
          description: 'Secure Stacks Trading',
          url:         WALLET_URL,
          icons:       [`${WALLET_URL}/icon.png`],
        },
      });
      setConnector(wc);

      // If a URI was passed in, use it; otherwise create a new session
      if (uriParam) {
        wc.uri    = uriParam;
        setUri(uriParam);
      } else {
        await wc.createSession();
        setUri(wc.uri);
      }

      // Handle a successful connection
      wc.on('connect', (err, payload) => {
        if (err) {
          setError(`Connection failed: ${err.message}`);
          return;
        }
        // Extract the STX address
        const account    = payload.params[0].accounts[0];
        const stxAddress = account.split(':')[1];
        setAddress(stxAddress);

        // Send it back to the Telegram bot
        if (window.opener) {
          window.opener.postMessage(
            { type: 'WC_SESSION', session: payload },
            '*'  // fallback to wildcard so Telegram in-app browser picks it up
          );
        } else {
          setError(
            'Unable to talk to Telegram. Please return to the bot and try again.'
          );
        }
      });

      wc.on('session_update', () => {
        console.log('Session updated');
      });

      wc.on('disconnect', () => {
        setAddress('');
        setError('Wallet disconnected');
      });
    }

    initWalletConnect();
  }, [WALLET_URL]);

  // Deep‑link into Xverse mobile wallet
  const handleDeepLink = () => {
    if (uri) {
      window.location.href = `https://xverse.app/wc?uri=${encodeURIComponent(
        uri
      )}`;
    }
  };

  // Browser extension fallback
  const handleExtension = () => {
    if (uri) {
      window.location.href = `wc:${uri}`;
    }
  };

  // Copy URI to clipboard
  const handleCopyUri = () => {
    if (uri) {
      navigator.clipboard.writeText(uri);
      alert('WalletConnect URI copied to clipboard! Paste into your wallet.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white shadow rounded-lg p-6 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4">Connect to Xverse Wallet</h1>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
            {error}
          </div>
        )}

        {address ? (
          <div className="bg-green-100 text-green-700 p-3 rounded mb-4">
            <p>
              Connected! Address:{' '}
              <span className="font-mono break-all">{address}</span>
            </p>
            <p className="mt-2">You may now close this window.</p>
          </div>
        ) : (
          <>
            <button
              onClick={handleDeepLink}
              className="w-full bg-blue-600 text-white py-2 rounded mb-3 hover:bg-blue-700 transition"
            >
              Connect with Xverse (Mobile)
            </button>

            <button
              onClick={handleExtension}
              className="w-full bg-blue-600 text-white py-2 rounded mb-3 hover:bg-blue-700 transition"
            >
              Connect via Browser Extension
            </button>

            <button
              onClick={handleCopyUri}
              className="w-full bg-gray-600 text-white py-2 rounded mb-4 hover:bg-gray-700 transition"
            >
              Copy URI to Connect Manually
            </button>

            <p className="text-gray-500 text-sm">
              Alternatively, paste the above URI into any WalletConnect‑compatible
              wallet.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
