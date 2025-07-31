import { createTheme } from '@mui/material/styles';

const getTheme = (darkMode) =>
  createTheme({
    palette: { mode: darkMode ? 'dark' : 'light', primary: { main: '#4cbb17' } },
    typography: { fontFamily: 'Inter, sans-serif' }
  });

export default getTheme;
