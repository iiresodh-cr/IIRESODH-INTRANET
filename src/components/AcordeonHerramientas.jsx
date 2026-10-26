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
  MessageSquare,
  ChevronDown,
  ShieldCheck
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
          borderRadius: '0 0 14px 14px !important',
          border: '1px solid #DCE4EE',
          borderTop: '3px solid #1D3557',
          bgcolor: '#FFFFFF',
          boxShadow: '0 8px 28px -6px rgba(29, 53, 87, 0.07)',
          overflow: 'hidden',
          '&:before': { display: 'none' }
        }}
      >
        <AccordionSummary
          expandIcon={<ChevronDown size={20} color="#1D3557" />}
          sx={{
            px: { xs: 2, sm: 3 },
            py: 1.4,
            bgcolor: isOpen ? 'rgba(29, 53, 87, 0.02)' : '#FFFFFF',
            borderBottom: isOpen ? '1px solid #E2E8F0' : 'none',
            '&:hover': { bgcolor: 'rgba(29, 53, 87, 0.035)' }
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
                  p: 1.25,
                  borderRadius: '8px 8px 0 0',
                  bgcolor: '#1D3557',
                  color: '#FFFFFF',
                  borderBottom: '2px solid #B92F32',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(29, 53, 87, 0.16)'
                }}
              >
                <MessageSquare size={20} />
              </Box>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontFamily: '"Plus Jakarta Sans", sans-serif',
                      fontWeight: 800,
                      color: '#1D3557',
                      fontSize: { xs: '1rem', sm: '1.12rem' },
                      letterSpacing: '-0.01em'
                    }}
                  >
                    Espacio de Trabajo & Agenda Institucional
                  </Typography>
                  <Chip
                    label="Canales • Proyectos • Calendario • Google Drive"
                    size="small"
                    sx={{
                      bgcolor: 'rgba(69, 123, 157, 0.1)',
                      color: '#1D3557',
                      border: '1px solid rgba(69, 123, 157, 0.25)',
                      fontWeight: 700,
                      fontSize: '0.69rem',
                      height: 22,
                      display: { xs: 'none', md: 'inline-flex' }
                    }}
                  />
                </Box>
                <Typography variant="caption" sx={{ color: '#475569', fontSize: '0.78rem' }}>
                  Coordinación interna en tiempo real, seguimiento de proyectos, agenda híbrida y repositorio Drive
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              {user && (
                <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1 }}>
                  <Avatar
                    src={user.photoURL}
                    sx={{ width: 24, height: 24, fontSize: '0.75rem', bgcolor: '#1D3557' }}
                  >
                    {user.displayName ? user.displayName.charAt(0) : 'U'}
                  </Avatar>
                  <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
                    {user.email}
                  </Typography>
                </Box>
              )}
              <Chip
                icon={<ShieldCheck size={13} color="#1D3557" />}
                label="Workspace Activo"
                size="small"
                sx={{
                  bgcolor: '#F8FAF8',
                  color: '#1D3557',
                  border: '1px solid #CBD5E1',
                  fontWeight: 700,
                  fontSize: '0.72rem'
                }}
              />
            </Box>
          </Box>
        </AccordionSummary>

        <AccordionDetails sx={{ p: { xs: 0.5, sm: 1.5 }, bgcolor: '#F8FAF8' }}>
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
