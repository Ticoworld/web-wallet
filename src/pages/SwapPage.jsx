import React, { useEffect, useState } from "react";
import { AlexSDK, Currency } from "alex-sdk";
import { ErrorBoundary } from "react-error-boundary";

function SwapErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="p-6 text-center">
      <h2 className="text-xl font-bold text-red-600 mb-4">Swap Error</h2>
      <p className="mb-4">{error.message}</p>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Retry Swap
      </button>
    </div>
  );
}

function SwapPage() {
  const [status, setStatus] = useState("Initializing swap…");
  const [error, setError] = useState(null);
  const [params, setParams] = useState(null);
  const [tg, setTg] = useState(null);

  // 1. Parameter Parsing & Validation
  useEffect(() => {
    if (!window.Telegram?.WebApp) {
      setError(new Error("Please open through Telegram bot interface"));
      return;
    }

    const webApp = window.Telegram.WebApp;
    webApp.ready();
    setTg(webApp);

    try {
      // Debug: Log raw URL parameters
      console.debug(
        "Raw URL Params:",
        new URLSearchParams(window.location.search).toString()
      );

      const searchParams = new URLSearchParams(window.location.search);
      if (!searchParams) throw new Error("Invalid URL parameters");

      const getRequiredParam = (name) => {
        const value = searchParams.get(name);
        const decoded = value ? decodeURIComponent(value) : "";
        if (!decoded.trim()) throw new Error(`Missing ${name} parameter`);
        return decoded;
      };

      const parsed = {
        chatId: getRequiredParam("chatId"),
        nonce: getRequiredParam("nonce"),
        from: getRequiredParam("from").toUpperCase().trim(),
        to: getRequiredParam("to").toUpperCase().trim(),
        amount: Number(getRequiredParam("amount")),
        slippage: Number(searchParams.get("slippage") || 1),
        address: decodeURIComponent(getRequiredParam("address")),
        fee: Number(searchParams.get("fee")),
        feeAddress: decodeURIComponent(getRequiredParam("feeAddress")),
      };

      // Post-Validation
      if (parsed.from === parsed.to)
        throw new Error("Cannot swap identical tokens");
      if (isNaN(parsed.amount) || parsed.amount <= 0)
        throw new Error("Invalid swap amount");
      if (
        isNaN(parsed.slippage) ||
        parsed.slippage < 0 ||
        parsed.slippage > 50
      ) {
        throw new Error("Slippage must be between 0-50%");
      }
      // After parameter parsing
      if (parsed.feeAddress !== import.meta.env.VITE_FEE_WALLET) {
        throw new Error("Invalid fee address detected");
      }
      setParams(parsed);
    } catch (e) {
      setError(
        e instanceof Error
          ? e
          : new Error(e.message || "Invalid swap parameters")
      );
    }
  }, []);

  // 2. Core Swap Execution
  useEffect(() => {
    if (!tg || !params || error) return;

    (async () => {
      try {
        setStatus("Initializing swap protocol…");

        const alex = new AlexSDK({
          apiUrl: import.meta.env.VITE_ALEX_API_URL,
          network: import.meta.env.VITE_STACKS_NETWORK,
        });

        // Validate supported tokens
        const fromCur = Currency[params.from];
        const toCur = Currency[params.to];
        if (!fromCur || !toCur) {
          throw new Error(
            `Unsupported token pair: ${params.from}/${params.to}`
          );
        }

        // Calculate with fee (1%)
        const swapAmount = params.amount; // Already net amount from backend
        const fee = params.fee; // Use pre-calculated fee

        // Get token decimals
        const [fromInfo, toInfo] = await Promise.all([
          alex.fetchTokenInfo(fromCur.address).catch(() => ({ decimals: 6 })),
          alex.fetchTokenInfo(toCur.address).catch(() => ({ decimals: 6 })),
        ]);

        const fromDecimals = fromInfo.decimals ?? 6;
        const toDecimals = toInfo.decimals ?? 6;

        // Convert to blockchain units
        const amountBase = BigInt(Math.floor(swapAmount * 10 ** fromDecimals));

        // Add after getting token decimals
        try {
          setStatus('Verifying balance…');
          
          // Fetch raw balances: keys like "token-stx", "token-alex", etc.
          const rawBalances = await alex.getBalances(params.address);
          
          // Find the right key whose symbol matches params.from
          const balanceKey = Object.keys(rawBalances).find(key => {
            const sym = key
              .replace(/^token-/, '')
              .replace(/^W/i, '')
              .toUpperCase();
            return sym === params.from;
          });
          if (!balanceKey) {
            throw new Error(`No ${params.from} balance found`);
          }
          
          // Convert BigInt → human-readable number
          const balanceBig = rawBalances[balanceKey].balance; // BigInt
          const userBalance = Number(balanceBig) / 10 ** fromDecimals;
          
          // Compare against requested amount + fee
          const requiredTotal = params.amount + params.fee;
          if (userBalance < requiredTotal) {
            throw new Error(
              `Insufficient ${params.from} balance\n` +
              `Required: ${requiredTotal.toFixed(4)} ${params.from}\n` +
              `Available: ${userBalance.toFixed(4)} ${params.from}`
            );
          }
        } catch (err) {
          // Any error here bubbles out to your outer catch,
          // where you already call tg.showAlert and setError.
          throw new Error(`Balance verification failed: ${err.message}`);
        }

        // Get best route
        setStatus("Finding optimal trading route…");
        const route = await alex.getRoute(fromCur, toCur);
        if (!route) throw new Error("No liquidity pool available");

        // Calculate expected output
        const recvBase = await alex.getAmountTo(
          fromCur,
          amountBase,
          toCur,
          route
        );
        const expected = Number(recvBase) / 10 ** toDecimals;

        // Build transaction
        setStatus("Constructing secure transaction…");
        const minReceived = BigInt(
          Math.floor(expected * (1 - params.slippage / 100) * 10 ** toDecimals)
        );

        const tx = await alex.runSwapForSponsoredTx(
          import.meta.env.VITE_FEE_WALLET,
          fromCur,
          toCur,
          BigInt(swapAmount * 10 ** fromDecimals), // Net amount
          minReceived,
          route,
          {
            feeAddress: params.feeAddress, // From URL params
            feeAmount: BigInt(params.fee * 10 ** fromDecimals), // Pre-calculated fee
          }
        );

        // Broadcast transaction
        setStatus("Finalizing swap…");
        const txId = await alex.broadcastSponsoredTx(tx);

        tg.sendData(
          JSON.stringify({
            type: "swap",
            txId,
            nonce: params.nonce,
            fee: fee.toFixed(4),
          })
        );

        tg.close();
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Swap execution failed";
        setError(new Error(message));
        tg.showAlert(`❌ ${message}`);
      }
    })();
  }, [tg, params, error]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-50 text-red-700 p-6 rounded-lg max-w-md">
          <h2 className="text-xl font-bold mb-2">Swap Failed</h2>
          <p className="mb-4">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry Swap
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <div className="animate-pulse text-4xl">⏳</div>
        <h2 className="text-xl font-semibold text-gray-800">{status}</h2>
        {params && (
          <p className="text-gray-600">
            Swapping {params.amount.toFixed(4)} {params.from}
            <br />
            <span className="text-sm text-gray-500">
              (Includes 1% protocol fee: {params.fee.toFixed(4)} {params.from})
            </span>
          </p>
        )}
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
