'use client';

import { Pause, Play } from 'lucide-react';
import React from 'react';
import { useTimeMachinePlayer } from './TimeMachineProvider';
import { PlaybackSpeed } from './types';

const SPEEDS: PlaybackSpeed[] = [1, 2, 5, 10];

interface TimeMachineControlsProps {
  className?: string;
}

export function TimeMachineControls({ className }: TimeMachineControlsProps) {
  const { isPlaying, togglePlay, speed, setSpeed } = useTimeMachinePlayer();

  return (
    <div className={`flex items-center gap-3 ${className ?? ''}`}>
      <button
        type="button"
        onClick={togglePlay}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:shadow-xl"
        aria-label={isPlaying ? 'Pause timeline' : 'Play timeline'}
      >
        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
      </button>

      <div className="flex items-center gap-2 bg-secondary/40 border border-border/60 rounded-full px-2 py-1">
        {SPEEDS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setSpeed(option)}
            className={`text-xs font-semibold px-3 py-1 rounded-full transition ${
              option === speed
                ? 'bg-primary text-primary-foreground shadow'
                : 'text-muted-foreground hover:bg-secondary'
            }`}
          >
            {option}x
          </button>
        ))}
      </div>
    </div>
  );
}
