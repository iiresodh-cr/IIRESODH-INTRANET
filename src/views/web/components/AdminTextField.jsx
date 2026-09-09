import React from 'react';
import { TextField } from '@mui/material';

export default function AdminTextField({ 
  label, 
  value, 
  onChange, 
  required = false, 
  type = "text", 
  placeholder, 
  multiline = false, 
  rows, 
  InputLabelProps, 
  inputProps, 
  step 
}) {
  return (
    <TextField
      label={label}
      value={value}
      onChange={onChange}
      required={required}
      type={type}
      placeholder={placeholder}
      multiline={multiline}
      rows={rows}
      fullWidth
      variant="outlined"
      size="medium"
      InputLabelProps={InputLabelProps}
      inputProps={{ step, ...inputProps }}
      sx={{
        backgroundColor: '#F9FAFB',
        '& .MuiOutlinedInput-root': {
          borderRadius: '12px',
          '& fieldset': {
            borderColor: '#E5E7EB',
          },
          '&:hover fieldset': {
            borderColor: '#457B9D',
          },
        },
      }}
    />
  );
}
