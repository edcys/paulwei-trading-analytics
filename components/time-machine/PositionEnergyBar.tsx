'use client';

import React from 'react';

interface PositionEnergyBarProps {
    /**
     * Ratio of net exposure over total capital. Values greater than 1 will be clamped
     * for rendering purposes but the exact ratio is still displayed numerically.
     */
    exposureRatio: number;
    className?: string;
}

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);

const getZoneInfo = (ratio: number) => {
    const absRatio = Math.abs(ratio);
    if (absRatio < 0.35) {
        return { label: '輕倉', color: 'text-emerald-500', bg: 'from-emerald-500/30 via-emerald-500/20 to-transparent' };
    }
    if (absRatio < 0.7) {
        return { label: '中倉', color: 'text-amber-400', bg: 'from-amber-400/30 via-amber-400/20 to-transparent' };
    }
    return { label: '重倉', color: 'text-rose-500', bg: 'from-rose-500/30 via-rose-500/20 to-transparent' };
};

export function PositionEnergyBar({ exposureRatio, className }: PositionEnergyBarProps) {
    const clamped = clamp(exposureRatio, -1, 1);
    const indicatorPosition = `${((clamped + 1) / 2) * 100}%`;
    const zone = getZoneInfo(exposureRatio);
    const directionLabel = exposureRatio >= 0 ? '淨多敞口' : '淨空敞口';

    return (
        <div className={`glass rounded-xl p-3 border border-white/5 shadow-inner backdrop-blur-sm ${className || ''}`}>
            <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Exposure</div>
                <div className={`text-sm font-bold ${zone.color}`}>
                    {zone.label} · {(exposureRatio * 100).toFixed(1)}%
                </div>
            </div>
            <div className="relative h-3 rounded-full overflow-hidden bg-secondary/50 border border-white/5">
                <div className="absolute inset-0 grid grid-cols-3 divide-x divide-white/10">
                    <div className="bg-emerald-500/20" />
                    <div className="bg-amber-400/20" />
                    <div className="bg-rose-500/20" />
                </div>
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_0_3px_rgba(255,255,255,0.35)] transition-all duration-300"
                    style={{ left: indicatorPosition }}
                />
            </div>
            <div className="mt-2 text-xs text-muted-foreground flex justify-between">
                <span className="font-medium">{directionLabel}</span>
                <span className="font-mono">Ratio = |Net| / Total</span>
            </div>
        </div>
    );
}
