import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Slide,
  useMediaQuery
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const isIosSafari = () => {
  const ua = window.navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  return isIOS && isSafari && !window.navigator.standalone;
};

const InstallBanner = () => {
  const isMobile = useMediaQuery('(max-width:600px)');
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (isIosSafari() && !localStorage.getItem('lrp_hide_install')) {
      setIsIos(true);
      setVisible(true);
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!localStorage.getItem('lrp_hide_install')) {
        setVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem('lrp_hide_install', '1');
  };

  if (!visible) return null;

  return (
    <Slide direction="down" in={visible} mountOnEnter unmountOnExit>
      <Box
        sx={{
          backgroundColor: '#4cbb17',
          color: '#fff',
          textAlign: 'center',
          p: 2,
          zIndex: 2000,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 3,
          flexWrap: 'wrap',
          rowGap: 1,
        }}
      >
        <Typography variant="body1" sx={{ flex: 1, pr: 2 }}>
          {isIos
            ? '📱 On Safari, tap Share → "Add to Home Screen" to install the app.'
            : '📲 Install the LRP Driver Portal on your device for faster access.'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {!isIos && deferredPrompt && (
            <Button
              onClick={handleInstall}
              variant="contained"
              sx={{
                backgroundColor: '#fff',
                color: '#4cbb17',
                fontWeight: 'bold',
                '&:hover': { backgroundColor: '#eafbe3' }
              }}
            >
              TAP TO INSTALL
            </Button>
          )}
          <IconButton onClick={handleDismiss} sx={{ color: '#fff' }} aria-label="Dismiss banner">
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>
    </Slide>
  );
};

export default InstallBanner;
