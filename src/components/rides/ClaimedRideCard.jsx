import { useMemo } from "react";
import PropTypes from "prop-types";
import { Chip, IconButton, Stack, Tooltip } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { alpha } from "@mui/material/styles";

import BaseRideCard from "./BaseRideCard.jsx";

/**
 * ClaimedRideCard - Card for claimed rides with edit/delete actions
 */
export default function ClaimedRideCard({
  ride,
  selected = false,
  onSelect,
  onEdit,
  onDelete,
}) {
  const statusChip = useMemo(
    () => (
      <Chip
        label="CLAIMED"
        size="small"
        icon={<CheckCircleIcon fontSize="small" />}
        sx={{
          bgcolor: (t) => alpha(t.palette.success.main, 0.2),
          color: (t) => t.palette.success.main,
          border: (t) => `1px solid ${t.palette.success.main}`,
          fontWeight: 600,
          ".MuiChip-icon": {
            color: (t) => t.palette.success.main,
          },
        }}
      />
    ),
    [],
  );

  const actions = useMemo(
    () => (
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
    ),
    [ride, onEdit, onDelete],
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

ClaimedRideCard.propTypes = {
  ride: PropTypes.object.isRequired,
  selected: PropTypes.bool,
  onSelect: PropTypes.func,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
};
