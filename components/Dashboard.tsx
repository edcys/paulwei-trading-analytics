'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Trade, PositionSession } from '@/lib/types';
import { TradeList } from './TradeList';
import { PositionSessionList } from './PositionSessionList';
import { PositionDetail } from './PositionDetail';
import { StatsOverview } from './StatsOverview';
import { MonthlyPnLChart } from './MonthlyPnLChart';
import { EquityCurve } from './EquityCurve';
import { TVChart } from './TVChart';
import { TimeMachinePlayer } from './time-machine/TimeMachinePlayer';
import {
    Loader2,
    ChevronLeft,
    ChevronRight,
    LayoutList,
    History,
    BarChart3,
    LineChart,
    TrendingUp,
    Activity
} from 'lucide-react';

type ViewMode = 'overview' | 'positions' | 'trades';

const TIMEFRAME_SECONDS: Record<string, number> = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '30m': 1800,
    '1h': 3600,
    '4h': 14400,
    '1d': 86400,
    '1w': 604800,
};

export function Dashboard() {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [sessions, setSessions] = useState<PositionSession[]>([]);
    const [chartData, setChartData] = useState<{ candles: any[], markers: any[] }>({ candles: [], markers: [] });
    const [chartLoading, setChartLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [account, setAccount] = useState<any>(null);
    const [equityCurve, setEquityCurve] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedSymbol, setSelectedSymbol] = useState('BTCUSD');
    const [timeframe, setTimeframe] = useState<string>('1d');
    const [viewMode, setViewMode] = useState<ViewMode>('overview');
    const [allTrades, setAllTrades] = useState<Trade[]>([]); // All trades for markers
    const [selectedSession, setSelectedSession] = useState<PositionSession | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [timeMachineRange, setTimeMachineRange] = useState<{ from: number; to: number } | null>(null);
    const [showKlines, setShowKlines] = useState(true);
    const limit = 20;

    // Helper function to align time to timeframe bucket
    const alignToTimeframe = (timestamp: number, tf: string): number => {
        const date = new Date(timestamp * 1000);
        
        switch (tf) {
            case '1m':
                date.setSeconds(0, 0);
                break;
            case '5m':
                date.setMinutes(Math.floor(date.getMinutes() / 5) * 5, 0, 0);
                break;
            case '15m':
                date.setMinutes(Math.floor(date.getMinutes() / 15) * 15, 0, 0);
                break;
            case '30m':
                date.setMinutes(Math.floor(date.getMinutes() / 30) * 30, 0, 0);
                break;
            case '1h':
                date.setMinutes(0, 0, 0);
                break;
            case '4h':
                date.setHours(Math.floor(date.getHours() / 4) * 4, 0, 0, 0);
                break;
            case '1d':
                date.setHours(0, 0, 0, 0);
                break;
            case '1w':
                const day = date.getDay();
                const diff = date.getDate() - day + (day === 0 ? -6 : 1);
                date.setDate(diff);
                date.setHours(0, 0, 0, 0);
                break;
        }
        
        return Math.floor(date.getTime() / 1000);
    };

    // Generate chart markers from trades or selected session
    const chartMarkers = useMemo(() => {
        // Use session trades if a session is selected, otherwise use all trades
        const tradesToMark = selectedSession ? selectedSession.trades : allTrades;
        
        if (!tradesToMark || tradesToMark.length === 0 || chartData.candles.length === 0) {
            return [];
        }

        // Get the visible chart time range (avoid spread operator for large arrays)
        let minTime = Infinity;
        let maxTime = -Infinity;
        for (const candle of chartData.candles) {
            if (candle.time < minTime) minTime = candle.time;
            if (candle.time > maxTime) maxTime = candle.time;
        }

        // Group trades by timeframe bucket and aggregate
        const bucketMap = new Map<string, { buys: number; sells: number; buyQty: number; sellQty: number; avgBuyPrice: number; avgSellPrice: number }>();
        
        tradesToMark.forEach(trade => {
            const tradeTime = Math.floor(new Date(trade.datetime).getTime() / 1000);
            
            // Skip trades outside the visible range
            if (tradeTime < minTime || tradeTime > maxTime) {
                return;
            }
            
            const bucketTime = alignToTimeframe(tradeTime, timeframe);
            const key = `${bucketTime}-${trade.side}`;
            
            if (!bucketMap.has(key)) {
                bucketMap.set(key, { buys: 0, sells: 0, buyQty: 0, sellQty: 0, avgBuyPrice: 0, avgSellPrice: 0 });
            }
            
            const bucket = bucketMap.get(key)!;
            if (trade.side === 'buy') {
                bucket.buyQty += trade.amount;
                bucket.avgBuyPrice = (bucket.avgBuyPrice * bucket.buys + trade.price) / (bucket.buys + 1);
                bucket.buys++;
            } else {
                bucket.sellQty += trade.amount;
                bucket.avgSellPrice = (bucket.avgSellPrice * bucket.sells + trade.price) / (bucket.sells + 1);
                bucket.sells++;
            }
        });

        // Create sorted array of candle times for binary search
        const sortedCandleTimes = chartData.candles.map(c => c.time).sort((a, b) => a - b);
        const candleTimeSet = new Set(sortedCandleTimes);
        
        // Binary search to find closest candle time
        const findClosestCandleTime = (time: number): number | null => {
            if (candleTimeSet.has(time)) return time;
            if (sortedCandleTimes.length === 0) return null;
            
            // Binary search for insertion point
            let left = 0;
            let right = sortedCandleTimes.length - 1;
            
            while (left < right) {
                const mid = Math.floor((left + right) / 2);
                if (sortedCandleTimes[mid] < time) {
                    left = mid + 1;
                } else {
                    right = mid;
                }
            }
            
            // Check closest between left and left-1
            const window = TIMEFRAME_SECONDS[timeframe] || 3600;
            
            let closest: number | null = null;
            let minDiff = Infinity;
            
            // Check the found index and one before
            for (const idx of [left - 1, left, left + 1]) {
                if (idx >= 0 && idx < sortedCandleTimes.length) {
                    const diff = Math.abs(sortedCandleTimes[idx] - time);
                    if (diff < minDiff && diff <= window) {
                        minDiff = diff;
                        closest = sortedCandleTimes[idx];
                    }
                }
            }
            
            return closest;
        };

        // Generate markers
        const markers: any[] = [];
        bucketMap.forEach((bucket, key) => {
            const [timeStr, side] = key.split('-');
            const rawTime = parseInt(timeStr);
            
            // Find the closest matching candle time
            const time = findClosestCandleTime(rawTime);
            if (time === null) return;
            
            if (side === 'buy' && bucket.buys > 0) {
                markers.push({
                    time,
                    position: 'belowBar',
                    color: '#10b981',
                    shape: 'arrowUp',
                    text: `BUY ${bucket.buyQty.toLocaleString()} @ $${bucket.avgBuyPrice.toLocaleString(undefined, { maximumFractionDigits: 1 })}`
                });
            }
            if (side === 'sell' && bucket.sells > 0) {
                markers.push({
                    time,
                    position: 'aboveBar',
                    color: '#ef4444',
                    shape: 'arrowDown',
                    text: `SELL ${bucket.sellQty.toLocaleString()} @ $${bucket.avgSellPrice.toLocaleString(undefined, { maximumFractionDigits: 1 })}`
                });
            }
        });

        // Sort by time
        return markers.sort((a, b) => a.time - b.time);
    }, [selectedSession, allTrades, timeframe, chartData.candles]);

    const timeMachineFrames = useMemo(() => {
        return chartData.candles.map((candle) => ({
            id: String(candle.time),
            label: new Date(candle.time * 1000).toLocaleString(),
            timestamp: candle.time,
        }));
    }, [chartData.candles]);

    useEffect(() => {
        setTimeMachineRange(null);
    }, [selectedSymbol, timeframe]);

    // Load Stats and Account Data
    useEffect(() => {
        async function loadStats() {
            try {
                const res = await fetch('/api/trades?type=stats');
                if (!res.ok) throw new Error('Failed to fetch stats');
                const data = await res.json();
                setStats(data.stats);
                setAccount(data.account);
            } catch (err) {
                console.error('Error loading stats:', err);
            }
        }
        loadStats();
    }, []);

    // Load Equity Curve
    useEffect(() => {
        async function loadEquity() {
            try {
                const res = await fetch('/api/trades?type=equity');
                if (!res.ok) throw new Error('Failed to fetch equity');
                const data = await res.json();
                setEquityCurve(data.equityCurve);
            } catch (err) {
                console.error('Error loading equity:', err);
            }
        }
        loadEquity();
    }, []);

    // Load all trades for markers (once per symbol)
    useEffect(() => {
        async function loadAllTrades() {
            try {
                // Fetch all trades for this symbol (for markers)
                const res = await fetch(`/api/trades?symbol=${encodeURIComponent(selectedSymbol)}&limit=10000`);
                if (!res.ok) throw new Error('Failed to fetch trades');
                const data = await res.json();
                setAllTrades(data.trades || []);
            } catch (err) {
                console.error('Error loading trades for markers:', err);
            }
        }
        loadAllTrades();
    }, [selectedSymbol]);

    // Calculate visible range for chart when a session is selected
    const selectedSessionRange = useMemo(() => {
        if (!selectedSession) return null;
        
        const sessionStart = Math.floor(new Date(selectedSession.openTime).getTime() / 1000);
        const sessionEnd = selectedSession.closeTime 
            ? Math.floor(new Date(selectedSession.closeTime).getTime() / 1000)
            : Math.floor(Date.now() / 1000); // Use current time for open positions
        const sessionDuration = sessionEnd - sessionStart;
        
        // Add padding based on timeframe
        const paddingMultiplier: Record<string, number> = {
            '1m': 0.3, '5m': 0.5, '15m': 1, '30m': 2,
            '1h': 3, '4h': 5, '1d': 10, '1w': 20,
        };
        const padding = Math.max(sessionDuration * (paddingMultiplier[timeframe] || 1), 3600 * 6); // At least 6 hours padding
        
        return {
            from: sessionStart - padding,
            to: sessionEnd + padding,
        };
    }, [selectedSession, timeframe]);

    // Load Real OHLCV Chart Data from local files (load ALL data)
    useEffect(() => {
        async function loadChartData() {
            setChartLoading(true);
            try {
                // Load all data without time range filter
                const url = `/api/ohlcv?symbol=${encodeURIComponent(selectedSymbol)}&timeframe=${timeframe}`;
                const res = await fetch(url);
                if (!res.ok) throw new Error('Failed to fetch OHLCV data');
                const data = await res.json();
                console.log(`Loaded ${data.candles?.length || 0} candles for ${selectedSymbol} ${timeframe}`);
                setChartData({ candles: data.candles || [], markers: [] });
            } catch (err) {
                console.error('Error loading OHLCV:', err);
                setChartData({ candles: [], markers: [] });
            } finally {
                setChartLoading(false);
            }
        }
        loadChartData();
    }, [selectedSymbol, timeframe]);

    // Load Table Data (Paginated)
    useEffect(() => {
        async function loadData() {
            if (viewMode === 'overview') {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const typeParam = viewMode === 'positions' ? '&type=sessions' : '';
                const res = await fetch(`/api/trades?page=${page}&limit=${limit}&symbol=${encodeURIComponent(selectedSymbol)}${typeParam}`);
                if (!res.ok) throw new Error('Failed to fetch data');
                const data = await res.json();

                if (viewMode === 'positions') {
                    setSessions(data.sessions);
                    setTotalPages(Math.ceil(data.total / limit));
                } else {
                    setTrades(data.trades);
                    setTotalPages(Math.ceil(data.total / limit));
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [page, selectedSymbol, viewMode]);

    // Reset selected session when switching views or symbols
    useEffect(() => {
        setSelectedSession(null);
    }, [viewMode, selectedSymbol]);

    // Handler to select a session and fetch full trade details
    const handleSelectSession = async (session: PositionSession) => {
        try {
            const res = await fetch(`/api/trades?sessionId=${encodeURIComponent(session.id)}`);
            if (!res.ok) throw new Error('Failed to fetch session details');
            const data = await res.json();
            setSelectedSession(data.session);
        } catch (err) {
            console.error('Error fetching session:', err);
            setSelectedSession(session);
        }
    };

    if (loading && !stats) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background">
                <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading analytics...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen text-destructive">
                Error: {error}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans selection:bg-primary/20">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-border">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                            BitMEX Analytics
                        </h1>
                        <p className="text-muted-foreground mt-1 font-medium">
                            {account?.user?.username ? `@${account.user.username}` : 'Portfolio'} • 2020-05-01 to Present
                        </p>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                        {/* View Mode Tabs */}
                        <div className="flex bg-secondary/30 backdrop-blur-sm rounded-xl p-1 border border-white/5">
                            <button
                                onClick={() => { setViewMode('overview'); setPage(1); }}
                                className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${viewMode === 'overview'
                                        ? 'bg-primary/10 text-primary shadow-[0_0_10px_rgba(59,130,246,0.2)] ring-1 ring-primary/20'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                                    }`}
                            >
                                <BarChart3 size={16} className="mr-2" /> Overview
                            </button>
                            <button
                                onClick={() => { setViewMode('positions'); setPage(1); }}
                                className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${viewMode === 'positions'
                                        ? 'bg-primary/10 text-primary shadow-[0_0_10px_rgba(59,130,246,0.2)] ring-1 ring-primary/20'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                                    }`}
                            >
                                <History size={16} className="mr-2" /> Positions
                            </button>
                            <button
                                onClick={() => { setViewMode('trades'); setPage(1); }}
                                className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${viewMode === 'trades'
                                        ? 'bg-primary/10 text-primary shadow-[0_0_10px_rgba(59,130,246,0.2)] ring-1 ring-primary/20'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                                    }`}
                            >
                                <LayoutList size={16} className="mr-2" /> Trades
                            </button>
                        </div>

                        {/* Symbol Selector */}
                        <div className="relative">
                            <select
                                value={selectedSymbol}
                                onChange={(e) => {
                                    setSelectedSymbol(e.target.value);
                                    setPage(1);
                                }}
                                className="appearance-none pl-4 pr-10 py-2.5 bg-secondary/30 border border-white/5 rounded-xl text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all hover:bg-secondary/50 cursor-pointer"
                            >
                                <option value="BTCUSD">BTCUSD</option>
                                <option value="ETHUSD">ETHUSD</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-muted-foreground">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Overview Mode */}
                {viewMode === 'overview' && stats && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <StatsOverview stats={stats} account={account} />

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="glass rounded-xl p-6 hover-card">
                                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-foreground">
                                    <TrendingUp className="w-5 h-5 text-primary" />
                                    Equity Curve
                                </h3>
                                <EquityCurve data={equityCurve} />
                            </div>
                            <div className="glass rounded-xl p-6 hover-card">
                                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-foreground">
                                    <BarChart3 className="w-5 h-5 text-primary" />
                                    Monthly PnL
                                </h3>
                                <MonthlyPnLChart data={stats.monthlyPnl} />
                            </div>
                        </div>

                        {/* Price Chart */}
                        <div className="glass rounded-xl p-6 hover-card">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                                    <Activity className="w-5 h-5 text-primary" />
                                    Price Action <span className="text-muted-foreground text-sm font-normal ml-2">{selectedSymbol.split(':')[0]}</span>
                                </h3>
                                <div className="flex bg-secondary/30 rounded-lg p-1 border border-white/5 overflow-x-auto">
                                    {(['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'] as const).map((tf) => (
                                        <button
                                            key={tf}
                                            onClick={() => setTimeframe(tf)}
                                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${timeframe === tf
                                                    ? 'bg-primary/10 text-primary shadow-sm'
                                                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                                                }`}
                                        >
                                            {tf.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {showKlines ? (
                                <TVChart
                                    data={chartData.candles}
                                    markers={chartMarkers}
                                    loading={chartLoading}
                                    visibleRange={timeMachineRange}
                                />
                            ) : (
                                <div className="w-full h-[500px] flex items-center justify-center bg-secondary/20 rounded-lg border border-dashed border-white/10 text-sm text-muted-foreground">
                                    K 線已隱藏，使用下方開關重新顯示。
                                </div>
                            )}
                            <div className="mt-4">
                                <TimeMachinePlayer
                                    frames={timeMachineFrames}
                                    timeframeSeconds={TIMEFRAME_SECONDS[timeframe] || 3600}
                                    onFrameChange={(frame) => {
                                        if (!frame) {
                                            setTimeMachineRange(null);
                                            return;
                                        }
                                        const padding = (TIMEFRAME_SECONDS[timeframe] || 3600) * 50;
                                        setTimeMachineRange({
                                            from: frame.timestamp - padding,
                                            to: frame.timestamp + padding,
                                        });
                                    }}
                                    onKlineToggle={(show) => setShowKlines(show)}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Positions/Trades Mode */}
                {viewMode !== 'overview' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Chart Section */}
                        <section className="glass rounded-xl p-6">
                            <div className="flex justify-between items-center mb-6">
                                {selectedSession ? (
                                    <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 rounded-xl border border-primary/20">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                        </span>
                                        <span className="text-sm font-medium text-primary">
                                            Viewing Position: {selectedSession.side.toUpperCase()} {selectedSession.maxSize.toLocaleString()}
                                        </span>
                                    </div>
                                ) : (
                                    <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                                        <Activity className="w-5 h-5 text-primary" />
                                        {selectedSymbol.split(':')[0]} Chart
                                    </h3>
                                )}
                                <div className="flex bg-secondary/30 rounded-lg p-1 border border-white/5 overflow-x-auto">
                                    {(['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'] as const).map((tf) => (
                                        <button
                                            key={tf}
                                            onClick={() => setTimeframe(tf)}
                                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${timeframe === tf
                                                    ? 'bg-primary/10 text-primary shadow-sm'
                                                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                                                }`}
                                        >
                                            {tf.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {showKlines ? (
                                <TVChart
                                    data={chartData.candles}
                                    markers={chartMarkers}
                                    loading={chartLoading}
                                    visibleRange={timeMachineRange ?? selectedSessionRange}
                                />
                            ) : (
                                <div className="w-full h-[500px] flex items-center justify-center bg-secondary/20 rounded-lg border border-dashed border-white/10 text-sm text-muted-foreground">
                                    K 線已隱藏，使用下方開關重新顯示。
                                </div>
                            )}
                            <div className="mt-4">
                                <TimeMachinePlayer
                                    frames={timeMachineFrames}
                                    timeframeSeconds={TIMEFRAME_SECONDS[timeframe] || 3600}
                                    onFrameChange={(frame) => {
                                        if (!frame) {
                                            setTimeMachineRange(null);
                                            return;
                                        }
                                        const padding = (TIMEFRAME_SECONDS[timeframe] || 3600) * 50;
                                        setTimeMachineRange({
                                            from: frame.timestamp - padding,
                                            to: frame.timestamp + padding,
                                        });
                                    }}
                                    onKlineToggle={(show) => setShowKlines(show)}
                                />
                            </div>
                        </section>

                        {/* Data Section */}
                        <section>
                            {selectedSession ? (
                                <PositionDetail
                                    session={selectedSession}
                                    onBack={() => setSelectedSession(null)}
                                />
                            ) : (
                                <>
                                    <div className="flex justify-between items-center mb-6">
                                        <h2 className="text-xl font-bold tracking-tight text-foreground">
                                            {viewMode === 'trades' ? 'Trade Log' : 'Position History'}
                                        </h2>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                                disabled={page === 1}
                                                className="p-2 rounded-lg border border-white/10 hover:bg-secondary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <ChevronLeft size={20} />
                                            </button>
                                            <span className="text-sm font-medium px-2 text-muted-foreground">
                                                Page {page} of {totalPages}
                                            </span>
                                            <button
                                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                                disabled={page === totalPages}
                                                className="p-2 rounded-lg border border-white/10 hover:bg-secondary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <ChevronRight size={20} />
                                            </button>
                                        </div>
                                    </div>

                                    {viewMode === 'trades' ? (
                                        <div className="glass rounded-xl overflow-hidden border border-white/5">
                                            <TradeList trades={trades} />
                                        </div>
                                    ) : (
                                        <PositionSessionList
                                            sessions={sessions}
                                            onSelectSession={handleSelectSession}
                                        />
                                    )}
                                </>
                            )}
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
}
