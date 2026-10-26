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
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import EspacioTrabajoSlack from './workspace/EspacioTrabajoSlack';
import { useAuth } from '../context/AuthContext';

export default function AcordeonHerramientas({
  activePanel,
  onPanelChange,
  userRole = 'Abogado/a',
  userName = ''
}) {
  const { user } = useAuth();

  // Estado del acordeón controlado o interno: 'chat' | 'calendario' | false
  const [internalExpanded, setInternalExpanded] = useState('chat');
  const expanded = activePanel !== undefined ? activePanel : internalExpanded;
  const setExpanded = onPanelChange || setInternalExpanded;

  const isOpen = expanded === 'chat' || expanded === 'calendario';
  const activeSection = expanded === 'calendario' ? 'calendario' : 'chat';

  const handleToggleAccordion = (_, isExpanded) => {
    setExpanded(isExpanded ? (expanded || 'chat') : false);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Accordion
        expanded={isOpen}
        onChange={handleToggleAccordion}
        disableGutters
        elevation={0}
        sx={{
          borderRadius: '18px !important',
          border: '1px solid #cbd5e1',
          bgcolor: '#ffffff',
          boxShadow: '0 6px 24px -4px rgba(15, 35, 60, 0.07)',
          overflow: 'hidden',
          '&:before': { display: 'none' }
        }}
      >
        <AccordionSummary
          expandIcon={<ChevronDown size={20} color="#64748b" />}
          sx={{
            px: { xs: 2, sm: 2.5 },
            py: 1.25,
            bgcolor: isOpen ? 'rgba(26, 54, 93, 0.02)' : '#ffffff',
            borderBottom: isOpen ? '1px solid #e2e8f0' : 'none',
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
                  borderRadius: 2.5,
                  bgcolor: '#0f233c',
                  color: '#c5a880',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 3px 10px rgba(15, 35, 60, 0.18)'
                }}
              >
                <MessageSquare size={21} />
              </Box>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography
                    variant="subtitle1"
                    fontWeight="800"
                    color="#0f233c"
                    sx={{ fontSize: { xs: '1rem', sm: '1.15rem' } }}
                  >
                    Espacio de Trabajo & Agenda Institucional
                  </Typography>
                  <Chip
                    label="Canales • Proyectos • Calendario • Google Drive"
                    size="small"
                    sx={{
                      bgcolor: 'rgba(16, 185, 129, 0.1)',
                      color: '#059669',
                      fontWeight: 700,
                      fontSize: '0.7rem',
                      height: 21,
                      display: { xs: 'none', md: 'inline-flex' }
                    }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Comunicación colaborativa en tiempo real (hilos, menciones, archivos) y agenda sincronizada
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {user && (
                <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1 }}>
                  <Avatar
                    src={user.photoURL}
                    sx={{ width: 24, height: 24, fontSize: '0.75rem', bgcolor: '#1a365d' }}
                  >
                    {user.displayName ? user.displayName.charAt(0) : 'U'}
                  </Avatar>
                  <Typography variant="caption" color="text.secondary" fontWeight="600">
                    {user.email}
                  </Typography>
                </Box>
              )}
              <Chip
                icon={<ShieldCheck size={12} color="#1a365d" />}
                label="Workspace Activo"
                size="small"
                sx={{
                  bgcolor: 'rgba(26, 54, 93, 0.08)',
                  color: '#1a365d',
                  fontWeight: '700',
                  fontSize: '0.72rem'
                }}
              />
            </Box>
          </Box>
        </AccordionSummary>

        <AccordionDetails sx={{ p: { xs: 0.5, sm: 1.5 }, bgcolor: '#f8fafc' }}>
          <EspacioTrabajoSlack
            initialSection={activeSection}
            userRole={userRole}
            userName={userName}
          />
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
