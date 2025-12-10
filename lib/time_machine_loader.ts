import 'server-only';
import {
  formatSymbol,
  getEquityCurve,
  getOHLCData,
  loadTradesFromCSV,
  TimelinePoint,
  TimelineTrade,
  TimeMachineTimeline,
} from './data_loader';

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

function getBucket(timestamp: number, timeframe: string): number {
  const bucketSize = TIMEFRAME_SECONDS[timeframe] ?? TIMEFRAME_SECONDS['1d'];
  return Math.floor(timestamp / bucketSize) * bucketSize;
}

function mapTradesToTimeline(trades: TimelineTrade[], timeframe: string): Map<number, TimelinePoint> {
  const points = new Map<number, TimelinePoint>();

  trades.forEach((trade) => {
    const bucket = getBucket(trade.time, timeframe);
    const existing = points.get(bucket) ?? {
      time: bucket,
      trades: [],
    };
    existing.trades = [...(existing.trades ?? []), trade];
    points.set(bucket, existing);
  });

  return points;
}

export interface TimeMachineOptions {
  symbol?: string;
  timeframe?: keyof typeof TIMEFRAME_SECONDS;
  clipToRange?: boolean;
}

export async function buildTimeMachineTimeline(
  options: TimeMachineOptions = {},
): Promise<TimeMachineTimeline> {
  const symbol = options.symbol ?? 'BTCUSD';
  const timeframe = options.timeframe ?? '1d';
  const errors: string[] = [];

  const ohlcTimeframe = (['1h', '4h', '1d', '1w'] as const).includes(timeframe as any)
    ? (timeframe as '1h' | '4h' | '1d' | '1w')
    : '1d';

  let candlePoints: TimelinePoint[] = [];
  try {
    const { candles } = getOHLCData(symbol, ohlcTimeframe);
    candlePoints = candles.map((candle) => ({
      time: candle.time,
      candle: {
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      },
      trades: [],
    }));
  } catch (error) {
    errors.push(
      error instanceof Error
        ? error.message
        : '無法載入 K 線資料，請確認 CSV 是否存在',
    );
  }

  let tradePoints = new Map<number, TimelinePoint>();
  try {
    const trades = loadTradesFromCSV()
      .filter((trade) => formatSymbol(trade.symbol) === formatSymbol(symbol))
      .map<TimelineTrade>((trade) => ({
        id: trade.id,
        time: Math.floor(new Date(trade.datetime).getTime() / 1000),
        side: trade.side,
        price: trade.price,
        quantity: trade.amount,
      }));

    tradePoints = mapTradesToTimeline(trades, timeframe);
  } catch (error) {
    errors.push(
      error instanceof Error
        ? error.message
        : '無法載入成交資料，請確認 CSV 是否存在',
    );
  }

  const pointMap = new Map<number, TimelinePoint>();

  [...candlePoints, ...tradePoints.values()].forEach((point) => {
    const existing = pointMap.get(point.time);
    if (existing) {
      pointMap.set(point.time, {
        ...existing,
        ...point,
        trades: [...(existing.trades ?? []), ...(point.trades ?? [])],
      });
    } else {
      pointMap.set(point.time, point);
    }
  });

  try {
    const equity = getEquityCurve();
    equity.forEach((balancePoint) => {
      const bucket = getBucket(balancePoint.time, timeframe);
      const existing = pointMap.get(bucket) ?? { time: bucket };
      pointMap.set(bucket, {
        ...existing,
        equity: balancePoint.balance,
      });
    });
  } catch (error) {
    errors.push(
      error instanceof Error
        ? error.message
        : '無法載入資金曲線資料，請確認 CSV 是否存在',
    );
  }

  const points = Array.from(pointMap.values()).sort((a, b) => a.time - b.time);

  return {
    symbol,
    timeframe,
    points,
    errors,
    range:
      points.length > 0
        ? {
            start: points[0].time,
            end: points[points.length - 1].time,
          }
        : null,
  };
}
