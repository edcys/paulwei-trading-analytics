'use client';

import React, { useEffect, useMemo } from 'react';
import { Pause, Play, RotateCcw, RotateCw } from 'lucide-react';
import { TimeMachineFrame, useTimeMachinePlayer } from './useTimeMachinePlayer';

interface TimeMachinePlayerProps {
    frames: TimeMachineFrame[];
    timeframeSeconds?: number;
    onFrameChange?: (frame: TimeMachineFrame | null) => void;
    onKlineToggle?: (show: boolean) => void;
}

const SPEED_HINTS = ['1 (0.5x)', '2 (1x)', '3 (2x)', '4 (4x)', '5 (8x)'];

export function TimeMachinePlayer({ frames, timeframeSeconds = 3600, onFrameChange, onKlineToggle }: TimeMachinePlayerProps) {
    const player = useTimeMachinePlayer(frames, { defaultSpeed: 1 });

    useEffect(() => {
        onFrameChange?.(player.currentFrame);
    }, [onFrameChange, player.currentFrame]);

    useEffect(() => {
        onKlineToggle?.(player.showKlines);
    }, [onKlineToggle, player.showKlines]);

    const activeRange = useMemo(() => {
        if (!player.currentFrame) return null;
        const padding = timeframeSeconds * 50;
        return {
            from: player.currentFrame.timestamp - padding,
            to: player.currentFrame.timestamp + padding,
        };
    }, [player.currentFrame, timeframeSeconds]);

    return (
        <div className="glass rounded-xl p-4 border border-white/5">
            <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={player.previousFrame}
                            title="上一幀 (←)"
                            aria-label="上一幀"
                            className="p-2 rounded-lg border border-white/10 hover:bg-secondary/50 transition-colors disabled:opacity-50"
                            disabled={player.currentIndex === 0}
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={player.togglePlay}
                            title={player.isPlaying ? '暫停 (Space)' : '播放 (Space)'}
                            aria-label={player.isPlaying ? '暫停' : '播放'}
                            className="px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary font-medium flex items-center gap-2"
                        >
                            {player.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            <span>{player.isPlaying ? 'Pause' : 'Play'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={player.nextFrame}
                            title="下一幀 (→)"
                            aria-label="下一幀"
                            className="p-2 rounded-lg border border-white/10 hover:bg-secondary/50 transition-colors disabled:opacity-50"
                            disabled={player.currentIndex >= frames.length - 1}
                        >
                            <RotateCw className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">速度</span>
                        {SPEED_HINTS.map((hint, idx) => (
                            <button
                                key={hint}
                                type="button"
                                onClick={() => player.setSpeedFromIndex(idx)}
                                className={`px-2 py-1 rounded-md border text-[11px] transition-colors ${player.speed === [0.5, 1, 2, 4, 8][idx]
                                        ? 'border-primary/40 text-primary bg-primary/5'
                                        : 'border-white/5 text-muted-foreground hover:text-foreground hover:border-white/20'
                                    }`}
                                title={`按數字鍵 ${idx + 1} 切換到 ${hint}`}
                            >
                                {hint}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                    <div className="flex flex-col">
                        <span className="text-muted-foreground">目前時間</span>
                        <span className="font-semibold text-foreground">
                            {player.currentFrame ? player.currentFrame.label : '等待資料'}
                        </span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer" title="保留 K 線顯示設定，離開後也會記得">
                        <input
                            type="checkbox"
                            className="form-checkbox h-4 w-4 text-primary rounded"
                            checked={player.showKlines}
                            onChange={(e) => player.setShowKlines(e.target.checked)}
                        />
                        <span className="text-sm text-foreground">顯示 K 線</span>
                        <span className="text-[11px] text-muted-foreground">
                            {player.showKlines ? '狀態：開啟 (會被記住)' : '狀態：關閉 (會被記住)'}
                        </span>
                    </label>
                </div>

                <div className="rounded-lg border border-dashed border-white/10 bg-secondary/30 p-3 text-xs text-muted-foreground">
                    <div className="flex flex-wrap gap-3">
                        <span className="font-semibold text-foreground">快捷鍵</span>
                        <span>Space：播放/暫停</span>
                        <span>← →：前後一幀</span>
                        <span>數字 1-5：切換速度</span>
                    </div>
                    {activeRange && (
                        <div className="mt-2 text-[11px] text-foreground/70">可視範圍：{new Date(activeRange.from * 1000).toLocaleString()} 至 {new Date(activeRange.to * 1000).toLocaleString()}</div>
                    )}
                </div>
            </div>
        </div>
    );
}
