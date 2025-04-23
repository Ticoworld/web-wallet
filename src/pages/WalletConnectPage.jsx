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

  // Extract and validate Telegram parameters
  const params = new URLSearchParams(window.location.search);
  const rawCb = params.get("callback");
  const { chatId, nonce, isValid } = useMemo(() => {
    try {
      const cbUrl = rawCb ? new URL(rawCb) : null;
      return {
        chatId: cbUrl?.searchParams.get("chatId"),
        nonce: cbUrl?.searchParams.get("nonce"),
        isValid: !!rawCb && !!cbUrl?.searchParams.get("chatId") && !!cbUrl?.searchParams.get("nonce")
      };
    } catch {
      return { chatId: null, nonce: null, isValid: false };
    }
  }, [rawCb]);

  // Session management
  const appConfig = useMemo(() => new AppConfig(["store_write"]), []);
  const userSession = useMemo(() => new UserSession({ appConfig }), [appConfig]);

  // Auto-clear invalid sessions
  useEffect(() => {
    if (!isValid && userSession.isUserSignedIn()) {
      userSession.signUserOut();
      window.localStorage.clear();
    }
  }, [isValid, userSession]);

  // Connection handler
  const connectWallet = useCallback(() => {
    if (!isValid) {
      setError(new Error("Invalid connection request"));
      return;
    }

    showConnect({
      appDetails: {
        name: "Stacks Trader Bot",
        icon: `${window.location.origin}/logo.png`,
      },
      onFinish: async () => {
        try {
          const userData = userSession.loadUserData();
          const stxAddress = userData.profile.stxAddress.mainnet;

          // Verify on-chain existence
          const balanceRes = await fetch(
            `https://api.hiro.so/extended/v1/address/${stxAddress}/balances`
          );
          if (!balanceRes.ok) throw new Error("Address not found on-chain");

          // Notify Telegram bot
          const botResponse = await fetch(decodeURIComponent(rawCb), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chatId, nonce, address: stxAddress }),
          });
          
          if (!botResponse.ok) throw new Error("Bot integration failed");

          // Success state
          setAddress(stxAddress);
          setSuccess(true);
          
          // Auto-redirect to Telegram after 5 seconds
          setTimeout(() => {
            window.location.href = `https://t.me/${import.meta.env.VITE_BOT_USERNAME}`;
          }, 5000);

        } catch (err) {
          userSession.signUserOut();
          window.localStorage.clear();
          setError(err);
        }
      },
      onCancel: () => {
        userSession.signUserOut();
        window.localStorage.clear();
        setAddress(null);
      },
      userSession,
    });
  }, [isValid, rawCb, chatId, nonce, userSession]);

  // Auto-initiate connection for valid flows
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
            {error.message}
          </div>
        )}

        {success ? (
          <div className="bg-green-100 text-green-700 p-3 rounded mb-4">
            <p className="font-mono break-all mb-2">{address}</p>
            <p className="mb-4">✅ Successfully connected!</p>
            <a
              href={`https://t.me/${import.meta.env.VITE_BOT_USERNAME}`}
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Return to Telegram
            </a>
            <p className="mt-2 text-sm text-gray-600">
              Auto-redirecting in 5 seconds...
            </p>
          </div>
        ) : (
          <button
            onClick={connectWallet}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
            disabled={!isValid}
          >
            {isValid ? "Connect Wallet" : "Invalid Connection Link"}
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
