/* Proprietary and confidential. See LICENSE. */
// allow-color-literal-file

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box as MuiBox,
  Button,
  Divider,
  Drawer,
  Fab,
  Link as MUILink,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { GridToolbarExport as _GridToolbarExport } from "@mui/x-data-grid-pro";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import DownloadIcon from "@mui/icons-material/Download";
import Lightbox from "yet-another-react-lightbox";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import "yet-another-react-lightbox/styles.css";
import QRCode from "react-qr-code";

import SmartAutoGrid from "src/components/datagrid/SmartAutoGrid.jsx";
import useIsMobile from "src/hooks/useIsMobile";
import PictureWebp from "@/components/media/PictureWebp";

import useMediaQuery from "../hooks/useMediaQuery";

import DropoffAccordion from "./DropoffAccordion";
import PassengerAppModal from "./PassengerAppModal";
import PageContainer from "./PageContainer.jsx";
import VehicleDropGuides from "./VehicleDropGuides.jsx";

void _GridToolbarExport;

// --- constants ---
const FLW_URL = "https://pass.aie.army.mil/steps/installation_selection";

const GATE_CODES = [
  { name: "Camden", codes: ["1793#", "1313"] },
  { name: "Cypress", codes: ["7469"] },
  { name: "Shooters 21", codes: ["4040"] },
  {
    name: "Tan-Tar-A",
    codes: ["4365", "1610", "5746", "1713", "4271", "0509"],
  },
  { name: "Ledges (Back Gate)", codes: ["2014"] },
  { name: "Ty’s Cove", codes: ["5540", "2349"] },
  { name: "Lighthouse Point", codes: ["#7373"] },
  { name: "Southwood Shores", codes: ["60200", "42888", "48675"] },
  {
    name: "Palisades",
    codes: ["#4667", "6186", "#5572", "6649", "8708", "2205"],
  },
  { name: "The Cove (off Bluff Dr)", codes: ["#1172"] },
  { name: "Cobblestone (off Nichols)", codes: ["1776"] },
  { name: "Cape Royal", codes: ["#1114", "#1099"] },
  { name: "Car Wash", codes: ["655054#"] },
  { name: "Bronx", codes: ["9376"] },
  { name: "Mystic Bay", codes: ["0235#"] },
  { name: "RT’s Cove", codes: ["8870"] },
  { name: "Magnolia Point", codes: ["#1827"] },
  { name: "Paige", codes: ["9195"] },
  { name: "Del Sol", codes: ["2202"] },
  { name: "Hamptons", codes: ["#3202"] },
  { name: "Stone Ridge", codes: ["1379"] },
  { name: "Lee C. Fine Airport", codes: ["1228"] },
  { name: "Sac Road", codes: ["#6423"] },
];

function NoRowsOverlay() {
  return (
    <Typography sx={{ p: 2, textAlign: "center" }} color="text.secondary">
      No gate codes available.
    </Typography>
  );
}

function NoResultsOverlay() {
  return (
    <Typography sx={{ p: 2, textAlign: "center" }} color="text.secondary">
      No matching locations found.
    </Typography>
  );
}

