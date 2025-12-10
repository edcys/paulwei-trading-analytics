'use client';

import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PlaybackSpeed, TimelinePoint } from './types';

type TimeMachineContextValue = {
  points: TimelinePoint[];
  currentIndex: number;
  currentPoint?: TimelinePoint;
  isPlaying: boolean;
  speed: PlaybackSpeed;
  progress: number;
  isScrubbing: boolean;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  seekToIndex: (index: number) => void;
  seekToProgress: (progress: number) => void;
  beginScrub: () => void;
  endScrub: () => void;
};

const TimeMachineContext = createContext<TimeMachineContextValue | null>(null);

interface TimeMachineProviderProps {
  points: TimelinePoint[];
  initialIndex?: number;
  defaultSpeed?: PlaybackSpeed;
  onPointChange?: (point: TimelinePoint, index: number) => void;
  children: ReactNode;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function TimeMachineProvider({
  points,
  initialIndex = 0,
  defaultSpeed = 1,
  onPointChange,
  children,
}: TimeMachineProviderProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(defaultSpeed);
  const [progress, setProgress] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const frameRef = useRef<number>();
  const lastFrameTimeRef = useRef<number | null>(null);
  const remainderToNextRef = useRef(0);

  const orderedPoints = useMemo(
    () => [...points].sort((a, b) => a.timestamp - b.timestamp),
    [points],
  );

  const currentPoint = orderedPoints[currentIndex];

  useEffect(() => {
    setCurrentIndex((prev) => clamp(prev, 0, Math.max(orderedPoints.length - 1, 0)));
    remainderToNextRef.current = 0;
  }, [orderedPoints.length]);

  const updateProgress = useCallback(
    (index: number, remainderToNext: number) => {
      if (!orderedPoints.length) {
        setProgress(0);
        return;
      }
      const startTime = orderedPoints[0].timestamp;
      const endTime = orderedPoints[orderedPoints.length - 1].timestamp;
      const clampedEnd = endTime <= startTime ? startTime + orderedPoints.length - 1 : endTime;
      const currentTime = orderedPoints[index]?.timestamp ?? startTime;
      const projected = currentTime + remainderToNext;
      const ratio = (projected - startTime) / (clampedEnd - startTime);
      setProgress(clamp(ratio, 0, 1));
    },
    [orderedPoints],
  );

  const notifyPointChange = useCallback(
    (index: number) => {
      const point = orderedPoints[index];
      if (point && onPointChange) {
        onPointChange(point, index);
      }
    },
    [onPointChange, orderedPoints],
  );

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const play = useCallback(() => {
    if (orderedPoints.length > 1) {
      setIsPlaying(true);
    }
  }, [orderedPoints.length]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const seekToIndex = useCallback(
    (index: number) => {
      const safeIndex = clamp(index, 0, Math.max(orderedPoints.length - 1, 0));
      remainderToNextRef.current = 0;
      setCurrentIndex(safeIndex);
      updateProgress(safeIndex, 0);
      notifyPointChange(safeIndex);
    },
    [notifyPointChange, orderedPoints.length, updateProgress],
  );

  const seekToProgress = useCallback(
    (value: number) => {
      if (!orderedPoints.length) return;
      const normalized = clamp(value, 0, 1);
      const startTime = orderedPoints[0].timestamp;
      const endTime = orderedPoints[orderedPoints.length - 1].timestamp;
      const targetTime = startTime + normalized * (endTime - startTime);
      const nearestIndex = orderedPoints.reduce((closestIdx, point, idx) => {
        const closestPoint = orderedPoints[closestIdx];
        const closestDelta = Math.abs(closestPoint.timestamp - targetTime);
        const currentDelta = Math.abs(point.timestamp - targetTime);
        return currentDelta < closestDelta ? idx : closestIdx;
      }, 0);
      seekToIndex(nearestIndex);
    },
    [orderedPoints, seekToIndex],
  );

  const beginScrub = useCallback(() => setIsScrubbing(true), []);
  const endScrub = useCallback(() => setIsScrubbing(false), []);

  useEffect(() => {
    if (!orderedPoints.length) return;
    notifyPointChange(clamp(currentIndex, 0, orderedPoints.length - 1));
  }, [currentIndex, notifyPointChange, orderedPoints.length]);

  useEffect(() => {
    if (!isPlaying) {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      lastFrameTimeRef.current = null;
      return;
    }

    const step = (timestamp: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = timestamp;
        frameRef.current = requestAnimationFrame(step);
        return;
      }

      const elapsed = timestamp - lastFrameTimeRef.current;
      lastFrameTimeRef.current = timestamp;
      const scaledElapsed = elapsed * speed;

      let nextIndex = currentIndex;
      let remainderToNext = remainderToNextRef.current + scaledElapsed;

      while (
        nextIndex < orderedPoints.length - 1 &&
        remainderToNext >=
          Math.max(
            orderedPoints[nextIndex + 1].timestamp - orderedPoints[nextIndex].timestamp,
            1,
          )
      ) {
        const gap = Math.max(
          orderedPoints[nextIndex + 1].timestamp - orderedPoints[nextIndex].timestamp,
          1,
        );
        remainderToNext -= gap;
        nextIndex += 1;
      }

      if (nextIndex !== currentIndex) {
        remainderToNextRef.current = remainderToNext;
        setCurrentIndex(nextIndex);
        notifyPointChange(nextIndex);
        updateProgress(nextIndex, remainderToNext);
        if (nextIndex === orderedPoints.length - 1) {
          setIsPlaying(false);
        }
      } else {
        remainderToNextRef.current = remainderToNext;
        updateProgress(nextIndex, remainderToNext);
      }

      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [currentIndex, isPlaying, notifyPointChange, orderedPoints, speed, updateProgress]);

  useEffect(() => {
    updateProgress(currentIndex, remainderToNextRef.current);
  }, [currentIndex, orderedPoints, updateProgress]);

  const value = useMemo<TimeMachineContextValue>(() => ({
    points: orderedPoints,
    currentIndex,
    currentPoint,
    isPlaying,
    speed,
    progress,
    isScrubbing,
    play,
    pause,
    togglePlay,
    setSpeed,
    seekToIndex,
    seekToProgress,
    beginScrub,
    endScrub,
  }), [
    orderedPoints,
    currentIndex,
    currentPoint,
    isPlaying,
    speed,
    progress,
    isScrubbing,
    play,
    pause,
    togglePlay,
    setSpeed,
    seekToIndex,
    seekToProgress,
    beginScrub,
    endScrub,
  ]);

  return <TimeMachineContext.Provider value={value}>{children}</TimeMachineContext.Provider>;
}

export const useTimeMachinePlayer = () => {
  const ctx = useContext(TimeMachineContext);
  if (!ctx) {
    throw new Error('useTimeMachinePlayer must be used within a TimeMachineProvider');
  }
  return ctx;
};
