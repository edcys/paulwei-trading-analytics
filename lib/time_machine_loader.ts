import {
    Trade,
    WalletTransaction,
    PositionSession,
    TimelinePoint,
    TimelineEvent,
    Timeframe,
    TimelineCandle,
    toInternalSymbol,
} from './types';
import { getPositionSessions, loadTradesFromCSV, loadWalletHistoryFromCSV } from './data_loader';

function timeframeToMs(timeframe: Timeframe): number {
    const units: Record<Timeframe, number> = {
        '1m': 60 * 1000,
        '5m': 5 * 60 * 1000,
        '15m': 15 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
    };

    return units[timeframe];
}

function getBucketStart(timestamp: number, timeframe: Timeframe): number {
    const frameMs = timeframeToMs(timeframe);
    return Math.floor(timestamp / frameMs) * frameMs;
}

function filterBySymbol<T extends { symbol: string; displaySymbol: string }>(
    items: T[],
    symbol: string,
): T[] {
    const internalSymbol = toInternalSymbol(symbol);
    return items.filter(
        (item) => item.symbol === symbol || item.symbol === internalSymbol || item.displaySymbol === symbol,
    );
}

function aggregateCandle(candle: TimelineCandle | undefined, trade: Trade): TimelineCandle {
    const base: TimelineCandle =
        candle || ({ open: trade.price, high: trade.price, low: trade.price, close: trade.price, volume: 0 } as const);

    return {
        open: base.open,
        high: Math.max(base.high, trade.price),
        low: Math.min(base.low, trade.price),
        close: trade.price,
        volume: base.volume + trade.amount,
    };
}

function ensureBucket(
    buckets: Map<number, TimelinePoint>,
    bucket: number,
    symbol: string,
    timeframe: Timeframe,
): TimelinePoint {
    if (!buckets.has(bucket)) {
        buckets.set(bucket, {
            timestamp: bucket,
            symbol,
            timeframe,
            trades: [],
            markers: [],
        });
    }

    return buckets.get(bucket)!;
}

function addPositionMarkers(markers: TimelineEvent[], session: PositionSession, key: 'openTime' | 'closeTime') {
    const time = session[key];
    if (!time) return;

    markers.push({
        type: 'position',
        timestamp: new Date(time).getTime(),
        payload: {
            id: session.id,
            side: session.side,
            maxSize: session.maxSize,
            status: key === 'openTime' ? 'opened' : 'closed',
        },
        message: `${key === 'openTime' ? 'Opened' : 'Closed'} ${session.side} session (${session.displaySymbol})`,
    });
}

function normalizeWallet(w: WalletTransaction) {
    const SAT_TO_BTC = 100000000;
    return {
        ...w,
        walletBalance: w.walletBalance / SAT_TO_BTC,
        marginBalance: w.marginBalance !== null ? w.marginBalance / SAT_TO_BTC : null,
    };
}

export function buildTimeline(
    symbol: string = 'BTCUSD',
    timeframe: Timeframe = '1h',
): TimelinePoint[] {
    const trades = filterBySymbol(loadTradesFromCSV(), symbol).sort(
        (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
    );
    const walletHistory = loadWalletHistoryFromCSV().map(normalizeWallet).sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    const sessions = filterBySymbol(getPositionSessions(), symbol);

    const buckets = new Map<number, TimelinePoint>();
    let cumulativeExposure = 0;

    trades.forEach((trade) => {
        const ts = new Date(trade.datetime).getTime();
        const bucket = getBucketStart(ts, timeframe);
        const point = ensureBucket(buckets, bucket, symbol, timeframe);
        point.trades.push(trade);
        point.candle = aggregateCandle(point.candle, trade);
        cumulativeExposure += trade.side === 'buy' ? trade.amount : -trade.amount;
        point.netExposure = cumulativeExposure;
    });

    walletHistory.forEach((wallet) => {
        const ts = new Date(wallet.timestamp).getTime();
        const bucket = getBucketStart(ts, timeframe);
        const point = ensureBucket(buckets, bucket, symbol, timeframe);
        point.walletBalance = wallet.walletBalance;
        if (wallet.marginBalance !== null) {
            point.equity = wallet.marginBalance;
        }
        point.markers.push({
            type: 'wallet',
            timestamp: ts,
            payload: { amount: wallet.amount, walletBalance: wallet.walletBalance, marginBalance: wallet.marginBalance },
            message: wallet.text || wallet.transactType,
        });
    });

    sessions.forEach((session) => {
        const openTs = new Date(session.openTime).getTime();
        const openBucket = getBucketStart(openTs, timeframe);
        const openPoint = ensureBucket(buckets, openBucket, symbol, timeframe);
        addPositionMarkers(openPoint.markers, session, 'openTime');
        if (session.closeTime) {
            const closeTs = new Date(session.closeTime).getTime();
            const closeBucket = getBucketStart(closeTs, timeframe);
            const closePoint = ensureBucket(buckets, closeBucket, symbol, timeframe);
            addPositionMarkers(closePoint.markers, session, 'closeTime');
        }
    });

    const lastHistoricalTime = Math.max(
        trades.length ? new Date(trades[trades.length - 1].datetime).getTime() : 0,
        walletHistory.length ? new Date(walletHistory[walletHistory.length - 1].timestamp).getTime() : 0,
        sessions.length
            ? Math.max(
                  ...sessions
                      .flatMap((s) => [s.openTime, s.closeTime].filter(Boolean))
                      .map((t) => new Date(t!).getTime()),
              )
            : 0,
    );

    const timeline = Array.from(buckets.values())
        .sort((a, b) => a.timestamp - b.timestamp)
        .map((point) => ({
            ...point,
            candle: point.candle
                ? { ...point.candle, isFuture: point.timestamp > lastHistoricalTime }
                : undefined,
            isFuture: point.timestamp > lastHistoricalTime,
        }));

    return timeline;
}
