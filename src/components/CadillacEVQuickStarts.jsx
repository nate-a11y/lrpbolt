/* Proprietary and confidential. See LICENSE. */
import React, { useMemo } from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Box,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Divider,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

export default function CadillacEVQuickStarts() {
  const evGuides = useMemo(
    () => [
      {
        name: "Escalade IQ (2025)",
        rows: [
          ["Startup", "Brake + Start button; right-side electronic shifter."],
          ["Size & Weight", "Very heavy SUV – allow longer braking distances."],
          ["Turning", "4-Wheel Steer gives surprisingly tight U-turns."],
          ["Ride Feel", "Air Ride/Mag Ride – let it settle before sharp moves."],
          ["Passenger Tips", "Flat floor, wide doors; step-in height auto-lowers."],
        ],
      },
      {
        name: "LYRIQ (2025)",
        rows: [
          ["Startup & Shift", "Brake + Start; console toggle shifter."],
          ["Acceleration", "Instant – feather throttle for smoothness."],
          ["Regen", "One-Pedal can feel grabby – toggle off if unfamiliar."],
          ["Visibility", "Rear window small – use mirrors + cameras."],
          ["Passenger Tips", "Tall riders: watch sloping roofline entering rear."],
        ],
      },
      {
        name: "CELESTIQ (2024–2025)",
        rows: [
          ["Startup & Shift", "Brake + Start; electronic shifter."],
          ["Power", "655 hp – easy throttle to avoid tossing riders."],
          ["Steering", "Drive limo-smooth; don’t treat it like a sports car."],
          ["Interior", "Bespoke finishes/glass roof – protect surfaces."],
          ["Passenger Tips", "Rear seats ultra-lux; smoothness is key."],
        ],
      },
      {
        name: "OPTIQ (2025)",
        rows: [
          [
            "Quick & Smooth",
            "Instant-torque AWD (~300 hp) – ease on throttle for smooth passenger starts.",
          ],
          [
            "Cabin Quiet",
            "Ultra-quiet interior – tell riders you’re moving, or they may not notice.",
          ],
          [
            "Super Cruise",
            "Hands-free highway driving is standard. Great for long ferrying legs.",
          ],
          [
            "Display & UI",
            "Huge 33″ 9K screen with Google built-in — use map/charge assist for route planning.",
          ],
          [
            "Regen Feel",
            "Subtle regen feels like coasting — warn riders and use brake pedal gently.",
          ],
        ],
      },
      {
        name: "Universal Pro Tips",
        rows: [
          ["Smoothness", "Roll on throttle gently – instant torque otherwise."],
          ["Braking", "Regen feels different – warn riders if using One-Pedal."],
          ["Silence", "Tell passengers before moving – they may not notice."],
          ["Climate", "Pre-set A/C/heat before loading for comfort."],
          ["Stops", "EVs creep less – apply light throttle to re-merge."],
        ],
      },
    ],
    []
  );

  return (
    <Box sx={{ my: 2 }}>
      {evGuides.map((guide, idx) => (
        <Box key={guide.name} sx={{ mb: idx === evGuides.length - 1 ? 0 : 2 }}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight="bold">{guide.name}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Table size="small">
                <TableBody>
                  {guide.rows.map(([label, desc], i) => (
                    <TableRow key={i} sx={{ verticalAlign: "top" }}>
                      <TableCell sx={{ fontWeight: 500, width: "35%" }}>{label}</TableCell>
                      <TableCell>{desc}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AccordionDetails>
          </Accordion>
          {idx !== evGuides.length - 1 && <Divider sx={{ mt: 2 }} />}
        </Box>
      ))}
    </Box>
  );
}

