import { useCallback, useState } from "react";

export default function useAccordionControl(initial = false) {
  const [expanded, setExpanded] = useState(initial);
  const handleChange = useCallback(
    (panel) => (_e, isExpanded) => setExpanded(isExpanded ? panel : false),
    [],
  );
  const is = useCallback((panel) => expanded === panel, [expanded]);
  return { expanded, setExpanded, handleChange, is };
}
