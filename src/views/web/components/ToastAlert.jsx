import React from 'react';
import { Snackbar, Alert } from '@mui/material';

export default function ToastAlert({ message, isError, open, onClose }) {
  return (
    <Snackbar 
      open={open} 
      autoHideDuration={isError ? 7000 : 4000} 
      onClose={onClose} 
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      sx={{ top: { xs: 80, sm: 100 } }}
    >
      <Alert 
        onClose={onClose} 
        severity={isError ? "error" : "success"} 
        variant="filled" 
        sx={{ 
          borderRadius: '12px', 
          fontWeight: 500,
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
        }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
