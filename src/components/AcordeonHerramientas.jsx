// src/components/AcordeonHerramientas.jsx
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip
} from '@mui/material';
import {
  MessageSquare,
  ChevronDown,
  ShieldCheck
} from 'lucide-react';
import EspacioTrabajoSlack from './workspace/EspacioTrabajoSlack';

export default function AcordeonHerramientas({
  activePanel,
  onPanelChange,
  userRole = 'Abogado/a',
  userName = ''
}) {
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
          borderRadius: '0 12px 12px 0 !important',
          border: '1px solid #e2e8f0',
          borderLeft: '3px solid #0f172a',
          bgcolor: '#ffffff',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
          overflow: 'hidden',
          '&:before': { display: 'none' }
        }}
      >
        <AccordionSummary
          expandIcon={<ChevronDown size={18} color="#0f172a" />}
          sx={{
            px: { xs: 2, sm: 3 },
            py: 1.25,
            bgcolor: '#ffffff',
            borderBottom: isOpen ? '1px solid #f1f5f9' : 'none',
            transition: 'background-color 0.15s ease',
            '&:hover': { bgcolor: '#f8fafc' }
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: '9px',
                  bgcolor: '#0f172a',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <MessageSquare size={18} />
              </Box>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontFamily: '"Plus Jakarta Sans", sans-serif',
                      fontWeight: 800,
                      color: '#0f172a',
                      fontSize: { xs: '0.95rem', sm: '1.05rem' },
                      letterSpacing: '-0.02em',
                      lineHeight: 1.2
                    }}
                  >
                    Espacio de Trabajo & Agenda Institucional
                  </Typography>
                  <Chip
                    label="Canales · Proyectos · Calendario · Google Drive"
                    size="small"
                    sx={{
                      bgcolor: '#f8fafc',
                      color: '#334155',
                      border: '1px solid #e2e8f0',
                      fontWeight: 700,
                      fontSize: '0.68rem',
                      height: 22,
                      borderRadius: '6px',
                      display: { xs: 'none', md: 'inline-flex' }
                    }}
                  />
                </Box>
                <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.76rem', display: 'block', mt: 0.2 }}>
                  Coordinación interna en tiempo real, seguimiento de proyectos, agenda híbrida y repositorio Drive
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Chip
                icon={<ShieldCheck size={13} color="#0f766e" />}
                label="En línea"
                size="small"
                sx={{
                  bgcolor: '#f0fdf4',
                  color: '#0f766e',
                  border: '1px solid #bbf7d0',
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  height: 24,
                  borderRadius: '6px'
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
