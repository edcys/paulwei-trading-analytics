'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { Loader2 } from 'lucide-react';

export interface TimelineTrade {
    side: 'long' | 'short' | 'buy' | 'sell';
    volume: number;
    label?: string;
}

export interface TimelinePoint {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
    trades?: TimelineTrade[];
}

interface TVChartProps {
    data?: {
        time: number;
        open: number;
        high: number;
        low: number;
        close: number;
    }[];
    timeline?: TimelinePoint[];
    currentIndex?: number;
    showFuture?: boolean;
    markers?: {
        time: number;
        position: 'aboveBar' | 'belowBar' | 'inBar';
        color: string;
        shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown';
        text: string;
        size?: number;
    }[];
    onCandleSelect?: (time: number, index?: number) => void;
    onTimelineJump?: (time: number, index?: number) => void;
    loading?: boolean;
    visibleRange?: {
        from: number;
        to: number;
    } | null;
    colors?: {
        backgroundColor?: string;
        lineColor?: string;
        textColor?: string;
    };
}

export const TVChart = ({
    data,
    timeline,
    currentIndex,
    showFuture = true,
    markers = [],
    loading = false,
    visibleRange = null,
    colors: {
        backgroundColor = 'transparent',
        textColor = '#9ca3af',
    } = {},
    onCandleSelect,
    onTimelineJump,
}: TVChartProps) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const futureSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

    const { historyData, futureData, markerPoints, maxVolume } = useMemo(() => {
        const points = timeline ?? data ?? [];
        const safeIndex = typeof currentIndex === 'number' ? Math.max(Math.min(currentIndex, points.length - 1), -1) : undefined;
        const history = safeIndex !== undefined ? points.slice(0, safeIndex + 1) : points;
        const future = safeIndex !== undefined ? points.slice(safeIndex + 1) : [];

        const trades = (timeline ?? []).flatMap(point => point.trades ?? []);
        const largestVolume = Math.max(...trades.map(t => t.volume).filter(Boolean), 0);

        return {
            historyData: history,
            futureData: future,
            markerPoints: timeline ?? [],
            maxVolume: largestVolume,
        };
    }, [timeline, data, currentIndex]);

    useEffect(() => {
        if (!chartContainerRef.current || loading) return;

        // Clean up previous chart
        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
        }

        const handleResize = () => {
            chartRef.current?.applyOptions({ width: chartContainerRef.current!.clientWidth });
        };

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: backgroundColor },
                textColor,
            },
            width: chartContainerRef.current.clientWidth,
            height: 500,
            grid: {
                vertLines: { color: 'rgba(51, 65, 85, 0.5)' },
                horzLines: { color: 'rgba(51, 65, 85, 0.5)' },
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderColor: '#334155',
            },
            rightPriceScale: {
                borderColor: '#334155',
            },
            crosshair: {
                vertLine: {
                    color: 'rgba(59, 130, 246, 0.5)',
                    width: 1,
                    style: 2,
                },
                horzLine: {
                    color: 'rgba(59, 130, 246, 0.5)',
                    width: 1,
                    style: 2,
                },
            },
        });

        chartRef.current = chart;

        const candlestickSeries = chart.addCandlestickSeries({
            upColor: '#10b981',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444'
        });

        if (futureSeriesRef.current) {
            chart.removeSeries(futureSeriesRef.current);
            futureSeriesRef.current = null;
        }

        const formatData = (points?: typeof data) =>
            (points ?? [])
                .filter((d) =>
                    d !== null &&
                    d !== undefined &&
                    [d.time, d.open, d.high, d.low, d.close].every((value) => Number.isFinite(value))
                )
                .map(d => ({
                    time: d.time as Time,
                    open: d.open,
                    high: d.high,
                    low: d.low,
                    close: d.close,
                }));

        const formattedHistory = formatData(historyData);
        const formattedFuture = formatData(showFuture ? futureData : []);

        if (formattedHistory.length > 0) {
            candlestickSeries.setData(formattedHistory);
        }

        if (formattedFuture.length > 0 && showFuture) {
            futureSeriesRef.current = chart.addCandlestickSeries({
                upColor: 'rgba(148, 163, 184, 0.5)',
                downColor: 'rgba(148, 163, 184, 0.5)',
                borderVisible: false,
                wickUpColor: 'rgba(148, 163, 184, 0.4)',
                wickDownColor: 'rgba(148, 163, 184, 0.4)',
                lastValueVisible: false,
                priceLineVisible: false,
            });

            futureSeriesRef.current.setData(formattedFuture);
        }

        const timelineMarkers = (markerPoints ?? []).flatMap(point =>
            (point.trades ?? []).map(trade => {
                const volumeRatio = maxVolume > 0 ? Math.min(trade.volume / maxVolume, 1) : 0;
                const baseSize = 10 + volumeRatio * 8;
                const opacity = 0.4 + volumeRatio * 0.6;
                const isLong = trade.side === 'long' || trade.side === 'buy';

                return {
                    time: point.time as Time,
                    position: isLong ? 'belowBar' : 'aboveBar',
                    color: `${isLong ? 'rgba(16, 185, 129,' : 'rgba(239, 68, 68,'}${opacity})`,
                    shape: isLong ? 'arrowUp' : 'arrowDown',
                    text: trade.label ?? `${isLong ? 'B' : 'S'} ${trade.volume}`,
                    size: baseSize,
                } as const;
            })
        );

        const formattedMarkers = [...(markers ?? []), ...timelineMarkers]
            .filter(m => m && m.time)
            .map(m => ({
                time: m.time as Time,
                position: m.position,
                color: m.color,
                shape: m.shape,
                text: m.text,
                size: m.size,
            }))
            .sort((a, b) => (a.time as number) - (b.time as number));

        if (formattedMarkers.length > 0) {
            candlestickSeries.setMarkers(formattedMarkers);
        }

        // Set visible range if provided, otherwise fit all content
        if (visibleRange) {
            chart.timeScale().setVisibleRange({
                from: visibleRange.from as Time,
                to: visibleRange.to as Time,
            });
        } else {
            chart.timeScale().fitContent();
        }

        const markerTimes = new Set((formattedMarkers ?? []).map(marker => Number(marker.time)));

        chart.subscribeClick((param) => {
            if (!param.time) return;

            const clickedTime = Number(param.time);
            const sourcePoints = timeline ?? data ?? [];

            if (onCandleSelect) {
                const idx = sourcePoints.findIndex(point => point.time === clickedTime);
                onCandleSelect(clickedTime, idx >= 0 ? idx : undefined);
            }

            if (onTimelineJump && markerTimes.has(clickedTime)) {
                const idx = sourcePoints.findIndex(point => point.time === clickedTime);
                onTimelineJump(clickedTime, idx >= 0 ? idx : undefined);
            }
        });

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
            }
        };
    }, [
        data,
        timeline,
        markers,
        loading,
        visibleRange,
        backgroundColor,
        textColor,
        historyData,
        futureData,
        showFuture,
        markerPoints,
        maxVolume,
        onCandleSelect,
        onTimelineJump,
        currentIndex,
    ]);

    const hasData = (timeline ?? data)?.length ?? 0;

    if (loading) {
        return (
            <div className="w-full h-[500px] flex items-center justify-center bg-secondary/20 rounded-lg">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Loading chart data...</span>
                </div>
            </div>
        );
    }

    if (!hasData) {
        return (
            <div className="w-full h-[500px] flex items-center justify-center bg-secondary/20 rounded-lg">
                <span className="text-sm text-muted-foreground">No chart data available</span>
            </div>
        );
    }

    return (
        <div ref={chartContainerRef} className="w-full h-[500px]" />
    );
};
