import { useEffect, useRef } from 'react';

/**
 * Calls callback every intervalMs. Automatically pauses when the document
 * tab becomes hidden and resumes when it becomes visible again.
 */
export function useAutoRefresh(intervalMs: number, callback: () => void) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let timerId: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (timerId !== null) return;
      timerId = setInterval(() => callbackRef.current(), intervalMs);
    }

    function stop() {
      if (timerId === null) return;
      clearInterval(timerId);
      timerId = null;
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        stop();
      } else {
        start();
      }
    }

    start();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs]);
}
