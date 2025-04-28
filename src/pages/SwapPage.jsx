// src/pages/SwapPage.jsx
import React, { useEffect, useState } from 'react';
import { request } from '@stacks/connect';
import { AlexSDK, Currency } from 'alex-sdk';

export default function SwapPage() {
  const [tg, setTg]               = useState(null);
  const [params, setParams]       = useState({});
  const [loading, setLoading]     = useState(false);
  const [quote, setQuote]         = useState(null);
  const [slippage, setSlippage]   = useState(1);

  // Full list of tickers from alex-sdk
  const tickers = Object.keys(Currency);

  // On mount: init Telegram WebApp & parse URL
  useEffect(() => {
    // 1) Telegram
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      setTg(window.Telegram.WebApp);
    }
    // 2) URL params
    const p = Object.fromEntries(new URLSearchParams(window.location.search));
    setParams({
      chatId:   p.chatId,
      nonce:    p.nonce,
      from:     p.from?.toUpperCase(),
      to:       p.to?.toUpperCase(),
      amount:   p.amount ? parseFloat(p.amount) : null,
      slippage: p.slippage ? parseFloat(p.slippage) : 1
    });
  }, []);

  // Helper: fetch a quote if inline params present
  useEffect(() => {
    async function loadQuote() {
      if (params.from && params.to && params.amount) {
        const alex = new AlexSDK({
          apiUrl:  import.meta.env.VITE_ALEX_API_URL,
          network: import.meta.env.VITE_STACKS_NETWORK
        });
        setLoading(true);
        try {
          const q = await alex.getAmountTo(
            Currency[params.from],
            Currency[params.to],
            params.amount
          );
          setQuote(q);
        } catch (e) {
          console.error('Quote error', e);
        } finally {
          setLoading(false);
        }
      }
    }
    loadQuote();
  }, [params.from, params.to, params.amount]);

  // Main sign & broadcast handler
  async function handleSign(swapParams) {
    if (!tg) return;
    setLoading(true);

    try {
      const alex = new AlexSDK({
        apiUrl:  import.meta.env.VITE_ALEX_API_URL,
        network: import.meta.env.VITE_STACKS_NETWORK
      });

      // Build the unsigned tx
      const fromCur = Currency[swapParams.from];
      const toCur   = Currency[swapParams.to];
      const amtBig  = BigInt(Math.floor(swapParams.amount * 1e6));
      const route   = await alex.getRoute(fromCur, toCur);
      const minGot  = BigInt(
        Math.floor(
          (await alex.getAmountTo(fromCur, amtBig, toCur)) *
          (1 - swapParams.slippage / 100)
        )
      );

      const txToSign = await alex.runSwapForSponsoredTx(
        tg.initDataUnsafe.user.id, 
        fromCur, toCur,
        amtBig,
        minGot,
        route
      );

      // In-view sign prompt
      const signed = await request('transaction', txToSign);

      // Send back to bot
      tg.sendData(JSON.stringify({
        type:     'swap',
        signedTx: signed.serialize().toString('hex'),
        nonce:    swapParams.nonce
      }));
    } catch (err) {
      console.error('Swap sign error', err);
      alert('Swap failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Render inline-confirmation view if quote ready
  if (params.from && params.to && params.amount && quote) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-bold mb-4">Confirm Swap</h2>
        <p className="mb-2">
          {params.amount} {params.from} → {quote.expectedAmount.toFixed(6)} {params.to}
        </p>
        <p className="mb-2">Slippage: {params.slippage}%</p>
        <p className="mb-6">Protocol Fee: {quote.fee} STX</p>
        <button
          disabled={loading}
          onClick={() => handleSign(params)}
          className="px-6 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Signing…' : 'Sign & Broadcast'}
        </button>
      </div>
    );
  }

  // Otherwise, full GUI flow
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-bold">Swap Tokens</h2>

      {/* From Token */}
      <div>
        <label className="block mb-1">From:</label>
        <select
          className="w-full p-2 border rounded"
          value={params.from || ''}
          onChange={e => setParams(p => ({ ...p, from: e.target.value }))}
        >
          <option value="" disabled>Select token</option>
          {tickers.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* To Token */}
      <div>
        <label className="block mb-1">To:</label>
        <select
          className="w-full p-2 border rounded"
          value={params.to || ''}
          onChange={e => setParams(p => ({ ...p, to: e.target.value }))}
        >
          <option value="" disabled>Select token</option>
          {tickers.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Amount */}
      <div>
        <label className="block mb-1">Amount:</label>
        <input
          type="number"
          step="0.000001"
          className="w-full p-2 border rounded"
          value={params.amount || ''}
          onChange={e => setParams(p => ({ ...p, amount: parseFloat(e.target.value) }))}
        />
      </div>

      {/* Slippage */}
      <div>
        <label className="block mb-1">Slippage %:</label>
        <input
          type="number"
          step="0.1"
          className="w-full p-2 border rounded"
          value={slippage}
          onChange={e => setSlippage(parseFloat(e.target.value))}
        />
      </div>

      {/* Quote & Sign */}
      <button
        disabled={
          loading ||
          !params.from ||
          !params.to ||
          !params.amount ||
          params.from === params.to
        }
        onClick={async () => {
          setParams(p => ({ ...p, slippage }));
          // Reuse the same nonce from URL or generate one
          const swapParams = {
            ...params,
            slippage,
            nonce: params.nonce || Math.random().toString(36).slice(2)
          };
          // Fetch quote then sign
          const alex = new AlexSDK({
            apiUrl:  import.meta.env.VITE_ALEX_API_URL,
            network: import.meta.env.VITE_STACKS_NETWORK
          });
          setLoading(true);
          try {
            const q = await alex.getAmountTo(
              Currency[swapParams.from],
              Currency[swapParams.to],
              swapParams.amount
            );
            setQuote(q);
            // Hand off to inline-confirm UI
            setLoading(false);
          } catch (e) {
            console.error(e);
            alert('Quote failed: ' + e.message);
            setLoading(false);
          }
        }}
        className="w-full px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
      >
        {loading ? 'Loading…' : 'Quote & Sign'}
      </button>
    </div>
  );
}
