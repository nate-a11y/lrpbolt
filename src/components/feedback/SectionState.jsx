import PropTypes from "prop-types";
import { Box, Button, Stack, Typography } from "@mui/material";

function BaseState({
  title,
  description,
  actionLabel,
  onAction,
  actionProps,
  illustration,
}) {
  return (
    <Box
      sx={{
        py: 8,
        px: 3,
        textAlign: "center",
        color: "text.secondary",
      }}
    >
      <Stack spacing={3} alignItems="center">
        {illustration}
        <Box>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {description ? (
            <Typography
              variant="body2"
              sx={{ mt: 1, maxWidth: 420, mx: "auto", color: "text.secondary" }}
            >
              {description}
            </Typography>
          ) : null}
        </Box>
        {actionLabel && typeof onAction === "function" ? (
          <Button
            variant="contained"
            color="primary"
            onClick={onAction}
            sx={{ minWidth: 160 }}
            {...actionProps}
          >
            {actionLabel}
          </Button>
        ) : null}
      </Stack>
    </Box>
  );
}

BaseState.propTypes = {
  actionLabel: PropTypes.string,
  actionProps: PropTypes.object,
  description: PropTypes.node,
  illustration: PropTypes.node,
  onAction: PropTypes.func,
  title: PropTypes.node,
};

export function EmptyState({
  title = "Nothing here yet",
  description = "This section will populate once new activity comes in.",
  actionLabel,
  onAction,
  actionProps,
  illustration,
}) {
  return (
    <BaseState
      title={title}
      description={description}
      actionLabel={actionLabel}
      onAction={onAction}
      actionProps={actionProps}
      illustration={illustration}
    />
  );
}

EmptyState.propTypes = BaseState.propTypes;

export function ErrorState({
  title = "We hit a snag",
  description = "Please try again. If the issue persists, contact the ops team.",
  actionLabel = "Retry",
  onAction,
  actionProps,
  illustration,
}) {
  return (
    <BaseState
      title={title}
      description={description}
      actionLabel={actionLabel}
      onAction={onAction}
      actionProps={actionProps}
      illustration={illustration}
    />
  );
}

ErrorState.propTypes = BaseState.propTypes;
