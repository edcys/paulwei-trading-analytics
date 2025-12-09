'use client';

import { useEffect, useMemo, useState } from "react";
import { Play, Pause, FastForward, Gauge, EyeOff, Eye, Loader2 } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TVChart } from "./TVChart";

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

interface TimeMachineLayoutProps {
  initialCandles: Candle[];
  initialEquity: EquityPoint[];
}

export function TimeMachineLayout({ initialCandles, initialEquity }: TimeMachineLayoutProps) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [equity, setEquity] = useState<EquityPoint[]>([]);
  const [currentIndex, setCurrentIndex] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showFuture, setShowFuture] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    setCandles(initialCandles ?? []);
    setEquity(initialEquity ?? []);
    setCurrentIndex(Math.min(initialCandles?.length ?? 0, 120));
    setBootstrapping(false);
  }, [initialCandles, initialEquity]);

  useEffect(() => {
    if (!isPlaying || candles.length === 0) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = Math.min(prev + speed, candles.length);
        if (next === candles.length) {
          setIsPlaying(false);
        }
        return next;
      });
    }, Math.max(250, 900 / speed));

    return () => clearInterval(timer);
  }, [isPlaying, speed, candles.length]);

  const displayedCandles = useMemo(() => {
    if (showFuture) return candles;
    return candles.slice(0, currentIndex);
  }, [candles, currentIndex, showFuture]);

  const displayedEquity = useMemo(() => {
    if (showFuture) return equity;
    return equity.slice(0, currentIndex);
  }, [equity, currentIndex, showFuture]);

  const progress = candles.length > 0 ? Math.min(100, Math.round((currentIndex / candles.length) * 100)) : 0;
  const latestPnl = displayedEquity.at(-1)?.pnl ?? 0;

  const handleReset = () => {
    setCurrentIndex(Math.min(candles.length, 120));
    setIsPlaying(false);
  };

  if (bootstrapping) {
    return (
      <div className="w-full h-[700px] flex items-center justify-center bg-slate-900/70 border border-slate-800 rounded-2xl">
        <div className="flex flex-col items-center gap-3 text-slate-300">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Loading time machine data...</p>
        </div>
      </div>
    );
  }

  if (candles.length === 0) {
    return (
      <div className="w-full h-[700px] flex items-center justify-center bg-slate-900/70 border border-slate-800 rounded-2xl">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 text-slate-400">
            <EyeOff className="w-6 h-6" />
          </div>
          <p className="text-lg font-semibold text-white">沒有可用的行情資料</p>
          <p className="text-slate-400">請確認伺服器上有可用的 OHLCV 檔案或 API 回應。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      <aside className="col-span-12 lg:col-span-2 space-y-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Playback</p>
              <p className="text-sm text-slate-200">行情回放</p>
            </div>
            <Gauge className="w-5 h-5 text-slate-400" />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying((prev) => !prev)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4" />
                  暫停
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  播放
                </>
              )}
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-2 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
            >
              重置
            </button>
          </div>
          <div className="mt-4 space-y-2">
            <p className="text-xs text-slate-400">速度</p>
            <div className="flex gap-2">
              {[1, 2, 4].map((value) => (
                <button
                  key={value}
                  onClick={() => setSpeed(value)}
                  className={`flex-1 px-3 py-2 rounded-lg border transition ${
                    speed === value ? "bg-primary text-primary-foreground border-primary" : "border-slate-700 text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  {value}x
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">顯示未來 K 線</p>
              <button
                onClick={() => setShowFuture((prev) => !prev)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition ${
                  showFuture ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300" : "border-slate-700 text-slate-300 hover:bg-slate-800"
                }`}
              >
                {showFuture ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {showFuture ? "顯示" : "隱藏"}
              </button>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 via-blue-500 to-indigo-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-400">已回放 {progress}%</p>
          </div>
        </div>
      </aside>

      <div className="col-span-12 lg:col-span-8 space-y-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg shadow-primary/5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">K 線</p>
              <p className="text-sm text-slate-200">BTCUSD 1H</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800 border border-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                回放中
              </span>
            </div>
          </div>
          <TVChart
            data={displayedCandles}
            loading={displayedCandles.length === 0}
            colors={{
              backgroundColor: "rgba(15, 23, 42, 0.6)",
              textColor: "#cbd5f5",
            }}
          />
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg shadow-primary/5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">資金 / 盈虧</p>
              <p className="text-sm text-slate-200">模擬資金曲線</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <FastForward className="w-4 h-4" />
              <span>速度 {speed}x</span>
            </div>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayedEquity} margin={{ top: 10, left: 0, right: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="time"
                  tickFormatter={(value) => new Date(value * 1000).toLocaleDateString()}
                  stroke="#9ca3af"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#9ca3af"
                  tick={{ fontSize: 12 }}
                  domain={["auto", "auto"]}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#9ca3af"
                  tick={{ fontSize: 12 }}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "10px" }}
                  labelFormatter={(value) => new Date(Number(value) * 1000).toLocaleString()}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="balance"
                  stroke="#22c55e"
                  fillOpacity={1}
                  fill="url(#equityGradient)"
                  name="資金"
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="pnl"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#pnlGradient)"
                  name="盈虧 %"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <aside className="col-span-12 lg:col-span-2 space-y-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">倉位能量條</p>
            <FastForward className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-sm text-slate-200 mb-2">模擬倉位強度</p>
          <div className="space-y-3">
            {["現貨", "多單", "空單"].map((label, idx) => {
              const value = ((currentIndex + 1 + idx * 17) % 100);
              return (
                <div key={label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{label}</span>
                    <span className="text-slate-200">{value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 transition-all"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">狀態</p>
          </div>
          <div className="space-y-2 text-sm text-slate-300">
            <div className="flex items-center justify-between">
              <span>進度</span>
              <span className="text-emerald-300">{progress}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span>K 線數</span>
              <span className="text-slate-100">{displayedCandles.length} / {candles.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>盈虧</span>
              <span className={`font-medium ${latestPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {latestPnl.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>播放</span>
              <span className="text-slate-100">{isPlaying ? "進行中" : "已暫停"}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
