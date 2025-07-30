import React, { useState } from 'react';
import {
  Box,
  Typography,
  Divider,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  InputAdornment
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import Lightbox from 'yet-another-react-lightbox';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import 'yet-another-react-lightbox/styles.css';

import DropoffAccordion from './DropoffAccordion';
import PassengerAppModal from './PassengerAppModal';

export default function DriverInfoTab() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const gateCodes = [
    { name: 'Camden', codes: ['1793#', '1313'] },
    { name: 'Cypress', codes: ['7469'] },
    { name: 'Shooters 21', codes: ['4040'] },
    { name: 'Tan-Tar-A', codes: ['4365', '1610', '5746', '1713', '4271', '0509'] },
    { name: 'Ledges (Back Gate)', codes: ['2014'] },
    { name: 'Ty’s Cove', codes: ['5540', '2349'] },
    { name: 'Lighthouse Point', codes: ['#7373'] },
    { name: 'Southwood Shores', codes: ['60200', '42888', '48675'] },
    { name: 'Palisades', codes: ['#4667', '6186', '#5572', '6649', '8708', '2205'] },
    { name: 'The Cove (off Bluff Dr)', codes: ['#1172'] },
    { name: 'Cobblestone (off Nichols)', codes: ['1776'] },
    { name: 'Cape Royal', codes: ['#1114', '#1099'] },
    { name: 'Car Wash', codes: ['655054#'] },
    { name: 'Bronx', codes: ['9376'] },
    { name: 'Mystic Bay', codes: ['0235#'] },
    { name: 'RT’s Cove', codes: ['8870'] },
    { name: 'Magnolia Point', codes: ['#1827'] },
    { name: 'Paige', codes: ['9195'] },
    { name: 'Del Sol', codes: ['2202'] },
    { name: 'Hamptons', codes: ['#3202'] },
    { name: 'Stone Ridge', codes: ['1379'] },
    { name: 'Lee C. Fine Airport', codes: ['1228'] },
    { name: 'Sac Road', codes: ['#6423'] },
  ];

  const filteredCodes = gateCodes.filter(({ name }) =>
    name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box sx={{ pb: 4 }}>
      <Typography variant="h5" gutterBottom fontWeight="bold">
        🚗 Driver Drop-Off Info & Instructions
      </Typography>

      <Typography variant="body1" sx={{ mb: 3 }}>
        These tips are here to help you stay compliant and deliver a seamless VIP experience.
      </Typography>

      <Divider sx={{ mb: 3 }} />

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
          <TextField
            fullWidth
            placeholder="Search by location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          {filteredCodes.length > 0 ? (
            <Box component="ul" sx={{ listStyleType: 'disc', pl: 3, lineHeight: 1.7 }}>
              {filteredCodes.map((entry, idx) => (
                <li key={idx}>
                  <strong>{entry.name}:</strong> {entry.codes.join(', ')}
                </li>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No matching locations found.
            </Typography>
          )}
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
        slides={selectedImage ? [{ src: selectedImage.mapUrl }] : []}
        plugins={[Fullscreen]}
        keyboardNavigation={false}
        render={{
          buttonPrev: () => null,
          buttonNext: () => null,
          slide: ({ slide }) => (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                p: 2,
              }}
            >
              <img
                src={slide?.src}
                alt={selectedImage?.name}
                style={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                  borderRadius: 8,
                }}
              />
              {selectedImage && (
                <>
                  <Typography variant="h6" sx={{ mt: 2, fontWeight: 'bold' }}>
                    {selectedImage.name}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ mt: 1, maxWidth: 600, color: 'text.secondary' }}
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
