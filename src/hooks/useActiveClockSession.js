/* Proprietary and confidential. See LICENSE. */
import { useContext, useMemo } from "react";

import { ActiveClockContext } from "@/context/ActiveClockContext.jsx";

export default function useActiveClockSession() {
  const { hasActive, docId, startTimeTs } = useContext(ActiveClockContext);

  return useMemo(
    () => ({
      active: hasActive,
      timeLogId: docId,
      startTimeTs,
    }),
    [hasActive, docId, startTimeTs],
  );
}
