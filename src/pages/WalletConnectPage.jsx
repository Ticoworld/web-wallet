import React, { useState, useEffect } from 'react';
import { showConnect } from '@stacks/connect';
import { AppConfig, UserSession } from '@stacks/auth';
import { ErrorBoundary } from 'react-error-boundary';

// Error fallback component
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

// Stacks Connect component
function WalletConnectComponent() {
  const [address, setAddress] = useState(null);
  const [error, setError] = useState(null);

  const appConfig = new AppConfig(['store_write', 'publish_data']);
  const userSession = new UserSession({ appConfig });

  const connectWallet = () => {
    showConnect({
      appDetails: {
        name: 'Stacks Mobile Trader',
        icon: `${window.location.origin}/icon.png`,
      },
      onFinish: async () => {
        try {
          const userData = userSession.loadUserData();
          const stacksAddress = userData.profile.stxAddress.mainnet; // Use .testnet for testnet
          setAddress(stacksAddress);

          // Send address back to bot
          const callback = new URLSearchParams(window.location.search).get('callback');
          if (callback) {
            const response = await fetch(decodeURIComponent(callback), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ address: stacksAddress }),
            });
            if (!response.ok) throw new Error('Failed to notify the bot');
          }
        } catch (err) {
          setError(new Error('Connection failed. Please try again.'));
          console.error('Callback error:', err);
        }
      },
      onCancel: () => {
        setError(new Error('Connection cancelled by user'));
      },
      userSession,
    });
  };

  useEffect(() => {
    if (userSession.isUserSignedIn()) {
      const userData = userSession.loadUserData();
      setAddress(userData.profile.stxAddress.mainnet); // Use .testnet for testnet
    } else {
      connectWallet(); // Auto-trigger on page load
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white shadow rounded-lg p-6 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4">Connect Your Stacks Wallet</h1>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
            {error.message}
          </div>
        )}

        {address ? (
          <div className="bg-green-100 text-green-700 p-3 rounded mb-4">
            <p>
              ✅ Connected! Address:{' '}
              <span className="font-mono break-all">{address}</span>
            </p>
            <p className="mt-2">You can now return to Telegram.</p>
          </div>
        ) : (
          <button
            onClick={connectWallet}
            className="w-full bg-blue-600 text-white py-2 rounded mb-4 hover:bg-blue-700 transition"
          >
            Connect with Xverse/Leather
          </button>
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