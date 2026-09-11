// src/components/approvals/ReviewModal.jsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  TextField,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  ExternalLink,
  CheckCircle2,
  XCircle,
  X,
  FileText,
  User,
  Calendar,
  AlertCircle
} from 'lucide-react';

export default function ReviewModal({
  open,
  onClose,
  approval,
  onSubmitAction
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));

  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!approval) return null;

  // Formatear fecha
  let fechaStr = 'Reciente';
  if (approval.createdAt?.toDate) {
    fechaStr = approval.createdAt.toDate().toLocaleDateString('es-CR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Transformar URL para embeber como /preview
  const getEmbedUrl = (rawUrl = '') => {
    if (!rawUrl) return '';
    if (rawUrl.includes('/preview')) return rawUrl;
    return rawUrl.replace(/\/edit(\?.*)?$/, '/preview');
  };

  const embedUrl = getEmbedUrl(approval.driveFileUrl);

  const handleAction = async (decision) => {
    setErrorMsg('');
    setSubmitting(true);
    try {
      await onSubmitAction(approval.id, decision, comment);
      setComment('');
      onClose();
    } catch (err) {
      console.error('Error al emitir decisión de aprobación:', err);
      setErrorMsg('No se pudo registrar su decisión en el servidor. Por favor intente nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      fullWidth
      maxWidth="xl"
      fullScreen={fullScreen}
      slotProps={{
        paper: {
          sx: {
            borderRadius: fullScreen ? 0 : 3.5,
            bgcolor: '#ffffff',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
            maxHeight: fullScreen ? '100vh' : '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }
        }
      }}
    >
      {/* CABECERA INSTITUCIONAL */}
      <DialogTitle
        sx={{
          p: { xs: 2, sm: 2.5 },
          bgcolor: '#1a365d',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              bgcolor: 'rgba(255, 255, 255, 0.12)',
              color: '#93c5fd',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <FileText size={22} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="subtitle1"
              fontWeight="bold"
              color="#ffffff"
              noWrap
              sx={{ fontSize: { xs: '1rem', sm: '1.15rem' } }}
            >
              {approval.title || 'Revisión de Documento Institucional'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mt: 0.3 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.8)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <User size={13} /> {approval.authorEmail || 'Solicitante'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>•</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.8)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Calendar size={13} /> {fechaStr}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          {approval.driveFileUrl && (
            <Button
              variant="contained"
              size="small"
              onClick={() => window.open(approval.driveFileUrl, '_blank', 'noopener,noreferrer')}
              startIcon={<ExternalLink size={15} />}
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.82rem',
                borderRadius: 2,
                boxShadow: 'none',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.25)',
                  boxShadow: 'none'
                }
              }}
            >
              Abrir en Google Docs
            </Button>
          )}

          <IconButton
            onClick={onClose}
            disabled={submitting}
            size="small"
            sx={{
              color: '#ffffff',
              bgcolor: 'rgba(255, 255, 255, 0.08)',
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.2)' }
            }}
          >
            <X size={18} />
          </IconButton>
        </Box>
      </DialogTitle>

      {/* CUERPO DEL DIÁLOGO (SPLIT VIEW) */}
      <DialogContent
        dividers
        sx={{
          p: 0,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          flex: 1,
          overflow: 'hidden',
          bgcolor: '#f8fafc'
        }}
      >
        {/* PANEL IZQUIERDO: VISOR DE GOOGLE DOCS / DRIVE */}
        <Box
          sx={{
            flex: { xs: '1 1 auto', md: 7 },
            height: { xs: '50vh', md: 'auto' },
            bgcolor: '#0f172a',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={approval.title || 'Documento en revisión'}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block'
              }}
              allow="autoplay"
            />
          ) : (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                p: 3,
                textAlign: 'center',
                color: '#94a3b8'
              }}
            >
              <FileText size={48} strokeWidth={1.5} />
              <Typography variant="body1" sx={{ mt: 2, fontWeight: 600, color: '#f1f5f9' }}>
                Enlace de previsualización no disponible
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, color: '#94a3b8' }}>
                Utilice el botón superior "Abrir en Google Docs" para examinar el archivo en una ventana nueva.
              </Typography>
            </Box>
          )}

          {/* Banner informativo de privacidad */}
          <Box
            sx={{
              px: 2,
              py: 0.8,
              bgcolor: 'rgba(15, 23, 42, 0.85)',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1
            }}
          >
            <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.75rem' }}>
              ℹ️ Si el documento muestra restricciones de cookies de Google, use el botón superior para visualizarlo directamente.
            </Typography>
          </Box>
        </Box>

        {/* PANEL DERECHO: ACCIONES Y COMENTARIOS DEL REVISOR */}
        <Box
          sx={{
            flex: { xs: 'none', md: 5 },
            width: { xs: '100%', md: '420px' },
            p: { xs: 2, sm: 3 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            bgcolor: '#ffffff',
            borderLeft: { md: '1px solid #e2e8f0' },
            overflowY: 'auto'
          }}
        >
          <Box>
            <Typography variant="subtitle2" fontWeight="bold" color="#0f233c" sx={{ mb: 1 }}>
              Dictamen y Observaciones
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, fontSize: '0.85rem' }}>
              Evalúe la redacción, términos y fundamentación del documento. Si requiere correcciones o adiciones, agréguelas en las observaciones antes de rechazar con cambios.
            </Typography>

            {errorMsg && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2, fontSize: '0.82rem' }}>
                {errorMsg}
              </Alert>
            )}

            <TextField
              label="Observaciones o Comentario de Retroalimentación (Opcional)"
              multiline
              rows={5}
              fullWidth
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ej: Aprobado conforme a la estrategia acordada... / Favor ajustar la cláusula 3..."
              disabled={submitting}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2.5,
                  fontSize: '0.9rem',
                  bgcolor: '#f8fafc'
                }
              }}
            />

            <Box sx={{ mt: 2, p: 2, borderRadius: 2.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <Typography variant="caption" fontWeight="bold" color="text.secondary" display="block">
                Detalles de Asignación:
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                • <strong>ID de Archivo:</strong> {approval.driveFileId || approval.id}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                • <strong>Solicitante:</strong> {approval.authorEmail || 'N/D'}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                • <strong>Estado Actual:</strong> {approval.status || 'PENDING'}
              </Typography>
            </Box>
          </Box>

          {/* BOTONES DE DECISIÓN RÁPIDA */}
          <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Button
              variant="contained"
              fullWidth
              size="large"
              disabled={submitting}
              onClick={() => handleAction('APPROVED')}
              startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <CheckCircle2 size={19} />}
              sx={{
                bgcolor: '#059669',
                color: '#ffffff',
                textTransform: 'none',
                fontWeight: 'bold',
                fontSize: '0.95rem',
                borderRadius: 2.5,
                py: 1.2,
                boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
                '&:hover': {
                  bgcolor: '#047857',
                  boxShadow: '0 6px 16px rgba(5, 150, 105, 0.35)'
                }
              }}
            >
              Confirmar Aprobación
            </Button>

            <Button
              variant="outlined"
              fullWidth
              size="large"
              disabled={submitting}
              onClick={() => handleAction('REJECTED')}
              startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <XCircle size={19} />}
              sx={{
                borderColor: '#fca5a5',
                color: '#dc2626',
                bgcolor: '#fef2f2',
                textTransform: 'none',
                fontWeight: 'bold',
                fontSize: '0.95rem',
                borderRadius: 2.5,
                py: 1.2,
                '&:hover': {
                  bgcolor: '#fee2e2',
                  borderColor: '#f87171'
                }
              }}
            >
              Rechazar con Cambios
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
