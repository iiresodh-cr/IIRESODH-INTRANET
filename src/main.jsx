import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'

// Paleta Oficial IIRESODH:
// MAIN BLUE: #1D3557 | SECONDARY BLUE: #457B9D | MAIN RED: #B92F32 | ACCENT RED: #E63946 | BASIC BEIGE/BG: #F8FAF8
const theme = createTheme({
  palette: {
    primary: {
      main: '#1D3557', // Main Blue institucional IIRESODH
      light: '#457B9D', // Secondary Blue
      dark: '#122238',
    },
    secondary: {
      main: '#B92F32', // Main Red institucional IIRESODH
      light: '#E63946',
    },
    info: {
      main: '#457B9D',
    },
    background: {
      default: '#F8FAF8', // Fondo sobrio institucional inspirado en Campus LMS
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1D3557',
      secondary: '#475569',
    }
  },
  typography: {
    fontFamily: '"Inter", "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: { fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif', fontWeight: 800, letterSpacing: '-0.02em' },
    h2: { fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif', fontWeight: 800, letterSpacing: '-0.02em' },
    h3: { fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif', fontWeight: 700, letterSpacing: '-0.015em' },
    h4: { fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif', fontWeight: 700, letterSpacing: '-0.015em' },
    h5: { fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif', fontWeight: 700, letterSpacing: '-0.01em' },
    h6: { fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif', fontWeight: 700, letterSpacing: '-0.01em' },
    subtitle1: { fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif' },
    button: { fontFamily: '"Inter", sans-serif', fontWeight: 600 },
  },
  shape: {
    borderRadius: 10,
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
