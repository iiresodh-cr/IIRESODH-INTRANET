// src/components/approvals/NewApprovalModal.jsx
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Alert,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  FileCheck2,
  X,
  Send,
  ExternalLink,
  Users
} from 'lucide-react';
import { db } from '../../config/firebase';
import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { registrarLogAuditoria } from '../../utils/auditLogger';

export default function NewApprovalModal({ open, onClose, onCreated }) {
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [driveFileUrl, setDriveFileUrl] = useState('');
  const [reviewerEmail, setReviewerEmail] = useState('');
  const [comment, setComment] = useState('');
  const [usuariosDisponibles, setUsuariosDisponibles] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Cargar lista de usuarios autorizados para seleccionar revisor fácilmente
  useEffect(() => {
    if (!open) return;
    const fetchUsuarios = async () => {
      setLoadingUsers(true);
      try {
        const snap = await getDocs(collection(db, 'usuarios_autorizados'));
        const lista = snap.docs.map(d => ({
          email: d.id,
          nombre: d.data().nombre || d.id,
          rol: d.data().rol || 'Colaborador'
        }));
        // Agregar siempre al Superadmin webmaster si no está
        if (!lista.some(u => u.email === 'webmaster@iiresodh.org')) {
          lista.unshift({ email: 'webmaster@iiresodh.org', nombre: 'Webmaster IIRESODH', rol: 'Superadmin' });
        }
        setUsuariosDisponibles(lista);
      } catch (err) {
        console.warn('No se pudo cargar la lista de usuarios autorizados:', err);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsuarios();
  }, [open]);

  // Extraer ID de archivo de Google Drive si es posible
  const extractDriveId = (url) => {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!title.trim()) {
      setErrorMsg('Por favor ingrese el título del documento.');
      return;
    }
    if (!driveFileUrl.trim()) {
      setErrorMsg('Por favor ingrese el enlace de Google Drive o Google Docs.');
      return;
    }
    if (!reviewerEmail.trim()) {
      setErrorMsg('Por favor seleccione o ingrese el correo del revisor asignado.');
      return;
    }

    setSubmitting(true);
    try {
      const driveFileId = extractDriveId(driveFileUrl) || 'drive_' + Date.now();
      const cleanReviewerEmail = reviewerEmail.trim().toLowerCase();

      const approvalData = {
        title: title.trim(),
        driveFileUrl: driveFileUrl.trim(),
        driveFileId: driveFileId,
        authorEmail: user?.email || '',
        authorUid: user?.uid || '',
        status: 'PENDING',
        reviewerEmails: [cleanReviewerEmail],
        reviewerEmail: cleanReviewerEmail,
        reviewerUids: [cleanReviewerEmail], // Compatible tanto con email como con UID
        initialComment: comment.trim(),
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'approvals'), approvalData);

      // Registrar en log de auditoría
      try {
        await registrarLogAuditoria(
          user?.email,
          'Solicitud de Aprobación',
          `Se solicitó revisión de "${title.trim()}" asignada a [${cleanReviewerEmail}]. ID: ${docRef.id}`
        );
      } catch (logErr) {
        console.warn('Error en log:', logErr);
      }

      // Limpiar formulario y cerrar
      setTitle('');
      setDriveFileUrl('');
      setReviewerEmail('');
      setComment('');
      if (onCreated) onCreated();
      onClose();
    } catch (err) {
      console.error('Error al crear solicitud de aprobación:', err);
      setErrorMsg('Error al registrar la solicitud: ' + (err.message || 'Error desconocido'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3.5,
            p: 1
          }
        }
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: '#fffbeb',
          borderRadius: 2.5,
          p: 2,
          color: '#92400e'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#fef3c7', color: '#d97706', display: 'flex' }}>
            <FileCheck2 size={22} />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight="bold">
              Nueva Solicitud de Aprobación
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Asigne un documento de Google Docs/Drive a un revisor institucional
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} disabled={submitting}>
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {errorMsg && (
            <Alert severity="error" sx={{ borderRadius: 2, fontSize: '0.85rem' }}>
              {errorMsg}
            </Alert>
          )}

          <TextField
            label="Título del Documento"
            placeholder="Ej: Minuta Demanda Caso X / Informe de Incidencia 2026"
            fullWidth
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
            size="small"
          />

          <TextField
            label="Enlace de Google Drive / Google Docs"
            placeholder="https://docs.google.com/document/d/..."
            fullWidth
            required
            value={driveFileUrl}
            onChange={(e) => setDriveFileUrl(e.target.value)}
            disabled={submitting}
            size="small"
            helperText="Asegúrese de que el documento tenga permisos de lectura/comentario para el revisor."
          />

          <FormControl fullWidth size="small">
            <InputLabel id="select-revisor-label">Revisor Asignado</InputLabel>
            <Select
              labelId="select-revisor-label"
              label="Revisor Asignado"
              value={reviewerEmail}
              onChange={(e) => setReviewerEmail(e.target.value)}
              disabled={submitting || loadingUsers}
            >
              {usuariosDisponibles.map((u) => (
                <MenuItem key={u.email} value={u.email}>
                  {u.nombre} ({u.email}) - <em>{u.rol}</em>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Opción de escribir email manualmente si no aparece en la lista */}
          <TextField
            label="O escriba el correo del Revisor manualmente"
            placeholder="colega@iiresodh.org"
            fullWidth
            value={reviewerEmail}
            onChange={(e) => setReviewerEmail(e.target.value)}
            disabled={submitting}
            size="small"
          />

          <TextField
            label="Observaciones o Instrucciones Iniciales (Opcional)"
            placeholder="Ej: Favor revisar cláusulas 2 y 4 con prioridad antes del viernes..."
            multiline
            rows={3}
            fullWidth
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={submitting}
            size="small"
          />
        </DialogContent>

        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button onClick={onClose} disabled={submitting} color="inherit" sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <Send size={16} />}
            sx={{
              bgcolor: '#1a365d',
              color: '#ffffff',
              textTransform: 'none',
              fontWeight: 'bold',
              borderRadius: 2,
              px: 2.5,
              '&:hover': { bgcolor: '#0f233c' }
            }}
          >
            Enviar a Revisión
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
