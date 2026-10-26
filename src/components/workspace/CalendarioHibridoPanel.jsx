// src/components/workspace/CalendarioHibridoPanel.jsx
import React, { useState, useEffect, useMemo } from 'react';
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
  ToggleButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Divider,
  Avatar,
  AvatarGroup
} from '@mui/material';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  CalendarDays,
  ListFilter,
  Scale,
  AlertTriangle,
  Users,
  Building2,
  Bookmark,
  ShieldCheck,
  Lock,
  ExternalLink,
  Trash2,
  Edit3,
  X,
  Check,
  Send
} from 'lucide-react';
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { registrarLogAuditoria } from '../../utils/auditLogger';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const CATEGORIAS_EVENTO = {
  audiencia: {
    id: 'audiencia',
    label: 'Audiencia Judicial / CIDH',
    color: '#991b1b',
    bg: '#fef2f2',
    border: '#fecaca',
    dot: '#B92F32',
    icon: Scale
  },
  plazo: {
    id: 'plazo',
    label: 'Plazo Fatal / Vencimiento',
    color: '#9a3412',
    bg: '#fff7ed',
    border: '#fed7aa',
    dot: '#ea580c',
    icon: AlertTriangle
  },
  reunion: {
    id: 'reunion',
    label: 'Reunión de Equipo',
    color: '#1D3557',
    bg: '#eff6ff',
    border: '#bfdbfe',
    dot: '#457B9D',
    icon: Users
  },
  institucional: {
    id: 'institucional',
    label: 'Evento Institucional',
    color: '#1D3557',
    bg: '#f0f9ff',
    border: '#bae6fd',
    dot: '#1D3557',
    icon: Building2
  },
  recordatorio: {
    id: 'recordatorio',
    label: 'Recordatorio Interno',
    color: '#065f46',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    dot: '#10b981',
    icon: Bookmark
  }
};

