/* Proprietary and confidential. See LICENSE. */
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Divider,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Stack,
  Link as MUILink,
} from "@mui/material";
import {
  GridToolbar,
  GridToolbarExport as _GridToolbarExport,
} from "@mui/x-data-grid-pro";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import DownloadIcon from "@mui/icons-material/Download";
import Lightbox from "yet-another-react-lightbox";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import "yet-another-react-lightbox/styles.css";
import QRCode from "react-qr-code";

import SmartAutoGrid from "src/components/datagrid/SmartAutoGrid.jsx";
import ResponsiveScrollBox from "src/components/datagrid/ResponsiveScrollBox";
import useIsMobile from "src/hooks/useIsMobile";

import DropoffAccordion from "./DropoffAccordion";
import PassengerAppModal from "./PassengerAppModal";

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

  const rows = useMemo(() => GATE_CODES, []);

  const columns = useMemo(
    () => [
      {
        field: "name",
        headerName: "Location",
        flex: 1,
        minWidth: 150,
        valueGetter: (params) => params?.row?.name ?? "N/A",
      },
      {
        field: "codes",
        headerName: "Gate Codes",
        flex: 1,
        minWidth: 150,
        valueGetter: (params) =>
          Array.isArray(params?.row?.codes)
            ? params.row.codes.join(", ")
            : "N/A",
        renderCell: (p) => (
          <Box
            sx={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: { xs: 180, md: "unset" },
            }}
          >
            {p?.value ?? "N/A"}
          </Box>
        ),
      },
    ],
    [],
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
    <Box sx={{ pb: 4 }}>
      <Typography variant="h5" gutterBottom fontWeight="bold">
        🚗 Driver Drop-Off Info & Instructions
      </Typography>

      <Typography variant="body1" sx={{ mb: 3 }}>
        These tips are here to help you stay compliant and deliver a seamless
        VIP experience.
      </Typography>

      <Divider sx={{ mb: 3 }} />

      {/* Airport Pickup (Fort Leonard Wood / Waynesville–St. Robert) */}
      <Accordion defaultExpanded sx={{ mt: 1 }}>
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
            <Box
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
            </Box>

            {/* Instructions */}
            <Box sx={{ flex: 1, minWidth: 280 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Step-by-step (Pre-Registration)
              </Typography>
              <Box component="ol" sx={{ pl: 3, lineHeight: 1.7, m: 0 }}>
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
                  <Box component="ul" sx={{ pl: 3, mt: 0.5, mb: 0 }}>
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
                  </Box>
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
              </Box>

              <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 2 }}>
                What to bring (physical copies)
              </Typography>
              <Box component="ul" sx={{ pl: 3, m: 0, lineHeight: 1.7 }}>
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
              </Box>
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Dropoff Locations Section */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="h6" gutterBottom>
          📍 Dropoff Locations
        </Typography>
        <DropoffAccordion onSelectImage={setSelectedImage} />
      </Box>

      {/* Gate Codes Accordion with Search */}
      <Accordion sx={{ mt: 4 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">
            🔐 Gate Codes & Access Notes
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <ResponsiveScrollBox>
            <Paper sx={{ width: "100%", overflow: "auto" }}>
              <SmartAutoGrid
                autoHeight
                rows={rows || []}
                columns={columns || []}
                getRowId={getRowId}
                columnVisibilityModel={columnVisibilityModel}
                slots={{
                  toolbar: GridToolbar,
                  noRowsOverlay: NoRowsOverlay,
                  noResultsOverlay: NoResultsOverlay,
                }}
                slotProps={{
                  toolbar: {
                    quickFilterProps: {
                      debounceMs: 300,
                      placeholder: "Search by location...",
                    },
                  },
                }}
                pagination
                hideFooterSelectedRowCount
              />
            </Paper>
          </ResponsiveScrollBox>
        </AccordionDetails>
      </Accordion>

      {/* Passenger App Walkthrough */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          📲 Passenger App Overview
        </Typography>
        <Button variant="outlined" onClick={() => setModalOpen(true)}>
          Open Walkthrough
        </Button>
      </Box>

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
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                p: 2,
              }}
            >
              {slide?.src ? (
                <Box
                  component="img"
                  src={slide.src}
                  alt={selectedImage?.name || "Dropoff map"}
                  sx={{
                    maxWidth: "100%",
                    maxHeight: "70vh",
                    objectFit: "contain",
                    borderRadius: 8,
                    height: "auto",
                    display: "block",
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
            </Box>
          ),
        }}
      />

      {/* Passenger App Walkthrough Modal */}
      <PassengerAppModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </Box>
  );
}
