import React, { useMemo } from 'react';
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
  const { open, address, isConnected, error } = useAppKit();

  // Grab the WC URI param if present
  const uri = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('uri') || '';
  }, []);

  // Build all deep-link URLs
  const links = useMemo(() => {
    if (!uri) return null;
    const redirect = `${window.location.origin}/connect?uri=${encodeURIComponent(uri)}`;
    return {
      xverseNative: `xverse://browser?url=${encodeURIComponent(redirect)}`,
      xverseWC:     `xverse://wc?uri=${encodeURIComponent(uri)}`,
      leatherWC:    `leather://wc?uri=${encodeURIComponent(uri)}`,
      xverseHTTPS:  `https://connect.xverse.app/browser?url=${encodeURIComponent(redirect)}`,
    };
  }, [uri]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white shadow-lg rounded-lg p-6 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4">Connect Your Wallet</h1>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
            {error.message}
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
            {/* Desktop / Web fallback */}
            <button
              onClick={open}
              className="w-full bg-blue-600 text-white py-2 rounded mb-4 hover:bg-blue-700 transition"
            >
              Web Wallet (Desktop)
            </button>

            {/* Mobile deep links */}
            {links && (
              <div className="space-y-2 mb-4">
                <a
                  href={links.xverseNative}
                  className="block w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 transition"
                >
                  Xverse (Native Browser)
                </a>
                <a
                  href={links.xverseWC}
                  className="block w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition"
                >
                  Xverse (WalletConnect)
                </a>
                <a
                  href={links.leatherWC}
                  className="block w-full bg-teal-600 text-white py-2 rounded hover:bg-teal-700 transition"
                >
                  Leather (WalletConnect)
                </a>
                <a
                  href={links.xverseHTTPS}
                  className="block w-full bg-gray-600 text-white py-2 rounded hover:bg-gray-700 transition"
                >
                  Xverse (HTTPS Fallback)
                </a>
              </div>
            )}

            <p className="text-gray-500 text-sm">
              If nothing happens, click the appropriate button above.
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
