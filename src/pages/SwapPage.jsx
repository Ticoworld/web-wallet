// src/pages/SwapPage.jsx

import React, { useEffect, useState } from 'react';
import { request } from '@stacks/connect';
import { AlexSDK, Currency } from 'alex-sdk';
import { ErrorBoundary } from 'react-error-boundary';

function SwapErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="p-6 text-center">
      <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
      <p className="mb-4">{error.message}</p>
      <button onClick={resetErrorBoundary} className="px-4 py-2 bg-gray-200 rounded">
        Retry
      </button>
    </div>
  );
}

function SwapPage() {
  const [status, setStatus] = useState('Initializing swap…');
  const [error,  setError]  = useState(null);
  const [params, setParams] = useState(null);
  const [tg,     setTg]     = useState(null);

  // 1) Parse & validate URL params
  useEffect(() => {
    if (!window.Telegram?.WebApp) {
      return setError(new Error('Open this only via Telegram WebApp.'));
    }
    window.Telegram.WebApp.ready();
    setTg(window.Telegram.WebApp);

    try {
      const sp = new URLSearchParams(window.location.search);
      const get = k => {
        const v = sp.get(k);
        if (!v) throw new Error(`Missing ${k}`);
        return v;
      };

      const p = {
        chatId:   get('chatId'),
        nonce:    get('nonce'),
        from:     get('from').toUpperCase(),
        to:       get('to').toUpperCase(),
        amount:   Number(get('amount')),
        slippage: Number(sp.get('slippage') || 1),
      };
      if (p.from === p.to) throw new Error('FROM and TO cannot match');
      if (isNaN(p.amount) || p.amount <= 0) throw new Error('Invalid amount');
      if (isNaN(p.slippage) || p.slippage < 0 || p.slippage > 50) {
        throw new Error('Slippage must be 0–50%');
      }
      setParams(p);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    }
  }, []);

  // 2) Core swap logic
  useEffect(() => {
    if (!tg || !params || error) return;

    (async () => {
      try {
        setStatus('Building quote & tx…');
        const alex = new AlexSDK({
          apiUrl:  import.meta.env.VITE_ALEX_API_URL,
          network: import.meta.env.VITE_STACKS_NETWORK,
        });
        const fromCur = Currency[params.from];
        const toCur   = Currency[params.to];
        if (!fromCur || !toCur) throw new Error('Unsupported tokens');

        // Route
        const route = await alex.getRoute(fromCur, toCur);
        if (!route) throw new Error('No liquidity pool');

        // Decimals
        const infoF = await alex.fetchTokenInfo(fromCur.address);
        const infoT = await alex.fetchTokenInfo(toCur.address);
        const dF = infoF.decimals ?? 6;
        const dT = infoT.decimals ?? 6;

        // Quote
        const baseAmt = BigInt(Math.floor(params.amount * 10**dF));
        const recvBig = await alex.getAmountTo(fromCur, baseAmt, toCur, route);
        const expected = Number(recvBig) / 10**dT;
        setStatus(`Quote: ~${expected.toFixed(6)} ${params.to}`);

        // Build sponsored TX
        const minGot = BigInt(
          Math.floor(expected * (1 - params.slippage/100) * 10**dT)
        );
        const tx = await alex.runSwapForSponsoredTx(
          tg.initDataUnsafe.user.id,
          fromCur, toCur,
          baseAmt, minGot,
          route
        );

        // Broadcast
        setStatus('Broadcasting swap…');
        if (await alex.isSponsoredTxServiceAvailable()) {
          const txid = await alex.broadcastSponsoredTx(tx);
          tg.sendData(JSON.stringify({ type:'swap', txid, nonce:params.nonce }));
          setStatus(`✅ Swap sent. TXID: ${txid}`);
        } else {
          const signed = await request('transaction', tx);
          const hex = signed.serialize().toString('hex');
          tg.sendData(JSON.stringify({ type:'swap', signedTx:hex, nonce:params.nonce }));
          setStatus('✅ Swap signed, returning to bot…');
        }

      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(new Error(msg));
        tg.showAlert(`❌ ${msg}`);
      }
    })();
  }, [tg, params, error]);

  // 3) Render
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-50 text-red-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Swap Error</h2>
          <p className="mb-4">{error.message}</p>
          <button onClick={()=>window.location.reload()} className="px-4 py-2 bg-gray-200 rounded">
            Retry
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <p className="text-lg text-center">{status}</p>
    </div>
  );
}

export default function WrappedSwapPage() {
  return (
    <ErrorBoundary FallbackComponent={SwapErrorFallback} onReset={() => window.location.reload()}>
      <SwapPage />
    </ErrorBoundary>
  );
}
