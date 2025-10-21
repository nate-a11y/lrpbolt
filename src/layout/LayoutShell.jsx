/* Proprietary and confidential. See LICENSE. */
import { useMemo, useState } from "react";
import { styled, useTheme } from "@mui/material/styles";
import {
  AppBar as MuiAppBar,
  Box,
  Divider,
  Drawer as MuiDrawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  useMediaQuery,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";

const APP_BAR_HEIGHT = 64;
const RAIL_WIDTH = 72; // collapsed
const DRAWER_WIDTH = 240; // expanded

const AppBar = styled(MuiAppBar)(({ theme }) => ({
  zIndex: theme.zIndex.drawer + 5,
  height: APP_BAR_HEIGHT,
}));

const drawerPaperSx = (t, expanded) => ({
  width: expanded ? DRAWER_WIDTH : RAIL_WIDTH,
  boxSizing: "border-box",
  overflowX: "hidden",
  position: "fixed",
  top: APP_BAR_HEIGHT,
  left: 0,
  height: `calc(100% - ${APP_BAR_HEIGHT}px)`,
  borderRight: `1px solid ${t.palette.divider}`,
  transition: t.transitions.create("width", {
    easing: t.transitions.easing.sharp,
    duration: t.transitions.duration.enteringScreen,
  }),
});

export default function LayoutShell({ children, railItems, onNavigate }) {
  const theme = useTheme();
  const query = theme?.breakpoints?.up("sm") || "(min-width:600px)";
  const smUp = useMediaQuery(query, { noSsr: true });
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const railWidth = expanded ? DRAWER_WIDTH : RAIL_WIDTH;

  const vars = useMemo(
    () => ({
      "--appbar-height": `${APP_BAR_HEIGHT}px`,
      "--rail-width": `${railWidth}px`,
    }),
    [railWidth],
  );

  const toggleExpand = () => setExpanded((v) => !v);
  const toggleMobile = () => setMobileOpen((v) => !v);

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100%",
        minWidth: 0,
        overflowX: "auto",
        ...vars,
      }}
    >
      <AppBar position="fixed" color="default" elevation={1}>
        <Toolbar sx={{ minHeight: APP_BAR_HEIGHT }}>
          {!smUp ? (
            <IconButton onClick={toggleMobile} edge="start" size="large">
              <MenuIcon />
            </IconButton>
          ) : (
            <IconButton onClick={toggleExpand} edge="start" size="large">
              {expanded ? <ChevronLeftIcon /> : <MenuIcon />}
            </IconButton>
          )}
          <Box sx={{ flex: 1 }} />
        </Toolbar>
      </AppBar>

      {smUp && (
        <MuiDrawer
          variant="permanent"
          open
          PaperProps={{ sx: (t) => drawerPaperSx(t, expanded) }}
        >
          <List sx={{ py: 1 }}>
            {(railItems || []).map(({ label, icon: Icon, to }, idx) => (
              <Tooltip
                // eslint-disable-next-line react/no-array-index-key
                key={idx}
                title={label}
                placement="right"
                disableInteractive
              >
                <ListItemButton
                  onClick={() => onNavigate?.(to)}
                  sx={{ justifyContent: expanded ? "initial" : "center" }}
                >
                  <ListItemIcon sx={{ minWidth: 0, mr: expanded ? 2 : "auto" }}>
                    {Icon ? <Icon /> : null}
                  </ListItemIcon>
                  {expanded && <ListItemText primary={label} />}
                </ListItemButton>
              </Tooltip>
            ))}
          </List>
          <Divider />
        </MuiDrawer>
      )}

      {!smUp && (
        <MuiDrawer
          variant="temporary"
          open={mobileOpen}
          onClose={toggleMobile}
          ModalProps={{ keepMounted: true }}
          PaperProps={{ sx: { width: DRAWER_WIDTH, boxSizing: "border-box" } }}
        >
          <List>
            {(railItems || []).map(({ label, icon: Icon, to }, idx) => (
              <ListItemButton
                // eslint-disable-next-line react/no-array-index-key
                key={idx}
                onClick={() => {
                  onNavigate?.(to);
                  toggleMobile();
                }}
              >
                <ListItemIcon>{Icon ? <Icon /> : null}</ListItemIcon>
                <ListItemText primary={label} />
              </ListItemButton>
            ))}
          </List>
        </MuiDrawer>
      )}

      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          pt: `${APP_BAR_HEIGHT}px`,
          ml: { xs: 0, sm: `var(--rail-width)` }, // space for rail
          pr: { xs: 1.5, sm: 2 }, // keep RIGHT padding
          pl: { xs: 1.5, sm: 2 }, // remove LEFT padding
          pb: 3, // keep bottom padding
          transition: (t) =>
            t.transitions.create("margin-left", {
              duration: t.transitions.duration.enteringScreen,
            }),
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
