// src/pages/WalletConnectPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { showConnect } from "@stacks/connect";
import { AppConfig, UserSession } from "@stacks/auth";
import { ErrorBoundary } from "react-error-boundary";
import { CheckCircleIcon, XCircleIcon, ArrowPathIcon } from "@heroicons/react/24/solid";
import Spinner from "../components/Spinner";

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div role="alert" className="p-4 bg-red-100 text-red-700 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <XCircleIcon className="w-5 h-5" />
        <h3 className="font-semibold">Connection Error</h3>
      </div>
      <p className="mb-3">{error.message}</p>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

function WalletConnectComponent() {
  const [address, setAddress] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(5);

  // Validate and parse URL parameters
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
        isValid: cbUrl.searchParams.has("chatId") && cbUrl.searchParams.has("nonce")
      };
    } catch (err) {
      console.error("Invalid callback URL:", err);
      return { isValid: false };
    }
  }, []);

  // Handle session and auto-redirect
  const userSession = useMemo(() => new UserSession({ 
    appConfig: new AppConfig(["store_write"], window.location.hostname) 
  }), []);

  // Connection handler with improved error states
  const connectWallet = useCallback(async () => {
    if (!isValid || loading) return;
    
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
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

              if (!/^SP[a-zA-Z0-9]{38}$/.test(stxAddress)) {
                throw new Error("Invalid Stacks address format");
              }

              const response = await fetch(decodeURIComponent(rawCb), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chatId, nonce, address: stxAddress }),
              });

              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Connection failed");
              }

              setAddress(stxAddress);
              setSuccess(true);
              setLoading(false);

              // Start redirect countdown
              const interval = setInterval(() => {
                setCountdown(prev => {
                  if (prev <= 1) {
                    clearInterval(interval);
                    window.location.href = `https://t.me/${import.meta.env.VITE_BOT_USERNAME}`;
                    return 0;
                  }
                  return prev - 1;
                });
              }, 1000);

              resolve();
            } catch (err) {
              reject(err);
            }
          },
          onCancel: () => reject(new Error("Connection cancelled by user")),
          userSession,
        });
      });
    } catch (err) {
      console.error("Connection error:", err);
      setError(err);
      setLoading(false);
      userSession.signUserOut();
    }
  }, [isValid, rawCb, chatId, nonce, userSession, loading]);

  // Auto-initiate connection for valid URLs
  useEffect(() => {
    if (isValid && !userSession.isUserSignedIn()) {
      connectWallet();
    }
  }, [isValid, userSession, connectWallet]);

  // Handle invalid callback URLs
  if (!isValid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white shadow-lg rounded-xl p-8 max-w-md w-full text-center">
          <XCircleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Invalid Connection Link</h2>
          <p className="text-gray-600 mb-6">
            This connection link is expired or invalid. Please generate a new one from Telegram.
          </p>
          <a
            href={`https://t.me/${import.meta.env.VITE_BOT_USERNAME}`}
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Return to Telegram
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white shadow-lg rounded-xl p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          Connect Wallet
        </h1>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">
            <div className="flex items-center gap-2 mb-2">
              <XCircleIcon className="w-5 h-5" />
              <span className="font-medium">Error:</span>
            </div>
            <p className="break-words">
              {error.message.includes("NetworkError") 
                ? "Network error - please check your internet connection"
                : error.message}
            </p>
          </div>
        )}

        {success ? (
          <div className="text-center">
            <div className="flex flex-col items-center mb-6">
              <CheckCircleIcon className="w-12 h-12 text-green-500 mb-4" />
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                Wallet Connected!
              </h2>
              <p className="text-gray-600 mb-4">
                Redirecting back to Telegram in {countdown} seconds...
              </p>
              <div className="bg-gray-100 p-4 rounded-lg w-full mb-4">
                <p className="font-mono text-sm break-all">{address}</p>
              </div>
            </div>
            <a
              href={`https://t.me/${import.meta.env.VITE_BOT_USERNAME}`}
              className="inline-block w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Return Now
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-gray-600 mb-6">
                Connect your wallet to link it with your Telegram account.
              </p>
              <button
                onClick={connectWallet}
                disabled={loading}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Spinner className="w-5 h-5" />
                    <span>Connecting...</span>
                  </div>
                ) : (
                  "Connect Wallet"
                )}
              </button>
            </div>

            <div className="text-center text-sm text-gray-500">
              <p className="mb-2">Don't have a wallet?</p>
              <a
                href="https://www.hiro.so/wallet"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700"
              >
                Get a Stacks Wallet →
              </a>
            </div>
          </div>
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