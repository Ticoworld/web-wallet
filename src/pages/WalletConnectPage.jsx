// src/pages/WalletConnectPage.jsx

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { showConnect } from "@stacks/connect";
import { AppConfig, UserSession } from "@stacks/auth";
import { ErrorBoundary } from "react-error-boundary";

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
  const [address, setAddress] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Validate Telegram parameters
  const { rawCb, chatId, nonce, isValid } = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const cb = params.get("callback");
      if (!cb) return { isValid: false };
      
      const cbUrl = new URL(cb);
      return {
        rawCb: cb,
        chatId: cbUrl.searchParams.get("chatId"),
        nonce: cbUrl.searchParams.get("nonce"),
        isValid: true
      };
    } catch (err) {
      console.error("Invalid callback URL:", err);
      return { isValid: false };
    }
  }, []);

  // Session management
  const userSession = useMemo(() => {
    return new UserSession({ appConfig: new AppConfig(["store_write"]) });
  }, []);

  // Connection handler
  const connectWallet = useCallback(async () => {
    if (!isValid || loading) return;

    setLoading(true);
    setError(null);

    try {
      // Show wallet connection modal
      await new Promise((resolve, reject) => {
        showConnect({
          appDetails: {
            name: "Stacks Trader Bot",
            icon: `${window.location.origin}/logo.png`,
          },
          onFinish: async () => {
            try {
              const userData = userSession.loadUserData();
              const stxAddress = userData.profile.stxAddress.mainnet;

              // Verify address
              const balanceRes = await fetch(
                `https://api.hiro.so/extended/v1/address/${stxAddress}/balances`
              );
              if (!balanceRes.ok) throw new Error("Address verification failed");

              // Notify bot
              const botRes = await fetch(decodeURIComponent(rawCb), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chatId, nonce, address: stxAddress }),
              });
              if (!botRes.ok) throw new Error("Bot notification failed");

              // Update state
              setAddress(stxAddress);
              setSuccess(true);
              
              // Redirect to Telegram
              setTimeout(() => {
                window.location.href = `https://t.me/${import.meta.env.VITE_BOT_USERNAME}`;
              }, 3000);

              resolve();
            } catch (err) {
              reject(err);
            }
          },
          onCancel: () => {
            userSession.signUserOut();
            reject(new Error("Connection cancelled"));
          },
          userSession,
        });
      });
    } catch (err) {
      console.error("Connection error:", err);
      setError(err);
      userSession.signUserOut();
    } finally {
      setLoading(false);
    }
  }, [isValid, rawCb, chatId, nonce, userSession, loading]);

  // Auto-initiate connection
  useEffect(() => {
    if (isValid && !userSession.isUserSignedIn()) {
      connectWallet();
    }
  }, [isValid, userSession, connectWallet]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white shadow rounded-lg p-6 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4">Wallet Connection</h1>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
            {error.message.includes("fetch") ? "Network error - check connection" : error.message}
          </div>
        )}

        {success ? (
          <div className="bg-green-100 text-green-700 p-3 rounded mb-4">
            <p className="font-mono break-all mb-2">{address}</p>
            <p className="mb-4">✅ Connection successful!</p>
            <a
              href={`https://t.me/${import.meta.env.VITE_BOT_USERNAME}`}
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Return to Telegram
            </a>
          </div>
        ) : (
          <button
            onClick={connectWallet}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition disabled:opacity-50"
            disabled={!isValid || loading}
          >
            {loading ? "Connecting..." : "Connect Wallet"}
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
