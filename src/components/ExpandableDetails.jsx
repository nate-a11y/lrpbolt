import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Box, Button, Collapse, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

import logError from "@/utils/logError.js";

/**
 * ExpandableDetails
 * Shows a blurb at all times and reveals the longer details on demand.
 */
export default function ExpandableDetails({
  id,
  blurb,
  details,
  defaultExpanded = false,
  remember = true,
}) {
  const storageKey = useMemo(() => {
    if (!id) return null;
    return `lrp_infocard_expand_${id}`;
  }, [id]);

  const [open, setOpen] = useState(Boolean(defaultExpanded));

  useEffect(() => {
    if (!remember || !storageKey) return;
    if (typeof window === "undefined") return;

    try {
      const value = window.localStorage.getItem(storageKey);
      if (value === "1") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing with localStorage on mount
        setOpen(true);
      } else if (value === "0") {
        setOpen(false);
      }
    } catch (error) {
      logError(error, { where: "ExpandableDetails.read", storageKey });
    }
  }, [remember, storageKey]);

  const hasDetails = useMemo(() => {
    if (typeof details !== "string") return false;
    return details.trim().length > 0;
  }, [details]);

  const detailsId = useMemo(() => {
    if (!id) return undefined;
    return `${id}-details`;
  }, [id]);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;

      if (remember && storageKey && typeof window !== "undefined") {
        try {
          window.localStorage.setItem(storageKey, next ? "1" : "0");
        } catch (error) {
          logError(error, {
            where: "ExpandableDetails.write",
            storageKey,
            next,
          });
        }
      }

      return next;
    });
  }, [remember, storageKey]);

  if (!blurb && !hasDetails) {
    return null;
  }

  return (
    <Box>
      {blurb ? (
        <Typography
          variant="body2"
          sx={{ opacity: 0.85, whiteSpace: "pre-line" }}
        >
          {blurb}
        </Typography>
      ) : null}

      {hasDetails ? (
        <Box sx={{ mt: blurb ? 1 : 0 }}>
          <Collapse in={open} timeout="auto" collapsedSize={0}>
            <Box id={detailsId}>
              <Typography
                variant="body2"
                sx={{
                  whiteSpace: "pre-line",
                  lineHeight: 1.5,
                  opacity: 0.85,
                }}
              >
                {details}
              </Typography>
            </Box>
          </Collapse>

          {!open ? (
            <Box
              aria-hidden
              sx={{
                mt: -1,
                height: 28,
                borderRadius: 1,
                backgroundImage: (theme) =>
                  (theme.palette.lrp && theme.palette.lrp.gradient) ||
                  `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.18)} 0%, ${alpha(theme.palette.background.default, 0)} 100%)`,
              }}
            />
          ) : null}

          <Stack direction="row" justifyContent="flex-start" sx={{ mt: 0.75 }}>
            <Button
              onClick={toggle}
              size="small"
              endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              aria-controls={detailsId}
              aria-expanded={open}
              sx={{
                px: 1.25,
                minWidth: 0,
                color: "primary.main",
                bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                border: (t) =>
                  `1px solid ${alpha(t.palette.primary.main, 0.3)}`,
                fontWeight: 600,
                textTransform: "none",
                borderRadius: 999,
                "&:hover": {
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.2),
                },
              }}
            >
              {open ? "See less" : "See more"}
            </Button>
          </Stack>
        </Box>
      ) : null}
    </Box>
  );
}

ExpandableDetails.propTypes = {
  id: PropTypes.string,
  blurb: PropTypes.string,
  details: PropTypes.string,
  defaultExpanded: PropTypes.bool,
  remember: PropTypes.bool,
};
