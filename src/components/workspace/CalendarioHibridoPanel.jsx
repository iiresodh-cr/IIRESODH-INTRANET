// src/components/workspace/CalendarioHibridoPanel.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  RotateCw,
  Clock,
  MapPin,
  CalendarDays,
  ListFilter,
  Scale,
  AlertTriangle,
  Users,
  Building2,
  Bookmark,
  Hash,
  Cloud,
  Database,
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
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';
import { registrarLogAuditoria } from '../../utils/auditLogger';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const CATEGORIAS_EVENTO = {
  audiencia: {
    id: 'audiencia',
    label: 'Audiencia Judicial / CIDH',
    color: '#991b1b',
    bg: '#fef2f2',
    border: '#fecaca',
    dot: '#dc2626',
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
    color: '#1e40af',
    bg: '#eff6ff',
    border: '#bfdbfe',
    dot: '#2563eb',
    icon: Users
  },
  institucional: {
    id: 'institucional',
    label: 'Evento Institucional',
    color: '#1a365d',
    bg: '#f0f9ff',
    border: '#bae6fd',
    dot: '#0284c7',
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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [vista, setVista] = useState('mes'); // 'mes' | 'agenda'
  const [filtroCategoria, setFiltroCategoria] = useState('todas');

  // Eventos nativos en Firestore y eventos remotos de Google Calendar
  const [firestoreEvents, setFirestoreEvents] = useState([]);
  const [googleEvents, setGoogleEvents] = useState([]);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [googleSyncStatus, setGoogleSyncStatus] = useState('conectado'); // 'conectado' | 'local'

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
    sincronizarGoogle: true
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // 1. Escucha en tiempo real de eventos nativos en Firestore
  useEffect(() => {
    const q = query(collection(db, 'workspace_eventos'), orderBy('startIso', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          origen: 'firestore'
        }));
        setFirestoreEvents(items);
      },
      (err) => {
        console.error('Error escuchando workspace_eventos:', err);
      }
    );
    return () => unsub();
  }, []);

  // 2. Carga complementaria desde Google Calendar (contacto@iiresodh.org)
  const cargarEventosGoogle = useCallback(async () => {
    setLoadingGoogle(true);
    try {
      const minDate = new Date(year, month - 1, 1).toISOString();
      const maxDate = new Date(year, month + 2, 0).toISOString();

      const obtenerFn = httpsCallable(functions, 'obtenerEventosCalendario');
      const res = await obtenerFn({ timeMin: minDate, timeMax: maxDate });

      if (res.data?.events) {
        setGoogleEvents(res.data.events);
        setGoogleSyncStatus('conectado');
      }
    } catch (err) {
      console.warn('Google Calendar operando en modo local Firestore:', err?.message);
      setGoogleSyncStatus('local');
    } finally {
      setLoadingGoogle(false);
    }
  }, [year, month]);

  useEffect(() => {
    cargarEventosGoogle();
  }, [cargarEventosGoogle]);

  // Abrir modal si viene señal desde el chat
  useEffect(() => {
    if (openNewModalSignal > 0) {
      abrirModalNuevo(null, initialChannelId);
    }
  }, [openNewModalSignal, initialChannelId]);

  // 3. Fusión inteligente y sin duplicados de eventos (Firestore + Google Calendar)
  const eventosUnificados = useMemo(() => {
    const googleIdsEnFirestore = new Set(
      firestoreEvents.map((e) => e.googleEventId).filter(Boolean)
    );

    const normalizadosFirestore = firestoreEvents.map((ev) => ({
      id: ev.id,
      firestoreId: ev.id,
      googleEventId: ev.googleEventId || null,
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
      htmlLink: ev.htmlLink || '',
      origen: ev.googleEventId ? 'hibrido' : 'firestore'
    }));

    const normalizadosGoogle = googleEvents
      .filter((gev) => !googleIdsEnFirestore.has(gev.id))
      .map((gev) => {
        // Inferir categoría si el título menciona audiencia o plazo
        const lower = (gev.summary || '').toLowerCase();
        let cat = 'institucional';
        if (lower.includes('audiencia') || lower.includes('cidh') || lower.includes('corte')) cat = 'audiencia';
        else if (lower.includes('plazo') || lower.includes('vencimiento') || lower.includes('fatal')) cat = 'plazo';
        else if (lower.includes('reunión') || lower.includes('reunion') || lower.includes('equipo')) cat = 'reunion';

        return {
          id: `gcal_${gev.id}`,
          firestoreId: null,
          googleEventId: gev.id,
          summary: gev.summary || '(Sin título)',
          description: gev.description || '',
          location: gev.location || '',
          categoria: cat,
          todoElDia: !gev.start?.dateTime && Boolean(gev.start?.date),
          start: gev.start,
          end: gev.end,
          participantes: [],
          creadoPorEmail: gev.creator?.email || 'contacto@iiresodh.org',
          creadoPorNombre: 'Google Calendar IIRESODH',
          htmlLink: gev.htmlLink || '',
          origen: 'google'
        };
      });

    const todos = [...normalizadosFirestore, ...normalizadosGoogle];
    if (filtroCategoria === 'todas') return todos;
    return todos.filter((e) => e.categoria === filtroCategoria);
  }, [firestoreEvents, googleEvents, filtroCategoria]);

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
      participantes: currentUser?.email ? [currentUser.email.toLowerCase()] : [],
      notificarCanalId: canalPreseleccionado || (canalesDisponibles[0]?.id || ''),
      sincronizarGoogle: true
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

    let descLimpia = ev.description || '';
    const idxFirma = descLimpia.indexOf('\n\n---');
    if (idxFirma !== -1) {
      descLimpia = descLimpia.substring(0, idxFirma);
    }

    setForm({
      titulo: ev.summary || '',
      categoria: ev.categoria || 'institucional',
      todoElDia: esTodoElDia,
      fechaInicio: formatInput(rawStart),
      fechaFin: formatInput(rawEnd),
      ubicacion: ev.location || '',
      descripcion: descLimpia,
      participantes: ev.participantes || [],
      notificarCanalId: '',
      sincronizarGoogle: Boolean(ev.googleEventId) || ev.origen === 'google'
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

  // Guardar (Crear o Actualizar) en Firestore + Opcional Google Calendar + Opcional Notificación en Canal Slack
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

      let googleEventId = modoEdicion ? eventoSeleccionado?.googleEventId || null : null;
      let htmlLink = modoEdicion ? eventoSeleccionado?.htmlLink || '' : '';

      // Sincronización con Google Calendar si está activa
      if (form.sincronizarGoogle) {
        try {
          if (modoEdicion && googleEventId) {
            const fnActualizar = httpsCallable(functions, 'actualizarEventoCalendario');
            const resG = await fnActualizar({
              eventId: googleEventId,
              titulo: form.titulo.trim(),
              todoElDia: form.todoElDia,
              fechaInicio: form.fechaInicio,
              fechaFin: form.todoElDia ? form.fechaInicio : form.fechaFin,
              ubicacion: form.ubicacion.trim() || undefined,
              descripcion: form.descripcion.trim() || undefined
            });
            if (resG.data?.event?.htmlLink) htmlLink = resG.data.event.htmlLink;
          } else if (!modoEdicion) {
            const fnCrear = httpsCallable(functions, 'crearEventoCalendario');
            const resG = await fnCrear({
              titulo: form.titulo.trim(),
              todoElDia: form.todoElDia,
              fechaInicio: form.fechaInicio,
              fechaFin: form.todoElDia ? form.fechaInicio : form.fechaFin,
              ubicacion: form.ubicacion.trim() || undefined,
              descripcion: form.descripcion.trim() || undefined
            });
            if (resG.data?.eventId) {
              googleEventId = resG.data.eventId;
              htmlLink = resG.data.htmlLink || '';
            }
          }
        } catch (gErr) {
          console.warn('No se pudo sincronizar con Google Calendar, guardando en Firestore:', gErr);
        }
      }

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
        participantes: form.participantes || [],
        googleEventId: googleEventId || null,
        htmlLink: htmlLink || '',
        actualizadoEn: serverTimestamp()
      };

      let docIdFinal = eventoSeleccionado?.firestoreId || null;

      if (modoEdicion && docIdFinal) {
        await updateDoc(doc(db, 'workspace_eventos', docIdFinal), payloadFirestore);
      } else {
        const nuevoRef = await addDoc(collection(db, 'workspace_eventos'), {
          ...payloadFirestore,
          creadoPorEmail: currentUser?.email?.toLowerCase() || '',
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
          autorEmail: currentUser?.email?.toLowerCase() || '',
          autorNombre: userName || currentUser?.displayName || 'Sistema de Agenda',
          autorAvatar: currentUser?.photoURL || '',
          autorRol: userRole || 'Colaborador',
          creadoEn: serverTimestamp(),
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
          ultimoMensajeTexto: `📅 Evento: ${form.titulo.trim()}`,
          ultimoMensajeAutor: userName || currentUser?.displayName || 'Equipo'
        });
      }

      if (currentUser?.email) {
        registrarLogAuditoria(
          currentUser.email,
          modoEdicion ? 'Actualización de Evento (Workspace)' : 'Creación de Evento (Workspace)',
          `Evento "${form.titulo.trim()}" [${form.categoria}] guardado en Calendario Híbrido.`
        );
      }

      setModalOpen(false);
      cargarEventosGoogle();
      setSnackbar({
        open: true,
        message: modoEdicion
          ? 'Evento actualizado correctamente.'
          : 'Evento agendado y sincronizado en el espacio de trabajo.',
        severity: 'success'
      });
    } catch (err) {
      console.error('Error guardando evento:', err);
      setFormError(err.message || 'Ocurrió un error al guardar el evento.');
    } finally {
      setSaving(false);
    }
  };

  // Eliminar evento de Firestore y/o Google Calendar
  const handleEliminarEvento = async () => {
    if (!eventoSeleccionado) return;
    setDeleting(true);
    try {
      if (eventoSeleccionado.googleEventId) {
        try {
          const eliminarFn = httpsCallable(functions, 'eliminarEventoCalendario');
          await eliminarFn({ eventId: eventoSeleccionado.googleEventId });
        } catch (gErr) {
          console.warn('Error eliminando en Google Calendar:', gErr);
        }
      }
      if (eventoSeleccionado.firestoreId) {
        await deleteDoc(doc(db, 'workspace_eventos', eventoSeleccionado.firestoreId));
      }

      setConfirmDeleteOpen(false);
      setDetalleOpen(false);
      cargarEventosGoogle();
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
        autorEmail: currentUser?.email?.toLowerCase() || '',
        autorNombre: userName || currentUser?.displayName || 'Equipo',
        autorAvatar: currentUser?.photoURL || '',
        autorRol: userRole || 'Colaborador',
        creadoEn: serverTimestamp(),
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#f8fafc', overflow: 'hidden' }}>
      {/* BARRA SUPERIOR DEL CALENDARIO HÍBRIDO */}
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
                color: '#1a365d',
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
            color="#0f233c"
            sx={{ textTransform: 'capitalize', fontSize: { xs: '1.05rem', sm: '1.2rem' } }}
          >
            {nombreMes}
          </Typography>

          <Tooltip
            title={
              googleSyncStatus === 'conectado'
                ? 'Sincronizado en tiempo real con Firestore y Google Calendar (contacto@iiresodh.org)'
                : 'Almacenamiento nativo activo en Firestore'
            }
          >
            <Chip
              icon={googleSyncStatus === 'conectado' ? <Cloud size={13} /> : <Database size={13} />}
              label={googleSyncStatus === 'conectado' ? 'Híbrido: Firestore + Google Calendar' : 'Firestore Nativo'}
              size="small"
              sx={{
                bgcolor: googleSyncStatus === 'conectado' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(26, 54, 93, 0.08)',
                color: googleSyncStatus === 'conectado' ? '#059669' : '#1a365d',
                fontWeight: 600,
                fontSize: '0.72rem'
              }}
            />
          </Tooltip>
        </Box>

        {/* FILTROS, VISTA Y BOTÓN NUEVO EVENTO */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
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

          <Tooltip title="Actualizar sincronización">
            <IconButton size="small" onClick={cargarEventosGoogle} disabled={loadingGoogle}>
              <RotateCw size={17} className={loadingGoogle ? 'animate-spin' : ''} />
            </IconButton>
          </Tooltip>

          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => abrirModalNuevo()}
            sx={{
              bgcolor: '#1a365d',
              color: '#ffffff',
              textTransform: 'none',
              fontWeight: 'bold',
              borderRadius: 2,
              px: 2,
              height: 34,
              fontSize: '0.83rem',
              '&:hover': { bgcolor: '#0f233c' }
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
          {vista === 'mes' ? (
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
                          ? 'rgba(26, 54, 93, 0.03)'
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
                            bgcolor: esHoy ? '#1a365d' : 'transparent',
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
                              title={`${formatearHora(ev)} • ${ev.summary} (${cat.label})`}
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
                                  borderRadius: 1,
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
                            sx={{ fontSize: '0.68rem', color: '#1a365d', fontWeight: 'bold', pl: 0.5 }}
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
                    No hay eventos registrados en este periodo
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
                        borderRadius: 2.5,
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
                            <Typography variant="subtitle1" fontWeight="bold" color="#0f233c">
                              {ev.summary}
                            </Typography>
                            <Chip
                              label={cat.label}
                              size="small"
                              sx={{ bgcolor: cat.bg, color: cat.color, fontWeight: 'bold', fontSize: '0.7rem', height: 20 }}
                            />
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
                              <Avatar sx={{ bgcolor: '#1a365d' }}>{email.charAt(0).toUpperCase()}</Avatar>
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
          <Typography variant="subtitle2" fontWeight="800" color="#1a365d" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                    borderRadius: 2,
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
                  <Typography variant="body2" fontWeight="700" color="#0f233c" noWrap sx={{ mt: 0.2 }}>
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
      {/* MODAL CREAR / EDITAR EVENTO HÍBRIDO                                   */}
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
            <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(26, 54, 93, 0.08)', color: '#1a365d' }}>
              <CalendarIcon size={20} />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight="bold" color="#1a365d">
                {modoEdicion ? 'Editar Evento Institucional' : 'Agendar Nuevo Evento o Audiencia'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Calendario Híbrido IIRESODH (Workspace + Google Calendar)
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

          {/* TOGGLE GOOGLE CALENDAR SYNC */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 1.25,
              borderRadius: 2,
              bgcolor: 'rgba(16, 185, 129, 0.06)',
              border: '1px solid rgba(16, 185, 129, 0.25)'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Cloud size={18} color="#059669" />
              <Box>
                <Typography variant="body2" fontWeight="bold" color="#065f46" sx={{ fontSize: '0.82rem' }}>
                  Sincronizar con Google Calendar (contacto@iiresodh.org)
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Guarda en Firestore al instante y replica en Google Calendar institucional
                </Typography>
              </Box>
            </Box>
            <Switch
              name="sincronizarGoogle"
              checked={form.sincronizarGoogle}
              onChange={handleFormChange}
              color="success"
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
            sx={{ bgcolor: '#1a365d', textTransform: 'none', fontWeight: 'bold', borderRadius: 2 }}
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
                <Chip
                  label={cat.label}
                  size="small"
                  sx={{ bgcolor: cat.bg, color: cat.color, fontWeight: 'bold' }}
                />
                <IconButton size="small" onClick={() => setDetalleOpen(false)}>
                  <X size={18} />
                </IconButton>
              </DialogTitle>
              <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="h6" fontWeight="800" color="#0f233c">
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

                {/* COMPARTIR RÁPIDO EN UN CANAL DE SLACK */}
                {canalesDisponibles.filter((c) => c.tipo !== 'dm').length > 0 && (
                  <Box sx={{ pt: 1 }}>
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
                    sx={{ bgcolor: '#1a365d', textTransform: 'none', borderRadius: 2 }}
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
        <DialogTitle sx={{ fontWeight: 'bold', color: '#dc2626' }}>¿Eliminar evento?</DialogTitle>
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
