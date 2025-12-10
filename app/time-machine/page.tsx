import { TimeMachineLayout } from "@/components/TimeMachineLayout";

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface EquityPoint {
  time: number;
  balance: number;
  pnl: number;
}

async function fetchInitialData(): Promise<{ candles: Candle[]; equity: EquityPoint[] }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  let candles: Candle[] = [];

  try {
    const response = await fetch(`${baseUrl}/api/ohlcv?symbol=BTCUSD&timeframe=1h`, {
      next: { revalidate: 300 },
    });

    if (response.ok) {
      const payload = await response.json();
      candles = payload?.candles ?? [];
    } else {
      console.error("Failed to load OHLCV data", response.statusText);
    }
  } catch (error) {
    console.error("Error while fetching OHLCV data", error);
  }

  const equity: EquityPoint[] = candles.map((candle) => {
    const firstClose = candles[0]?.close ?? 1;
    const pnlPercent = firstClose > 0 ? ((candle.close - firstClose) / firstClose) * 100 : 0;
    const baseBalance = 10000;
    const balance = baseBalance * (1 + pnlPercent / 100);

    return {
      time: candle.time,
      balance,
      pnl: pnlPercent,
    };
  });

  return { candles, equity };
}

export default async function TimeMachinePage() {
  const { candles, equity } = await fetchInitialData();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Time Machine</p>
          <h1 className="text-3xl font-bold mt-2 text-white">模擬回放</h1>
          <p className="text-slate-400 mt-2">服務端預先載入行情資料，客戶端組裝並播放回測畫面。</p>
        </div>
        <TimeMachineLayout initialCandles={candles} initialEquity={equity} />
      </div>
    </div>
  );
}
