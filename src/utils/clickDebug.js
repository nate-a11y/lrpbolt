export function traceClick(label = "click") {
  return (e) => {
    if (import.meta?.env?.DEV) {
      // eslint-disable-next-line no-console
      console.log(`[trace] ${label}`, {
        target: e.target?.tagName,
        currentTarget: e.currentTarget?.tagName,
        classList: e.target?.className,
      });
    }
  };
}
