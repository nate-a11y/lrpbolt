/* Proprietary and confidential. See LICENSE. */
// React & vendor
// allow-color-literal-file

import * as React from "react";
import {
  Box,
  Divider,
  Paper,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import DRIVER_LIST from "../data/driverDirectory";

import DriverCardGrid from "./directory/DriverCardGrid.jsx";
import DriverCard from "./directory/DriverCard.jsx";
import PageContainer from "./PageContainer.jsx";


export default function DriverDirectory({
  disableContainer = false,
  showHeading = true,
  sx: sxProp = null,
} = {}) {
  const theme = useTheme();
  const LRP = React.useMemo(
    () => ({
      green: theme.palette.primary.main,
      textDim: theme.palette.text.secondary,
    }),
    [theme.palette.primary.main, theme.palette.text.secondary],
  );

  const drivers = React.useMemo(
    () =>
      DRIVER_LIST.map((d) => ({
        id: d.lrp || d.email,
        ...d,
      })),
    [],
  );

  const renderCard = React.useCallback(
    ({ driver }) => <DriverCard key={driver.id} driver={driver} />,
    [],
  );

  const baseSx = React.useMemo(
    () => ({
      width: "100%",
      "& *": { fontFamily: theme.typography.fontFamily },
    }),
    [theme.typography.fontFamily],
  );

  const mergedSx = React.useMemo(() => {
    if (Array.isArray(sxProp)) {
      return [baseSx, ...sxProp];
    }
    if (sxProp) {
      return [baseSx, sxProp];
    }
    return [baseSx];
  }, [baseSx, sxProp]);

  const content = (
    <Box sx={mergedSx}>
      {showHeading ? (
        <Typography
          variant="h5"
          gutterBottom
          sx={{
            fontWeight: 900,
            color: (t) => t.palette.text.primary,
            textShadow: `0 0 12px rgba(76,187,23,0.6)`,
          }}
        >
          📇 Driver Directory
        </Typography>
      ) : null}

      <Paper
        sx={{
          width: "100%",
          p: 2,
          "& .MuiDataGrid-root": { border: "none" },
        }}
      >
        <DriverCardGrid
          drivers={drivers}
          renderCard={renderCard}
          searchPlaceholder="Search name, LRP #, email, vehicle…"
          title={null}
          pageSize={12}
        />
      </Paper>

      <Divider
        sx={{ my: 2, borderColor: (t) => alpha(t.palette.common.white, 0.06) }}
      />
      <Typography variant="caption" sx={{ color: LRP.textDim }}>
        Lake Ride Pros • Real Rides. Real Pros.
      </Typography>
    </Box>
  );

  if (disableContainer) return content;

  return <PageContainer>{content}</PageContainer>;
}
