import { useEffect, useRef } from "react";

export default function useAutoRefresh(callback, ms = 60000) {
  const timer = useRef(null);
  useEffect(() => {
    if (typeof callback !== "function") return;
    timer.current = setInterval(() => callback(), ms);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [callback, ms]);
}
