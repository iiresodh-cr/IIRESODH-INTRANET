import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  CircularProgress,
  Tooltip,
  Paper,
  Chip,
  Snackbar,
  Alert,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCw,
  Clock,
  MapPin,
  CalendarDays,
  ListFilter
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import ModalNuevoEventoCalendario from './ModalNuevoEventoCalendario';
import ModalDetalleEvento from './ModalDetalleEvento';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function CalendarioInstitucional({ insideAccordion = false }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [vista, setVista] = useState('mes'); // 'mes' | 'agenda'
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modales
  const [modalNuevoOpen, setModalNuevoOpen] = useState(false);
  const [modalDetalleOpen, setModalDetalleOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Notificaciones
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Cargar eventos del rango visible
  const cargarEventos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Tomar desde el primer día del mes anterior hasta el fin del mes siguiente
      const minDate = new Date(year, month - 1, 1).toISOString();
      const maxDate = new Date(year, month + 2, 0).toISOString();

      const obtenerFn = httpsCallable(functions, 'obtenerEventosCalendario');
      const res = await obtenerFn({ timeMin: minDate, timeMax: maxDate });

      if (res.data?.events) {
        setEvents(res.data.events);
      }
    } catch (err) {
      console.error('Error cargando eventos:', err);
      setError(
        'No se pudieron cargar los eventos del calendario. Asegúrese de que la cuenta de servicio tenga acceso.'
      );
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    cargarEventos();
  }, [cargarEventos]);

  // Navegación
  const irMesAnterior = () => setCurrentDate(new Date(year, month - 1, 1));
  const irMesSiguiente = () => setCurrentDate(new Date(year, month + 1, 1));
  const irHoy = () => setCurrentDate(new Date());

  // Nombre del mes actual
  const nombreMes = currentDate.toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric'
  });

  // Cálculo de la cuadrícula del mes
  const primerDiaSemana = (new Date(year, month, 1).getDay() + 6) % 7; // Lunes = 0
  const diasEnMes = new Date(year, month + 1, 0).getDate();
  const diasEnMesAnterior = new Date(year, month, 0).getDate();

  const celdasDias = [];

  // Días del mes anterior para relleno
  for (let i = primerDiaSemana - 1; i >= 0; i--) {
    const diaNum = diasEnMesAnterior - i;
    celdasDias.push({
      fecha: new Date(year, month - 1, diaNum),
      diaNum,
      esMesActual: false
    });
  }

  // Días del mes actual
  for (let i = 1; i <= diasEnMes; i++) {
    celdasDias.push({
      fecha: new Date(year, month, i),
      diaNum: i,
      esMesActual: true
    });
  }

  // Relleno al final para completar semanas completas (múltiplo de 7)
  const celdasRestantes = 7 - (celdasDias.length % 7);
  if (celdasRestantes < 7) {
    for (let i = 1; i <= celdasRestantes; i++) {
      celdasDias.push({
        fecha: new Date(year, month + 1, i),
        diaNum: i,
        esMesActual: false
      });
    }
  }

  // Helper para saber si una fecha coincide con el día de la celda
  const esMismoDia = (fecha1, fecha2) => {
    return (
      fecha1.getFullYear() === fecha2.getFullYear() &&
      fecha1.getMonth() === fecha2.getMonth() &&
      fecha1.getDate() === fecha2.getDate()
    );
  };

  const hoyDate = new Date();

  // Filtrar eventos por fecha
  const getEventosDelDia = (fecha) => {
    return events.filter((ev) => {
      if (ev.start?.date) {
        const [y, m, d] = ev.start.date.split('-');
        const fEv = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        return esMismoDia(fEv, fecha);
      }
      if (ev.start?.dateTime) {
        const fEv = new Date(ev.start.dateTime);
        return esMismoDia(fEv, fecha);
      }
      return false;
    });
  };

  const abrirDetalle = (evento) => {
    setSelectedEvent(evento);
    setModalDetalleOpen(true);
  };

  const handleEventAdded = () => {
    cargarEventos();
    setSnackbar({
      open: true,
      message: 'Evento agendado exitosamente en el Calendario IIRESODH.',
      severity: 'success'
    });
  };

  const handleEventDeleted = (idEliminado) => {
    setEvents((prev) => prev.filter((ev) => ev.id !== idEliminado));
    setSnackbar({
      open: true,
      message: 'Evento eliminado del Calendario IIRESODH.',
      severity: 'success'
    });
  };

  const handleEventUpdated = () => {
    cargarEventos();
    setSnackbar({
      open: true,
      message: 'Evento actualizado exitosamente en el Calendario IIRESODH.',
      severity: 'success'
    });
  };

  // Ordenar eventos para la vista de agenda
  const eventosOrdenados = [...events].sort((a, b) => {
    const fechaA = new Date(a.start?.dateTime || a.start?.date || 0);
    const fechaB = new Date(b.start?.dateTime || b.start?.date || 0);
    return fechaA - fechaB;
  });

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: insideAccordion ? 0 : 4,
        overflow: 'hidden',
        border: insideAccordion ? 'none' : '1px solid #e2e8f0',
        bgcolor: '#ffffff',
        boxShadow: insideAccordion ? 'none' : '0 4px 20px -2px rgba(0, 0, 0, 0.05)'
      }}
    >
      {/* CABECERA DEL CALENDARIO */}
      <Box
        sx={{
          p: { xs: 2, sm: 2.5 },
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'stretch', md: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          borderBottom: '1px solid #f1f5f9'
        }}
      >
        {/* TÍTULO Y NAVEGACIÓN */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            gap: 1.5,
            width: { xs: '100%', md: 'auto' }
          }}
        >
          {insideAccordion ? (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography
                variant="h6"
                fontWeight="bold"
                color="#1a365d"
                sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' }, textTransform: 'capitalize' }}
              >
                {nombreMes}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  p: 1.2,
                  borderRadius: 2.5,
                  bgcolor: 'rgba(26, 54, 93, 0.07)',
                  color: '#1a365d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <CalendarIcon size={22} />
              </Box>

              <Box>
                <Typography
                  variant="h6"
                  fontWeight="bold"
                  color="#0f233c"
                  sx={{ fontSize: { xs: '1.05rem', sm: '1.2rem' } }}
                >
                  Calendario Institucional IIRESODH
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize', fontWeight: '500' }}>
                  {nombreMes}
                </Typography>
              </Box>
            </Box>
          )}

          {/* CONTROLES DE NAVEGACIÓN */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, alignSelf: { xs: 'flex-end', sm: 'center' } }}>
            <Tooltip title="Mes anterior">
              <IconButton size="small" onClick={irMesAnterior} sx={{ border: '1px solid #e2e8f0' }}>
                <ChevronLeft size={18} />
              </IconButton>
            </Tooltip>

            <Button
              size="small"
              onClick={irHoy}
              sx={{
                textTransform: 'none',
                fontWeight: '600',
                color: '#1a365d',
                px: 1.5,
                border: '1px solid #e2e8f0',
                borderRadius: 2
              }}
            >
              Hoy
            </Button>

            <Tooltip title="Mes siguiente">
              <IconButton size="small" onClick={irMesSiguiente} sx={{ border: '1px solid #e2e8f0' }}>
                <ChevronRight size={18} />
              </IconButton>
            </Tooltip>

            <Tooltip title="Actualizar eventos">
              <IconButton
                size="small"
                onClick={cargarEventos}
                disabled={loading}
                sx={{ border: '1px solid #e2e8f0', ml: 0.5 }}
              >
                <RotateCw size={16} className={loading ? 'animate-spin' : ''} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* ACCIONES Y SELECTOR DE VISTA */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: { xs: 'space-between', sm: 'flex-end' },
            gap: 1.5,
            width: { xs: '100%', md: 'auto' }
          }}
        >
          <ToggleButtonGroup
            value={vista}
            exclusive
            onChange={(_, nuevaVista) => nuevaVista && setVista(nuevaVista)}
            size="small"
            sx={{
              height: 36,
              bgcolor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 2,
              '& .MuiToggleButton-root': {
                border: 'none',
                px: { xs: 1.2, sm: 1.5 },
                py: 0.5,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.82rem',
                color: '#64748b',
                gap: 0.5,
                '&.Mui-selected': {
                  bgcolor: '#ffffff',
                  color: '#1a365d',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }
              }
            }}
          >
            <ToggleButton value="mes">
              <CalendarDays size={15} />
              Mes
            </ToggleButton>
            <ToggleButton value="agenda">
              <ListFilter size={15} />
              Agenda
            </ToggleButton>
          </ToggleButtonGroup>

          {/* BOTÓN NUEVO EVENTO */}
          <Button
            variant="contained"
            onClick={() => setModalNuevoOpen(true)}
            startIcon={<Plus size={16} />}
            sx={{
              bgcolor: '#1a365d',
              color: '#ffffff',
              textTransform: 'none',
              fontWeight: 'bold',
              borderRadius: 2.5,
              px: { xs: 1.8, sm: 2.2 },
              py: 0.8,
              fontSize: { xs: '0.82rem', sm: '0.875rem' },
              boxShadow: '0 2px 8px rgba(26, 54, 93, 0.25)',
              '&:hover': { bgcolor: '#0f233c' }
            }}
          >
            Nuevo Evento
          </Button>
        </Box>
      </Box>

      {/* ERROR BANNER */}
      {error && (
        <Alert severity="warning" sx={{ m: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* CONTENIDO DEL CALENDARIO */}
      {loading && events.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 12 }}>
          <CircularProgress size={32} sx={{ color: '#1a365d' }} />
        </Box>
      ) : vista === 'mes' ? (
        /* VISTA DE MES */
        <Box sx={{ width: '100%', overflowX: 'auto' }}>
          <Box sx={{ minWidth: 640 }}>
            {/* ENCABEZADOS DÍAS DE LA SEMANA */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                bgcolor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0'
              }}
            >
              {DIAS_SEMANA.map((dia, idx) => (
                <Box
                  key={dia}
                  sx={{
                    py: 1.2,
                    textAlign: 'center',
                    fontWeight: '700',
                    fontSize: '0.78rem',
                    color: idx >= 5 ? '#94a3b8' : '#475569',
                    letterSpacing: 0.5
                  }}
                >
                  {dia.toUpperCase()}
                </Box>
              ))}
            </Box>

            {/* CUADRÍCULA DE DÍAS */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gridAutoRows: 'minmax(110px, auto)'
              }}
            >
              {celdasDias.map((celda, index) => {
                const esHoy = esMismoDia(celda.fecha, hoyDate);
                const eventosDia = getEventosDelDia(celda.fecha);

                return (
                  <Box
                    key={index}
                    sx={{
                      p: 1,
                      borderRight: (index + 1) % 7 === 0 ? 'none' : '1px solid #f1f5f9',
                      borderBottom: '1px solid #f1f5f9',
                      bgcolor: celda.esMesActual ? '#ffffff' : '#fafafa',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'background-color 0.2s',
                      '&:hover': {
                        bgcolor: celda.esMesActual ? '#f8fafc' : '#f5f5f5'
                      }
                    }}
                  >
                    {/* NÚMERO DEL DÍA */}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 0.5 }}>
                      <Box
                        sx={{
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.8rem',
                          fontWeight: esHoy ? 'bold' : '500',
                          bgcolor: esHoy ? '#1a365d' : 'transparent',
                          color: esHoy
                            ? '#ffffff'
                            : celda.esMesActual
                              ? '#1e293b'
                              : '#94a3b8'
                        }}
                      >
                        {celda.diaNum}
                      </Box>
                    </Box>

                    {/* EVENTOS EN EL DÍA */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flexGrow: 1 }}>
                      {eventosDia.slice(0, 3).map((ev) => {
                        let horaStr = '';
                        if (ev.start?.dateTime) {
                          const horaD = new Date(ev.start.dateTime);
                          horaStr = horaD.toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          });
                        }

                        return (
                          <Box
                            key={ev.id}
                            onClick={() => abrirDetalle(ev)}
                            sx={{
                              p: 0.6,
                              borderRadius: '0 6px 6px 0',
                              bgcolor: 'rgba(26, 54, 93, 0.08)',
                              borderLeft: '3px solid #e63946',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 0.2,
                              transition: 'all 0.15s ease',
                              '&:hover': {
                                bgcolor: 'rgba(26, 54, 93, 0.18)',
                                transform: 'translateX(2px)'
                              }
                            }}
                          >
                            <Typography
                              variant="caption"
                              fontWeight="600"
                              color="#1a365d"
                              noWrap
                              sx={{ fontSize: '0.73rem', lineHeight: 1.2 }}
                            >
                              {ev.summary || '(Sin título)'}
                            </Typography>
                            {horaStr && (
                              <Typography
                                variant="caption"
                                color="#64748b"
                                sx={{ fontSize: '0.68rem', lineHeight: 1 }}
                              >
                                {horaStr}
                              </Typography>
                            )}
                          </Box>
                        );
                      })}

                      {eventosDia.length > 3 && (
                        <Typography
                          variant="caption"
                          color="#1a365d"
                          fontWeight="bold"
                          sx={{ fontSize: '0.7rem', px: 0.5, cursor: 'pointer' }}
                          onClick={() => abrirDetalle(eventosDia[3])}
                        >
                          +{eventosDia.length - 3} más...
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>
      ) : (
        /* VISTA DE AGENDA / PRÓXIMOS */
        <Box sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {eventosOrdenados.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <CalendarDays size={40} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
              <Typography variant="body1" color="text.secondary" fontWeight="500">
                No hay eventos registrados en este período.
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Plus size={16} />}
                onClick={() => setModalNuevoOpen(true)}
                sx={{ mt: 2, textTransform: 'none', borderRadius: 2 }}
              >
                Crear el primer evento
              </Button>
            </Box>
          ) : (
            eventosOrdenados.map((ev) => {
              const esTodoElDia = !ev.start?.dateTime && Boolean(ev.start?.date);
              let fechaStr = '';
              let horaStr = 'Todo el día';

              try {
                if (esTodoElDia) {
                  const [y, m, d] = ev.start.date.split('-');
                  const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
                  fechaStr = dateObj.toLocaleDateString('es-ES', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short'
                  });
                } else {
                  const inicio = new Date(ev.start.dateTime);
                  const fin = new Date(ev.end.dateTime);
                  fechaStr = inicio.toLocaleDateString('es-ES', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short'
                  });
                  horaStr = `${inicio.toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  })} - ${fin.toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  })}`;
                }
              } catch {
                fechaStr = ev.start?.date || '';
              }

              return (
                <Box
                  key={ev.id}
                  onClick={() => abrirDetalle(ev)}
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    border: '1px solid #e2e8f0',
                    bgcolor: '#f8fafc',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    justifyContent: 'space-between',
                    gap: 1.5,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: '#ffffff',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                      borderColor: '#1a365d'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Box
                      sx={{
                        p: 1.2,
                        minWidth: 70,
                        textAlign: 'center',
                        borderRadius: 2,
                        bgcolor: '#1a365d',
                        color: '#ffffff'
                      }}
                    >
                      <Typography variant="caption" fontWeight="bold" sx={{ textTransform: 'uppercase', display: 'block' }}>
                        {fechaStr.split(' ')[0]}
                      </Typography>
                      <Typography variant="body1" fontWeight="bold">
                        {fechaStr.split(' ')[1]} {fechaStr.split(' ')[2]}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="body1" fontWeight="bold" color="#0f233c">
                        {ev.summary || '(Sin título)'}
                      </Typography>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#64748b' }}>
                          <Clock size={14} />
                          <Typography variant="caption" fontWeight="500">
                            {horaStr}
                          </Typography>
                        </Box>

                        {ev.location && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#64748b' }}>
                            <MapPin size={14} />
                            <Typography variant="caption" noWrap sx={{ maxWidth: 220 }}>
                              {ev.location}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </Box>

                  <Chip
                    label="Ver detalles"
                    size="small"
                    variant="outlined"
                    sx={{
                      borderColor: '#cbd5e1',
                      color: '#475569',
                      fontWeight: '600',
                      alignSelf: { xs: 'flex-end', sm: 'center' }
                    }}
                  />
                </Box>
              );
            })
          )}
        </Box>
      )}

      {/* MODAL NUEVO EVENTO */}
      <ModalNuevoEventoCalendario
        open={modalNuevoOpen}
        onClose={() => setModalNuevoOpen(false)}
        onEventAdded={handleEventAdded}
      />

      {/* MODAL DETALLE EVENTO */}
      <ModalDetalleEvento
        open={modalDetalleOpen}
        onClose={() => setModalDetalleOpen(false)}
        evento={selectedEvent}
        onEventDeleted={handleEventDeleted}
        onEventUpdated={handleEventUpdated}
      />

      {/* SNACKBAR DE NOTIFICACIONES */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%', borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
}
