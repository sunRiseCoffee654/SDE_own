import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#3563E9', light: '#E9EEFF', dark: '#2447B8' },
    secondary: { main: '#0F9F91' },
    background: { default: '#F6F8FC', paper: '#FFFFFF' },
    text: { primary: '#182033', secondary: '#526077' },
    success: { main: '#159A78' },
    warning: { main: '#DD9B31' },
    error: { main: '#D95763' },
    divider: '#E9EDF5',
  },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: { fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.055em' },
    h2: { fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.04em' },
    h3: { fontSize: '1.12rem', fontWeight: 750, letterSpacing: '-0.02em' },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  shape: { borderRadius: 18 },
  components: {
    MuiButton: { styleOverrides: { root: { borderRadius: 14, paddingInline: 16, minHeight: 42, boxShadow: 'none' } } },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: 22 } } },
    MuiCard: { styleOverrides: { root: { border: '1px solid #EDF0F6', boxShadow: '0 10px 30px rgba(29, 47, 91, 0.035)' } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 24, backgroundImage: 'none' } } },
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
  },
});
