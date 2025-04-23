// src/pages/WalletConnectPage.jsx

import React, { useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useAppKit } from '@reown/appkit/react';

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="p-4 bg-red-100 text-red-700 rounded">
      <p>Something went wrong:</p>
      <pre className="mt-2">{error.message}</pre>
      <button
        onClick={resetErrorBoundary}
        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
      >
        Try again
      </button>
    </div>
  );
}

function WalletConnectComponent() {
  // open() will trigger Xverse in-app or desktop WalletConnect flow
  const { open, address, isConnected, error } = useAppKit();

  // Automatically open on page load if not connected
  useEffect(() => {
    if (!isConnected) {
      open();
    }
  }, [isConnected, open]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white shadow-lg rounded-lg p-6 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4">Connect Your Wallet</h1>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
            {escapeMarkdown(error.message)}
          </div>
        )}

        {isConnected && address ? (
          <div className="bg-green-100 text-green-700 p-3 rounded mb-4">
            <p>
              ✅ Connected! Address:{' '}
              <span className="font-mono break-all">{address}</span>
            </p>
            <p className="mt-2">You can now return to Telegram.</p>
          </div>
        ) : (
          <>
            <button
              onClick={open}
              className="w-full bg-blue-600 text-white py-2 rounded mb-4 hover:bg-blue-700 transition"
            >
              Connect Wallet
            </button>
            <p className="text-gray-500 text-sm">
              If nothing happens, click the button above to open your wallet.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function WalletConnectPage() {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()}
    >
      <WalletConnectComponent />
    </ErrorBoundary>
  );
}
