import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';

export default function ConfirmDialog({ open, title, content, onConfirm, onCancel }) {
  return (
    <Dialog 
      open={open} 
      onClose={onCancel} 
      PaperProps={{ 
        sx: { 
          borderRadius: '16px', 
          padding: '10px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' 
        } 
      }}
    >
      <DialogTitle sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: '1.25rem' }}>
        {title}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: '#6B7280', lineHeight: 1.6, fontSize: '0.875rem' }}>
          {content}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ gap: 1, padding: '16px' }}>
        <Button 
          onClick={onCancel} 
          variant="outlined" 
          color="inherit" 
          fullWidth 
          sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 600, py: 1.5 }}
        >
          Cancelar
        </Button>
        <Button 
          onClick={onConfirm} 
          variant="contained" 
          color="error" 
          fullWidth 
          sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 600, py: 1.5, boxShadow: 'none' }}
        >
          Sí, eliminar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
