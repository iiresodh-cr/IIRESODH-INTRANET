// src/components/GoogleChatPanel.jsx
import React from 'react';
import {
  Box,
  Typography,
  Button,
  Avatar,
  Chip,
  Paper
} from '@mui/material';
import {
  AppWindow,
  ExternalLink,
  ShieldCheck,
  Info,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function GoogleChatPanel() {
  const { user } = useAuth();

  // Genera URL forzando la cuenta de Google Workspace del usuario actual
  const getChatUrl = (hash = '') => {
    const email = user?.email || 'webmaster@iiresodh.org';
    const target = hash 
      ? `https://mail.google.com/chat/u/?authuser=${encodeURIComponent(email)}${hash}`
      : `https://chat.google.com/?authuser=${encodeURIComponent(email)}`;
    
    return `https://accounts.google.com/AccountChooser?Email=${encodeURIComponent(email)}&continue=${encodeURIComponent(target)}`;
  };

  const handleAbrirVentanaFlotante = () => {
    const width = 480;
    const height = 750;
    const left = window.screen.width - width - 40;
    const top = 60;
    const url = getChatUrl();
    window.open(
      url,
      'GoogleChatIIRESODH',
      `width=${width},height=${height},top=${top},left=${left},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`
    );
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 2.5 }, bgcolor: '#fafbfd' }}>
      {/* TARJETA PRINCIPAL DE ACCESO AL CHAT */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 3 },
          borderRadius: 3,
          border: '1px solid #e2e8f0',
          background: '#ffffff',
          boxShadow: '0 2px 12px -2px rgba(0, 0, 0, 0.04)'
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'stretch', md: 'center' },
            justifyContent: 'space-between',
            gap: 2.5
          }}
        >
          {/* IDENTIDAD DEL USUARIO */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ position: 'relative', flexShrink: 0 }}>
              <Avatar
                src={user?.photoURL}
                alt={user?.displayName || 'Usuario'}
                sx={{
                  width: 54,
                  height: 54,
                  border: '2px solid #ffffff',
                  boxShadow: '0 3px 10px rgba(0, 0, 0, 0.1)',
                  bgcolor: '#059669',
                  fontSize: '1.3rem',
                  fontWeight: 'bold'
                }}
              >
                {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
              </Avatar>
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 1,
                  right: 1,
                  width: 13,
                  height: 13,
                  bgcolor: '#22c55e',
                  border: '2px solid #ffffff',
                  borderRadius: '50%'
                }}
              />
            </Box>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.3 }}>
                <Typography variant="subtitle1" fontWeight="bold" color="#0f233c">
                  {user?.displayName || 'Usuario IIRESODH'}
                </Typography>
                <Chip
                  icon={<ShieldCheck size={13} color="#059669" />}
                  label="Workspace @iiresodh.org"
                  size="small"
                  sx={{
                    bgcolor: 'rgba(16, 185, 129, 0.1)',
                    color: '#059669',
                    fontWeight: '600',
                    fontSize: '0.72rem',
                    height: 22
                  }}
                />
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                Cuenta activa: <strong>{user?.email}</strong>
              </Typography>
            </Box>
          </Box>

          {/* BOTONES DE ACCIÓN */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 1.5,
              flexShrink: 0
            }}
          >
            <Button
              variant="contained"
              onClick={handleAbrirVentanaFlotante}
              startIcon={<AppWindow size={18} />}
              sx={{
                bgcolor: '#1a365d',
                color: '#ffffff',
                fontWeight: 'bold',
                textTransform: 'none',
                px: 2.5,
                py: 1.1,
                borderRadius: 2.5,
                boxShadow: '0 4px 14px rgba(26, 54, 93, 0.2)',
                '&:hover': {
                  bgcolor: '#0f233c'
                }
              }}
            >
              Abrir en Ventana Flotante
            </Button>

            <Button
              variant="outlined"
              href={getChatUrl()}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<ExternalLink size={16} />}
              sx={{
                borderColor: '#cbd5e1',
                color: '#334155',
                fontWeight: '600',
                textTransform: 'none',
                px: 2,
                py: 1.1,
                borderRadius: 2.5,
                '&:hover': {
                  borderColor: '#94a3b8',
                  bgcolor: '#f1f5f9'
                }
              }}
            >
              Abrir en Pestaña
            </Button>
          </Box>
        </Box>

        {/* NOTA DE AYUDA DE LA VENTANA FLOTANTE */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.2,
            bgcolor: 'rgba(26, 54, 93, 0.03)',
            border: '1px dashed #cbd5e1',
            borderRadius: 2,
            p: 1.5,
            mt: 2.5
          }}
        >
          <Info size={17} color="#1a365d" style={{ flexShrink: 0 }} />
          <Typography variant="caption" color="#475569" sx={{ lineHeight: 1.4 }}>
            <strong>Modo Ventana Flotante:</strong> Abre una ventana compacta de Google Chat que puedes ubicar al lado de tu navegador para comunicarte con el equipo en tiempo real mientras continúas trabajando en la Intranet.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
