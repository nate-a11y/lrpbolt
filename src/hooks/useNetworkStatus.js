import { useState, useEffect, useRef, useCallback } from "react";

const OFFLINE_DEBOUNCE_MS = 2500;
const OFFLINE_MODAL_DELAY_MS = 5000;

export default function useNetworkStatus(onReconnect) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showOffline, setShowOffline] = useState(false);
  const offlineTimer = useRef(null);
  const displayTimer = useRef(null);

  const clearTimers = () => {
    if (offlineTimer.current) {
      clearTimeout(offlineTimer.current);
      offlineTimer.current = null;
    }
    if (displayTimer.current) {
      clearTimeout(displayTimer.current);
      displayTimer.current = null;
    }
  };

  const goOnline = useCallback(() => {
    clearTimers();
    setIsOffline(false);
    setShowOffline(false);
    if (onReconnect) onReconnect();
  }, [onReconnect]);

  const goOffline = useCallback(() => {
    clearTimers();
    offlineTimer.current = setTimeout(() => {
      if (!navigator.onLine) {
        setIsOffline(true);
        displayTimer.current = setTimeout(() => {
          if (!navigator.onLine) setShowOffline(true);
        }, OFFLINE_MODAL_DELAY_MS - OFFLINE_DEBOUNCE_MS);
      }
    }, OFFLINE_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    if (!navigator.onLine) goOffline();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      clearTimers();
    };
  }, [goOnline, goOffline]);

  const retry = useCallback(() => {
    if (navigator.onLine) {
      goOnline();
    } else {
      goOffline();
    }
  }, [goOnline, goOffline]);

  const dismiss = useCallback(() => setShowOffline(false), []);

  return { isOffline, showOffline, retry, dismiss };
}
