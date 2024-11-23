// src/App.jsx
import React from 'react';
import AIProcessor from './components/AIProcessor';
import { Box, Container, Typography, CssBaseline, ThemeProvider, createTheme } from '@mui/material';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Typography variant="h3" component="h1" gutterBottom align="center">
            Recipe Processor
          </Typography>
          <Typography variant="h6" component="h2" gutterBottom align="center" color="text.secondary">
            Process your recipes with AI
          </Typography>
          <AIProcessor />
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;