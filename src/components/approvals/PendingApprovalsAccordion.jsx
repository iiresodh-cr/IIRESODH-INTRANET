// src/components/approvals/PendingApprovalsAccordion.jsx
import React, { useState } from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Typography,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Paper,
  Divider,
  Snackbar,
  Alert
} from '@mui/material';
import {
  FileCheck2,
  ChevronDown,
  Eye,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Calendar,
  User,
  Clock
} from 'lucide-react';
import ReviewModal from './ReviewModal';

export default function PendingApprovalsAccordion({
  pendingApprovals = [],
  pendingCount = 0,
  expanded = true,
  onToggle,
  onSubmitAction
}) {
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  // REGLA FUNDAMENTAL: Si no hay tareas pendientes, no mostrar absolutamente nada
  if (pendingCount === 0 || !pendingApprovals || pendingApprovals.length === 0) {
    return null;
  }

  const handleOpenReview = (approval) => {
    setSelectedApproval(approval);
    setModalOpen(true);
  };

  const handleCloseReview = () => {
    setModalOpen(false);
    setSelectedApproval(null);
  };

  const handleQuickSubmit = async (approvalId, decision, comment = '') => {
    try {
      await onSubmitAction(approvalId, decision, comment);
      setToast({
        open: true,
        message: decision === 'APPROVED' 
          ? 'Documento aprobado exitosamente.' 
          : 'Documento rechazado con observaciones registradas.',
        severity: decision === 'APPROVED' ? 'success' : 'info'
      });
    } catch (err) {
      setToast({
        open: true,
        message: 'Ocurrió un error al procesar la acción. Intente nuevamente.',
        severity: 'error'
      });
    }
  };

  return (
    <>
      <Accordion
        id="acordeon-aprobaciones"
        expanded={expanded}
        onChange={onToggle}
        disableGutters
        elevation={0}
        sx={{
          borderRadius: '16px !important',
          border: '1.5px solid #f59e0b',
          bgcolor: '#ffffff',
          boxShadow: '0 6px 24px -2px rgba(245, 158, 11, 0.12)',
          overflow: 'hidden',
          '&:before': { display: 'none' },
          transition: 'all 0.2s ease-in-out',
          '&.Mui-expanded': {
            boxShadow: '0 8px 30px -4px rgba(245, 158, 11, 0.18)'
          }
        }}
      >
        <AccordionSummary
          expandIcon={<ChevronDown size={20} color="#b45309" />}
          sx={{
            px: { xs: 2, sm: 2.5 },
            py: 1.5,
            bgcolor: expanded ? '#fffbeb' : '#ffffff',
            borderBottom: expanded ? '1px solid #fde68a' : 'none',
            '&:hover': { bgcolor: '#fef3c7' }
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
            {/* LADO IZQUIERDO: ICONO Y TÍTULO */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  p: 1.2,
                  borderRadius: 2,
                  bgcolor: '#fef3c7',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(217, 119, 6, 0.15)'
                }}
              >
                <FileCheck2 size={22} />
              </Box>
              <Box>
                <Typography
                  variant="subtitle1"
                  fontWeight="bold"
                  color="#92400e"
                  sx={{ fontSize: { xs: '1rem', sm: '1.15rem' }, display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  Bandeja de Aprobaciones / Revisiones
                </Typography>
                <Typography variant="caption" color="#b45309">
                  Documentos y piezas jurídicas pendientes de su dictamen o conformidad
                </Typography>
              </Box>
            </Box>

            {/* LADO DERECHO: BADGE CONTEO */}
            <Chip
              label={`${pendingCount} Tarea${pendingCount > 1 ? 's' : ''} Pendiente${pendingCount > 1 ? 's' : ''}`}
              size="small"
              sx={{
                bgcolor: '#f59e0b',
                color: '#ffffff',
                fontWeight: '800',
                fontSize: '0.75rem',
                borderRadius: 2,
                px: 0.5,
                boxShadow: '0 2px 6px rgba(245, 158, 11, 0.3)'
              }}
            />
          </Box>
        </AccordionSummary>

        <AccordionDetails sx={{ p: { xs: 1.5, sm: 2.5 }, bgcolor: '#ffffff' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {pendingApprovals.map((approval) => {
              let fechaFormat = 'Reciente';
              if (approval.createdAt?.toDate) {
                fechaFormat = approval.createdAt.toDate().toLocaleDateString('es-CR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                });
              }

              return (
                <Paper
                  key={approval.id}
                  elevation={0}
                  sx={{
                    p: { xs: 1.8, sm: 2.2 },
                    borderRadius: 3,
                    border: '1px solid #e2e8f0',
                    bgcolor: '#fafaf9',
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    alignItems: { xs: 'flex-start', md: 'center' },
                    justifyContent: 'space-between',
                    gap: 2,
                    transition: 'all 0.18s ease-in-out',
                    '&:hover': {
                      bgcolor: '#f8fafc',
                      borderColor: '#cbd5e1',
                      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)'
                    }
                  }}
                >
                  {/* METADATOS DEL DOCUMENTO */}
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant="subtitle2"
                      fontWeight="bold"
                      color="#0f233c"
                      onClick={() => handleOpenReview(approval)}
                      sx={{
                        fontSize: { xs: '0.95rem', sm: '1.02rem' },
                        cursor: 'pointer',
                        '&:hover': { color: '#d97706', textDecoration: 'underline' }
                      }}
                    >
                      {approval.title || 'Documento en revisión de Google Drive'}
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mt: 0.6 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          fontSize: '0.8rem'
                        }}
                      >
                        <User size={13} color="#94a3b8" /> {approval.authorEmail || 'Solicitante'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#cbd5e1' }}>•</Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          fontSize: '0.8rem'
                        }}
                      >
                        <Calendar size={13} color="#94a3b8" /> {fechaFormat}
                      </Typography>
                    </Box>
                  </Box>

                  {/* ACCIONES DEL REVISOR */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      width: { xs: '100%', md: 'auto' },
                      justifyContent: { xs: 'flex-end', md: 'flex-start' },
                      flexWrap: 'wrap'
                    }}
                  >
                    {/* Botón principal: Revisar / Abrir */}
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleOpenReview(approval)}
                      startIcon={<Eye size={15} />}
                      sx={{
                        bgcolor: '#1a365d',
                        color: '#ffffff',
                        textTransform: 'none',
                        fontWeight: 'bold',
                        fontSize: '0.82rem',
                        borderRadius: 2,
                        px: 1.8,
                        py: 0.6,
                        boxShadow: 'none',
                        '&:hover': {
                          bgcolor: '#0f233c',
                          boxShadow: 'none'
                        }
                      }}
                    >
                      Revisar / Abrir
                    </Button>

                    {/* Botón rápido: Aprobar */}
                    <Tooltip title="Aprobar directamente">
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleQuickSubmit(approval.id, 'APPROVED')}
                        startIcon={<CheckCircle2 size={15} />}
                        sx={{
                          borderColor: '#86efac',
                          color: '#15803d',
                          bgcolor: '#f0fdf4',
                          textTransform: 'none',
                          fontWeight: 'bold',
                          fontSize: '0.82rem',
                          borderRadius: 2,
                          px: 1.4,
                          py: 0.6,
                          '&:hover': {
                            bgcolor: '#dcfce7',
                            borderColor: '#4ade80'
                          }
                        }}
                      >
                        Aprobar
                      </Button>
                    </Tooltip>

                    {/* Botón rápido: Rechazar (abre modal con advertencia de cambios) */}
                    <Tooltip title="Rechazar y enviar observaciones">
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleOpenReview(approval)}
                        startIcon={<XCircle size={15} />}
                        sx={{
                          borderColor: '#fca5a5',
                          color: '#dc2626',
                          bgcolor: '#fef2f2',
                          textTransform: 'none',
                          fontWeight: 'bold',
                          fontSize: '0.82rem',
                          borderRadius: 2,
                          px: 1.4,
                          py: 0.6,
                          '&:hover': {
                            bgcolor: '#fee2e2',
                            borderColor: '#f87171'
                          }
                        }}
                      >
                        Rechazar
                      </Button>
                    </Tooltip>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* MODAL FLOTANTE DE REVISIÓN CON GOOGLE DOCS / DRIVE */}
      {selectedApproval && (
        <ReviewModal
          open={modalOpen}
          onClose={handleCloseReview}
          approval={selectedApproval}
          onSubmitAction={handleQuickSubmit}
        />
      )}

      {/* NOTIFICACIÓN TOAST */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          severity={toast.severity}
          sx={{ width: '100%', borderRadius: 2.5, fontWeight: 'bold' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </>
  );
}
