/* Proprietary and confidential. See LICENSE. */
import { memo } from "react";

import TimeClockBubble from "@/components/TimeClockBubble.jsx";

function GlobalChrome() {
  return (
    <>
      {/* Global overlays, toasts, dialogs */}
      <TimeClockBubble />
    </>
  );
}

export default memo(GlobalChrome);
