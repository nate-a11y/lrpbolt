import { useState, useCallback } from "react";

export default function useToast(defaultSeverity = "info") {
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: defaultSeverity,
  });

  const showToast = useCallback(
    (message, severity = defaultSeverity) => {
      setToast({ open: true, message, severity });
    },
    [defaultSeverity],
  );

  const closeToast = useCallback(() => {
    setToast((prev) => ({ ...prev, open: false }));
  }, []);

  return { toast, showToast, closeToast };
}