export default function CalendarioHibridoPanel({
  currentUser,
  userName,
  userRole,
  usuariosEquipo = [],
  canalesDisponibles = [],
  initialChannelId = '',
  openNewModalSignal = 0,
  onIrACanal
}) {
  const currentUserEmail = (currentUser?.email || '').toLowerCase();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [vista, setVista] = useState('mes'); // 'mes' | 'agenda'
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [filtroAlcance, setFiltroAlcance] = useState('todos'); // 'todos' | 'mios'

  // Eventos nativos en el Calendario Propio de la Plataforma (Firestore)
  const [firestoreEvents, setFirestoreEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Modales
  const [modalOpen, setModalOpen] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [eventoSeleccionado, setEventoSeleccionado] = useState(null);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState(null);

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Inicializar fechas redondeadas
  const obtenerFechasIniciales = (todoElDia = false, baseDate = null) => {
    const ahora = baseDate ? new Date(baseDate) : new Date();
    if (!baseDate) {
      ahora.setMinutes(0, 0, 0);
      ahora.setHours(ahora.getHours() + 1);
    } else {
      ahora.setHours(9, 0, 0, 0);
    }

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
    const unaHoraDespues = new Date(ahora.getTime() + 60 * 60 * 1000);
    const fechaFinStr = `${unaHoraDespues.getFullYear()}-${pad(unaHoraDespues.getMonth() + 1)}-${pad(unaHoraDespues.getDate())}T${pad(unaHoraDespues.getHours())}:00`;

    return { inicio: fechaInicioStr, fin: fechaFinStr };
  };

  const [form, setForm] = useState({
    titulo: '',
    categoria: 'reunion',
    todoElDia: false,
    fechaInicio: '',
    fechaFin: '',
    ubicacion: '',
    descripcion: '',
    participantes: [],
    notificarCanalId: '',
    esConfidencial: false
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // 1. Escucha en tiempo real de eventos nativos del Calendario Propio de la Plataforma (Firestore)
  useEffect(() => {
    setLoadingEvents(true);
    const q = query(collection(db, 'workspace_eventos'), orderBy('startIso', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }));
        setFirestoreEvents(items);
        setLoadingEvents(false);
      },
      (err) => {
        console.error('Error escuchando workspace_eventos:', err);
        setLoadingEvents(false);
      }
    );
    return () => unsub();
  }, []);

  // Abrir modal si viene señal desde el chat
  useEffect(() => {
    if (openNewModalSignal > 0) {
      abrirModalNuevo(null, initialChannelId);
    }
  }, [openNewModalSignal, initialChannelId]);

  // 2. Normalización y filtrado de privacidad/confidencialidad
  const eventosUnificados = useMemo(() => {
    const visiblesParaUsuario = firestoreEvents.filter((ev) => {
      if (ev.visibilidad === 'confidencial' || ev.esConfidencial === true) {
        if (userRole === 'Superadmin') return true;
        const esCreador = (ev.creadoPorEmail || '').toLowerCase() === currentUserEmail;
        const esParticipante = (ev.participantes || []).some(
          (p) => p.toLowerCase() === currentUserEmail
        );
        return esCreador || esParticipante;
      }
      return true;
    });

    const normalizados = visiblesParaUsuario.map((ev) => ({
      id: ev.id,
      firestoreId: ev.id,
      summary: ev.titulo || '(Sin título)',
      description: ev.descripcion || '',
      location: ev.ubicacion || '',
      categoria: ev.categoria || 'institucional',
      todoElDia: Boolean(ev.todoElDia),
      start: ev.todoElDia ? { date: ev.fechaInicio } : { dateTime: ev.startIso || ev.fechaInicio },
      end: ev.todoElDia ? { date: ev.fechaFin || ev.fechaInicio } : { dateTime: ev.endIso || ev.fechaFin },
      participantes: ev.participantes || [],
      creadoPorEmail: ev.creadoPorEmail || '',
      creadoPorNombre: ev.creadoPorNombre || '',
      canalId: ev.canalId || '',
      esConfidencial: ev.visibilidad === 'confidencial' || Boolean(ev.esConfidencial)
    }));

    return normalizados.filter((ev) => {
      if (filtroCategoria !== 'todas' && ev.categoria !== filtroCategoria) return false;
      if (filtroAlcance === 'mios') {
        const soyCreador = (ev.creadoPorEmail || '').toLowerCase() === currentUserEmail;
        const estoyConvocado = (ev.participantes || []).some(
          (p) => p.toLowerCase() === currentUserEmail
        );
        if (!soyCreador && !estoyConvocado) return false;
      }
      return true;
    });
  }, [firestoreEvents, filtroCategoria, filtroAlcance, currentUserEmail, userRole]);

  // Generar enlace para que el usuario agregue opcionalmente un evento a su propio Google Calendar personal
  const generarUrlGoogleCalendarPersonal = (ev) => {
    if (!ev) return '#';
    const pad = (n) => String(n).padStart(2, '0');
    const toGCalDate = (isoStr, isAllDay) => {
      if (!isoStr) return '';
      if (isAllDay) {
        return isoStr.split('T')[0].replace(/-/g, '');
      }
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '';
      return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
    };

    const startRaw = ev.todoElDia ? ev.start?.date : ev.start?.dateTime;
    const endRaw = ev.todoElDia ? ev.end?.date || ev.start?.date : ev.end?.dateTime || ev.start?.dateTime;
    const startParam = toGCalDate(startRaw, ev.todoElDia);
    let endParam = toGCalDate(endRaw, ev.todoElDia);
    if (ev.todoElDia && startRaw) {
      const d = new Date(`${startRaw.split('T')[0]}T00:00:00`);
      d.setDate(d.getDate() + 1);
      endParam = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    }

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `[IIRESODH] ${ev.summary || ''}`,
      dates: `${startParam}/${endParam}`,
      details: ev.description || 'Evento agendado en la Intranet Institucional IIRESODH.',
      location: ev.location || ''
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  // Abrir modal para crear nuevo evento
  const abrirModalNuevo = (fechaClick = null, canalPreseleccionado = '') => {
    const { inicio, fin } = obtenerFechasIniciales(false, fechaClick);
    setModoEdicion(false);
    setFormError(null);
    setForm({
      titulo: '',
      categoria: 'reunion',
      todoElDia: false,
      fechaInicio: inicio,
      fechaFin: fin,
      ubicacion: '',
      descripcion: '',
      participantes: currentUserEmail ? [currentUserEmail] : [],
      notificarCanalId: canalPreseleccionado || (canalesDisponibles[0]?.id || ''),
      esConfidencial: false
    });
    setModalOpen(true);
  };

  // Abrir modal para editar un evento existente
  const abrirModalEditar = (ev) => {
    setDetalleOpen(false);
    setModoEdicion(true);
    setFormError(null);

    const esTodoElDia = Boolean(ev.todoElDia);
    const formatInput = (val) => {
      if (!val) return '';
      if (esTodoElDia) return val.split('T')[0];
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const rawStart = esTodoElDia ? ev.start?.date : ev.start?.dateTime;
    const rawEnd = esTodoElDia ? ev.end?.date : ev.end?.dateTime;

    setForm({
      titulo: ev.summary || '',
      categoria: ev.categoria || 'institucional',
      todoElDia: esTodoElDia,
      fechaInicio: formatInput(rawStart),
      fechaFin: formatInput(rawEnd),
      ubicacion: ev.location || '',
      descripcion: ev.description || '',
      participantes: ev.participantes || [],
      notificarCanalId: '',
      esConfidencial: Boolean(ev.esConfidencial)
    });
    setModalOpen(true);
  };

  const sumarUnaHora = (fechaHoraStr) => {
    if (!fechaHoraStr) return '';
    try {
      const d = new Date(fechaHoraStr);
      if (isNaN(d.getTime())) return '';
      const unaHoraDespues = new Date(d.getTime() + 60 * 60 * 1000);
      const pad = (n) => String(n).padStart(2, '0');
      return `${unaHoraDespues.getFullYear()}-${pad(unaHoraDespues.getMonth() + 1)}-${pad(unaHoraDespues.getDate())}T${pad(unaHoraDespues.getHours())}:${pad(unaHoraDespues.getMinutes())}`;
    } catch {
      return '';
    }
  };

  const handleFormChange = (e) => {
    const { name, value, checked, type } = e.target;
    if (name === 'todoElDia') {
      const { inicio, fin } = obtenerFechasIniciales(checked);
      setForm((prev) => ({
        ...prev,
        todoElDia: checked,
        fechaInicio: inicio,
        fechaFin: fin
      }));
    } else if (name === 'fechaInicio') {
      if (form.todoElDia) {
        setForm((prev) => ({ ...prev, fechaInicio: value, fechaFin: value }));
      } else {
        setForm((prev) => ({
          ...prev,
          fechaInicio: value,
          fechaFin: sumarUnaHora(value) || prev.fechaFin
        }));
      }
    } else {
      setForm((prev) => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  // Guardar (Crear o Actualizar) en el Calendario Propio de la Plataforma (Firestore)
  const handleGuardarEvento = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!form.titulo.trim()) {
      setFormError('Por favor ingrese el título del evento.');
      return;
    }
    if (!form.fechaInicio) {
      setFormError('Seleccione la fecha de inicio.');
      return;
    }
    if (!form.todoElDia && (!form.fechaFin || form.fechaFin <= form.fechaInicio)) {
      setFormError('La hora de finalización debe ser posterior a la de inicio.');
      return;
    }

    setSaving(true);
    try {
      const startIso = form.todoElDia
        ? `${form.fechaInicio}T00:00:00`
        : new Date(form.fechaInicio).toISOString();
      const endIso = form.todoElDia
        ? `${form.fechaFin || form.fechaInicio}T23:59:59`
        : new Date(form.fechaFin).toISOString();

      const participantesFinales = Array.from(
        new Set([...(form.participantes || []), ...(form.esConfidencial && currentUserEmail ? [currentUserEmail] : [])])
      );

      const payloadFirestore = {
        titulo: form.titulo.trim(),
        categoria: form.categoria,
        todoElDia: form.todoElDia,
        fechaInicio: form.fechaInicio,
        fechaFin: form.todoElDia ? form.fechaInicio : form.fechaFin,
        startIso,
        endIso,
        ubicacion: form.ubicacion.trim(),
        descripcion: form.descripcion.trim(),
        participantes: participantesFinales,
        visibilidad: form.esConfidencial ? 'confidencial' : 'equipo',
        esConfidencial: Boolean(form.esConfidencial),
        actualizadoEn: serverTimestamp()
      };

      let docIdFinal = eventoSeleccionado?.firestoreId || null;

      if (modoEdicion && docIdFinal) {
        await updateDoc(doc(db, 'workspace_eventos', docIdFinal), payloadFirestore);
      } else {
        const nuevoRef = await addDoc(collection(db, 'workspace_eventos'), {
          ...payloadFirestore,
          creadoPorEmail: currentUserEmail,
          creadoPorNombre: userName || currentUser?.displayName || currentUser?.email || 'Usuario',
          creadoEn: serverTimestamp()
        });
        docIdFinal = nuevoRef.id;
      }

      // Publicar tarjeta interactiva en el canal de Slack seleccionado
      if (!modoEdicion && form.notificarCanalId) {
        const catInfo = CATEGORIAS_EVENTO[form.categoria] || CATEGORIAS_EVENTO.institucional;
        const textoMensaje = `📅 *Nuevo evento agendado:* *${form.titulo.trim()}*\n• *Categoría:* ${catInfo.label}\n• *Cuándo:* ${form.todoElDia ? form.fechaInicio + ' (Todo el día)' : new Date(form.fechaInicio).toLocaleString('es-CR', { dateStyle: 'medium', timeStyle: 'short' })}${form.ubicacion.trim() ? `\n• *Ubicación/Enlace:* ${form.ubicacion.trim()}` : ''}`;

        await addDoc(collection(db, 'workspace_canales', form.notificarCanalId, 'mensajes'), {
          texto: textoMensaje,
          autorEmail: currentUserEmail,
          autorNombre: userName || currentUser?.displayName || 'Agenda Institucional',
          autorAvatar: currentUser?.photoURL || '',
          autorRol: userRole || 'Colaborador',
          creadoEn: serverTimestamp(),
          creadoEnMs: Date.now(),
          reacciones: {},
          fijado: false,
          respuestasCount: 0,
          eventoAdjunto: {
            id: docIdFinal,
            titulo: form.titulo.trim(),
            categoria: form.categoria,
            fechaInicio: form.fechaInicio,
            fechaFin: form.todoElDia ? form.fechaInicio : form.fechaFin,
            todoElDia: form.todoElDia,
            ubicacion: form.ubicacion.trim()
          }
        });

        await updateDoc(doc(db, 'workspace_canales', form.notificarCanalId), {
          ultimoMensajeAt: serverTimestamp(),
          ultimoMensajeMs: Date.now(),
          ultimoMensajeTexto: `📅 Evento: ${form.titulo.trim()}`,
          ultimoMensajeAutor: userName || currentUser?.displayName || 'Equipo'
        });
      }

      if (currentUser?.email) {
        registrarLogAuditoria(
          currentUser.email,
          modoEdicion ? 'Actualización de Evento (Calendario Interno)' : 'Creación de Evento (Calendario Interno)',
          `Evento "${form.titulo.trim()}" [${form.categoria}] (${form.esConfidencial ? 'Confidencial' : 'Equipo'}) guardado en Calendario Propio IIRESODH.`
        );
      }

      setModalOpen(false);
      setSnackbar({
        open: true,
        message: modoEdicion
          ? 'Evento actualizado en el calendario de la plataforma.'
          : 'Evento agendado de forma segura en el calendario institucional.',
        severity: 'success'
      });
    } catch (err) {
      console.error('Error guardando evento:', err);
      setFormError(err.message || 'Ocurrió un error al guardar el evento.');
    } finally {
      setSaving(false);
    }
  };

  // Eliminar evento del Calendario Propio de la Plataforma
  const handleEliminarEvento = async () => {
    if (!eventoSeleccionado?.firestoreId) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'workspace_eventos', eventoSeleccionado.firestoreId));

      if (currentUser?.email) {
        registrarLogAuditoria(
          currentUser.email,
          'Eliminación de Evento (Calendario Interno)',
          `Evento "${eventoSeleccionado.summary}" eliminado del calendario institucional.`
        );
      }

      setConfirmDeleteOpen(false);
      setDetalleOpen(false);
      setSnackbar({
        open: true,
        message: 'Evento eliminado del calendario institucional.',
        severity: 'info'
      });
    } catch (err) {
      console.error('Error eliminando evento:', err);
    } finally {
      setDeleting(false);
    }
  };

  // Compartir evento existente en un canal
  const handleCompartirEnCanal = async (canalId) => {
    if (!eventoSeleccionado || !canalId) return;
    try {
      const catInfo = CATEGORIAS_EVENTO[eventoSeleccionado.categoria] || CATEGORIAS_EVENTO.institucional;
      const fechaTexto = eventoSeleccionado.todoElDia
        ? `${eventoSeleccionado.start?.date} (Todo el día)`
        : new Date(eventoSeleccionado.start?.dateTime).toLocaleString('es-CR', {
            dateStyle: 'medium',
            timeStyle: 'short'
          });

      await addDoc(collection(db, 'workspace_canales', canalId, 'mensajes'), {
        texto: `📅 *Recordatorio de Evento:* *${eventoSeleccionado.summary}*\n• *Categoría:* ${catInfo.label}\n• *Cuándo:* ${fechaTexto}${eventoSeleccionado.location ? `\n• *Ubicación:* ${eventoSeleccionado.location}` : ''}`,
        autorEmail: currentUserEmail,
        autorNombre: userName || currentUser?.displayName || 'Equipo',
        autorAvatar: currentUser?.photoURL || '',
        autorRol: userRole || 'Colaborador',
        creadoEn: serverTimestamp(),
        creadoEnMs: Date.now(),
        reacciones: {},
        fijado: false,
        respuestasCount: 0,
        eventoAdjunto: {
          id: eventoSeleccionado.id,
          titulo: eventoSeleccionado.summary,
          categoria: eventoSeleccionado.categoria,
          fechaInicio: eventoSeleccionado.start?.dateTime || eventoSeleccionado.start?.date,
          todoElDia: eventoSeleccionado.todoElDia,
          ubicacion: eventoSeleccionado.location || ''
        }
      });

      await updateDoc(doc(db, 'workspace_canales', canalId), {
        ultimoMensajeAt: serverTimestamp(),
        ultimoMensajeMs: Date.now(),
        ultimoMensajeTexto: `📅 Recordatorio: ${eventoSeleccionado.summary}`,
        ultimoMensajeAutor: userName || 'Equipo'
      });

      setDetalleOpen(false);
      setSnackbar({
        open: true,
        message: 'Evento compartido en el canal exitosamente.',
        severity: 'success'
      });
      if (onIrACanal) onIrACanal(canalId);
    } catch (err) {
      console.error('Error compartiendo evento:', err);
    }
  };

  // Cálculos de cuadrícula mensual
  const primerDiaSemana = (new Date(year, month, 1).getDay() + 6) % 7;
  const diasEnMes = new Date(year, month + 1, 0).getDate();
  const diasEnMesAnterior = new Date(year, month, 0).getDate();

  const celdasDias = [];
  for (let i = primerDiaSemana - 1; i >= 0; i--) {
    const diaNum = diasEnMesAnterior - i;
    celdasDias.push({
      fecha: new Date(year, month - 1, diaNum),
      diaNum,
      esMesActual: false
    });
  }
  for (let i = 1; i <= diasEnMes; i++) {
    celdasDias.push({
      fecha: new Date(year, month, i),
      diaNum: i,
      esMesActual: true
    });
  }
  const restantes = (7 - (celdasDias.length % 7)) % 7;
  for (let i = 1; i <= restantes; i++) {
    celdasDias.push({
      fecha: new Date(year, month + 1, i),
      diaNum: i,
      esMesActual: false
    });
  }

  const hoy = new Date();
  const esMismoDia = (d1, d2) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const obtenerEventosDelDia = (fechaCelda) => {
    const inicioDia = new Date(fechaCelda.getFullYear(), fechaCelda.getMonth(), fechaCelda.getDate(), 0, 0, 0);
    const finDia = new Date(fechaCelda.getFullYear(), fechaCelda.getMonth(), fechaCelda.getDate(), 23, 59, 59);

    return eventosUnificados.filter((ev) => {
      const esTodoElDia = Boolean(ev.todoElDia);
      if (esTodoElDia) {
        const startStr = (ev.start?.date || '').split('T')[0];
        if (!startStr) return false;
        const [sy, sm, sd] = startStr.split('-').map(Number);
        const startDate = new Date(sy, sm - 1, sd, 0, 0, 0);
        return esMismoDia(startDate, fechaCelda);
      } else {
        const startDT = new Date(ev.start?.dateTime);
        const endDT = new Date(ev.end?.dateTime || ev.start?.dateTime);
        return startDT <= finDia && endDT >= inicioDia;
      }
    });
  };

  const formatearHora = (ev) => {
    if (ev.todoElDia) return 'Todo el día';
    if (!ev.start?.dateTime) return '';
    const d = new Date(ev.start.dateTime);
    return d.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // Próximos eventos para la barra lateral derecha
  const proximosEventos = useMemo(() => {
    const ahora = new Date();
    ahora.setHours(0, 0, 0, 0);
    return eventosUnificados
      .filter((ev) => {
        const fechaEv = new Date(ev.start?.dateTime || `${ev.start?.date}T00:00:00`);
        return fechaEv >= ahora;
      })
      .sort((a, b) => {
        const dA = new Date(a.start?.dateTime || `${a.start?.date}T00:00:00`);
        const dB = new Date(b.start?.dateTime || `${b.start?.date}T00:00:00`);
        return dA - dB;
      })
      .slice(0, 8);
  }, [eventosUnificados]);

  const nombreMes = currentDate.toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric'
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#F8FAF8', overflow: 'hidden' }}>
      {/* BARRA SUPERIOR DEL CALENDARIO PROPIO DE LA PLATAFORMA */}
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          py: 1.75,
          bgcolor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5
        }}
      >
        {/* CONTROLES DE MES Y TÍTULO */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#f1f5f9', borderRadius: 2, p: 0.4 }}>
            <IconButton size="small" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>
              <ChevronLeft size={18} />
            </IconButton>
            <Button
              size="small"
              onClick={() => setCurrentDate(new Date())}
              sx={{
                textTransform: 'none',
                fontWeight: 'bold',
                color: '#1D3557',
                minWidth: 'auto',
                px: 1.2,
                fontSize: '0.8rem'
              }}
            >
              Hoy
            </Button>
            <IconButton size="small" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>
              <ChevronRight size={18} />
            </IconButton>
          </Box>

          <Typography
            variant="h6"
            fontWeight="800"
            color="#1D3557"
            sx={{ textTransform: 'capitalize', fontSize: { xs: '1.05rem', sm: '1.2rem' } }}
          >
            {nombreMes}
          </Typography>

          <Tooltip title="Calendario 100% interno y privado de la plataforma IIRESODH, blindado con reglas perimetrales de Firestore">
            <Chip
              icon={<ShieldCheck size={13} color="#1D3557" />}
              label="Calendario Privado IIRESODH"
              size="small"
              sx={{
                bgcolor: 'rgba(29, 53, 87, 0.08)',
                color: '#1D3557',
                fontWeight: 700,
                fontSize: '0.72rem'
              }}
            />
          </Tooltip>
        </Box>

        {/* FILTROS, VISTA Y BOTÓN NUEVO EVENTO */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <Select
              value={filtroAlcance}
              onChange={(e) => setFiltroAlcance(e.target.value)}
              sx={{ borderRadius: 2, fontSize: '0.8rem', bgcolor: '#f8fafc', height: 34 }}
            >
              <MenuItem value="todos" sx={{ fontSize: '0.8rem' }}>
                Agenda del Equipo
              </MenuItem>
              <MenuItem value="mios" sx={{ fontSize: '0.8rem' }}>
                👤 Mis convocatorias
              </MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              sx={{ borderRadius: 2, fontSize: '0.82rem', bgcolor: '#f8fafc', height: 34 }}
            >
              <MenuItem value="todas" sx={{ fontSize: '0.82rem' }}>
                Todas las categorías
              </MenuItem>
              {Object.values(CATEGORIAS_EVENTO).map((cat) => (
                <MenuItem key={cat.id} value={cat.id} sx={{ fontSize: '0.82rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: cat.dot }} />
                    {cat.label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <ToggleButtonGroup
            value={vista}
            exclusive
            onChange={(_, val) => val && setVista(val)}
            size="small"
            sx={{ height: 34 }}
          >
            <ToggleButton value="mes" sx={{ textTransform: 'none', px: 1.5, fontSize: '0.8rem', fontWeight: 600 }}>
              <CalendarDays size={15} style={{ marginRight: 5 }} />
              Mes
            </ToggleButton>
            <ToggleButton value="agenda" sx={{ textTransform: 'none', px: 1.5, fontSize: '0.8rem', fontWeight: 600 }}>
              <ListFilter size={15} style={{ marginRight: 5 }} />
              Agenda
            </ToggleButton>
          </ToggleButtonGroup>

          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => abrirModalNuevo()}
            sx={{
              bgcolor: '#1D3557',
              color: '#ffffff',
              textTransform: 'none',
              fontWeight: 'bold',
              borderRadius: 2,
              px: 2,
              height: 34,
              fontSize: '0.83rem',
              '&:hover': { bgcolor: '#122238' }
            }}
          >
            Agendar Evento
          </Button>
        </Box>
      </Box>

      {/* CUERPO DEL CALENDARIO: CUADRÍCULA + PANEL DE PRÓXIMOS EVENTOS */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        {/* ÁREA PRINCIPAL (MES O AGENDA) */}
        <Box sx={{ flexGrow: 1, p: { xs: 1.5, sm: 2.5 }, overflowY: 'auto' }}>
          {loadingEvents ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress size={30} />
            </Box>
          ) : vista === 'mes' ? (
            <Paper
              elevation={0}
              sx={{
                borderRadius: 3,
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                bgcolor: '#ffffff'
              }}
            >
              {/* CABECERA DÍAS DE LA SEMANA */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  bgcolor: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0'
                }}
              >
                {DIAS_SEMANA.map((dia) => (
                  <Box key={dia} sx={{ py: 1, textAlign: 'center' }}>
                    <Typography variant="caption" fontWeight="bold" color="#475569" sx={{ textTransform: 'uppercase' }}>
                      {dia}
                    </Typography>
                  </Box>
                ))}
              </Box>

              {/* CELDAS DE DÍAS */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))'
                }}
              >
                {celdasDias.map((celda, idx) => {
                  const esHoy = esMismoDia(celda.fecha, hoy);
                  const eventosDia = obtenerEventosDelDia(celda.fecha);

                  return (
                    <Box
                      key={idx}
                      onClick={() => abrirModalNuevo(celda.fecha)}
                      sx={{
                        minHeight: { xs: 80, sm: 105 },
                        p: 0.75,
                        borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid #f1f5f9',
                        borderBottom: '1px solid #f1f5f9',
                        bgcolor: !celda.esMesActual
                          ? '#f8fafc'
                          : esHoy
                          ? 'rgba(29, 53, 87, 0.04)'
                          : '#ffffff',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s',
                        '&:hover': { bgcolor: '#f1f5f9' }
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: esHoy ? '#1D3557' : 'transparent',
                            color: esHoy
                              ? '#ffffff'
                              : celda.esMesActual
                              ? '#1e293b'
                              : '#94a3b8',
                            fontWeight: esHoy ? 'bold' : 600,
                            fontSize: '0.78rem'
                          }}
                        >
                          {celda.diaNum}
                        </Box>
                        {eventosDia.length > 0 && (
                          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>
                            {eventosDia.length}
                          </Typography>
                        )}
                      </Box>

                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                        {eventosDia.slice(0, 3).map((ev) => {
                          const cat = CATEGORIAS_EVENTO[ev.categoria] || CATEGORIAS_EVENTO.institucional;
                          return (
                            <Tooltip
                              key={ev.id}
                              title={`${formatearHora(ev)} • ${ev.summary} (${cat.label})${ev.esConfidencial ? ' [Confidencial]' : ''}`}
                              arrow
                            >
                              <Box
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEventoSeleccionado(ev);
                                  setDetalleOpen(true);
                                }}
                                sx={{
                                  px: 0.75,
                                  py: 0.25,
                                  borderRadius: '0 4px 4px 0',
                                  bgcolor: cat.bg,
                                  color: cat.color,
                                  borderLeft: `3px solid ${cat.dot}`,
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  '&:hover': { filter: 'brightness(0.95)' }
                                }}
                              >
                                {ev.esConfidencial && '🔒 '}
                                {!ev.todoElDia && (
                                  <span style={{ opacity: 0.85, marginRight: 4 }}>
                                    {formatearHora(ev)}
                                  </span>
                                )}
                                {ev.summary}
                              </Box>
                            </Tooltip>
                          );
                        })}
                        {eventosDia.length > 3 && (
                          <Typography
                            variant="caption"
                            sx={{ fontSize: '0.68rem', color: '#1D3557', fontWeight: 'bold', pl: 0.5 }}
                          >
                            +{eventosDia.length - 3} más
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Paper>
          ) : (
            /* VISTA AGENDA DETALLADA */
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {eventosUnificados.length === 0 ? (
                <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 3, border: '1px dashed #cbd5e1' }}>
                  <CalendarIcon size={40} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
                  <Typography variant="subtitle1" fontWeight="bold" color="text.secondary">
                    No hay eventos registrados en este criterio
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<Plus size={16} />}
                    onClick={() => abrirModalNuevo()}
                    sx={{ mt: 2, textTransform: 'none', borderRadius: 2 }}
                  >
                    Crear el primer evento
                  </Button>
                </Paper>
              ) : (
                eventosUnificados.map((ev) => {
                  const cat = CATEGORIAS_EVENTO[ev.categoria] || CATEGORIAS_EVENTO.institucional;
                  const fechaEv = new Date(ev.start?.dateTime || `${ev.start?.date}T00:00:00`);
                  return (
                    <Paper
                      key={ev.id}
                      onClick={() => {
                        setEventoSeleccionado(ev);
                        setDetalleOpen(true);
                      }}
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: '0 10px 10px 0',
                        border: '1px solid #e2e8f0',
                        borderLeft: `5px solid ${cat.dot}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 2,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: '#f8fafc', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box
                          sx={{
                            minWidth: 54,
                            textAlign: 'center',
                            p: 1,
                            borderRadius: 2,
                            bgcolor: cat.bg,
                            color: cat.color
                          }}
                        >
                          <Typography variant="caption" fontWeight="bold" sx={{ textTransform: 'uppercase', display: 'block' }}>
                            {fechaEv.toLocaleDateString('es-CR', { month: 'short' })}
                          </Typography>
                          <Typography variant="h6" fontWeight="800" sx={{ lineHeight: 1 }}>
                            {fechaEv.getDate()}
                          </Typography>
                        </Box>

                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.4 }}>
                            <Typography variant="subtitle1" fontWeight="bold" color="#1D3557">
                              {ev.summary}
                            </Typography>
                            <Chip
                              label={cat.label}
                              size="small"
                              sx={{ bgcolor: cat.bg, color: cat.color, fontWeight: 'bold', fontSize: '0.7rem', height: 20 }}
                            />
                            {ev.esConfidencial && (
                              <Chip
                                icon={<Lock size={11} />}
                                label="Confidencial"
                                size="small"
                                sx={{
                                  bgcolor: 'rgba(185, 47, 50, 0.1)',
                                  color: '#B92F32',
                                  fontWeight: 700,
                                  fontSize: '0.68rem',
                                  height: 20
                                }}
                              />
                            )}
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Clock size={13} /> {formatearHora(ev)}
                            </Typography>
                            {ev.location && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <MapPin size={13} /> {ev.location}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </Box>

                      {ev.participantes?.length > 0 && (
                        <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 26, height: 26, fontSize: '0.72rem' } }}>
                          {ev.participantes.map((email) => (
                            <Tooltip key={email} title={email}>
                              <Avatar sx={{ bgcolor: '#1D3557' }}>{email.charAt(0).toUpperCase()}</Avatar>
                            </Tooltip>
                          ))}
                        </AvatarGroup>
                      )}
                    </Paper>
                  );
                })
              )}
            </Box>
          )}
        </Box>

        {/* BARRA LATERAL DERECHA: PRÓXIMOS EVENTOS Y PLAZOS */}
        <Box
          sx={{
            width: 290,
            borderLeft: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
            p: 2,
            display: { xs: 'none', lg: 'flex' },
            flexDirection: 'column',
            gap: 1.5,
            overflowY: 'auto'
          }}
        >
          <Typography variant="subtitle2" fontWeight="800" color="#1D3557" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarDays size={17} /> Próximos Eventos y Plazos
          </Typography>
          <Divider />

          {proximosEventos.length === 0 ? (
            <Typography variant="caption" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              No hay eventos próximos programados.
            </Typography>
          ) : (
            proximosEventos.map((ev) => {
              const cat = CATEGORIAS_EVENTO[ev.categoria] || CATEGORIAS_EVENTO.institucional;
              const fechaObj = new Date(ev.start?.dateTime || `${ev.start?.date}T00:00:00`);
              return (
                <Box
                  key={ev.id}
                  onClick={() => {
                    setEventoSeleccionado(ev);
                    setDetalleOpen(true);
                  }}
                  sx={{
                    p: 1.25,
                    borderRadius: '0 8px 8px 0',
                    border: '1px solid #e2e8f0',
                    borderLeft: `4px solid ${cat.dot}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    '&:hover': { bgcolor: '#f8fafc', transform: 'translateX(2px)' }
                  }}
                >
                  <Typography variant="caption" fontWeight="bold" sx={{ color: cat.color, display: 'block' }}>
                    {fechaObj.toLocaleDateString('es-CR', { weekday: 'short', day: 'numeric', month: 'short' })} • {formatearHora(ev)}
                  </Typography>
                  <Typography variant="body2" fontWeight="700" color="#1D3557" noWrap sx={{ mt: 0.2 }}>
                    {ev.esConfidencial && '🔒 '}
                    {ev.summary}
                  </Typography>
                  {ev.location && (
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.2 }}>
                      📍 {ev.location}
                    </Typography>
                  )}
                </Box>
              );
            })
          )}
        </Box>
      </Box>

      {/* ===================================================================== */}
      {/* MODAL CREAR / EDITAR EVENTO EN EL CALENDARIO PROPIO DE LA PLATAFORMA  */}
      {/* ===================================================================== */}
      <Dialog
        open={modalOpen}
        onClose={saving ? undefined : () => setModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(29, 53, 87, 0.08)', color: '#1D3557' }}>
              <CalendarIcon size={20} />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight="bold" color="#1D3557">
                {modoEdicion ? 'Editar Evento Institucional' : 'Agendar Nuevo Evento o Audiencia'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Calendario Privado de la Plataforma IIRESODH
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={() => setModalOpen(false)} disabled={saving}>
            <X size={18} />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {formError && <Alert severity="error">{formError}</Alert>}

          <TextField
            name="titulo"
            label="Título del Evento, Audiencia o Plazo"
            placeholder="Ej: Audiencia Caso CIDH, Reunión de Litigios..."
            value={form.titulo}
            onChange={handleFormChange}
            fullWidth
            required
            size="small"
          />

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Categoría</InputLabel>
              <Select
                name="categoria"
                value={form.categoria}
                label="Categoría"
                onChange={handleFormChange}
              >
                {Object.values(CATEGORIAS_EVENTO).map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: cat.dot }} />
                      {cat.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 1.5,
                borderRadius: 1.5,
                border: '1px solid #cbd5e1',
                bgcolor: '#f8fafc'
              }}
            >
              <Typography variant="body2" fontWeight="500">
                Todo el día
              </Typography>
              <Switch
                name="todoElDia"
                checked={form.todoElDia}
                onChange={handleFormChange}
                size="small"
              />
            </Box>
          </Box>

          {form.todoElDia ? (
            <TextField
              name="fechaInicio"
              label="Fecha del evento"
              type="date"
              value={form.fechaInicio}
              onChange={handleFormChange}
              size="small"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField
                name="fechaInicio"
                label="Inicio"
                type="datetime-local"
                value={form.fechaInicio}
                onChange={handleFormChange}
                size="small"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                name="fechaFin"
                label="Finalización"
                type="datetime-local"
                value={form.fechaFin}
                onChange={handleFormChange}
                size="small"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Box>
          )}

          <TextField
            name="ubicacion"
            label="Ubicación física o enlace de videollamada (Meet / Zoom)"
            placeholder="Ej: Sala Principal IIRESODH o https://meet.google.com/..."
            value={form.ubicacion}
            onChange={handleFormChange}
            size="small"
            fullWidth
          />

          {/* PARTICIPANTES DEL EQUIPO */}
          <FormControl size="small" fullWidth>
            <InputLabel>Participantes convocados del equipo</InputLabel>
            <Select
              multiple
              value={form.participantes}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  participantes: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value
                }))
              }
              input={<OutlinedInput label="Participantes convocados del equipo" />}
              renderValue={(selected) => `${selected.length} miembro(s) convocado(s)`}
            >
              {usuariosEquipo.map((u) => (
                <MenuItem key={u.email} value={u.email}>
                  <Checkbox size="small" checked={form.participantes.indexOf(u.email) > -1} />
                  <ListItemText
                    primary={u.nombre || u.email}
                    secondary={`${u.email} • ${u.rol}`}
                    primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }}
                    secondaryTypographyProps={{ fontSize: '0.72rem' }}
                  />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* NOTIFICAR EN CANAL DE SLACK */}
          {!modoEdicion && (
            <FormControl size="small" fullWidth>
              <InputLabel>Anunciar automáticamente en un canal de Slack (Opcional)</InputLabel>
              <Select
                name="notificarCanalId"
                value={form.notificarCanalId}
                label="Anunciar automáticamente en un canal de Slack (Opcional)"
                onChange={handleFormChange}
              >
                <MenuItem value="">
                  <em>No publicar anuncio en canal</em>
                </MenuItem>
                {canalesDisponibles
                  .filter((c) => c.tipo !== 'dm')
                  .map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      # {c.nombre}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          )}

          <TextField
            name="descripcion"
            label="Notas, agenda o expediente relacionado"
            value={form.descripcion}
            onChange={handleFormChange}
            multiline
            rows={2}
            size="small"
            fullWidth
          />

          {/* SELECTOR DE CONFIDENCIALIDAD / VISIBILIDAD INTERNA */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 1.5,
              borderRadius: '0 8px 8px 0',
              bgcolor: form.esConfidencial ? 'rgba(185, 47, 50, 0.06)' : 'rgba(29, 53, 87, 0.04)',
              border: '1px solid #cbd5e1',
              borderLeft: form.esConfidencial ? '4px solid #B92F32' : '4px solid #1D3557'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              {form.esConfidencial ? (
                <Lock size={18} color="#B92F32" />
              ) : (
                <ShieldCheck size={18} color="#1D3557" />
              )}
              <Box>
                <Typography
                  variant="body2"
                  fontWeight="bold"
                  color={form.esConfidencial ? '#B92F32' : '#1D3557'}
                  sx={{ fontSize: '0.82rem' }}
                >
                  {form.esConfidencial
                    ? 'Evento Confidencial (Solo participantes convocados)'
                    : 'Visible para todo el equipo autorizado en la Intranet'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {form.esConfidencial
                    ? 'Solo tú, los participantes seleccionados y Superadmin podrán ver este evento.'
                    : 'Almacenado de forma segura exclusivamente dentro de la plataforma IIRESODH.'}
                </Typography>
              </Box>
            </Box>
            <Switch
              name="esConfidencial"
              checked={form.esConfidencial}
              onChange={handleFormChange}
              size="small"
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalOpen(false)} disabled={saving} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleGuardarEvento}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={15} color="inherit" /> : <Check size={16} />}
            sx={{ bgcolor: '#1D3557', textTransform: 'none', fontWeight: 'bold', borderRadius: 2 }}
          >
            {saving ? 'Guardando...' : modoEdicion ? 'Guardar Cambios' : 'Agendar Evento'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===================================================================== */}
      {/* MODAL DETALLE DEL EVENTO                                              */}
      {/* ===================================================================== */}
      <Dialog
        open={detalleOpen && Boolean(eventoSeleccionado)}
        onClose={() => setDetalleOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        {eventoSeleccionado && (() => {
          const cat = CATEGORIAS_EVENTO[eventoSeleccionado.categoria] || CATEGORIAS_EVENTO.institucional;
          return (
            <>
              <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={cat.label}
                    size="small"
                    sx={{ bgcolor: cat.bg, color: cat.color, fontWeight: 'bold' }}
                  />
                  {eventoSeleccionado.esConfidencial && (
                    <Chip
                      icon={<Lock size={12} />}
                      label="Confidencial"
                      size="small"
                      sx={{
                        bgcolor: 'rgba(185, 47, 50, 0.1)',
                        color: '#B92F32',
                        fontWeight: 700
                      }}
                    />
                  )}
                </Box>
                <IconButton size="small" onClick={() => setDetalleOpen(false)}>
                  <X size={18} />
                </IconButton>
              </DialogTitle>
              <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="h6" fontWeight="800" color="#1D3557">
                  {eventoSeleccionado.summary}
                </Typography>

                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <Typography variant="body2" fontWeight="600" color="#1e293b">
                    🕒 Horario: {formatearHora(eventoSeleccionado)}
                  </Typography>
                  {eventoSeleccionado.location && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      📍 Ubicación: {eventoSeleccionado.location}
                    </Typography>
                  )}
                  {eventoSeleccionado.creadoPorNombre && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      Agendado por: {eventoSeleccionado.creadoPorNombre}
                    </Typography>
                  )}
                </Box>

                {eventoSeleccionado.description && (
                  <Box>
                    <Typography variant="caption" fontWeight="bold" color="text.secondary">
                      DESCRIPCIÓN / NOTAS
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        mt: 0.5,
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {eventoSeleccionado.description}
                    </Typography>
                  </Box>
                )}

                {eventoSeleccionado.participantes?.length > 0 && (
                  <Box>
                    <Typography variant="caption" fontWeight="bold" color="text.secondary">
                      PARTICIPANTES CONVOCADOS ({eventoSeleccionado.participantes.length})
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 0.75 }}>
                      {eventoSeleccionado.participantes.map((em) => (
                        <Chip key={em} label={em} size="small" variant="outlined" />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* BOTÓN PARA COPIAR OPCIONALMENTE AL GOOGLE CALENDAR PERSONAL DEL ABOGADO */}
                <Box sx={{ pt: 0.5 }}>
                  <Button
                    component="a"
                    href={generarUrlGoogleCalendarPersonal(eventoSeleccionado)}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="small"
                    variant="outlined"
                    startIcon={<CalendarIcon size={14} />}
                    endIcon={<ExternalLink size={13} />}
                    sx={{
                      textTransform: 'none',
                      borderRadius: 2,
                      fontWeight: 700,
                      fontSize: '0.76rem',
                      borderColor: '#457B9D',
                      color: '#1D3557'
                    }}
                  >
                    Guardar copia en mi Google Calendar personal
                  </Button>
                </Box>

                {/* COMPARTIR RÁPIDO EN UN CANAL DE SLACK */}
                {canalesDisponibles.filter((c) => c.tipo !== 'dm').length > 0 && (
                  <Box sx={{ pt: 0.5 }}>
                    <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                      COMPARTIR RECORDATORIO EN CANAL DE SLACK:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                      {canalesDisponibles
                        .filter((c) => c.tipo !== 'dm')
                        .slice(0, 4)
                        .map((c) => (
                          <Button
                            key={c.id}
                            size="small"
                            variant="outlined"
                            startIcon={<Send size={13} />}
                            onClick={() => handleCompartirEnCanal(c.id)}
                            sx={{ textTransform: 'none', borderRadius: 2, fontSize: '0.75rem' }}
                          >
                            #{c.nombre}
                          </Button>
                        ))}
                    </Box>
                  </Box>
                )}
              </DialogContent>
              <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
                <Button
                  color="error"
                  variant="outlined"
                  size="small"
                  startIcon={<Trash2 size={15} />}
                  onClick={() => setConfirmDeleteOpen(true)}
                  sx={{ textTransform: 'none', borderRadius: 2 }}
                >
                  Eliminar
                </Button>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Edit3 size={15} />}
                    onClick={() => abrirModalEditar(eventoSeleccionado)}
                    sx={{ textTransform: 'none', borderRadius: 2 }}
                  >
                    Modificar
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => setDetalleOpen(false)}
                    sx={{ bgcolor: '#1D3557', textTransform: 'none', borderRadius: 2 }}
                  >
                    Cerrar
                  </Button>
                </Box>
              </DialogActions>
            </>
          );
        })()}
      </Dialog>

      {/* CONFIRMACIÓN DE ELIMINACIÓN */}
      <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', color: '#B92F32' }}>¿Eliminar evento?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Se eliminará <strong>"{eventoSeleccionado?.summary}"</strong> del calendario institucional.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setConfirmDeleteOpen(false)} disabled={deleting}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleEliminarEvento}
            disabled={deleting}
          >
            {deleting ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} variant="filled" sx={{ borderRadius: 2 }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
