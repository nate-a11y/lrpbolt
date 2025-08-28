export function assertGridScrollable(el) {
  if (!el) return;
  try {
    const hasXScroll = el.scrollWidth > el.clientWidth;
    // log once, dev only
    if (!hasXScroll) {
      console.debug(
        "[LRP] Grid container not wider than viewport (no horizontal scroll).",
      );
    }
  } catch (err) {
    console.debug("[LRP] assertGridScrollable error", err);
  }
}
