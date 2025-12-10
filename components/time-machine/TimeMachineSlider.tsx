'use client';

import React, { useMemo } from 'react';
import { useTimeMachinePlayer } from './TimeMachineProvider';

interface TimeMachineSliderProps {
  className?: string;
}

export function TimeMachineSlider({ className }: TimeMachineSliderProps) {
  const { progress, seekToProgress, beginScrub, endScrub } = useTimeMachinePlayer();

  const percentage = useMemo(() => Math.round(progress * 10000) / 100, [progress]);

  return (
    <div className={`flex flex-col gap-1 ${className ?? ''}`}>
      <div className="flex h-2 w-full items-center">
        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={percentage}
          className="w-full appearance-none cursor-pointer bg-gradient-to-r from-primary/80 to-primary h-1.5 rounded-full accent-primary"
          onChange={(event) => {
            const value = Number(event.target.value) / 100;
            seekToProgress(value);
          }}
          onMouseDown={beginScrub}
          onMouseUp={endScrub}
          onTouchStart={beginScrub}
          onTouchEnd={endScrub}
        />
      </div>
      <div className="text-xs text-muted-foreground font-medium">
        {percentage.toFixed(1)}%
      </div>
    </div>
  );
}
