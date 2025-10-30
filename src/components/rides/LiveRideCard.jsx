import { useMemo } from "react";
import PropTypes from "prop-types";
import { Button, Chip, IconButton, Stack, Tooltip } from "@mui/material";
import BoltIcon from "@mui/icons-material/Bolt";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { alpha } from "@mui/material/styles";

import BaseRideCard from "./BaseRideCard.jsx";

/**
 * LiveRideCard - Card for live/open rides with claim functionality
 */
export default function LiveRideCard({
  ride,
  selected = false,
  onSelect,
  onClaim,
  onEdit,
  onDelete,
  claiming = false,
  driverId = null,
}) {
  const alreadyClaimed = Boolean(
    ride?.claimedBy && ride.claimedBy !== driverId,
  );
  const disabled = !driverId || claiming || alreadyClaimed;

  const statusChip = useMemo(() => {
    if (alreadyClaimed) {
      return (
        <Chip
          label="CLAIMED"
          size="small"
          sx={{
            bgcolor: (t) => alpha(t.palette.warning.main, 0.2),
            color: (t) => t.palette.warning.main,
            border: (t) => `1px solid ${t.palette.warning.main}`,
            fontWeight: 600,
          }}
        />
      );
    }
    return null;
  }, [alreadyClaimed]);

  const actions = useMemo(
    () => (
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
        sx={{ width: "100%" }}
      >
        <Stack direction="row" spacing={0.5}>
          {onEdit && (
            <Tooltip title="Edit ride">
              <IconButton
                size="small"
                onClick={() => onEdit(ride)}
                sx={{
                  color: (t) => t.palette.text.secondary,
                  "&:hover": { color: (t) => t.palette.primary.main },
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip title="Delete ride">
              <IconButton
                size="small"
                onClick={() => onDelete(ride)}
                sx={{
                  color: (t) => t.palette.text.secondary,
                  "&:hover": { color: (t) => t.palette.error.main },
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>

        {onClaim && (
          <Button
            variant="contained"
            color="primary"
            size="medium"
            disabled={disabled}
            onClick={() => onClaim(ride)}
            startIcon={<BoltIcon fontSize="small" />}
            sx={{
              borderRadius: 9999,
              px: 2.5,
              py: 0.75,
              fontWeight: 700,
              color: "primary.contrastText",
              "&:hover": { filter: "brightness(1.08)" },
              "&.Mui-disabled": {
                color: (t) => alpha(t.palette.common.white, 0.4),
                backgroundColor: (t) => alpha(t.palette.common.white, 0.08),
              },
            }}
          >
            {alreadyClaimed ? "Claimed" : claiming ? "Claiming..." : "Claim"}
          </Button>
        )}
      </Stack>
    ),
    [ride, onEdit, onDelete, onClaim, disabled, alreadyClaimed, claiming],
  );

  return (
    <BaseRideCard
      ride={ride}
      selected={selected}
      onSelect={onSelect}
      actions={actions}
      statusChip={statusChip}
      showCheckbox={Boolean(onSelect)}
    />
  );
}

LiveRideCard.propTypes = {
  ride: PropTypes.object.isRequired,
  selected: PropTypes.bool,
  onSelect: PropTypes.func,
  onClaim: PropTypes.func,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  claiming: PropTypes.bool,
  driverId: PropTypes.string,
};
