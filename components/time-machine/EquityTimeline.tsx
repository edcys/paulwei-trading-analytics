'use client';

import { useEffect, useRef } from 'react';
import { ColorType, IChartApi, Time, createChart } from 'lightweight-charts';

import { EquityData, equityAreaSeriesOptions } from '../EquityCurve';

interface EquityTimelineProps {
    data: EquityData[];
    currentIndex: number | null;
    highlightedIndices?: number[];
    onSeek?: (index: number, point: EquityData) => void;
}

export function EquityTimeline({
    data,
    currentIndex,
    highlightedIndices = [],
    onSeek,
}: EquityTimelineProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const areaSeriesRef = useRef<ReturnType<IChartApi['addAreaSeries']> | null>(null);

    useEffect(() => {
        if (!containerRef.current || data.length === 0) return;

        const chart = createChart(containerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#9ca3af',
            },
            width: containerRef.current.clientWidth,
            height: 180,
            grid: {
                vertLines: { color: '#334155' },
                horzLines: { color: '#334155' },
            },
            rightPriceScale: {
                borderColor: '#334155',
            },
            timeScale: {
                borderColor: '#334155',
                timeVisible: true,
            },
        });

        chartRef.current = chart;

        const areaSeries = chart.addAreaSeries({ ...equityAreaSeriesOptions, lastValueVisible: false });
        areaSeriesRef.current = areaSeries;

        const chartData = data.map(point => ({
            time: point.time as Time,
            value: point.balance,
        }));

        areaSeries.setData(chartData);
        chart.timeScale().fitContent();

        const handleClick = (param: any) => {
            if (!onSeek || !param.time) return;

            const clickedIndex = chartData.findIndex(point => point.time === param.time);
            if (clickedIndex !== -1) {
                onSeek(clickedIndex, data[clickedIndex]);
            }
        };

        chart.subscribeClick(handleClick);

        const handleResize = () => {
            if (containerRef.current) {
                chart.applyOptions({ width: containerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.unsubscribeClick(handleClick);
            chart.remove();
            chartRef.current = null;
            areaSeriesRef.current = null;
        };
    }, [data, onSeek]);

    useEffect(() => {
        if (!chartRef.current || !areaSeriesRef.current) return;
        if (currentIndex === null || currentIndex === undefined) {
            chartRef.current.clearCrosshairPosition();
            return;
        }

        const point = data[currentIndex];
        if (!point) return;

        chartRef.current.setCrosshairPosition(
            point.balance,
            point.time as Time,
            areaSeriesRef.current,
        );
    }, [currentIndex, data]);

    useEffect(() => {
        if (!areaSeriesRef.current) return;

        const markers = highlightedIndices
            .filter(index => index >= 0 && index < data.length)
            .map(index => ({
                time: data[index].time as Time,
                position: 'aboveBar' as const,
                color: '#f59e0b',
                shape: 'circle' as const,
                size: 1,
            }));

        areaSeriesRef.current.setMarkers(markers);
    }, [highlightedIndices, data]);

    return <div ref={containerRef} className="w-full h-[180px]" />;
}
