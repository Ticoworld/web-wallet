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
  const [error, setError]     = useState(null);

  // 1) Grab and validate all required query params
  const params           = new URLSearchParams(window.location.search);
  const callback         = params.get("callback");
  const chatId           = params.get("chatId");
  const nonce            = params.get("nonce");
  const hasTelegramFlow  = !!callback && !!chatId && !!nonce;

  // 2) Set up Stacks UserSession
  const appConfig   = useMemo(() => new AppConfig(["store_write"]), []);
  const userSession = useMemo(() => new UserSession({ appConfig }), [appConfig]);

  // 3) If _no_ Telegram flow and we’re signed in, forcibly sign out & clear storage
  useEffect(() => {
    if (!hasTelegramFlow && userSession.isUserSignedIn()) {
      userSession.signUserOut();
      setAddress(null);
      window.localStorage.clear();
    }
  }, [hasTelegramFlow, userSession]);

  // 4) The “Connect” routine
  const connectWallet = useCallback(() => {
    if (!hasTelegramFlow) {
      setError(new Error("Invalid or missing connection parameters"));
      return;
    }

    showConnect({
      appDetails: {
        name: "Stacks Mobile Trader",
        icon: `${window.location.origin}/icon.png`,
      },
      onFinish: async () => {
        try {
          // Load STX address
          const userData      = userSession.loadUserData();
          const stxAddress    = userData.profile.stxAddress.mainnet;

          // Blockchain‐side validation
          const balanceResp = await fetch(
            `https://api.mainnet.hiro.so/extended/v1/address/${stxAddress}/balances`
          );
          if (!balanceResp.ok) {
            throw new Error("Chain lookup failed");
          }

          // Notify bot
          const botResp = await fetch(decodeURIComponent(callback), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: stxAddress, chatId, nonce }),
          });
          if (!botResp.ok) {
            throw new Error("Bot callback failed");
          }

          setAddress(stxAddress);
        } catch (err) {
          console.error(err);
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
  }, [callback, chatId, nonce, hasTelegramFlow, userSession]);

  // 5) Auto-trigger connect only if in Telegram flow and not already signed in
  useEffect(() => {
    if (hasTelegramFlow && !userSession.isUserSignedIn()) {
      connectWallet();
    }
  }, [connectWallet, hasTelegramFlow, userSession]);

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
              ✅ Connected! Address:{" "}
              <span className="font-mono break-all">{address}</span>
            </p>
            <p className="mt-2">Return to Telegram to continue your session.</p>
          </div>
        ) : (
          <button
            onClick={connectWallet}
            className="w-full bg-blue-600 text-white py-2 rounded mb-4 hover:bg-blue-700 transition"
          >
            Connect with Xverse / Leather
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
