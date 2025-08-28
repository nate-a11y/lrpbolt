import { useMemo } from "react";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

/** Returns { isXs, isSm, isMdDown } for responsive logic. */
export default function useIsMobile() {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const isSm = useMediaQuery(theme.breakpoints.only("sm"));
  const isMdDown = useMediaQuery(theme.breakpoints.down("md"));
  return useMemo(() => ({ isXs, isSm, isMdDown }), [isXs, isSm, isMdDown]);
}