export default function DriverInfoTab() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);

  const theme = useTheme();
  const isSmUp = useMediaQuery(theme.breakpoints.up("sm"));
  const APPBAR_MOBILE = 56;
  const APPBAR_DESKTOP = 64;
  const drawerTopXs = `calc(${APPBAR_MOBILE}px + env(safe-area-inset-top, 0px))`;
  const drawerTopSm = `calc(${APPBAR_DESKTOP}px + env(safe-area-inset-top, 0px))`;

  const rows = useMemo(() => GATE_CODES, []);

  const resolveRow = useCallback((maybeParams, fallbackRow) => {
    if (
      maybeParams &&
      typeof maybeParams === "object" &&
      !Array.isArray(maybeParams) &&
      "row" in maybeParams
    ) {
      return maybeParams.row;
    }
    return fallbackRow;
  }, []);

  const columns = useMemo(
    () => [
      {
        field: "name",
        headerName: "Location",
        flex: 1,
        minWidth: 150,
        valueGetter: (value, row) => {
          const sourceRow = resolveRow(value, row);
          return sourceRow?.name ?? "N/A";
        },
      },
      {
        field: "codes",
        headerName: "Gate Codes",
        flex: 1,
        minWidth: 150,
        valueGetter: (value, row) => {
          const sourceRow = resolveRow(value, row);
          if (Array.isArray(sourceRow?.codes)) {
            return sourceRow.codes.join(", ");
          }
          return "N/A";
        },
        renderCell: (p) => (
          <MuiBox
            sx={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: { xs: 180, md: "unset" },
            }}
          >
            {p?.value ?? "N/A"}
          </MuiBox>
        ),
      },
    ],
    [resolveRow],
  );

  const getRowId = useCallback(
    (row) =>
      row?.id ?? row?.uid ?? row?._id ?? row?.name ?? JSON.stringify(row),
    [],
  );

  const slides = useMemo(
    () => (selectedImage ? [{ src: selectedImage.mapUrl || "" }] : []),
    [selectedImage],
  );

  const { isMdDown } = useIsMobile();
  const columnVisibilityModel = useMemo(
    () => (isMdDown ? { id: false, internalOnly: false } : undefined),
    [isMdDown],
  );

  // --- QR download helpers ---
  const qrRef = useRef(null);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(FLW_URL);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadQR = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);

    const canvas = document.createElement("canvas");
    const scale = 4; // increase for higher DPI
    const size = parseInt(svg.getAttribute("width") || "256", 10) * scale;
    canvas.width = size;
    canvas.height = size;

    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, size, size);
      const pngFile = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = pngFile;
      a.download = "FLW_PreReg_QR.png";
      a.click();
    };
    img.src =
      "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);
  };

  return (
    <PageContainer pb={4}>
      <Typography variant="h5" gutterBottom fontWeight="bold">
        🚗 Driver Drop-Off Info & Instructions
      </Typography>

      <Typography variant="body1" sx={{ mb: 3 }}>
        These tips are here to help you stay compliant and deliver a seamless
        VIP experience.
      </Typography>

      <Divider sx={{ mb: 3 }} />

      {/* Airport Pickup (Fort Leonard Wood / Waynesville–St. Robert) */}
      <Accordion defaultExpanded={false} sx={{ mt: 1 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">
            ✈️ Airport Pickup: Waynesville–St. Robert (Fort Leonard Wood) —
            Pre-register 24+ hours prior
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Alert severity="info" sx={{ mb: 2 }}>
            Passengers should complete pre-registration at least{" "}
            <strong>24 hours before pickup</strong>. If under 24 hours, they
            must complete it on site at the security checkpoint.
          </Alert>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={3}
            alignItems="flex-start"
          >
            {/* QR + actions */}
            <MuiBox
              ref={qrRef}
              sx={{
                p: 2,
                border: "1px dashed",
                borderColor: "divider",
                borderRadius: 2,
              }}
            >
              <QRCode value={FLW_URL} size={196} />
              <Stack direction="row" spacing={1} sx={{ mt: 1 }} useFlexGap>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<OpenInNewIcon />}
                  href={FLW_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Portal
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={handleCopyLink}
                >
                  Copy Link
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadQR}
                >
                  Download QR
                </Button>
              </Stack>
              <Typography variant="caption" sx={{ display: "block", mt: 1 }}>
                Portal:{" "}
                <MUILink
                  href={FLW_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  pass.aie.army.mil/steps/installation_selection
                </MUILink>
              </Typography>
            </MuiBox>

            {/* Instructions */}
            <MuiBox sx={{ flex: 1, minWidth: 280 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Step-by-step (Pre-Registration)
              </Typography>
              <MuiBox component="ol" sx={{ pl: 3, lineHeight: 1.7, m: 0 }}>
                <li>
                  Scan the QR code above (or open the portal link) and follow
                  the prompts.
                </li>
                <li>
                  If shown, choose <strong>Army</strong> &rarr;{" "}
                  <strong>Fort Leonard Wood</strong>.
                </li>
                <li>
                  Complete the security check (<em>I’m not a robot</em>) and
                  accept terms if prompted.
                </li>
                <li>
                  Select <strong>Visitor Pass</strong> (not Special Event Pass).
                </li>
                <li>
                  Enter Driver’s License #, select issuing state, and expiration
                  date (mm/dd/yyyy).
                </li>
                <li>
                  Choose your <strong>Reason for Visit</strong>:
                  <MuiBox component="ul" sx={{ pl: 3, mt: 0.5, mb: 0 }}>
                    <li>
                      <strong>Visit service member</strong> — validated by guard
                      at the Visitor Center.
                    </li>
                    <li>
                      <strong>Airport</strong> — have your flight itinerary to
                      show the guard.
                    </li>
                    <li>
                      <strong>Hotel stay</strong> — bring proof of reservation.
                    </li>
                    <li>
                      <strong>Museum</strong> — hours: Mon–Fri 8am–4pm; Sat
                      9am–3pm; Sun closed.
                    </li>
                  </MuiBox>
                </li>
                <li>
                  Enter personal info:{" "}
                  <strong>DOB, Name, Address, SSN, Mobile Phone</strong> (must
                  accept SMS).
                </li>
                <li>
                  Review and click <strong>Register</strong> to submit for NCIC
                  background screening.
                </li>
                <li>
                  You’ll see status as <em>pending review</em>. Allow up to{" "}
                  <strong>24 hours</strong>. Updates arrive via SMS.
                </li>
                <li>
                  When approved, proceed to the <strong>Visitor Center</strong>{" "}
                  at the main gate with your approval text and proof for your
                  selected reason.
                </li>
              </MuiBox>

              <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 2 }}>
                What to bring (physical copies)
              </Typography>
              <MuiBox component="ul" sx={{ pl: 3, m: 0, lineHeight: 1.7 }}>
                <li>
                  <strong>REAL ID or Passport</strong> (REAL ID will be scanned
                  at checkpoint).
                </li>
                <li>
                  <strong>Current vehicle registration</strong> paperwork.
                </li>
                <li>
                  <strong>Current vehicle insurance</strong> paperwork.{" "}
                  <em>Digital copies are not accepted</em>; bring printed/paper
                  copies.
                </li>
              </MuiBox>
            </MuiBox>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Dropoff Locations Section */}
      <MuiBox sx={{ mt: 2 }}>
        <Typography variant="h6" gutterBottom>
          📍 Dropoff Locations
        </Typography>
        <DropoffAccordion onSelectImage={setSelectedImage} />
      </MuiBox>

      {/* Gate Codes Accordion with Search */}
      <Accordion defaultExpanded={false} sx={{ mt: 4 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">
            🔐 Gate Codes & Access Notes
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Paper sx={{ width: "100%" }}>
            <SmartAutoGrid
              autoHeight
              rows={rows || []}
              columns={columns || []}
              getRowId={getRowId}
              columnVisibilityModel={columnVisibilityModel}
              slots={{
                noRowsOverlay: NoRowsOverlay,
                noResultsOverlay: NoResultsOverlay,
              }}
              slotProps={{
                toolbar: {
                  quickFilterPlaceholder: "Search by location...",
                },
              }}
              checkboxSelection
              disableRowSelectionOnClick
              pagination
              hideFooterSelectedRowCount
            />
          </Paper>
        </AccordionDetails>
      </Accordion>

      {/* Passenger App Walkthrough */}
      <MuiBox sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          📲 Passenger App Overview
        </Typography>
        <Button variant="outlined" onClick={() => setModalOpen(true)}>
          Open Walkthrough
        </Button>
      </MuiBox>

      <Tooltip title="Vehicle Tips (Sprinter, Shuttle, Rescue, Limo)">
        <Fab
          variant="extended"
          color="primary"
          aria-label="Open vehicle tips"
          onClick={() => setTipsOpen(true)}
          sx={{
            position: "fixed",
            right: 16,
            bottom: `calc(16px + env(safe-area-inset-bottom, 0px))`,
            zIndex: (t) => t.zIndex.tooltip + 1,
            backgroundColor: (t) => t.palette.primary.main,
            "&:hover": { backgroundColor: "#3ea313" },
            px: { xs: 2, sm: 3 },
          }}
        >
          <HelpOutlineIcon sx={{ mr: { xs: 0, sm: 1 } }} />
          <MuiBox
            component="span"
            sx={{ display: { xs: "none", sm: "inline" } }}
          >
            Vehicle Tips
          </MuiBox>
        </Fab>
      </Tooltip>

      <Drawer
        anchor="right"
        open={tipsOpen}
        onClose={() => setTipsOpen(false)}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          sx: {
            mt: { xs: drawerTopXs, sm: drawerTopSm },
            height: {
              xs: `calc(100% - ${drawerTopXs})`,
              sm: `calc(100% - ${drawerTopSm})`,
            },
            width: isSmUp ? 460 : "94vw",
            overflow: "auto",
            pt: 1,
          },
        }}
      >
        <MuiBox sx={{ px: 2, pb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: "bold", mb: 1 }}>
            🚐 Vehicle Tips
          </Typography>
          <VehicleDropGuides compact />
        </MuiBox>
      </Drawer>

      {/* Lightbox for Dropoff Maps */}
      <Lightbox
        open={!!selectedImage}
        close={() => setSelectedImage(null)}
        slides={slides}
        plugins={[Fullscreen]}
        keyboardNavigation={false}
        render={{
          buttonPrev: () => null,
          buttonNext: () => null,
          slide: ({ slide }) => (
            <MuiBox
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                p: 2,
              }}
            >
              {slide?.src ? (
                <PictureWebp
                  srcPng={slide.src}
                  alt={selectedImage?.name || "Dropoff map"}
                  imgProps={{
                    style: {
                      maxWidth: "100%",
                      maxHeight: "70vh",
                      objectFit: "contain",
                      borderRadius: 8,
                      height: "auto",
                      display: "block",
                    },
                  }}
                />
              ) : null}
              {selectedImage && (
                <>
                  <Typography variant="h6" sx={{ mt: 2, fontWeight: "bold" }}>
                    {selectedImage.name}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ mt: 1, maxWidth: 600, color: "text.secondary" }}
                  >
                    {selectedImage.notes}
                  </Typography>
                </>
              )}
            </MuiBox>
          ),
        }}
      />

      {/* Passenger App Walkthrough Modal */}
      <PassengerAppModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </PageContainer>
  );
}
