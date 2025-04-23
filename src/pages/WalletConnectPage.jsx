import React, { useEffect } from 'react';
import { useAppKit } from '@reown/appkit/react';
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div role="alert" className="p-4 bg-red-100 text-red-700 rounded">
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
  const { open, address, isConnected, error } = useAppKit();

  useEffect(() => {
    // Check for URI parameter from Telegram bot or other external initiation
    const uri = new URLSearchParams(window.location.search).get('uri');
    if (!isConnected) {
      if (uri) {
        // Handle connection initiated via URI (e.g., from a bot)
        open({ uri, namespace: 'bip122' });
      } else {
        // Open modal for manual connection, targeting Bitcoin wallets
        open({ namespace: 'bip122' });
      }
    }
  }, [isConnected, open]);

  const handleDeepLink = () => {
    // Trigger connection with Bitcoin namespace for Xverse/Leather
    open({ namespace: 'bip122' });
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white shadow rounded-lg p-6 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4">Connect to Bitcoin L2 Wallet</h1>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
            {error.message}
          </div>
        )}

        {isConnected && address ? (
          <div className="bg-green-100 text-green-700 p-3 rounded mb-4">
            <p>
              Connected! Address:{' '}
              <span className="font-mono break-all">{address}</span>
            </p>
          </div>
        ) : (
          <>
            <button
              onClick={handleDeepLink}
              className="w-full bg-blue-600 text-white py-2 rounded mb-3 hover:bg-blue-700 transition"
            >
              Connect with Xverse or Leather
            </button>
            <p className="text-gray-500 text-sm">
              This will open your wallet connection interface
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