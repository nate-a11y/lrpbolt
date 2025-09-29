/* Proprietary and confidential. See LICENSE. */
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import PageContainer from "./PageContainer.jsx";

const VEHICLE_GUIDES = [
  {
    title: "🚌 Shuttle Bus Drop-Off",
    notes: `Use hotel loops or wide lanes only — do not attempt tight turns.
Always communicate with valet/front desk.
Allow extra time for unloading and maneuvering.
Use emergency flashers at all times during drop-off.
Avoid tight or crowded parking lots.
You may need to unload at a designated bus drop-off area away from the main entrance.
Watch for height restrictions — some resorts have low awnings.
Ensure your tablet is collected before departing the property.`,
  },
  {
    title: "🚐 Sprinter Van Drop-Off",
    notes: `Fits in standard width parking lanes, but needs extra length — approximately 1.5 spaces.
Watch all resort height clearance signs carefully.
Use emergency flashers while parked or maneuvering.
Avoid squeezing into compact parking areas or garages.
Always open the sliding side door for customer entry/exit — never have customers open it themselves.
Park straight to avoid blocking traffic flow.
Ensure your tablet is collected before leaving.`,
  },
  {
    title: "🚑 Rescue Squad Drop-Off",
    notes: `Use emergency flashers at all stops.
Look for level ground when deploying side steps — avoid steep curbs or inclines.
Do not attempt to squeeze into compact spaces; use larger open zones or driveways.
Avoid pedestrian-heavy zones when possible, and be hyper aware of foot traffic.
Check clearance signage carefully — the vehicle is taller than it looks.
Unload and load in a clear area before approaching valet or front.
Ensure your tablet is collected before departing.`,
  },
  {
    title: "🚌 Limo Bus Drop-Off",
    notes: `Use flashers at every stop.
Can fit in a regular size parking space, but only if the front and rear are fully aligned.
Use mirrors and rear camera for backing into place — always go slow and double-check.
Be cautious of tight turns in resort loops — make wider turns when needed.
Drop off passengers near the awning or covered walkway when possible.
Ensure your tablet is collected before leaving the vehicle unattended.`,
  },
];

export default function VehicleDropGuides({ compact = false }) {
  const Wrapper = compact ? Box : PageContainer;
  return (
    <Wrapper pb={compact ? 0 : 4}>
      {!compact && (
        <Typography variant="h6" sx={{ fontWeight: "bold", mb: 2 }}>
          🚐 Vehicle Drop-off Instructions
        </Typography>
      )}

      {VEHICLE_GUIDES.map((item) => (
        <Accordion key={item.title} defaultExpanded={false}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight="bold">{item.title}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography
              variant="body2"
              sx={{
                whiteSpace: "pre-line",
                lineHeight: 1.6,
                color: "text.secondary",
              }}
            >
              {item.notes}
            </Typography>
          </AccordionDetails>
        </Accordion>
      ))}
    </Wrapper>
  );
}
