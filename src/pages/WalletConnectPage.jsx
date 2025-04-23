import React, { useEffect, useState } from 'react';
import { useAppKit } from '@reown/appkit/react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode.react';

function WalletConnectComponent() {
  const { open, connect, address, isConnected, error } = useAppKit();
  const [searchParams] = useSearchParams();
  const uri = searchParams.get('uri');
  const [connectionStatus, setConnectionStatus] = useState('idle');

  // Detect Xverse or Leather provider in the browser
  const detectWalletProvider = () => {
    if (window.xverseProviders) {
      return 'xverse';
    } else if (window.LeatherProvider) {
      return 'leather';
    }
    return null;
  };

  // Attempt to connect directly via extension provider
  const connectViaExtension = async (providerType) => {
    try {
      setConnectionStatus('connecting');
      if (providerType === 'xverse' && window.xverseProviders) {
        const accounts = await window.xverseProviders.requestAccounts();
        if (accounts && accounts.length > 0) {
          setConnectionStatus('connected');
          return accounts[0];
        }
      } else if (providerType === 'leather' && window.LeatherProvider) {
        // Leather-specific connection (adjust based on actual API)
        const accounts = await window.LeatherProvider.requestAccounts();
        if (accounts && accounts.length > 0) {
          setConnectionStatus('connected');
          return accounts[0];
        }
      }
    } catch (err) {
      console.error('Extension connection failed:', err);
      setConnectionStatus('error');
    }
    return null;
  };

  useEffect(() => {
    const attemptConnection = async () => {
      if (isConnected) return;

      setConnectionStatus('checking');

      // Check for extension providers first
      const providerType = detectWalletProvider();
      if (providerType) {
        const account = await connectViaExtension(providerType);
        if (account) return;
      }

      // If URI is provided (from Telegram), use it
      if (uri) {
        setConnectionStatus('waiting');
        // AppKit doesn't directly support passing a URI, so we guide the user
        return;
      }

      // Fallback to AppKit modal for manual selection
      setConnectionStatus('opening');
      await open();
    };

    attemptConnection();
  }, [isConnected, open, uri]);

  // Handle manual connection button click
  const handleConnect = async () => {
    const providerType = detectWalletProvider();
    if (providerType) {
      await connectViaExtension(providerType);
    } else {
      await open();
    }
  };

  // Render based on URI or normal flow
  if (uri) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white shadow rounded-lg p-6 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-4">Connect Your Wallet</h1>
          <p className="mb-4">Scan this QR code with your Xverse or Leather app:</p>
          <QRCode value={uri} size={256} />
          <p className="mt-4">Or open your wallet app:</p>
          <a
            href={`https://connect.xverse.app/browser?url=${encodeURIComponent(window.location.href)}`}
            className="text-blue-600 hover:underline mr-4"
          >
            Xverse
          </a>
          <a
            href={`leather://connect?uri=${encodeURIComponent(uri)}`}
            className="text-blue-600 hover:underline"
          >
            Leather
          </a>
          <p className="mt-4 text-gray-500 text-sm">
            After approving in your wallet, the connection should complete.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white shadow rounded-lg p-6 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4">Connect to Xverse or Leather</h1>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
            Error: {error.message}
          </div>
        )}

        {connectionStatus === 'connecting' && (
          <p className="mb-4 text-gray-600">Connecting to wallet...</p>
        )}

        {connectionStatus === 'error' && (
          <p className="mb-4 text-red-600">Failed to connect. Please try again.</p>
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
              onClick={handleConnect}
              disabled={connectionStatus === 'connecting'}
              className="w-full bg-blue-600 text-white py-2 rounded mb-3 hover:bg-blue-700 transition disabled:bg-gray-400"
            >
              {connectionStatus === 'connecting' ? 'Connecting...' : 'Connect Wallet'}
            </button>
            <p className="text-gray-500 text-sm">
              Use Chrome with Xverse or Leather extension for best experience.
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
      FallbackComponent={({ error, resetErrorBoundary }) => (
        <div className="p-4 bg-red-100 text-red-700 rounded">
          <p>Something went wrong: {error.message}</p>
          <button
            onClick={resetErrorBoundary}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
          >
            Try Again
          </button>
        </div>
      )}
      onReset={() => window.location.reload()}
    >
      <WalletConnectComponent />
    </ErrorBoundary>
  );
}