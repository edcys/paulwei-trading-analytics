export type PlaybackSpeed = 1 | 2 | 5 | 10;

export interface TimelinePoint {
  /**
   * Epoch milliseconds representing the moment the point occurs.
   */
  timestamp: number;
  /**
   * Optional label for UI display.
   */
  label?: string;
  /**
   * Optional payload for consumers (e.g. candle or marker id).
   */
  payload?: Record<string, unknown>;
}
