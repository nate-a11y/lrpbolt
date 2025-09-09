import { useState, useCallback } from "react";

export default function useCopy() {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const copy = useCallback(async (text) => {
    try {
      setError(null);
      await navigator.clipboard.writeText(String(text ?? ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      setError(err);
    }
  }, []);

  return { copy, copied, error };
}
