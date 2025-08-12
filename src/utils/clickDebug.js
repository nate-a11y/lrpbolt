export function traceClick(label = "click") {
  return (e) => {
    if (import.meta?.env?.DEV) {
      console.log(`[trace] ${label}`, {
        target: e.target?.tagName,
        currentTarget: e.currentTarget?.tagName,
        classList: e.target?.className,
      });
    }
  };
}
