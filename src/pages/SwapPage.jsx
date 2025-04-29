import React, { useEffect, useState } from 'react';
import { request } from '@stacks/connect';
import { AlexSDK, Currency } from 'alex-sdk';
import { ErrorBoundary } from 'react-error-boundary';

// Fallback UI for any uncaught error
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
  const [tg, setTg] = useState(null);
  const [params, setParams] = useState(null);
  const [status, setStatus] = useState('Initializing swap…');
  const [error, setError] = useState(null);
  // 1. Init Telegram WebApp + parse URL parameters
  useEffect(() => {
    if (!window.Telegram?.WebApp) {
      return setError('This page must be opened from the Telegram bot WebApp.');
    }
    window.Telegram.WebApp.ready();
    setTg(window.Telegram.WebApp);

    try {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // 2. Main flow: quote → build tx → broadcast
  useEffect(() => {
    if (!tg || !params || error) return;

    (async () => {
      try {
        setStatus('Fetching route & token info…');

        const alex = new AlexSDK({
          apiUrl:  import.meta.env.VITE_ALEX_API_URL,
          network: import.meta.env.VITE_STACKS_NETWORK,
        });
        const fromCur = Currency[params.from];
        const toCur   = Currency[params.to];
        if (!fromCur || !toCur) throw new Error('Unsupported token symbols');

        // 2a. Route lookup
        const route = await alex.getRoute(fromCur, toCur);
        if (!route) throw new Error(`No liquidity pool for ${params.from} → ${params.to}`);

        // 2b. Fetch decimals
        setStatus('Calculating quote…');
        const infoFrom = await alex.fetchTokenInfo(fromCur.address);
        const infoTo   = await alex.fetchTokenInfo(toCur.address);
        const dFrom = infoFrom?.decimals ?? 6;
        const dTo   = infoTo?.decimals   ?? 6;

        // 2c. Compute big-ints
        const amtBig  = BigInt(Math.floor(params.amount * 10 ** dFrom));
        const recvBig = await alex.getAmountTo(fromCur, amtBig, toCur, route);
        const expected = Number(recvBig) / 10 ** dTo;

        // 2d. Slippage floor
        const minGotBig = BigInt(
          Math.floor(expected * (1 - params.slippage/100) * 10 ** dTo)
        );

        // Show estimated numbers
        setStatus(
          `Quote: ${params.amount} ${params.from} → ~${expected.toFixed(6)} ${params.to}` +
          ` (fee: ${(expected * 0.002).toFixed(6)} ${params.to})`
        );

        // 2e. Build sponsored swap TX
        setStatus('Building swap transaction…');
        const sponsoredTx = await alex.runSwapForSponsoredTx(
          tg.initDataUnsafe.user.id,
          fromCur, toCur,
          amtBig, minGotBig,
          route
        );

        // 2f. Broadcast
        setStatus('Broadcasting transaction…');
        if (await alex.isSponsoredTxServiceAvailable()) {
          const txid = await alex.broadcastSponsoredTx(sponsoredTx);
          tg.sendData(JSON.stringify({ type: 'swap', txid, nonce: params.nonce }));
          setStatus(`✅ Swap sent. TXID: ${txid}`);
        } else {
          const signed = await request('transaction', sponsoredTx);
          const hex = signed.serialize().toString('hex');
          tg.sendData(JSON.stringify({ type: 'swap', signedTx: hex, nonce: params.nonce }));
          setStatus('✅ Swap signed. Returning to bot…');
        }

      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        tg.showAlert(`Swap error: ${msg}`);
      }
    })();
  }, [tg, params, error, setError]);

  // 3. Render
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-100 text-red-800 p-6 rounded">
          <p className="font-semibold mb-4">Error</p>
          <p className="mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-gray-200 rounded">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-lg">{status}</p>
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
