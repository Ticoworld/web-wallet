// src/pages/SwapPage.jsx

import React, { useEffect, useState } from 'react';
import { request } from '@stacks/connect';
import { AlexSDK, Currency } from 'alex-sdk';
import { ErrorBoundary } from 'react-error-boundary';

function SwapErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="p-6 text-center">
      <h2 className="text-xl font-bold text-red-600 mb-4">Oops!</h2>
      <p className="mb-4">{error.message}</p>
      <button onClick={resetErrorBoundary} className="px-4 py-2 bg-gray-200 rounded">
        Try Again
      </button>
    </div>
  );
}

function SwapPage() {
  const [tg, setTg] = useState(null);
  const [params, setParams] = useState(null);
  const [loading, setLoading] = useState(false);

  // 1. Initialize Telegram WebApp & parse URL params once
  useEffect(() => {
    if (!window.Telegram?.WebApp) {
      alert('Please open this via the Telegram bot WebApp.');
      return;
    }
    window.Telegram.WebApp.ready();
    setTg(window.Telegram.WebApp);

    const p = Object.fromEntries(new URLSearchParams(window.location.search));
    const parsed = {
      chatId:   p.chatId,
      nonce:    p.nonce,
      from:     p.from?.toUpperCase(),
      to:       p.to?.toUpperCase(),
      amount:   Number(p.amount),
      slippage: p.slippage ? Number(p.slippage) : 1,
    };
    if (!parsed.chatId || !parsed.nonce || !parsed.from || !parsed.to || !parsed.amount) {
      throw new Error('Missing swap parameters');
    }
    setParams(parsed);
  }, []);

  
useEffect(() => {
  if (!tg || !params) return;

  (async () => {
    setLoading(true);
    try {
      // Setup Alex SDK
      const alex = new AlexSDK({
        apiUrl: import.meta.env.VITE_ALEX_API_URL,
        network: import.meta.env.VITE_STACKS_NETWORK,
      });
      const fromCur = Currency[params.from];
      const toCur = Currency[params.to];
      if (!fromCur || !toCur) throw new Error('Unsupported tokens');

      // Fetch best route
      const route = await alex.getRoute(fromCur, toCur);
      if (!route) throw new Error(`No liquidity pool for ${params.from}→${params.to}`);

      // Get decimals
      const infoFrom = await alex.fetchTokenInfo(fromCur.address);
      const dFrom = infoFrom?.decimals ?? 6;
      const infoTo = await alex.fetchTokenInfo(toCur.address);
      const dTo = infoTo?.decimals ?? 6;

      // Compute amounts in base units
      const amtBig = BigInt(Math.floor(params.amount * 10 ** dFrom));
      const recvBig = await alex.getAmountTo(fromCur, amtBig, toCur, route);
      const expected = Number(recvBig) / 10 ** dTo;
      const minGotBig = BigInt(
        Math.floor(expected * (1 - params.slippage / 100) * 10 ** dTo)
      );

      // Build sponsored swap tx
      const sponsoredTx = await alex.runSwapForSponsoredTx(
        tg.initDataUnsafe.user.id,
        fromCur, toCur,
        amtBig, minGotBig,
        route
      );

      // Broadcast: prefer sponsor service
      if (await alex.isSponsoredTxServiceAvailable()) {
        const txid = await alex.broadcastSponsoredTx(sponsoredTx);
        tg.sendData(JSON.stringify({
          type: 'swap',
          txid,
          nonce: params.nonce,
        }));
      } else {
        // Fallback: have user sign & broadcast
        const signed = await request('transaction', sponsoredTx);
        tg.sendData(JSON.stringify({
          type: 'swap',
          signedTx: signed.serialize().toString('hex'),
          nonce: params.nonce,
        }));
      }
    } finally {
      setLoading(false);
    }
  })();
}, [tg, params]);

  // 3. Loading state UI
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        {loading
          ? <p className="text-lg">Signing & submitting your swap…</p>
          : <p className="text-lg">Initializing swap…</p>
        }
      </div>
    </div>
  );
}

export default function WrappedSwapPage() {
  return (
    <ErrorBoundary
      FallbackComponent={SwapErrorFallback}
      onReset={() => window.location.reload()}
    >
      <SwapPage />
    </ErrorBoundary>
  );
}
