import React, { useEffect, useState } from 'react';
import { request } from '@stacks/connect';
import { AlexSDK, Currency } from 'alex-sdk';
import { ErrorBoundary } from 'react-error-boundary';

function SwapErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="p-6 text-center">
      <h2 className="text-xl font-bold text-red-600 mb-4">Swap Failed</h2>
      <p className="mb-4">{error.message}</p>
      <button 
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Try Again
      </button>
    </div>
  );
}

function SwapPage() {
  const [tg, setTg] = useState(null);
  const [params, setParams] = useState(null);
  const [status, setStatus] = useState('Initializing...');
  const [error, setError] = useState(null);

  // Initialize WebApp and parse parameters
  useEffect(() => {
    if (!window.Telegram?.WebApp) {
      setError(new Error('Please open through Telegram bot'));
      return;
    }
    
    const webApp = window.Telegram.WebApp;
    webApp.ready();
    setTg(webApp);

    try {
      const params = Object.fromEntries(new URLSearchParams(window.location.search));
      if (!params.chatId || !params.nonce || !params.from || !params.to || !params.amount) {
        throw new Error('Invalid swap parameters');
      }
      setParams({
        ...params,
        amount: Number(params.amount),
        slippage: Math.min(50, Number(params.slippage) || 1),
        address: params.address
      });
    } catch (err) {
      setError(err);
    }
  }, []);

  // Main swap execution flow
  useEffect(() => {
    if (!tg || !params || error) return;

    const executeSwap = async () => {
      try {
        const alex = new AlexSDK({
          apiUrl: import.meta.env.VITE_ALEX_API_URL,
          network: import.meta.env.VITE_STACKS_NETWORK,
        });

        // 1. Validate tokens
        const fromCur = Currency[params.from];
        const toCur = Currency[params.to];
        if (!fromCur || !toCur) {
          throw new Error(`Unsupported tokens: ${params.from}/${params.to}`);
        }

        // 2. Get token decimals
        setStatus('Fetching token details...');
        const [fromDecimals, toDecimals] = await Promise.all([
          alex.getDecimals(fromCur),
          alex.getDecimals(toCur)
        ]);

        // 3. Calculate amounts with fee
       const FEE_PERCENT= import.meta.VITE_FEE_PERCENT

        const feeAmount = params.amount * FEE_PERCENT;
        const swapAmount = params.amount - feeAmount;
        const amountBase = BigInt(swapAmount * 10 ** fromDecimals);

        // 4. Find best route
        setStatus('Finding best route...');
        const route = await alex.getRoute(fromCur, toCur);
        if (!route) {
          throw new Error(`No liquidity pool for ${params.from} → ${params.to}`);
        }

        // 5. Get quote
        setStatus('Calculating quote...');
        const recvBase = await alex.getAmountTo(fromCur, amountBase, toCur, route);
        const expected = Number(recvBase) / 10 ** toDecimals;
        const minReceived = expected * (1 - params.slippage/100);

        // 6. Build transaction
        setStatus('Building transaction...');
        const tx = await alex.runSwapForSponsoredTx(
          params.address,
          fromCur,
          toCur,
          amountBase,
          BigInt(minReceived * 10 ** toDecimals),
          route,
          {
            feeAddress: import.meta.env.VITE_FEE_WALLET,
            feeAmount: BigInt(feeAmount * 10 ** fromDecimals)
          }
        );

        // 7. Broadcast transaction
        setStatus('Broadcasting...');
        const txId = await alex.broadcastSponsoredTx(tx);
        
        tg.sendData(JSON.stringify({
          type: 'swap',
          txId,
          nonce: params.nonce,
          fee: feeAmount
        }));

        tg.close();

      } catch (err) {
        console.error('Swap error:', err);
        tg.showAlert(`❌ Swap failed: ${err.message}`);
        setError(err);
      }
    };

    executeSwap();
  }, [tg, params, error]);

  if (error) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
        <p className="mb-4">{error.message}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <div className="animate-pulse">⏳</div>
        <h2 className="text-xl font-bold">{status}</h2>
        <p className="text-gray-600">
          {params && `Swapping ${params.amount} ${params.from} → ${params.to}`}
        </p>
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