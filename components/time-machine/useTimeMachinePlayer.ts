"use client";

import { useEffect, useMemo, useState } from "react";
import { TimelinePoint } from "@/lib/types";

export const PLAYBACK_SPEEDS = [1, 2, 5, 10];

export interface TimeMachinePlayerState {
  points: TimelinePoint[];
  currentIndex: number;
  isPlaying: boolean;
  speed: number;
  showFuture: boolean;
  currentPoint: TimelinePoint | null;
  setSpeed: (speed: number) => void;
  togglePlay: () => void;
  setShowFuture: (value: boolean) => void;
  seek: (index: number) => void;
  jumpToTime: (timestamp: number) => void;
}

export function useTimeMachinePlayer(points: TimelinePoint[]): TimeMachinePlayerState {
  const [speed, setSpeed] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [showFuture, setShowFuture] = useState<boolean>(true);

  const visiblePoints = useMemo(
    () => points.filter((point) => showFuture || !point.isFuture),
    [points, showFuture],
  );

  useEffect(() => {
    if (currentIndex >= visiblePoints.length) {
      setCurrentIndex(Math.max(visiblePoints.length - 1, 0));
    }
  }, [visiblePoints.length, currentIndex]);

  useEffect(() => {
    if (!isPlaying || visiblePoints.length === 0) return;

    const interval = window.setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= visiblePoints.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / speed);

    return () => window.clearInterval(interval);
  }, [isPlaying, speed, visiblePoints.length]);

  const seek = (index: number) => {
    const clamped = Math.max(0, Math.min(index, visiblePoints.length - 1));
    setCurrentIndex(clamped);
  };

  const jumpToTime = (timestamp: number) => {
    const idx = visiblePoints.findIndex((point) => point.time >= timestamp);
    if (idx >= 0) {
      seek(idx);
    }
  };

  const togglePlay = () => setIsPlaying((prev) => !prev);

  return {
    points: visiblePoints,
    currentIndex,
    isPlaying,
    speed,
    showFuture,
    currentPoint: visiblePoints[currentIndex] ?? null,
    setSpeed,
    togglePlay,
    setShowFuture,
    seek,
    jumpToTime,
  };
}
