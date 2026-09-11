// src/components/AcordeonHerramientas.jsx
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Avatar
} from '@mui/material';
import {
  Calendar as CalendarIcon,
  MessageSquare,
  ChevronDown,
  ShieldCheck
} from 'lucide-react';
import CalendarioInstitucional from './CalendarioInstitucional';
import GoogleChatPanel from './GoogleChatPanel';
import { useAuth } from '../context/AuthContext';

export default function AcordeonHerramientas() {
  const { user } = useAuth();

  // Estado del acordeón: 'chat' (abierto por defecto) | 'calendario' | false
  const [expanded, setExpanded] = useState('chat');

  const handleChange = (panel) => (event, isExpanded) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* ======================================================== */}
      {/* 💬 PANEL 1: GOOGLE CHAT INSTITUCIONAL (ABIERTO POR DEFECTO) */}
      {/* ======================================================== */}
      <Accordion
        expanded={expanded === 'chat'}
        onChange={handleChange('chat')}
        disableGutters
        elevation={0}
        sx={{
          borderRadius: '16px !important',
          border: '1px solid #e2e8f0',
          bgcolor: '#ffffff',
          boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          '&:before': { display: 'none' },
          transition: 'box-shadow 0.2s ease-in-out',
          '&.Mui-expanded': {
            boxShadow: '0 8px 28px -4px rgba(16, 185, 129, 0.08)'
          }
        }}
      >
        <AccordionSummary
          expandIcon={<ChevronDown size={20} color="#64748b" />}
          sx={{
            px: { xs: 2, sm: 2.5 },
            py: 1.5,
            bgcolor: expanded === 'chat' ? 'rgba(16, 185, 129, 0.02)' : '#ffffff',
            borderBottom: expanded === 'chat' ? '1px solid #e2e8f0' : 'none',
            '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.03)' }
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              pr: 1.5,
              gap: 2,
              flexWrap: 'wrap'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  p: 1.2,
                  borderRadius: 2,
                  bgcolor: 'rgba(16, 185, 129, 0.1)',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <MessageSquare size={22} />
              </Box>
              <Box>
                <Typography
                  variant="subtitle1"
                  fontWeight="bold"
                  color="#0f233c"
                  sx={{ fontSize: { xs: '1rem', sm: '1.15rem' } }}
                >
                  Google Chat Institucional
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Comunicación en tiempo real, canales temáticos y mensajes directos
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {user && (
                <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1 }}>
                  <Avatar
                    src={user.photoURL}
                    sx={{ width: 22, height: 22, fontSize: '0.75rem', bgcolor: '#059669' }}
                  >
                    {user.displayName ? user.displayName.charAt(0) : 'U'}
                  </Avatar>
                  <Typography variant="caption" color="text.secondary" fontWeight="500">
                    {user.email}
                  </Typography>
                </Box>
              )}
              <Chip
                icon={<ShieldCheck size={12} color="#059669" />}
                label="Google Chat"
                size="small"
                sx={{
                  bgcolor: 'rgba(16, 185, 129, 0.1)',
                  color: '#059669',
                  fontWeight: '600',
                  fontSize: '0.72rem'
                }}
              />
            </Box>
          </Box>
        </AccordionSummary>

        <AccordionDetails sx={{ p: 0 }}>
          <GoogleChatPanel />
        </AccordionDetails>
      </Accordion>

      {/* ======================================================== */}
      {/* 📅 PANEL 2: CALENDARIO INSTITUCIONAL IIRESODH (CERRADO) */}
      {/* ======================================================== */}
      <Accordion
        expanded={expanded === 'calendario'}
        onChange={handleChange('calendario')}
        disableGutters
        elevation={0}
        sx={{
          borderRadius: '16px !important',
          border: '1px solid #e2e8f0',
          bgcolor: '#ffffff',
          boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          '&:before': { display: 'none' },
          transition: 'box-shadow 0.2s ease-in-out',
          '&.Mui-expanded': {
            boxShadow: '0 8px 28px -4px rgba(26, 54, 93, 0.08)'
          }
        }}
      >
        <AccordionSummary
          expandIcon={<ChevronDown size={20} color="#64748b" />}
          sx={{
            px: { xs: 2, sm: 2.5 },
            py: 1.5,
            bgcolor: expanded === 'calendario' ? 'rgba(26, 54, 93, 0.02)' : '#ffffff',
            borderBottom: expanded === 'calendario' ? '1px solid #e2e8f0' : 'none',
            '&:hover': { bgcolor: 'rgba(26, 54, 93, 0.03)' }
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              pr: 1.5,
              gap: 2,
              flexWrap: 'wrap'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  p: 1.2,
                  borderRadius: 2,
                  bgcolor: 'rgba(26, 54, 93, 0.08)',
                  color: '#1a365d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <CalendarIcon size={22} />
              </Box>
              <Box>
                <Typography
                  variant="subtitle1"
                  fontWeight="bold"
                  color="#1a365d"
                  sx={{ fontSize: { xs: '1rem', sm: '1.15rem' } }}
                >
                  Calendario Institucional IIRESODH
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Agenda institucional, audiencias y eventos sincronizados
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label="Google Calendar"
                size="small"
                sx={{
                  bgcolor: 'rgba(26, 54, 93, 0.08)',
                  color: '#1a365d',
                  fontWeight: '600',
                  fontSize: '0.72rem'
                }}
              />
            </Box>
          </Box>
        </AccordionSummary>

        <AccordionDetails sx={{ p: 0 }}>
          <CalendarioInstitucional insideAccordion={true} />
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
