// src/components/ModalNuevoEventoCalendario.jsx
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Switch,
  Box,
  Typography,
  Alert,
  CircularProgress,
  IconButton
} from '@mui/material';
import { Clock, MapPin, Users, X, Plus, CalendarPlus } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export default function ModalNuevoEventoCalendario({ open, onClose, onEventoCreado, onEventAdded }) {
  // Inicialización de fechas con la hora próxima redondeada
  const obtenerFechasIniciales = (todoElDia = false) => {
    const ahora = new Date();
    ahora.setMinutes(0, 0, 0);
    ahora.setHours(ahora.getHours() + 1);

    const pad = (n) => String(n).padStart(2, '0');
    const anio = ahora.getFullYear();
    const mes = pad(ahora.getMonth() + 1);
    const dia = pad(ahora.getDate());
    const hora = pad(ahora.getHours());

    if (todoElDia) {
      return {
        inicio: `${anio}-${mes}-${dia}`,
        fin: `${anio}-${mes}-${dia}`
      };
    }

    const fechaInicioStr = `${anio}-${mes}-${dia}T${hora}:00`;
    
    // Fin por defecto: 1 hora después
    const unaHoraDespues = new Date(ahora.getTime() + 60 * 60 * 1000);
    const anioFin = unaHoraDespues.getFullYear();
    const mesFin = pad(unaHoraDespues.getMonth() + 1);
    const diaFin = pad(unaHoraDespues.getDate());
    const horaFin = pad(unaHoraDespues.getHours());
    const fechaFinStr = `${anioFin}-${mesFin}-${diaFin}T${horaFin}:00`;

    return { inicio: fechaInicioStr, fin: fechaFinStr };
  };

  const [form, setForm] = useState({
    titulo: '',
    todoElDia: false,
    fechaInicio: '',
    fechaFin: '',
    ubicacion: '',
    descripcion: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Reiniciar formulario cuando se abre el modal
  useEffect(() => {
    if (open) {
      const { inicio, fin } = obtenerFechasIniciales(false);
      setForm({
        titulo: '',
        todoElDia: false,
        fechaInicio: inicio,
        fechaFin: fin,
        ubicacion: '',
        descripcion: ''
      });
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    if (name === 'todoElDia') {
      const nuevoTodoElDia = checked;
      const { inicio, fin } = obtenerFechasIniciales(nuevoTodoElDia);
      setForm((prev) => ({
        ...prev,
        todoElDia: nuevoTodoElDia,
        fechaInicio: inicio,
        fechaFin: fin
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validaciones básicas
    if (!form.titulo.trim()) {
      setError('Por favor ingrese el título del evento.');
      return;
    }
    if (!form.fechaInicio || !form.fechaFin) {
      setError('Por favor seleccione la fecha de inicio y de finalización.');
      return;
    }
    if (form.fechaFin < form.fechaInicio) {
      setError('La fecha y hora de finalización debe ser posterior a la de inicio.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        titulo: form.titulo.trim(),
        todoElDia: form.todoElDia,
        fechaInicio: form.fechaInicio,
        fechaFin: form.fechaFin,
        ubicacion: form.ubicacion.trim() || undefined,
        descripcion: form.descripcion.trim() || undefined
      };

      const fnCrearEvento = httpsCallable(functions, 'crearEventoCalendario');
      const resultado = await fnCrearEvento(payload);

      if (resultado.data && resultado.data.success) {
        if (onEventoCreado) {
          onEventoCreado(resultado.data);
        }
        if (onEventAdded) {
          onEventAdded(resultado.data);
        }
        onClose();
      } else {
        throw new Error('No se recibió confirmación del servidor.');
      }
    } catch (err) {
      console.error('Error guardando evento:', err);
      setError(
        err.message ||
        'Ocurrió un problema al agendar el evento. Verifique los permisos de la cuenta institucional.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          p: 1,
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
            <CalendarPlus size={22} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight="bold" color="#1a365d" sx={{ fontSize: '1.15rem' }}>
              Nuevo Evento Institucional
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Se sincronizará en tiempo real con el Calendario Institucional
            </Typography>
          </Box>
        </Box>

        <IconButton
          aria-label="close"
          onClick={onClose}
          disabled={loading}
          sx={{ color: (theme) => theme.palette.grey[500] }}
        >
          <X size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
        <Box component="form" id="form-nuevo-evento" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {error && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {/* TÍTULO */}
          <TextField
            name="titulo"
            label="Título del Evento o Audiencia"
            placeholder="Ej: Audiencia CIDH, Reunión de Litigio, Conferencia..."
            value={form.titulo}
            onChange={handleChange}
            fullWidth
            required
            autoFocus
            disabled={loading}
            slotProps={{
              input: {
                sx: { borderRadius: 2 }
              }
            }}
          />

          {/* OPCIÓN TODO EL DÍA */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#f8fafc', p: 1.5, borderRadius: 2, border: '1px solid #e2e8f0' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Clock size={18} color="#64748b" />
              <Typography variant="body2" fontWeight="500" color="text.primary">
                Evento de todo el día
              </Typography>
            </Box>
            <Switch
              name="todoElDia"
              checked={form.todoElDia}
              onChange={handleChange}
              disabled={loading}
              color="primary"
            />
          </Box>

          {/* FECHAS */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              name="fechaInicio"
              label="Fecha y hora de inicio"
              type={form.todoElDia ? 'date' : 'datetime-local'}
              value={form.fechaInicio}
              onChange={handleChange}
              required
              fullWidth
              disabled={loading}
              slotProps={{
                inputLabel: { shrink: true },
                input: { sx: { borderRadius: 2 } }
              }}
            />

            <TextField
              name="fechaFin"
              label="Fecha y hora de fin"
              type={form.todoElDia ? 'date' : 'datetime-local'}
              value={form.fechaFin}
              onChange={handleChange}
              required
              fullWidth
              disabled={loading}
              slotProps={{
                inputLabel: { shrink: true },
                input: { sx: { borderRadius: 2 } }
              }}
            />
          </Box>

          {/* UBICACIÓN O ENLACE */}
          <TextField
            name="ubicacion"
            label="Ubicación o enlace virtual"
            placeholder="Ej: Sala de Juntas IIRESODH, Google Meet, Zoom..."
            value={form.ubicacion}
            onChange={handleChange}
            fullWidth
            disabled={loading}
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
            value={form.descripcion}
            onChange={handleChange}
            fullWidth
            multiline
            rows={3}
            disabled={loading}
            slotProps={{
              input: { sx: { borderRadius: 2 } }
            }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button
          onClick={onClose}
          disabled={loading}
          sx={{
            textTransform: 'none',
            borderRadius: 2,
            color: 'text.secondary',
            fontWeight: 'bold',
            px: 2.5
          }}
        >
          Cancelar
        </Button>

        <Button
          type="submit"
          form="form-nuevo-evento"
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Plus size={16} />}
          sx={{
            textTransform: 'none',
            borderRadius: 2,
            bgcolor: '#1a365d',
            fontWeight: 'bold',
            px: 3,
            '&:hover': { bgcolor: '#0f233c' }
          }}
        >
          {loading ? 'Guardando...' : 'Agendar Evento'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
