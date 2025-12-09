import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

interface TimelinePoint {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

const SYMBOL_MAP: Record<string, string> = {
    'BTCUSD': 'XBTUSD',
    'ETHUSD': 'ETHUSD',
    'XBTUSD': 'XBTUSD',
};

const TIMEFRAME_MINUTES: Record<string, number> = {
    '1m': 1,
    '5m': 5,
    '15m': 15,
    '30m': 30,
    '1h': 60,
    '4h': 240,
    '1d': 1440,
    '1w': 10080,
};

const TIMEFRAME_SOURCE: Record<string, string> = {
    '1m': '1m',
    '5m': '5m',
    '15m': '5m',
    '30m': '5m',
    '1h': '1h',
    '4h': '1h',
    '1d': '1d',
    '1w': '1d',
};

const DEFAULT_WINDOW_DAYS: Partial<Record<string, number>> = {
    '1m': 30,
    '5m': 60,
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const dataCache = new Map<string, { points: TimelinePoint[]; loadedAt: number }>();

function loadLocalTimeline(symbol: string, sourceTimeframe: string): TimelinePoint[] | null {
    const cacheKey = `${symbol}_${sourceTimeframe}`;
    const cached = dataCache.get(cacheKey);

    if (cached && Date.now() - cached.loadedAt < CACHE_TTL) {
        return cached.points;
    }

    const dataDir = path.join(process.cwd(), 'data', 'ohlcv');
    const filename = path.join(dataDir, `${symbol}_${sourceTimeframe}.csv`);

    if (!fs.existsSync(filename)) {
        console.warn(`Timeline file not found: ${filename}`);
        return null;
    }

    try {
        const content = fs.readFileSync(filename, 'utf-8');
        const records = parse(content, { columns: true, skip_empty_lines: true });

        const points: TimelinePoint[] = records.map((r: any) => ({
            time: Math.floor(new Date(r.timestamp).getTime() / 1000),
            open: parseFloat(r.open),
            high: parseFloat(r.high),
            low: parseFloat(r.low),
            close: parseFloat(r.close),
            volume: parseFloat(r.volume) || 0,
        }))
            .filter(p => !isNaN(p.time) && !isNaN(p.open) && !isNaN(p.close))
            .sort((a, b) => a.time - b.time);

        dataCache.set(cacheKey, { points, loadedAt: Date.now() });
        return points;
    } catch (error) {
        console.error('Failed to read timeline data:', error);
        return null;
    }
}

function aggregatePoints(points: TimelinePoint[], targetMinutes: number, sourceMinutes: number): TimelinePoint[] {
    if (points.length === 0) return [];

    const ratio = Math.round(targetMinutes / sourceMinutes);
    if (ratio <= 1) return points;

    const bucketSeconds = targetMinutes * 60;
    const buckets = new Map<number, TimelinePoint[]>();

    for (const point of points) {
        const bucketTime = Math.floor(point.time / bucketSeconds) * bucketSeconds;
        if (!buckets.has(bucketTime)) {
            buckets.set(bucketTime, []);
        }
        buckets.get(bucketTime)!.push(point);
    }

    const result: TimelinePoint[] = [];

    for (const [bucketTime, bucketPoints] of buckets.entries()) {
        bucketPoints.sort((a, b) => a.time - b.time);

        result.push({
            time: bucketTime,
            open: bucketPoints[0].open,
            high: Math.max(...bucketPoints.map(p => p.high)),
            low: Math.min(...bucketPoints.map(p => p.low)),
            close: bucketPoints[bucketPoints.length - 1].close,
            volume: bucketPoints.reduce((sum, p) => sum + p.volume, 0),
        });
    }

    return result.sort((a, b) => a.time - b.time);
}

function applyWindow(points: TimelinePoint[], timeframe: string, startParam?: string | null, endParam?: string | null, windowDaysParam?: string | null): { filtered: TimelinePoint[]; windowApplied: boolean } {
    if (startParam || endParam) {
        const startTime = startParam ? parseInt(startParam) : 0;
        const endTime = endParam ? parseInt(endParam) : Infinity;
        return {
            filtered: points.filter(p => p.time >= startTime && p.time <= endTime),
            windowApplied: false,
        };
    }

    const defaultWindowDays = windowDaysParam ? parseInt(windowDaysParam) : DEFAULT_WINDOW_DAYS[timeframe];
    if (!defaultWindowDays || points.length === 0) {
        return { filtered: points, windowApplied: false };
    }

    const latestTime = points[points.length - 1].time;
    const windowStart = latestTime - defaultWindowDays * 24 * 60 * 60;

    return {
        filtered: points.filter(p => p.time >= windowStart),
        windowApplied: true,
    };
}

function paginatePoints(points: TimelinePoint[], page: number, limit: number) {
    const total = points.length;
    const safePage = Math.max(page, 1);
    const safeLimit = Math.max(1, Math.min(limit, 5000));

    const endIndex = total - (safePage - 1) * safeLimit;
    const startIndex = Math.max(0, endIndex - safeLimit);

    const slice = points.slice(startIndex, endIndex);

    return {
        slice,
        total,
        page: safePage,
        limit: safeLimit,
        hasMore: startIndex > 0,
    };
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const displaySymbol = searchParams.get('symbol') || 'BTCUSD';
    const timeframe = searchParams.get('timeframe') || '1h';
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '500');
    const windowDaysParam = searchParams.get('windowDays');

    try {
        const bitmexSymbol = SYMBOL_MAP[displaySymbol] || displaySymbol;
        const sourceTimeframe = TIMEFRAME_SOURCE[timeframe] || timeframe;
        const targetMinutes = TIMEFRAME_MINUTES[timeframe] || 60;
        const sourceMinutes = TIMEFRAME_MINUTES[sourceTimeframe] || targetMinutes;

        let points = loadLocalTimeline(bitmexSymbol, sourceTimeframe);
        if (!points || points.length === 0) {
            return NextResponse.json({
                error: `No timeline data found for ${displaySymbol} ${timeframe}`,
            }, { status: 404 });
        }

        if (targetMinutes !== sourceMinutes) {
            points = aggregatePoints(points, targetMinutes, sourceMinutes);
        }

        const { filtered, windowApplied } = applyWindow(points, timeframe, startParam, endParam, windowDaysParam);
        const { slice, total, hasMore, limit: safeLimit, page: safePage } = paginatePoints(filtered, page, limit);

        const response = {
            symbol: displaySymbol,
            timeframe,
            points: slice,
            page: safePage,
            limit: safeLimit,
            total,
            hasMore,
            windowApplied,
            range: slice.length > 0 ? {
                start: slice[0].time,
                end: slice[slice.length - 1].time,
            } : null,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Time Machine API Error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: 'Failed to load timeline data', details: message }, { status: 500 });
    }
}
