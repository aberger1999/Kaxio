import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const FocusTimerContext = createContext(null);
const FOCUS_TIMER_STORAGE_KEY = 'kaxio_focus_timer_v1';

function safeReadTimerState() {
  try {
    const raw = localStorage.getItem(FOCUS_TIMER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const totalTime = Number(parsed?.totalTime || 0);
    if (!Number.isFinite(totalTime) || totalTime <= 0) {
      return null;
    }
    return {
      totalTime,
      isRunning: Boolean(parsed?.isRunning),
      isPaused: Boolean(parsed?.isPaused),
      startTimeMs: parsed?.startTimeMs ? Number(parsed.startTimeMs) : null,
      elapsedBeforePause: Number(parsed?.elapsedBeforePause || 0),
    };
  } catch {
    return null;
  }
}

function safeWriteTimerState(state) {
  try {
    localStorage.setItem(FOCUS_TIMER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors; timer still works in-memory.
  }
}

function safeClearTimerState() {
  try {
    localStorage.removeItem(FOCUS_TIMER_STORAGE_KEY);
  } catch {
    // Ignore storage errors; timer still works in-memory.
  }
}

export function FocusTimerProvider({ children }) {
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const intervalRef = useRef(null);
  const onCompleteRef = useRef(null);
  const startTimeRef = useRef(null);
  const elapsedBeforePauseRef = useRef(0);
  const totalTimeRef = useRef(0);
  const isPausedRef = useRef(false);

  useEffect(() => {
    totalTimeRef.current = totalTime;
  }, [totalTime]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const persistActiveTimerState = useCallback(({
    nextTotalTime = totalTimeRef.current,
    nextIsRunning,
    nextIsPaused,
    nextStartTimeMs = startTimeRef.current,
    nextElapsedBeforePause = elapsedBeforePauseRef.current,
  }) => {
    safeWriteTimerState({
      totalTime: nextTotalTime,
      isRunning: nextIsRunning,
      isPaused: nextIsPaused,
      startTimeMs: nextStartTimeMs,
      elapsedBeforePause: nextElapsedBeforePause,
    });
  }, []);

  const tick = useCallback(() => {
    setTimeLeft((prev) => {
      if (prev <= 1) {
        clearTimer();
        setIsRunning(false);
        setIsPaused(false);
        startTimeRef.current = null;
        elapsedBeforePauseRef.current = totalTimeRef.current;
        safeClearTimerState();
        const completedDuration = totalTimeRef.current;
        onCompleteRef.current?.(completedDuration);
        return 0;
      }
      return prev - 1;
    });
  }, [clearTimer]);

  const start = useCallback((durationSeconds) => {
    if (!durationSeconds || durationSeconds <= 0) {
      return;
    }
    clearTimer();
    setTotalTime(durationSeconds);
    setTimeLeft(durationSeconds);
    setIsRunning(true);
    setIsPaused(false);
    totalTimeRef.current = durationSeconds;
    startTimeRef.current = Date.now();
    elapsedBeforePauseRef.current = 0;
    persistActiveTimerState({
      nextTotalTime: durationSeconds,
      nextIsRunning: true,
      nextIsPaused: false,
      nextStartTimeMs: startTimeRef.current,
      nextElapsedBeforePause: 0,
    });
    intervalRef.current = setInterval(tick, 1000);
  }, [clearTimer, persistActiveTimerState, tick]);

  const pause = useCallback(() => {
    if (!isRunning || isPausedRef.current) return;
    clearTimer();
    setIsPaused(true);
    const now = Date.now();
    if (startTimeRef.current) {
      elapsedBeforePauseRef.current += Math.round((now - startTimeRef.current) / 1000);
    }
    startTimeRef.current = null;
    persistActiveTimerState({
      nextIsRunning: true,
      nextIsPaused: true,
      nextStartTimeMs: null,
      nextElapsedBeforePause: elapsedBeforePauseRef.current,
    });
  }, [clearTimer, isRunning, persistActiveTimerState]);

  const resume = useCallback(() => {
    if (!isRunning || !isPausedRef.current) return;
    setIsPaused(false);
    startTimeRef.current = Date.now();
    persistActiveTimerState({
      nextIsRunning: true,
      nextIsPaused: false,
      nextStartTimeMs: startTimeRef.current,
      nextElapsedBeforePause: elapsedBeforePauseRef.current,
    });
    intervalRef.current = setInterval(tick, 1000);
  }, [isRunning, persistActiveTimerState, tick]);

  const stop = useCallback(() => {
    clearTimer();
    let elapsed = elapsedBeforePauseRef.current;
    if (!isPausedRef.current && startTimeRef.current) {
      elapsed += Math.round((Date.now() - startTimeRef.current) / 1000);
    }
    setIsRunning(false);
    setIsPaused(false);
    startTimeRef.current = null;
    elapsedBeforePauseRef.current = elapsed;
    safeClearTimerState();
    return Math.max(0, elapsed);
  }, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    setTimeLeft(0);
    setTotalTime(0);
    setIsRunning(false);
    setIsPaused(false);
    startTimeRef.current = null;
    elapsedBeforePauseRef.current = 0;
    totalTimeRef.current = 0;
    safeClearTimerState();
  }, [clearTimer]);

  const setOnComplete = useCallback((handler) => {
    onCompleteRef.current = handler || null;
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  useEffect(() => {
    const persisted = safeReadTimerState();
    if (!persisted || !persisted.isRunning) {
      safeClearTimerState();
      return;
    }

    const nowMs = Date.now();
    const liveElapsed = (!persisted.isPaused && persisted.startTimeMs)
      ? Math.round((nowMs - persisted.startTimeMs) / 1000)
      : 0;
    const elapsedSeconds = Math.max(0, persisted.elapsedBeforePause + liveElapsed);
    const remainingSeconds = Math.max(0, persisted.totalTime - elapsedSeconds);

    if (remainingSeconds <= 0) {
      safeClearTimerState();
      return;
    }

    clearTimer();
    setTotalTime(persisted.totalTime);
    setTimeLeft(remainingSeconds);
    setIsRunning(true);
    setIsPaused(persisted.isPaused);
    totalTimeRef.current = persisted.totalTime;
    elapsedBeforePauseRef.current = persisted.totalTime - remainingSeconds;
    startTimeRef.current = persisted.isPaused ? null : Date.now();
    if (!persisted.isPaused) {
      intervalRef.current = setInterval(tick, 1000);
      persistActiveTimerState({
        nextTotalTime: persisted.totalTime,
        nextIsRunning: true,
        nextIsPaused: false,
        nextStartTimeMs: startTimeRef.current,
        nextElapsedBeforePause: elapsedBeforePauseRef.current,
      });
    } else {
      persistActiveTimerState({
        nextTotalTime: persisted.totalTime,
        nextIsRunning: true,
        nextIsPaused: true,
        nextStartTimeMs: null,
        nextElapsedBeforePause: elapsedBeforePauseRef.current,
      });
    }
  }, [clearTimer, persistActiveTimerState, tick]);

  const progress = useMemo(() => (
    totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0
  ), [timeLeft, totalTime]);

  const value = useMemo(() => ({
    timeLeft,
    totalTime,
    isRunning,
    isPaused,
    progress,
    start,
    pause,
    resume,
    stop,
    reset,
    setOnComplete,
  }), [
    timeLeft,
    totalTime,
    isRunning,
    isPaused,
    progress,
    start,
    pause,
    resume,
    stop,
    reset,
    setOnComplete,
  ]);

  return (
    <FocusTimerContext.Provider value={value}>
      {children}
    </FocusTimerContext.Provider>
  );
}

export function useFocusTimer() {
  const context = useContext(FocusTimerContext);
  if (!context) {
    throw new Error('useFocusTimer must be used within a FocusTimerProvider');
  }
  return context;
}
