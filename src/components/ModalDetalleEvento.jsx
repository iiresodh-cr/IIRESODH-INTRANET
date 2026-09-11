import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  Button,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  Switch
} from '@mui/material';
import {
  Calendar,
  Clock,
  MapPin,
  FileText,
  Trash2,
  X,
  ExternalLink,
  AlertTriangle,
  Edit3,
  Check,
  RotateCcw
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export default function ModalDetalleEvento({
  open,
  onClose,
  evento,
  onEventDeleted,
  onEventUpdated
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState(null);

  // Estado del formulario de edición
  const [editForm, setEditForm] = useState({
    titulo: '',
    todoElDia: false,
    fechaInicio: '',
    fechaFin: '',
    ubicacion: '',
    descripcion: ''
  });

  // Helper para convertir ISO o date a formato de input datetime-local / date
  const formatForInput = (dateVal, isAllDay) => {
    if (!dateVal) return '';
    try {
      if (isAllDay) {
        return dateVal.split('T')[0];
      }
      const d = new Date(dateVal);
      const pad = (n) => String(n).padStart(2, '0');
      const year = d.getFullYear();
      const month = pad(d.getMonth() + 1);
      const day = pad(d.getDate());
      const hours = pad(d.getHours());
      const minutes = pad(d.getMinutes());
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
      return '';
    }
  };

  // Cargar datos al abrir o cambiar de evento
  useEffect(() => {
    if (evento && open) {
      setIsEditing(false);
      setError(null);
      setLoadingDelete(false);
      setLoadingSave(false);
      setConfirmOpen(false);

      const esTodoElDia = !evento.start?.dateTime && Boolean(evento.start?.date);
      const inicio = esTodoElDia
        ? evento.start?.date
        : evento.start?.dateTime;
      const fin = esTodoElDia
        ? evento.end?.date
        : evento.end?.dateTime;

      // Limpiar texto de pie si tiene firma previa para que en el textarea sea editable sin duplicar
      let descLimpia = evento.description || '';
      const indiceSeparador = descLimpia.indexOf('\n\n---');
      if (indiceSeparador !== -1) {
        descLimpia = descLimpia.substring(0, indiceSeparador);
      }

      setEditForm({
        titulo: evento.summary || '',
        todoElDia: esTodoElDia,
        fechaInicio: formatForInput(inicio, esTodoElDia),
        fechaFin: formatForInput(fin, esTodoElDia),
        ubicacion: evento.location || '',
        descripcion: descLimpia
      });
    } else if (!open) {
      setLoadingDelete(false);
      setLoadingSave(false);
      setConfirmOpen(false);
      setIsEditing(false);
      setError(null);
    }
  }, [evento, open]);

  if (!evento) return null;

  // Formatear fechas y horas para modo visualización
  const esTodoElDia = !evento.start?.dateTime && Boolean(evento.start?.date);

  const formatearFechaHora = () => {
    try {
      if (esTodoElDia) {
        const fechaStr = evento.start.date;
        const [year, month, day] = fechaStr.split('-');
        const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return {
          fecha: dateObj.toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          }),
          hora: 'Todo el día'
        };
      }

      const inicio = new Date(evento.start?.dateTime);
      const fin = new Date(evento.end?.dateTime);

      const fecha = inicio.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      const horaInicio = inicio.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      const horaFin = fin.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      return {
        fecha,
        hora: `${horaInicio} - ${horaFin}`
      };
    } catch {
      return {
        fecha: evento.start?.dateTime || evento.start?.date || '',
        hora: ''
      };
    }
  };

  const { fecha, hora } = formatearFechaHora();

  // Comprobar si la ubicación es un enlace web
  const esEnlaceUbicacion =
    evento.location &&
    (evento.location.startsWith('http://') ||
      evento.location.startsWith('https://'));

  // Helper para sumar 1 hora a un string datetime-local (YYYY-MM-DDTHH:mm)
  const sumarUnaHora = (fechaHoraStr) => {
    if (!fechaHoraStr) return '';
    try {
      const d = new Date(fechaHoraStr);
      if (isNaN(d.getTime())) return '';
      const unaHoraDespues = new Date(d.getTime() + 60 * 60 * 1000);
      const pad = (n) => String(n).padStart(2, '0');
      const anioFin = unaHoraDespues.getFullYear();
      const mesFin = pad(unaHoraDespues.getMonth() + 1);
      const diaFin = pad(unaHoraDespues.getDate());
      const horaFin = pad(unaHoraDespues.getHours());
      const minFin = pad(unaHoraDespues.getMinutes());
      return `${anioFin}-${mesFin}-${diaFin}T${horaFin}:${minFin}`;
    } catch {
      return '';
    }
  };

  // Manejar cambios en edición
  const handleEditChange = (e) => {
    const { name, value, checked, type } = e.target;
    if (name === 'todoElDia') {
      const nuevoTodoElDia = checked;
      setEditForm((prev) => ({
        ...prev,
        todoElDia: nuevoTodoElDia,
        fechaInicio: formatForInput(prev.fechaInicio, nuevoTodoElDia),
        fechaFin: formatForInput(prev.fechaFin, nuevoTodoElDia)
      }));
    } else if (name === 'fechaInicio') {
      if (editForm.todoElDia) {
        setEditForm((prev) => ({
          ...prev,
          fechaInicio: value,
          fechaFin: value
        }));
      } else {
        const finSugerido = sumarUnaHora(value);
        setEditForm((prev) => ({
          ...prev,
          fechaInicio: value,
          fechaFin: finSugerido || prev.fechaFin
        }));
      }
    } else {
      setEditForm((prev) => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  // Guardar edición
  const handleGuardarEdicion = async (e) => {
    e.preventDefault();
    setError(null);

    if (!editForm.titulo.trim()) {
      setError('El título del evento es obligatorio.');
      return;
    }
    if (editForm.todoElDia) {
      if (!editForm.fechaInicio) {
        setError('La fecha del evento es obligatoria.');
        return;
      }
    } else {
      if (!editForm.fechaInicio || !editForm.fechaFin) {
        setError('Las fechas y horas de inicio y fin son obligatorias.');
        return;
      }
      if (editForm.fechaFin <= editForm.fechaInicio) {
        setError('La fecha y hora de fin debe ser posterior a la de inicio.');
        return;
      }
    }

    setLoadingSave(true);
    try {
      const actualizarFn = httpsCallable(functions, 'actualizarEventoCalendario');
      const res = await actualizarFn({
        eventId: evento.id,
        titulo: editForm.titulo.trim(),
        todoElDia: editForm.todoElDia,
        fechaInicio: editForm.fechaInicio,
        fechaFin: editForm.todoElDia ? editForm.fechaInicio : editForm.fechaFin,
        ubicacion: editForm.ubicacion.trim() || undefined,
        descripcion: editForm.descripcion.trim() || undefined
      });

      if (res.data && res.data.success) {
        setIsEditing(false);
        if (onEventUpdated) {
          onEventUpdated(res.data.event);
        }
        onClose();
      } else {
        throw new Error('No se recibió confirmación del servidor.');
      }
    } catch (err) {
      console.error('Error actualizando evento:', err);
      setError(
        err.message || 'No se pudo guardar la modificación del evento.'
      );
    } finally {
      setLoadingSave(false);
    }
  };

  // Eliminar evento
  const handleEliminar = async () => {
    setLoadingDelete(true);
    setError(null);
    try {
      const eliminarFn = httpsCallable(functions, 'eliminarEventoCalendario');
      await eliminarFn({ eventId: evento.id });
      setConfirmOpen(false);
      onEventDeleted(evento.id);
      onClose();
    } catch (err) {
      console.error('Error eliminando evento:', err);
      setError(
        err.message || 'No se pudo eliminar el evento. Verifique su conexión y permisos.'
      );
    } finally {
      setLoadingDelete(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={loadingDelete || loadingSave ? undefined : onClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            p: { xs: 0.5, sm: 1 },
            m: { xs: 1.5, sm: 2 },
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            overflow: 'hidden'
          }
        }}
      >
        {/* CABECERA DEL DIÁLOGO */}
        <DialogTitle
          sx={{
            m: 0,
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                p: 1,
                borderRadius: 2,
                bgcolor: 'rgba(26, 54, 93, 0.08)',
                color: '#1a365d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {isEditing ? <Edit3 size={22} /> : <Calendar size={22} />}
            </Box>
            <Typography variant="h6" fontWeight="bold" color="#1a365d" sx={{ fontSize: '1.15rem' }}>
              {isEditing ? 'Modificar Evento - Calendario IIRESODH' : 'Detalle del Evento - Calendario IIRESODH'}
            </Typography>
          </Box>

          <IconButton
            aria-label="close"
            onClick={onClose}
            disabled={loadingDelete || loadingSave}
            sx={{ color: (theme) => theme.palette.grey[500] }}
          >
            <X size={20} />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {isEditing ? (
            /* =================== MODO EDICIÓN =================== */
            <Box
              component="form"
              id="form-editar-evento"
              onSubmit={handleGuardarEdicion}
              sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
            >
              <TextField
                name="titulo"
                label="Título del Evento o Audiencia"
                value={editForm.titulo}
                onChange={handleEditChange}
                fullWidth
                required
                autoFocus
                disabled={loadingSave}
                slotProps={{ input: { sx: { borderRadius: 2 } } }}
              />

              {/* TOGGLE TODO EL DÍA */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  bgcolor: '#f8fafc',
                  p: 1.5,
                  borderRadius: 2,
                  border: '1px solid #e2e8f0'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Clock size={18} color="#64748b" />
                  <Typography variant="body2" fontWeight="500" color="text.primary">
                    Evento de todo el día
                  </Typography>
                </Box>
                <Switch
                  name="todoElDia"
                  checked={editForm.todoElDia}
                  onChange={handleEditChange}
                  disabled={loadingSave}
                  color="primary"
                />
              </Box>

              {/* FECHAS */}
              {editForm.todoElDia ? (
                <TextField
                  name="fechaInicio"
                  label="Fecha del evento"
                  type="date"
                  value={editForm.fechaInicio}
                  onChange={handleEditChange}
                  required
                  fullWidth
                  disabled={loadingSave}
                  slotProps={{
                    inputLabel: { shrink: true },
                    input: { sx: { borderRadius: 2 } }
                  }}
                />
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  <TextField
                    name="fechaInicio"
                    label="Fecha y hora de inicio"
                    type="datetime-local"
                    value={editForm.fechaInicio}
                    onChange={handleEditChange}
                    required
                    fullWidth
                    disabled={loadingSave}
                    slotProps={{
                      inputLabel: { shrink: true },
                      input: { sx: { borderRadius: 2 } }
                    }}
                  />

                  <TextField
                    name="fechaFin"
                    label="Fecha y hora de fin"
                    type="datetime-local"
                    value={editForm.fechaFin}
                    onChange={handleEditChange}
                    required
                    fullWidth
                    disabled={loadingSave}
                    slotProps={{
                      inputLabel: { shrink: true },
                      input: { sx: { borderRadius: 2 } }
                    }}
                  />
                </Box>
              )}

              {/* UBICACIÓN */}
              <TextField
                name="ubicacion"
                label="Ubicación o enlace virtual"
                placeholder="Ej: Sala de Juntas IIRESODH, Google Meet, Zoom..."
                value={editForm.ubicacion}
                onChange={handleEditChange}
                fullWidth
                disabled={loadingSave}
                slotProps={{
                  input: {
                    startAdornment: (
                      <Box sx={{ mr: 1, color: '#64748b', display: 'flex', alignItems: 'center' }}>
                        <MapPin size={18} />
                      </Box>
                    ),
                    sx: { borderRadius: 2 }
                  }
                }}
              />

              {/* DESCRIPCIÓN */}
              <TextField
                name="descripcion"
                label="Descripción o notas del evento"
                placeholder="Detalles de la reunión, puntos de agenda, expedientes vinculados..."
                value={editForm.descripcion}
                onChange={handleEditChange}
                fullWidth
                multiline
                rows={3}
                disabled={loadingSave}
                slotProps={{ input: { sx: { borderRadius: 2 } } }}
              />
            </Box>
          ) : (
            /* =================== MODO VISUALIZACIÓN =================== */
            <Box>
              {/* TÍTULO */}
              <Typography
                variant="h5"
                fontWeight="bold"
                color="#0f233c"
                sx={{ mb: 2, textTransform: 'capitalize', lineHeight: 1.3 }}
              >
                {evento.summary || '(Sin título)'}
              </Typography>

              {/* FECHA Y HORA */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.2,
                  bgcolor: '#f8fafc',
                  p: 2,
                  borderRadius: 2.5,
                  border: '1px solid #e2e8f0',
                  mb: 2.5
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Calendar size={18} color="#1a365d" />
                  <Typography variant="body1" fontWeight="600" color="#1e293b" sx={{ textTransform: 'capitalize' }}>
                    {fecha}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Clock size={18} color="#c59b27" />
                  <Typography variant="body2" color="text.secondary" fontWeight="500">
                    {hora}
                  </Typography>
                  {esTodoElDia && (
                    <Chip
                      label="Día Completo"
                      size="small"
                      sx={{
                        bgcolor: 'rgba(197, 155, 39, 0.15)',
                        color: '#8c6b12',
                        fontWeight: 'bold',
                        fontSize: '0.72rem'
                      }}
                    />
                  )}
                </Box>
              </Box>

              {/* UBICACIÓN */}
              {evento.location && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2.5 }}>
                  <MapPin size={19} color="#64748b" style={{ marginTop: 2, flexShrink: 0 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      UBICACIÓN / ENLACE
                    </Typography>
                    <Typography variant="body2" color="text.primary" sx={{ mt: 0.2 }}>
                      {evento.location}
                    </Typography>
                    {esEnlaceUbicacion && (
                      <Button
                        variant="outlined"
                        size="small"
                        href={evento.location}
                        target="_blank"
                        rel="noopener noreferrer"
                        endIcon={<ExternalLink size={14} />}
                        sx={{
                          mt: 1,
                          textTransform: 'none',
                          borderRadius: 1.5,
                          borderColor: '#1a365d',
                          color: '#1a365d'
                        }}
                      >
                        Unirse a la sesión
                      </Button>
                    )}
                  </Box>
                </Box>
              )}

              {/* DESCRIPCIÓN Y NOTAS */}
              {evento.description ? (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <FileText size={19} color="#64748b" style={{ marginTop: 2, flexShrink: 0 }} />
                  <Box sx={{ width: '100%' }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      DESCRIPCIÓN Y NOTAS
                    </Typography>
                    <Typography
                      variant="body2"
                      color="#334155"
                      sx={{
                        mt: 0.5,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        bgcolor: '#ffffff',
                        p: 1.5,
                        borderRadius: 2,
                        border: '1px solid #e2e8f0',
                        lineHeight: 1.6
                      }}
                    >
                      {evento.description}
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" fontStyle="italic">
                  Sin notas adicionales registradas.
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>

        {/* ACCIONES DEL DIÁLOGO */}
        <DialogActions sx={{ p: 2, display: 'flex', justifyContent: 'space-between', gap: 1 }}>
          {isEditing ? (
            /* ACCIONES EN EDICIÓN */
            <>
              <Button
                variant="outlined"
                onClick={() => setIsEditing(false)}
                disabled={loadingSave}
                startIcon={<RotateCcw size={16} />}
                sx={{ textTransform: 'none', borderRadius: 2 }}
              >
                Cancelar Edición
              </Button>

              <Button
                type="submit"
                form="form-editar-evento"
                variant="contained"
                disabled={loadingSave}
                startIcon={loadingSave ? <CircularProgress size={16} color="inherit" /> : <Check size={16} />}
                sx={{
                  textTransform: 'none',
                  borderRadius: 2,
                  bgcolor: '#1a365d',
                  fontWeight: 'bold',
                  px: 3,
                  '&:hover': { bgcolor: '#0f233c' }
                }}
              >
                {loadingSave ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </>
          ) : (
            /* ACCIONES EN VISUALIZACIÓN */
            <>
              {/* BOTÓN ELIMINAR */}
              <Button
                variant="outlined"
                color="error"
                startIcon={loadingDelete ? <CircularProgress size={16} color="inherit" /> : <Trash2 size={16} />}
                disabled={loadingDelete}
                onClick={() => setConfirmOpen(true)}
                sx={{
                  textTransform: 'none',
                  borderRadius: 2,
                  fontWeight: '600',
                  px: 2
                }}
              >
                Eliminar
              </Button>

              <Box sx={{ display: 'flex', gap: 1 }}>
                {/* BOTÓN MODIFICAR */}
                <Button
                  variant="outlined"
                  onClick={() => setIsEditing(true)}
                  startIcon={<Edit3 size={16} />}
                  sx={{
                    textTransform: 'none',
                    borderRadius: 2,
                    borderColor: '#1a365d',
                    color: '#1a365d',
                    fontWeight: '600',
                    px: 2
                  }}
                >
                  Modificar
                </Button>

                {/* BOTÓN CERRAR */}
                <Button
                  onClick={onClose}
                  disabled={loadingDelete}
                  variant="contained"
                  sx={{
                    textTransform: 'none',
                    borderRadius: 2,
                    bgcolor: '#1a365d',
                    fontWeight: 'bold',
                    px: 2.5,
                    '&:hover': { bgcolor: '#0f233c' }
                  }}
                >
                  Cerrar
                </Button>
              </Box>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* DIÁLOGO DE CONFIRMACIÓN PARA ELIMINAR */}
      <Dialog
        open={confirmOpen}
        onClose={loadingDelete ? undefined : () => setConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: '#dc2626' }}>
          <AlertTriangle size={24} />
          <Typography variant="h6" fontWeight="bold">
            ¿Eliminar este evento?
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Esta acción eliminará el evento <strong>"{evento.summary}"</strong> de forma permanente del <strong>Calendario IIRESODH</strong>.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setConfirmOpen(false)}
            disabled={loadingDelete}
            sx={{ textTransform: 'none', borderRadius: 2, color: 'text.secondary', fontWeight: 'bold' }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleEliminar}
            disabled={loadingDelete}
            startIcon={loadingDelete ? <CircularProgress size={16} color="inherit" /> : <Trash2 size={16} />}
            sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 'bold' }}
          >
            {loadingDelete ? 'Eliminando...' : 'Sí, eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
