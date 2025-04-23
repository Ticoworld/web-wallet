import React, { useEffect, useState, useCallback } from 'react';
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
  const [status, setStatus] = useState('idle'); // idle, checking, connecting, connected, error

  // Detect available wallet providers by ensuring their API exists
  const detectProvider = useCallback(() => {
    if (window.xverseProviders && typeof window.xverseProviders.requestAccounts === 'function') {
      return 'xverse';
    }
    if (window.LeatherProvider && typeof window.LeatherProvider.requestAccounts === 'function') {
      return 'leather';
    }
    return null;
  }, []);

  // Poll for the provider a few times if not immediately available
  const pollForProvider = useCallback(async (tries = 5, delay = 500) => {
    for (let i = 0; i < tries; i++) {
      const provider = detectProvider();
      if (provider) {
        return provider;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    return null;
  }, [detectProvider]);

  // Connect using the detected extension provider if available
  const connectViaExtension = useCallback(async (provider) => {
    try {
      setStatus('connecting');
      if (provider === 'xverse' && window.xverseProviders) {
        const accounts = await window.xverseProviders.requestAccounts();
        if (accounts && accounts.length > 0) {
          setStatus('connected');
          return accounts[0];
        }
      }
      if (provider === 'leather' && window.LeatherProvider) {
        const accounts = await window.LeatherProvider.requestAccounts();
        if (accounts && accounts.length > 0) {
          setStatus('connected');
          return accounts[0];
        }
      }
    } catch (err) {
      console.error('Extension connection error:', err);
      setStatus('error');
    }
    return null;
  }, []);

  useEffect(() => {
    const attemptAutoConnect = async () => {
      if (isConnected) return;
      setStatus('checking');
      
      // Poll for a provider to be available
      const provider = await pollForProvider();
      if (provider) {
        const account = await connectViaExtension(provider);
        if (account) return;
      }
      // Fallback to using the open() method for a deep-link or connection interface
      await open();
    };

    attemptAutoConnect();
  }, [isConnected, open, pollForProvider, connectViaExtension]);

  const handleDeepLink = async () => {
    await open();
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white shadow rounded-lg p-6 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4">Connect to Xverse Wallet</h1>
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
            {error.message}
          </div>
        )}
        {isConnected && address ? (
          <div className="bg-green-100 text-green-700 p-3 rounded mb-4">
            <p>
              Connected! Address: <span className="font-mono break-all">{address}</span>
            </p>
          </div>
        ) : (
          <>
            <button
              onClick={handleDeepLink}
              className="w-full bg-blue-600 text-white py-2 rounded mb-3 hover:bg-blue-700 transition"
              disabled={status === 'connecting' || status === 'checking'}
            >
              {status === 'connecting' || status === 'checking'
                ? 'Connecting...'
                : 'Connect with Xverse'}
            </button>
            <p className="text-gray-500 text-sm">
              Using Chrome with Xverse or Leather extension provides the best experience.
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