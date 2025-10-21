/* Proprietary and confidential. See LICENSE. */
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Link,
  Box,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";

import useAccordionControl from "../hooks/useAccordionControl";
import LOCATIONS from "../driverLocations";

const CATEGORIES = {
  "🏨 Resorts & Golf": [
    "Margaritaville",
    "Camden on the Lake – Shady Gators",
    "Lodge of the Four Seasons",
    "Old Kinderhook",
    "Osage National Golf Course",
  ],
  "🌙 Bars & Nightlife": [
    "Shady Gators",
    "Backwater Jacks",
    "Dog Days",
    "Redheads High Tide Performance Boat Center",
    "Encore",
    "LakeHouse 13",
    "Bagnell Dam Strip Behind Tuckers",
    "Bagnell Dam Strip Lower",
    "Bagnell Dam Strip Mid",
  ],
  "🍽️ Restaurants": [
    "Baxters and JB Hooks",
    "1932 Reserve",
    "Shorty Pants",
    "H. Toad’s Bar & Grill",
    "Fish and Co",
    "The Cave",
    "Coconuts",
    "Franky and Louies",
  ],
  "🎯 Other Destinations": [
    "Ozarks Amphitheater",
    "Cypress Condos",
    "Worldmark Lake of the Ozarks Condos",
  ],
};

export default function DropoffAccordion({ onSelectImage }) {
  const categorized = Object.entries(CATEGORIES).map(([category, names]) => ({
    category,
    places: LOCATIONS.filter((loc) => names.includes(loc.name)),
  }));
  const acc = useAccordionControl(false);

  return (
    <>
      {categorized.map(({ category, places }, idx) => (
        <Accordion
          // eslint-disable-next-line react/no-array-index-key
          key={idx}
          defaultExpanded={false}
          expanded={acc.is(category)}
          onChange={acc.handleChange(category)}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight="bold">{category}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {places.map((loc, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <Box key={i} sx={{ mb: 3 }}>
                <Typography
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    fontWeight: 500,
                    mb: 0.5,
                  }}
                >
                  <DirectionsCarIcon fontSize="small" sx={{ mr: 1 }} />
                  {loc.name}
                </Typography>

                <Typography
                  variant="body2"
                  sx={{ mb: 1, whiteSpace: "pre-wrap" }}
                  color="text.secondary"
                >
                  {loc.notes}
                </Typography>

                <Link
                  component="button"
                  underline="hover"
                  onClick={() => onSelectImage(loc)}
                  sx={{ fontSize: "0.875rem" }}
                >
                  View Map / Drop-off Image
                </Link>
              </Box>
            ))}
          </AccordionDetails>
        </Accordion>
      ))}
    </>
  );
}
