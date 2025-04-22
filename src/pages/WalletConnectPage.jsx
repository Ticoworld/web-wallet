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
    if (!isConnected) {
      open(); // Use the correct open function from useAppKit
    }
  }, [isConnected, open]);

  const handleDeepLink = () => {
    open(); // Use the unified open method
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white shadow rounded-lg p-6 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4">Connect to Xverse Wallet</h1>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error.message}</div>
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
              Connect with Xverse
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