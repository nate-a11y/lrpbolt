// allow-color-literal-file

import { useMemo } from "react";
import PropTypes from "prop-types";
import { Button, Chip, IconButton, Stack, Tooltip } from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { alpha } from "@mui/material/styles";

import BaseRideCard from "./BaseRideCard.jsx";

/**
 * QueueRideCard - Card for queued rides with "Move to Live" action
 */
export default function QueueRideCard({
  ride,
  selected = false,
  onSelect,
  onMoveToLive,
  onEdit,
  onDelete,
  moving = false,
}) {
  const statusChip = useMemo(
    () => (
      <Chip
        label="QUEUED"
        size="small"
        sx={{
          bgcolor: (t) => alpha(t.palette.info.main, 0.2),
          color: (t) => t.palette.info.main,
          border: (t) => `1px solid ${t.palette.info.main}`,
          fontWeight: 600,
        }}
      />
    ),
    [],
  );

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

        {onMoveToLive && (
          <Button
            variant="contained"
            color="primary"
            size="medium"
            disabled={moving}
            onClick={() => onMoveToLive(ride)}
            startIcon={<PlayArrowRoundedIcon fontSize="small" />}
            sx={{
              borderRadius: 9999,
              px: 2.5,
              py: 0.75,
              fontWeight: 700,
              color: "#060606",
              "&:hover": { filter: "brightness(1.08)" },
            }}
          >
            {moving ? "Moving..." : "Move to Live"}
          </Button>
        )}
      </Stack>
    ),
    [ride, onEdit, onDelete, onMoveToLive, moving],
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

QueueRideCard.propTypes = {
  ride: PropTypes.object.isRequired,
  selected: PropTypes.bool,
  onSelect: PropTypes.func,
  onMoveToLive: PropTypes.func,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  moving: PropTypes.bool,
};
