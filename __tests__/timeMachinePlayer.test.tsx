import React, { useImperativeHandle } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
    TimeMachineFrame,
    TimeMachinePlayerState,
    useTimeMachinePlayer,
} from '@/components/time-machine/useTimeMachinePlayer';
import { TimeMachinePlayer } from '@/components/time-machine/TimeMachinePlayer';

type HarnessProps = {
    frames: TimeMachineFrame[];
    storageKey?: string;
};

const HookHarness = React.forwardRef<TimeMachinePlayerState, HarnessProps>(({ frames, storageKey }, ref) => {
    const api = useTimeMachinePlayer(frames, { storageKey });
    useImperativeHandle(ref, () => api, [api]);
    return <div data-testid="current-label">{api.currentFrame?.label ?? 'none'}</div>;
});

HookHarness.displayName = 'HookHarness';

const sampleFrames: TimeMachineFrame[] = [
    { id: 'a', label: 'Frame A', timestamp: 1 },
    { id: 'b', label: 'Frame B', timestamp: 2 },
    { id: 'c', label: 'Frame C', timestamp: 3 },
];

afterEach(() => {
    jest.useRealTimers();
    window.localStorage.clear();
});

test('useTimeMachinePlayer responds to shortcuts and persists toggle state', () => {
    const ref = React.createRef<TimeMachinePlayerState>();
    window.localStorage.setItem('tm-test', 'false');

    render(<HookHarness ref={ref} frames={sampleFrames} storageKey="tm-test" />);

    expect(ref.current?.showKlines).toBe(false);

    act(() => {
        fireEvent.keyDown(window, { key: 'ArrowRight' });
        fireEvent.keyDown(window, { key: '1' });
        fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    });

    expect(ref.current?.currentIndex).toBe(1);
    expect(ref.current?.speed).toBe(0.5);
    expect(ref.current?.isPlaying).toBe(true);

    act(() => {
        ref.current?.setShowKlines(true);
    });
    expect(window.localStorage.getItem('tm-test')).toBe('true');
});

test('TimeMachinePlayer renders and advances frames via controls', () => {
    jest.useFakeTimers();
    const onFrameChange = jest.fn();

    render(
        <TimeMachinePlayer
            frames={sampleFrames}
            timeframeSeconds={60}
            onFrameChange={onFrameChange}
        />
    );

    expect(screen.getByText('Frame A')).toBeInTheDocument();

    act(() => {
        fireEvent.click(screen.getByTitle('下一幀 (→)'));
    });

    expect(screen.getByText('Frame B')).toBeInTheDocument();
    expect(onFrameChange).toHaveBeenLastCalledWith(sampleFrames[1]);

    act(() => {
        fireEvent.keyDown(window, { code: 'Space', key: ' ' });
        jest.advanceTimersByTime(1200);
    });

    expect(onFrameChange).toHaveBeenLastCalledWith(sampleFrames[2]);
});
