import { useMemo } from "react";
import { useTheme } from "@mui/material/styles";

import useMediaQuery from "./useMediaQuery";

/** Returns { isXs, isSm, isMdDown } for responsive logic. */
export default function useIsMobile() {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const isSm = useMediaQuery(theme.breakpoints.only("sm"));
  const isMdDown = useMediaQuery(theme.breakpoints.down("md"));
  return useMemo(() => ({ isXs, isSm, isMdDown }), [isXs, isSm, isMdDown]);
}
