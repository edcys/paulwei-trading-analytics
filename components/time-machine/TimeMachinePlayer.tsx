"use client";

import { useMemo } from "react";
import { TimeMachineTimeline } from "@/lib/types";
import { PLAYBACK_SPEEDS, useTimeMachinePlayer } from "./useTimeMachinePlayer";

function formatTimestamp(time?: number) {
  if (!time) return "-";
  return new Date(time * 1000).toLocaleString();
}

export function TimeMachinePlayer({ dataset }: { dataset: TimeMachineTimeline }) {
  const player = useTimeMachinePlayer(dataset.points);

  const progress = useMemo(() => {
    if (player.points.length === 0) return 0;
    return Math.round((player.currentIndex / Math.max(player.points.length - 1, 1)) * 100);
  }, [player.currentIndex, player.points.length]);

  const current = player.currentPoint;
  const trades = current?.trades ?? [];

  if (player.points.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
        <p className="font-semibold">尚未找到可播放的時間軸資料</p>
        <p className="text-sm">請確認已經在根目錄放置成交/錢包 CSV 與 data/ohlcv K 線檔案。</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Time Machine / {dataset.symbol}</p>
          <h2 className="text-xl font-semibold">{dataset.timeframe} Timeline</h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
            onClick={player.togglePlay}
          >
            {player.isPlaying ? "暫停" : "播放"}
          </button>
          <div className="flex items-center gap-2">
            {PLAYBACK_SPEEDS.map((value) => (
              <button
                key={value}
                onClick={() => player.setSpeed(value)}
                className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                  player.speed === value
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {value}x
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={player.showFuture}
              onChange={(event) => player.setShowFuture(event.target.checked)}
            />
            顯示未來 K 線
          </label>
        </div>
      </header>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>播放進度</span>
          <span>
            {player.currentIndex + 1} / {player.points.length} ({progress}%)
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(player.points.length - 1, 0)}
          value={player.currentIndex}
          onChange={(event) => player.seek(Number(event.target.value))}
          className="w-full accent-indigo-600"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">當前時間</p>
          <p className="text-lg font-semibold text-slate-900">{formatTimestamp(current?.time)}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-700">
            <div>
              <p className="text-xs text-slate-500">Open</p>
              <p className="font-medium">{current?.candle?.open?.toLocaleString() ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Close</p>
              <p className="font-medium">{current?.candle?.close?.toLocaleString() ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">High</p>
              <p className="font-medium">{current?.candle?.high?.toLocaleString() ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Low</p>
              <p className="font-medium">{current?.candle?.low?.toLocaleString() ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Volume</p>
              <p className="font-medium">{current?.candle?.volume?.toLocaleString() ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Equity</p>
              <p className="font-medium">{current?.equity ? `${current.equity.toFixed(4)} BTC` : '-'}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-slate-500">成交打點</p>
            <p className="text-xs text-slate-500">點擊列表可跳轉</p>
          </div>
          {trades.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">此時間點沒有成交紀錄</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm text-slate-700">
              {trades.map((trade) => (
                <li
                  key={trade.id}
                  className="flex cursor-pointer items-center justify-between rounded-md bg-white px-3 py-2 shadow-sm transition hover:bg-indigo-50"
                  onClick={() => player.jumpToTime(trade.time)}
                >
                  <span className={trade.side === "buy" ? "text-emerald-600" : "text-rose-600"}>
                    {trade.side.toUpperCase()} {trade.quantity.toLocaleString()}
                  </span>
                  <span className="text-slate-500">@ {trade.price.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {dataset.errors && dataset.errors.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          <p className="font-semibold">資料警告</p>
          <ul className="list-inside list-disc space-y-1">
            {dataset.errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
