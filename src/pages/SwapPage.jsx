// src/pages/SwapPage.jsx

import React, { useEffect, useState } from 'react';
import { showConnect, request } from '@stacks/connect';
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

  // On mount: init Telegram WebApp & parse URL params
  useEffect(() => {
    if (!window.Telegram?.WebApp) {
      alert('This page must be opened inside the Telegram WebApp.');
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
    // validate presence
    if (!parsed.chatId || !parsed.nonce || !parsed.from || !parsed.to || !parsed.amount) {
      throw new Error('Missing required swap parameters.');
    }
    setParams(parsed);
  }, []);

  // Main effect: run once we have params & tg
 //// filepath: src/pages/SwapPage.jsx
useEffect(() => {
  if (!tg || !params) return;

  (async () => {
    setLoading(true);
    try {
      // 1) Connect wallet once
      await new Promise((res, rej) => {
        showConnect({
          appDetails: {
            name: 'Stacks Trader Bot',
            icon: `${window.location.origin}/logo.png`,
          },
          onFinish: res,
          onCancel: () => rej(new Error('Wallet connection canceled')),
          onError: rej,
        });
      });

      // 2) Setup Alex SDK
      const alex = new AlexSDK({
        apiUrl: import.meta.env.VITE_ALEX_API_URL,
        network: import.meta.env.VITE_STACKS_NETWORK,
      });
      const fromCur = Currency[params.from];
      const toCur = Currency[params.to];
      if (!fromCur || !toCur) {
        throw new Error('Unsupported token pair.');
      }

      // 3) Fetch route
      const route = await alex.getRoute(fromCur, toCur);
      if (!route) {
        throw new Error(`No liquidity pool for ${params.from} → ${params.to}`);
      }

      // 4) Handle decimals
      const dFrom = await alex.getDecimals(fromCur);
      const dTo = await alex.getDecimals(toCur);
      const amtBig = BigInt(Math.floor(params.amount * 10 ** dFrom));

      // 5) Calculate expected receive
      const recvBig = await alex.getAmountTo(fromCur, amtBig, toCur, route);
      const expected = Number(recvBig) / 10 ** dTo;

      // 6) Prepare slippage floor
      const minGotBig = BigInt(
        Math.floor(expected * (1 - params.slippage / 100) * 10 ** dTo)
      );

      // 7) Build sponsored swap tx
      const sponsoredTx = await alex.runSwapForSponsoredTx(
        tg.initDataUnsafe.user.id,
        fromCur,
        toCur,
        amtBig,
        minGotBig,
        route
      );

      // 8) Broadcast via sponsor if available
      if (await alex.isSponsoredTxServiceAvailable()) {
        const txid = await alex.broadcastSponsoredTx(sponsoredTx);
        // Send back txid
        tg.sendData(
          JSON.stringify({
            type: 'swap',
            txid,
            nonce: params.nonce,
          })
        );
      } else {
        // Fallback: have user sign & broadcast
        const signed = await request('transaction', sponsoredTx);
        const hex = signed.serialize().toString('hex');
        tg.sendData(
          JSON.stringify({
            type: 'swap',
            signedTx: hex,
            nonce: params.nonce,
          })
        );
      }
    } finally {
      setLoading(false);
    }
  })();
}, [tg, params]);

  // Loading view
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        {loading
          ? <p className="text-lg">Connecting & swapping…</p>
          : <p className="text-lg">Initializing…</p>
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
