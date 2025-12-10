import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type TimeMachineFrame = {
    id: string;
    label: string;
    timestamp: number;
};

const SPEED_PRESETS = [0.5, 1, 2, 4, 8];
const STORAGE_KEY = 'timeMachineShowKlines';

export interface TimeMachinePlayerOptions {
    defaultSpeed?: number;
    storageKey?: string;
    autoPlay?: boolean;
}

export interface TimeMachinePlayerState {
    currentFrame: TimeMachineFrame | null;
    currentIndex: number;
    isPlaying: boolean;
    speed: number;
    showKlines: boolean;
    play: () => void;
    pause: () => void;
    togglePlay: () => void;
    nextFrame: () => void;
    previousFrame: () => void;
    setSpeedFromIndex: (index: number) => void;
    setShowKlines: (value: boolean) => void;
}

export function useTimeMachinePlayer(
    frames: TimeMachineFrame[],
    { defaultSpeed = 1, storageKey = STORAGE_KEY, autoPlay = false }: TimeMachinePlayerOptions = {}
): TimeMachinePlayerState {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [speed, setSpeed] = useState(defaultSpeed);
    const [showKlines, setShowKlines] = useState(true);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const boundedIndex = useMemo(() => Math.min(Math.max(currentIndex, 0), Math.max(frames.length - 1, 0)), [currentIndex, frames.length]);
    const currentFrame = frames[boundedIndex] ?? null;

    const nextFrame = useCallback(() => {
        setCurrentIndex((prev) => Math.min(prev + 1, Math.max(frames.length - 1, 0)));
    }, [frames.length]);

    const previousFrame = useCallback(() => {
        setCurrentIndex((prev) => Math.max(prev - 1, 0));
    }, []);

    const play = useCallback(() => setIsPlaying(true), []);
    const pause = useCallback(() => setIsPlaying(false), []);
    const togglePlay = useCallback(() => setIsPlaying((prev) => !prev), []);

    const setSpeedFromIndex = useCallback((index: number) => {
        const preset = SPEED_PRESETS[index];
        if (preset) {
            setSpeed(preset);
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const saved = window.localStorage.getItem(storageKey);
        if (saved !== null) {
            setShowKlines(saved === 'true');
        }
    }, [storageKey]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(storageKey, String(showKlines));
    }, [showKlines, storageKey]);

    useEffect(() => {
        if (!isPlaying || frames.length === 0) return;

        const interval = 1000 / speed;
        intervalRef.current = setInterval(() => {
            setCurrentIndex((prev) => {
                if (prev >= frames.length - 1) {
                    setIsPlaying(false);
                    return prev;
                }
                return prev + 1;
            });
        }, interval);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [frames.length, isPlaying, speed]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                return;
            }

            if (event.code === 'Space') {
                event.preventDefault();
                togglePlay();
                return;
            }

            if (event.key === 'ArrowRight') {
                event.preventDefault();
                nextFrame();
                return;
            }

            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                previousFrame();
                return;
            }

            if (/^[1-5]$/.test(event.key)) {
                const numeric = Number(event.key) - 1;
                setSpeedFromIndex(numeric);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [nextFrame, previousFrame, setSpeedFromIndex, togglePlay]);

    return {
        currentFrame,
        currentIndex: boundedIndex,
        isPlaying,
        speed,
        showKlines,
        play,
        pause,
        togglePlay,
        nextFrame,
        previousFrame,
        setSpeedFromIndex,
        setShowKlines,
    };
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
