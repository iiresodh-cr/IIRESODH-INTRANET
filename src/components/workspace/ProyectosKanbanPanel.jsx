// src/components/workspace/ProyectosKanbanPanel.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  Paper,
  Chip,
  Avatar,
  AvatarGroup,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  OutlinedInput,
  LinearProgress,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Snackbar,
  Alert,
  Switch,
  InputAdornment
} from '@mui/material';
import {
  Kanban,
  ListChecks,
  Plus,
  Search,
  Calendar as CalendarIcon,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Edit3,
  FolderKanban,
  HardDrive,
  CheckCircle2,
  X,
  Lock,
  Hash,
  ShieldCheck,
  UserCheck,
  RotateCcw,
  Send
} from 'lucide-react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { sincronizarPermisosDriveConCanal } from '../../context/AuthContext';
import GoogleDriveSelectorBrowser from './GoogleDriveSelectorBrowser';

export const COLUMNAS_KANBAN = [
  { id: 'pendiente', titulo: 'Por Hacer', emoji: '📋', color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' },
  { id: 'en_curso', titulo: 'En Curso', emoji: '⚡', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  { id: 'en_revision', titulo: 'En Revisión', emoji: '🔍', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  { id: 'completado', titulo: 'Completado', emoji: '✅', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' }
];

export const PRIORIDADES_TAREA = {
  urgente: { id: 'urgente', label: '🚨 Urgente / Plazo Fatal', color: '#991b1b', bg: '#fef2f2' },
  alta: { id: 'alta', label: '🔴 Alta', color: '#9a3412', bg: '#fff7ed' },
  media: { id: 'media', label: '🔵 Media', color: '#1e40af', bg: '#eff6ff' },
  baja: { id: 'baja', label: '🟢 Baja', color: '#065f46', bg: '#ecfdf5' }
};

const PROYECTOS_INICIALES = [
  {
    slug: 'litigios-cidh',
    nombre: 'Litigios Estratégicos & CIDH',
    color: '#1a365d',
    canalId: 'litigios-y-casos',
    descripcion: 'Escritos judiciales, audiencias ante la Corte IDH y control de plazos procesales.'
  },
  {
    slug: 'gestion-administrativa',
    nombre: 'Gestión Operativa & Finanzas',
    color: '#059669',
    canalId: 'administracion',
    descripcion: 'Coordinación administrativa, conciliación, convenios y logística interna.'
  },
  {
    slug: 'comunicacion-institucional',
    nombre: 'Comunicación & Portal Web',
    color: '#2563eb',
    canalId: 'general',
    descripcion: 'Publicaciones oficiales, boletines, recursos institucionales y difusión.'
  }
];

export default function ProyectosKanbanPanel({
  currentUser,
  userName,
  userRole,
  usuariosEquipo = [],
  canalesDisponibles = [],
  canalActivoInicialId = 'general',
  onAbrirDrivePreview,
  onIrACanal
}) {
  const [proyectos, setProyectos] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [proyectoFiltro, setProyectoFiltro] = useState('todos');
  const [canalFiltro, setCanalFiltro] = useState('todos');
  const [responsableFiltro, setResponsableFiltro] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [vistaModo, setVistaModo] = useState('kanban'); // 'kanban' | 'lista'

  const userEmail = (currentUser?.email || '').toLowerCase();
  const esAdminOSuper = userRole === 'Superadmin' || userRole === 'Admin';

  // Canales de equipo seleccionables (excluyendo DMs 1 a 1)
  const canalesEquipo = useMemo(
    () => canalesDisponibles.filter((c) => c.tipo !== 'dm'),
    [canalesDisponibles]
  );

  // Modal de Nueva/Editar Tarea
  const [modalTareaOpen, setModalTareaOpen] = useState(false);
  const [mostrarSelectorDriveTarea, setMostrarSelectorDriveTarea] = useState(false);
  const [tareaEditandoId, setTareaEditandoId] = useState(null);
  const [nuevaSubtareaTexto, setNuevaSubtareaTexto] = useState('');
  const [formTarea, setFormTarea] = useState({
    titulo: '',
    descripcion: '',
    proyectoId: 'litigios-cidh',
    canalId: canalActivoInicialId || 'general',
    estado: 'pendiente',
    prioridad: 'media',
    responsables: [],
    revisorEmail: '',
    notaEntregaRevision: '',
    fechaLimite: '',
    subtareas: [],
    driveUrl: '',
    driveTitulo: '',
    agendarEnCalendario: false,
    notificarEnCanal: true
  });

  // Modal de Detalle Interactivo de Tarea
  const [tareaSeleccionada, setTareaSeleccionada] = useState(null);

  // Modal de Devolución / Solicitud de Correcciones (exclusivo Revisor)
  const [modalDevolverOpen, setModalDevolverOpen] = useState(false);
  const [tareaADevolver, setTareaADevolver] = useState(null);
  const [motivoDevolucion, setMotivoDevolucion] = useState('');

  // Modal de Nuevo Proyecto (con vinculación a canal/equipo)
  const [modalProyectoOpen, setModalProyectoOpen] = useState(false);
  const [nuevoProyecto, setNuevoProyecto] = useState({
    nombre: '',
    descripcion: '',
    color: '#1a365d',
    canalId: canalActivoInicialId || 'general'
  });

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  const obtenerNombreUsuario = useCallback(
    (email = '') => {
      if (!email) return 'Sin asignar';
      const clean = email.toLowerCase();
      const u = usuariosEquipo.find((x) => (x.email || '').toLowerCase() === clean);
      return u?.nombre || clean.split('@')[0];
    },
    [usuariosEquipo]
  );

  // Calcula los correos miembros de un canal específico
  const obtenerMiembrosDelCanal = useCallback(
    (canalIdTarget) => {
      const canal = canalesDisponibles.find((c) => c.id === canalIdTarget);
      if (!canal) return userEmail ? [userEmail] : [];
      if (canal.esPrivado) {
        return Array.from(
          new Set(
            [...(canal.miembros || []), canal.creadoPor, userEmail]
              .map((e) => (e || '').toLowerCase())
              .filter(Boolean)
          )
        );
      }
      return Array.from(
        new Set(
          [...usuariosEquipo.map((u) => u.email), canal.creadoPor, userEmail]
            .map((e) => (e || '').toLowerCase())
            .filter(Boolean)
        )
      );
    },
    [canalesDisponibles, usuariosEquipo, userEmail]
  );

  // Verifica si el usuario actual pertenece al canal/equipo del proyecto o tarea
  const usuarioPuedeVerTarea = useCallback(
    (tarea) => {
      if (!tarea) return false;
      if (esAdminOSuper) return true;
      const creador = (tarea.creadoPorEmail || tarea.creadoPor || '').toLowerCase();
      const revisor = (tarea.revisorEmail || '').toLowerCase();
      const resps = (tarea.responsables || []).map((r) => (r || '').toLowerCase());

      if (creador === userEmail || revisor === userEmail || resps.includes(userEmail)) {
        return true;
      }

      if (tarea.canalId) {
        const canal = canalesDisponibles.find((c) => c.id === tarea.canalId);
        if (!canal) return false;
        if (canal.esPrivado) {
          return obtenerMiembrosDelCanal(canal.id).includes(userEmail);
        }
        return true;
      }

      return true;
    },
    [esAdminOSuper, userEmail, canalesDisponibles, obtenerMiembrosDelCanal]
  );

  const usuarioPuedeVerProyecto = useCallback(
    (proy) => {
      if (!proy) return false;
      if (esAdminOSuper) return true;
      if (proy.canalId) {
        const canal = canalesDisponibles.find((c) => c.id === proy.canalId);
        if (!canal) return false;
        if (canal.esPrivado) {
          return obtenerMiembrosDelCanal(canal.id).includes(userEmail);
        }
      }
      return true;
    },
    [esAdminOSuper, canalesDisponibles, obtenerMiembrosDelCanal, userEmail]
  );

  // 1. Escuchar y sembrar Proyectos Institucionales
  useEffect(() => {
    const q = query(collection(db, 'workspace_proyectos'));
    const unsub = onSnapshot(
      q,
      async (snap) => {
        if (snap.empty) {
          for (const p of PROYECTOS_INICIALES) {
            await setDoc(doc(db, 'workspace_proyectos', p.slug), {
              nombre: p.nombre,
              descripcion: p.descripcion,
              color: p.color,
              canalId: p.canalId || 'general',
              creadoEn: serverTimestamp()
            });
          }
          return;
        }
        setProyectos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => console.error('Error escuchando workspace_proyectos:', err)
    );
    return () => unsub();
  }, []);

  // 2. Escuchar Tareas en tiempo real
  useEffect(() => {
    const q = query(collection(db, 'workspace_tareas'), orderBy('creadoEn', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            estado: data.estado === 'por_hacer' ? 'pendiente' : data.estado || 'pendiente'
          };
        });
        setTareas(docs);
      },
      (err) => console.error('Error escuchando workspace_tareas:', err)
    );
    return () => unsub();
  }, []);

  // Mantener actualizada la tarea seleccionada en el modal de detalle
  useEffect(() => {
    if (tareaSeleccionada) {
      const actualizada = tareas.find((t) => t.id === tareaSeleccionada.id);
      if (actualizada) setTareaSeleccionada(actualizada);
    }
  }, [tareas, tareaSeleccionada]);

  const proyectosVisibles = useMemo(
    () => proyectos.filter((p) => usuarioPuedeVerProyecto(p)),
    [proyectos, usuarioPuedeVerProyecto]
  );

  // Filtrado de tareas respetando perímetro de canal + filtros activos
  const tareasFiltradas = useMemo(() => {
    return tareas.filter((t) => {
      if (!usuarioPuedeVerTarea(t)) return false;
      if (proyectoFiltro !== 'todos' && t.proyectoId !== proyectoFiltro) return false;
      if (canalFiltro !== 'todos' && (t.canalId || 'general') !== canalFiltro) return false;

      if (responsableFiltro === '__mis_revisiones__') {
        if ((t.revisorEmail || '').toLowerCase() !== userEmail) return false;
      } else if (
        responsableFiltro !== 'todos' &&
        !(t.responsables || []).map((r) => r.toLowerCase()).includes(responsableFiltro.toLowerCase())
      ) {
        return false;
      }

      if (!busqueda.trim()) return true;
      const term = busqueda.toLowerCase();
      return (
        (t.titulo || '').toLowerCase().includes(term) ||
        (t.descripcion || '').toLowerCase().includes(term) ||
        (t.revisorNombre || '').toLowerCase().includes(term)
      );
    });
  }, [tareas, usuarioPuedeVerTarea, proyectoFiltro, canalFiltro, responsableFiltro, userEmail, busqueda]);

  // Helper de completitud de subtareas
  const evaluarSubtareas = (tarea) => {
    const lista = Array.isArray(tarea?.subtareas) ? tarea.subtareas : [];
    const total = lista.length;
    const completadas = lista.filter((s) => Boolean(s.completada)).length;
    const pct = total > 0 ? Math.round((completadas / total) * 100) : 100;
    const todasListas = total === 0 || completadas === total;
    return { total, completadas, pct, todasListas };
  };

  // Permisos de rol sobre una tarea específica
  const esRevisorDeTarea = (tarea) => {
    const rev = (tarea?.revisorEmail || tarea?.creadoPorEmail || tarea?.creadoPor || '').toLowerCase();
    return esAdminOSuper || (rev && rev === userEmail);
  };

  const esResponsableDeTarea = (tarea) => {
    const resps = (tarea?.responsables || []).map((r) => (r || '').toLowerCase());
    return esAdminOSuper || resps.includes(userEmail) || esRevisorDeTarea(tarea);
  };

  const abrirModalNuevaTarea = (estadoInicial = 'pendiente') => {
    // Nunca permitir que una tarea nazca directamente en revisión o completado
    const estadoSeguro =
      estadoInicial === 'en_revision' || estadoInicial === 'completado' ? 'pendiente' : estadoInicial;
    const proyDefaultId =
      proyectoFiltro !== 'todos' ? proyectoFiltro : proyectosVisibles[0]?.id || 'litigios-cidh';
    const proyObj = proyectosVisibles.find((p) => p.id === proyDefaultId);
    const canalDefault =
      canalFiltro !== 'todos'
        ? canalFiltro
        : proyObj?.canalId ||
          canalesEquipo.find((c) => c.id === canalActivoInicialId)?.id ||
          'general';

    setTareaEditandoId(null);
    setNuevaSubtareaTexto('');
    setFormTarea({
      titulo: '',
      descripcion: '',
      proyectoId: proyDefaultId,
      canalId: canalDefault,
      estado: estadoSeguro,
      prioridad: 'media',
      responsables: [userEmail],
      revisorEmail: userEmail,
      notaEntregaRevision: '',
      fechaLimite: '',
      subtareas: [],
      driveUrl: '',
      driveTitulo: '',
      agendarEnCalendario: false,
      notificarEnCanal: true
    });
    setModalTareaOpen(true);
  };

  const abrirModalEditarTarea = (tarea) => {
    setTareaSeleccionada(null);
    setTareaEditandoId(tarea.id);
    setNuevaSubtareaTexto('');
    setFormTarea({
      titulo: tarea.titulo || '',
      descripcion: tarea.descripcion || '',
      proyectoId: tarea.proyectoId || 'litigios-cidh',
      canalId: tarea.canalId || 'general',
      estado: tarea.estado || 'pendiente',
      prioridad: tarea.prioridad || 'media',
      responsables: tarea.responsables || [],
      revisorEmail: (tarea.revisorEmail || tarea.creadoPorEmail || userEmail).toLowerCase(),
      notaEntregaRevision: tarea.notaEntregaRevision || '',
      fechaLimite: tarea.fechaLimite || '',
      subtareas: tarea.subtareas || [],
      driveUrl: tarea.driveUrl || '',
      driveTitulo: tarea.driveTitulo || '',
      agendarEnCalendario: false,
      notificarEnCanal: false
    });
    setModalTareaOpen(true);
  };

  const handleAgregarSubtareaForm = () => {
    if (!nuevaSubtareaTexto.trim()) return;
    setFormTarea((prev) => ({
      ...prev,
      subtareas: [
        ...(prev.subtareas || []),
        { id: `sub_${Date.now()}`, texto: nuevaSubtareaTexto.trim(), completada: false }
      ]
    }));
    setNuevaSubtareaTexto('');
  };

  const handleGuardarTarea = async () => {
    if (!formTarea.titulo.trim() || !formTarea.revisorEmail) return;

    const proy = proyectos.find((p) => p.id === formTarea.proyectoId);
    const canalObj = canalesDisponibles.find((c) => c.id === formTarea.canalId);
    const miembrosDelCanal = obtenerMiembrosDelCanal(formTarea.canalId);
    const revisorClean = formTarea.revisorEmail.toLowerCase();
    const revisorNombre = obtenerNombreUsuario(revisorClean);

    // Si la tarea tiene subtareas incompletas, no puede guardarse en estado 'en_revision' ni 'completado'
    const evalSub = evaluarSubtareas({ subtareas: formTarea.subtareas });
    let estadoFinal = formTarea.estado;
    if (!evalSub.todasListas && (estadoFinal === 'en_revision' || estadoFinal === 'completado')) {
      estadoFinal = 'en_curso';
    }

    // Si hay archivo/carpeta de Google Drive vinculado, blindar permisos para los miembros del canal + responsables + revisor
    if (formTarea.driveUrl.trim()) {
      try {
        const correosAutorizadosDrive = Array.from(
          new Set([...miembrosDelCanal, ...(formTarea.responsables || []), revisorClean, userEmail])
        );
        await sincronizarPermisosDriveConCanal({
          fileIdOrUrl: formTarea.driveUrl.trim(),
          miembrosEmails: correosAutorizadosDrive,
          rolPermiso: 'writer',
          revocarUsuariosAjenos: true,
          emailHint: userEmail
        });
      } catch (e) {
        console.warn('Aviso al sincronizar permisos de Drive desde la tarea:', e);
      }
    }

    const payload = {
      titulo: formTarea.titulo.trim(),
      descripcion: formTarea.descripcion.trim(),
      proyectoId: formTarea.proyectoId,
      proyectoNombre: proy?.nombre || 'General',
      proyectoColor: proy?.color || '#1a365d',
      canalId: formTarea.canalId || 'general',
      canalNombre: canalObj?.nombre || formTarea.canalId || 'general',
      esCanalPrivado: Boolean(canalObj?.esPrivado || canalObj?.tipo === 'dm'),
      miembrosAutorizados: miembrosDelCanal,
      estado: estadoFinal,
      prioridad: formTarea.prioridad,
      responsables: formTarea.responsables || [],
      revisorEmail: revisorClean,
      revisorNombre,
      fechaLimite: formTarea.fechaLimite || '',
      subtareas: formTarea.subtareas || [],
      driveUrl: formTarea.driveUrl.trim(),
      driveTitulo:
        formTarea.driveTitulo.trim() || (formTarea.driveUrl ? 'Documento de Google Drive' : ''),
      actualizadoEn: serverTimestamp()
    };

    try {
      let idFinal = tareaEditandoId;
      if (tareaEditandoId) {
        await updateDoc(doc(db, 'workspace_tareas', tareaEditandoId), payload);
      } else {
        const ref = await addDoc(collection(db, 'workspace_tareas'), {
          ...payload,
          creadoPorEmail: userEmail,
          creadoPorNombre: userName || currentUser?.displayName || userEmail,
          creadoEn: serverTimestamp()
        });
        idFinal = ref.id;
      }

      // Si tiene fecha límite y el usuario pidió agendar en el Calendario Híbrido
      if (!tareaEditandoId && formTarea.agendarEnCalendario && formTarea.fechaLimite) {
        await addDoc(collection(db, 'workspace_eventos'), {
          titulo: `📋 Entrega: ${formTarea.titulo.trim()}`,
          categoria: formTarea.prioridad === 'urgente' ? 'plazo' : 'recordatorio',
          todoElDia: true,
          fechaInicio: formTarea.fechaLimite,
          fechaFin: formTarea.fechaLimite,
          startIso: `${formTarea.fechaLimite}T00:00:00`,
          endIso: `${formTarea.fechaLimite}T23:59:59`,
          ubicacion: `#${canalObj?.nombre || 'general'} • ${proy?.nombre || 'Proyectos'}`,
          descripcion:
            formTarea.descripcion.trim() ||
            `Fecha límite de la tarea asignada en ${proy?.nombre || 'Workspace'} (Revisor: ${revisorNombre}).`,
          participantes: Array.from(new Set([...(formTarea.responsables || []), revisorClean])),
          canalId: formTarea.canalId || 'general',
          creadoPorEmail: userEmail,
          creadoPorNombre: userName || 'Proyectos',
          creadoEn: serverTimestamp()
        });
      }

      // Publicar anuncio en el canal vinculado
      if (!tareaEditandoId && formTarea.notificarEnCanal && formTarea.canalId) {
        const prioInfo = PRIORIDADES_TAREA[formTarea.prioridad] || PRIORIDADES_TAREA.media;
        const menciones = (formTarea.responsables || [])
          .map((em) => `@${obtenerNombreUsuario(em).replace(/\s+/g, '')}`)
          .join(' ');

        await addDoc(collection(db, 'workspace_canales', formTarea.canalId, 'mensajes'), {
          texto: `📋 *Nueva tarea asignada en el canal:* *${formTarea.titulo.trim()}*\n• *Proyecto:* ${
            proy?.nombre || 'General'
          }\n• *Prioridad:* ${prioInfo.label}\n• *Ejecuta:* ${
            menciones || 'Sin asignar'
          }\n• *Revisor / Aprobador:* 🔎 @${revisorNombre.replace(/\s+/g, '')}${
            formTarea.fechaLimite ? `\n• *Fecha límite:* ${formTarea.fechaLimite}` : ''
          }`,
          autorEmail: userEmail,
          autorNombre: userName || 'Gestión de Proyectos',
          autorAvatar: currentUser?.photoURL || '',
          autorRol: userRole || 'Colaborador',
          creadoEn: serverTimestamp(),
          creadoEnMs: Date.now(),
          reacciones: {},
          fijado: false,
          respuestasCount: 0,
          tareaAdjunta: {
            id: idFinal,
            titulo: formTarea.titulo.trim(),
            proyectoNombre: proy?.nombre || 'General',
            prioridad: formTarea.prioridad,
            fechaLimite: formTarea.fechaLimite
          }
        });

        await updateDoc(doc(db, 'workspace_canales', formTarea.canalId), {
          ultimoMensajeAt: serverTimestamp(),
          ultimoMensajeMs: Date.now(),
          ultimoMensajeTexto: `📋 Tarea: ${formTarea.titulo.trim()}`,
          ultimoMensajeAutor: userName || 'Equipo'
        });
      }

      setModalTareaOpen(false);
      setSnackbar({
        open: true,
        message: tareaEditandoId
          ? 'Tarea y revisor actualizados.'
          : `Tarea creada y vinculada a #${canalObj?.nombre || formTarea.canalId}.`,
        severity: 'success'
      });
    } catch (err) {
      console.error('Error guardando tarea:', err);
    }
  };

  // =========================================================================
  // MOTOR ESTRICTO DE TRANSICIÓN DE ESTADOS Y FASE DE REVISIÓN SUPERVISADA
  // =========================================================================
  const handleCambiarEstadoTarea = async (tarea, nuevoEstado, comentarioOpcional = '') => {
    if (!tarea || tarea.estado === nuevoEstado) return;

    const { total, completadas, pct, todasListas } = evaluarSubtareas(tarea);
    const soyRevisor = esRevisorDeTarea(tarea);
    const soyResponsable = esResponsableDeTarea(tarea);
    const nombreRevisor = tarea.revisorNombre || obtenerNombreUsuario(tarea.revisorEmail || tarea.creadoPorEmail);

    // 1. Verificar que el usuario sea parte de la tarea
    if (!soyResponsable && !soyRevisor) {
      setSnackbar({
        open: true,
        message: '🔒 Solo los responsables asignados o el revisor pueden cambiar el estado de esta tarea.',
        severity: 'warning'
      });
      return;
    }

    // 2. REGLA DE COMPLETITUD DE SUBTAREAS:
    // Prohibido pasar a "En Revisión" o "Completado" si hay subtareas pendientes (< 100%)
    if ((nuevoEstado === 'en_revision' || nuevoEstado === 'completado') && !todasListas) {
      setSnackbar({
        open: true,
        message: `⚠️ Bloqueado: Faltan ${total - completadas} de ${total} subtareas por terminar (${pct}%). Debes completar el 100% de las subtareas antes de enviar a Revisión o Completado.`,
        severity: 'error'
      });
      return;
    }

    // 3. PROHIBIDO SALTAR LA FASE DE REVISIÓN:
    // Si la tarea está en "Por Hacer" o "En Curso", no puede saltar directo a "Completado"
    if (
      nuevoEstado === 'completado' &&
      tarea.estado !== 'en_revision'
    ) {
      setSnackbar({
        open: true,
        message: `🔎 Flujo de control de calidad: Primero debes pasar la tarea a "En Revisión" para que sea validada por el revisor (${nombreRevisor}).`,
        severity: 'warning'
      });
      return;
    }

    // 4. REGLA DE SEGREGACIÓN EN LA FASE DE REVISIÓN:
    // Solo el Revisor designado (o Admin/Superadmin) puede aprobar a "Completado"
    if (nuevoEstado === 'completado') {
      const esAutoRevisionSinSerRevisor =
        (tarea.revisorEmail || '').toLowerCase() &&
        (tarea.revisorEmail || '').toLowerCase() !== userEmail &&
        !esAdminOSuper;

      if (!soyRevisor || esAutoRevisionSinSerRevisor) {
        setSnackbar({
          open: true,
          message: `🔒 Aprobación exclusiva del Revisor: Solo ${nombreRevisor} puede aprobar esta tarea y moverla a Completado.`,
          severity: 'error'
        });
        return;
      }
    }

    // Construir metadatos de auditoría según la transición
    const updates = {
      estado: nuevoEstado,
      actualizadoEn: serverTimestamp()
    };

    if (nuevoEstado === 'en_revision') {
      updates.enviadoARevisionPorEmail = userEmail;
      updates.enviadoARevisionPorNombre = userName || obtenerNombreUsuario(userEmail);
      updates.enviadoARevisionEnMs = Date.now();
      updates.observacionesDevolucion = ''; // Limpia observaciones previas al reenviar
    } else if (nuevoEstado === 'completado') {
      updates.aprobadoPorEmail = userEmail;
      updates.aprobadoPorNombre = userName || obtenerNombreUsuario(userEmail);
      updates.aprobadoEnMs = Date.now();
      if (comentarioOpcional) {
        updates.comentarioAprobacion = comentarioOpcional;
      }
    } else if (nuevoEstado === 'en_curso' && tarea.estado === 'en_revision' && comentarioOpcional) {
      updates.observacionesDevolucion = comentarioOpcional;
      updates.devueltoPorNombre = userName || obtenerNombreUsuario(userEmail);
      updates.devueltoEnMs = Date.now();
      updates.aprobadoPorEmail = '';
      updates.aprobadoPorNombre = '';
    } else if (nuevoEstado === 'en_curso' || nuevoEstado === 'pendiente') {
      updates.aprobadoPorEmail = '';
      updates.aprobadoPorNombre = '';
    }

    try {
      await updateDoc(doc(db, 'workspace_tareas', tarea.id), updates);

      // Notificar en el canal vinculado cuando entra a Revisión, se Aprueba o se Devuelve
      const canalNotif = tarea.canalId;
      if (canalNotif && canalesDisponibles.some((c) => c.id === canalNotif)) {
        if (nuevoEstado === 'en_revision') {
          await addDoc(collection(db, 'workspace_canales', canalNotif, 'mensajes'), {
            texto: `🔎 *Tarea enviada a Revisión:* *${tarea.titulo}*\n• *Enviada por:* ${
              userName || userEmail
            }\n• *Revisor asignado:* @${nombreRevisor.replace(/\s+/g, '')} (Subtareas completadas: ${completadas}/${total})`,
            autorEmail: userEmail,
            autorNombre: userName || 'Proyectos',
            autorAvatar: currentUser?.photoURL || '',
            autorRol: userRole || 'Colaborador',
            creadoEn: serverTimestamp(),
            creadoEnMs: Date.now(),
            reacciones: {},
            fijado: false,
            respuestasCount: 0
          });
        } else if (nuevoEstado === 'completado') {
          await addDoc(collection(db, 'workspace_canales', canalNotif, 'mensajes'), {
            texto: `✅ *Tarea Aprobada y Completada:* *${tarea.titulo}*\n• *Aprobada por (Revisor):* ${
              userName || userEmail
            }${comentarioOpcional ? `\n• *Dictamen:* ${comentarioOpcional}` : ''}`,
            autorEmail: userEmail,
            autorNombre: userName || 'Proyectos',
            autorAvatar: currentUser?.photoURL || '',
            autorRol: userRole || 'Colaborador',
            creadoEn: serverTimestamp(),
            creadoEnMs: Date.now(),
            reacciones: {},
            fijado: false,
            respuestasCount: 0
          });
        } else if (nuevoEstado === 'en_curso' && comentarioOpcional) {
          await addDoc(collection(db, 'workspace_canales', canalNotif, 'mensajes'), {
            texto: `↩️ *Tarea devuelta a En Curso con observaciones:* *${tarea.titulo}*\n• *Revisor:* ${
              userName || userEmail
            }\n• *Correcciones solicitadas:* ${comentarioOpcional}`,
            autorEmail: userEmail,
            autorNombre: userName || 'Proyectos',
            autorAvatar: currentUser?.photoURL || '',
            autorRol: userRole || 'Colaborador',
            creadoEn: serverTimestamp(),
            creadoEnMs: Date.now(),
            reacciones: {},
            fijado: false,
            respuestasCount: 0
          });
        }
      }

      if (nuevoEstado === 'en_revision') {
        setSnackbar({
          open: true,
          message: `🔎 Tarea enviada a Revisión. Se notificó al revisor ${nombreRevisor}.`,
          severity: 'info'
        });
      } else if (nuevoEstado === 'completado') {
        setSnackbar({
          open: true,
          message: `✅ Tarea aprobada y marcada como Completada por ${userName || nombreRevisor}.`,
          severity: 'success'
        });
      } else if (comentarioOpcional) {
        setSnackbar({
          open: true,
          message: '↩️ Tarea devuelta a En Curso con observaciones para corrección.',
          severity: 'warning'
        });
      }
    } catch (err) {
      console.error('Error cambiando estado de tarea:', err);
    }
  };

  const abrirModalDevolverConObservaciones = (tarea) => {
    setTareaADevolver(tarea);
    setMotivoDevolucion('');
    setModalDevolverOpen(true);
  };

  const handleConfirmarDevolucion = async () => {
    if (!tareaADevolver || !motivoDevolucion.trim()) return;
    await handleCambiarEstadoTarea(tareaADevolver, 'en_curso', motivoDevolucion.trim());
    setModalDevolverOpen(false);
    setTareaADevolver(null);
    setMotivoDevolucion('');
  };

  // Alternar subtarea: si se desmarca una subtarea de una tarea que estaba en Revisión o Completado,
  // regresa automáticamente a "En Curso" para impedir inconsistencias
  const handleToggleSubtarea = async (tarea, subtareaId) => {
    if (!esResponsableDeTarea(tarea)) {
      setSnackbar({
        open: true,
        message: 'Solo los responsables o el revisor pueden marcar subtareas.',
        severity: 'warning'
      });
      return;
    }

    const nuevas = (tarea.subtareas || []).map((s) =>
      s.id === subtareaId ? { ...s, completada: !s.completada } : s
    );
    const quedanIncompletas = nuevas.some((s) => !s.completada);

    const payload = {
      subtareas: nuevas,
      actualizadoEn: serverTimestamp()
    };

    if (quedanIncompletas && (tarea.estado === 'en_revision' || tarea.estado === 'completado')) {
      payload.estado = 'en_curso';
      payload.aprobadoPorEmail = '';
      payload.aprobadoPorNombre = '';
    }

    try {
      await updateDoc(doc(db, 'workspace_tareas', tarea.id), payload);
      if (quedanIncompletas && (tarea.estado === 'en_revision' || tarea.estado === 'completado')) {
        setSnackbar({
          open: true,
          message: '↩️ Al quedar subtareas pendientes, la tarea regresó automáticamente a "En Curso".',
          severity: 'info'
        });
      }
    } catch (err) {
      console.error('Error actualizando subtarea:', err);
    }
  };

  const handleEliminarTarea = async (tareaId) => {
    try {
      await deleteDoc(doc(db, 'workspace_tareas', tareaId));
      setTareaSeleccionada(null);
      setSnackbar({
        open: true,
        message: 'Tarea eliminada del proyecto.',
        severity: 'info'
      });
    } catch (err) {
      console.error('Error eliminando tarea:', err);
    }
  };

  // Crear nuevo proyecto vinculado a un canal/equipo
  const handleCrearProyecto = async () => {
    if (!nuevoProyecto.nombre.trim()) return;
    const slug = nuevoProyecto.nombre
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '');

    const canalObj = canalesDisponibles.find((c) => c.id === nuevoProyecto.canalId);

    await setDoc(doc(db, 'workspace_proyectos', slug || `proy_${Date.now()}`), {
      nombre: nuevoProyecto.nombre.trim(),
      descripcion: nuevoProyecto.descripcion.trim(),
      color: nuevoProyecto.color || '#1a365d',
      canalId: nuevoProyecto.canalId || 'general',
      canalNombre: canalObj?.nombre || nuevoProyecto.canalId || 'general',
      esCanalPrivado: Boolean(canalObj?.esPrivado),
      creadoPorEmail: userEmail,
      creadoEn: serverTimestamp()
    });

    setModalProyectoOpen(false);
    setNuevoProyecto({
      nombre: '',
      descripcion: '',
      color: '#1a365d',
      canalId: canalActivoInicialId || 'general'
    });
    setSnackbar({
      open: true,
      message: `Proyecto creado y vinculado al canal #${canalObj?.nombre || nuevoProyecto.canalId}.`,
      severity: 'success'
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#f8fafc', overflow: 'hidden' }}>
      {/* BARRA SUPERIOR DE PROYECTOS Y TAREAS */}
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          py: 1.5,
          bgcolor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              bgcolor: 'rgba(26, 54, 93, 0.08)',
              color: '#1a365d',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <FolderKanban size={20} />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="subtitle1" fontWeight="800" color="#0f233c" sx={{ lineHeight: 1.2 }}>
                Seguimiento de Proyectos y Tareas
              </Typography>
              <Chip
                icon={<ShieldCheck size={13} color="#166534" />}
                label="Control de Revisión y Canales Activo"
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.67rem',
                  fontWeight: 700,
                  bgcolor: '#dcfce7',
                  color: '#166534'
                }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              Vinculado por canal/equipo • Requiere 100% de subtareas para Revisión y aprobación del Revisor asignado
            </Typography>
          </Box>
        </Box>

        {/* ACCIONES: VISTA KANBAN/LISTA + NUEVO PROYECTO + NUEVA TAREA */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <ToggleButtonGroup
            size="small"
            value={vistaModo}
            exclusive
            onChange={(_, val) => val && setVistaModo(val)}
            sx={{ height: 34 }}
          >
            <ToggleButton value="kanban" sx={{ textTransform: 'none', px: 1.5, fontSize: '0.8rem', fontWeight: 700 }}>
              <Kanban size={15} style={{ marginRight: 6 }} />
              Tablero Kanban
            </ToggleButton>
            <ToggleButton value="lista" sx={{ textTransform: 'none', px: 1.5, fontSize: '0.8rem', fontWeight: 700 }}>
              <ListChecks size={15} style={{ marginRight: 6 }} />
              Vista de Lista
            </ToggleButton>
          </ToggleButtonGroup>

          <Button
            size="small"
            variant="outlined"
            startIcon={<Plus size={15} />}
            onClick={() => setModalProyectoOpen(true)}
            sx={{
              textTransform: 'none',
              borderRadius: 2,
              fontWeight: 600,
              fontSize: '0.78rem',
              height: 34,
              borderColor: '#cbd5e1',
              color: '#1a365d'
            }}
          >
            Nuevo Proyecto
          </Button>

          <Button
            size="small"
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => abrirModalNuevaTarea('pendiente')}
            sx={{
              bgcolor: '#1a365d',
              color: '#ffffff',
              textTransform: 'none',
              fontWeight: 'bold',
              borderRadius: 2,
              px: 2,
              height: 34,
              fontSize: '0.8rem',
              '&:hover': { bgcolor: '#0f233c' }
            }}
          >
            Nueva Tarea
          </Button>
        </Box>
      </Box>

      {/* SUB-BARRA DE FILTROS POR PROYECTO, CANAL, RESPONSABLE/REVISOR Y BUSCADOR */}
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          py: 1,
          bgcolor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <Chip
            label={`Todos (${tareasFiltradas.length})`}
            size="small"
            onClick={() => setProyectoFiltro('todos')}
            sx={{
              fontWeight: 700,
              fontSize: '0.75rem',
              cursor: 'pointer',
              bgcolor: proyectoFiltro === 'todos' ? '#0f233c' : '#f1f5f9',
              color: proyectoFiltro === 'todos' ? '#ffffff' : '#475569'
            }}
          />
          {proyectosVisibles.map((p) => {
            const chProy = canalesDisponibles.find((c) => c.id === p.canalId);
            return (
              <Chip
                key={p.id}
                label={chProy?.esPrivado ? `🔒 ${p.nombre}` : p.nombre}
                size="small"
                onClick={() => setProyectoFiltro(p.id)}
                sx={{
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  bgcolor: proyectoFiltro === p.id ? p.color || '#1a365d' : '#f1f5f9',
                  color: proyectoFiltro === p.id ? '#ffffff' : '#334155'
                }}
              />
            );
          })}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {/* FILTRO POR CANAL / EQUIPO */}
          <FormControl size="small" sx={{ minWidth: 165 }}>
            <Select
              value={canalFiltro}
              onChange={(e) => setCanalFiltro(e.target.value)}
              sx={{ height: 32, fontSize: '0.76rem', borderRadius: 2, bgcolor: '#f8fafc', fontWeight: 700 }}
            >
              <MenuItem value="todos" sx={{ fontSize: '0.76rem' }}>
                Todos mis canales
              </MenuItem>
              {canalesEquipo.map((c) => (
                <MenuItem key={c.id} value={c.id} sx={{ fontSize: '0.76rem' }}>
                  {c.esPrivado ? `🔒 #${c.nombre}` : `#${c.nombre}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* FILTRO POR RESPONSABLE O REVISOR */}
          <FormControl size="small" sx={{ minWidth: 175 }}>
            <Select
              value={responsableFiltro}
              onChange={(e) => setResponsableFiltro(e.target.value)}
              sx={{ height: 32, fontSize: '0.76rem', borderRadius: 2, bgcolor: '#f8fafc' }}
            >
              <MenuItem value="todos" sx={{ fontSize: '0.76rem' }}>
                Todos los responsables
              </MenuItem>
              <MenuItem value={userEmail} sx={{ fontSize: '0.76rem', fontWeight: 'bold' }}>
                👤 Mis tareas por ejecutar
              </MenuItem>
              <MenuItem value="__mis_revisiones__" sx={{ fontSize: '0.76rem', fontWeight: 'bold', color: '#b45309' }}>
                🔎 Asignadas a mí como Revisor
              </MenuItem>
              <Divider />
              {usuariosEquipo.map((u) => (
                <MenuItem key={u.email} value={u.email} sx={{ fontSize: '0.76rem' }}>
                  {u.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            placeholder="Buscar tarea..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            sx={{ width: { xs: 140, sm: 190 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={14} color="#64748b" />
                  </InputAdornment>
                ),
                sx: { height: 32, fontSize: '0.78rem', borderRadius: 2, bgcolor: '#f8fafc' }
              }
            }}
          />
        </Box>
      </Box>

      {/* ===================================================================== */}
      {/* CUERPO PRINCIPAL: VISTA TABLERO KANBAN O VISTA DE LISTA               */}
      {/* ===================================================================== */}
      <Box sx={{ flexGrow: 1, p: { xs: 1.5, sm: 2.5 }, overflow: 'auto' }}>
        {vistaModo === 'kanban' ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(260px, 1fr))',
                lg: 'repeat(4, minmax(255px, 1fr))'
              },
              gap: 2,
              alignItems: 'flex-start',
              minHeight: '100%'
            }}
          >
            {COLUMNAS_KANBAN.map((col, colIndex) => {
              const tareasColumna = tareasFiltradas.filter((t) => t.estado === col.id);
              const permiteCrearDirecto = col.id === 'pendiente' || col.id === 'en_curso';

              return (
                <Paper
                  key={col.id}
                  elevation={0}
                  sx={{
                    p: 1.5,
                    borderRadius: 3,
                    bgcolor: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.25,
                    minHeight: 420
                  }}
                >
                  {/* CABECERA DE COLUMNA KANBAN */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      px: 0.75,
                      py: 0.5
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>{col.emoji}</span>
                      <Typography variant="subtitle2" fontWeight="800" color="#0f233c">
                        {col.titulo}
                      </Typography>
                      <Chip
                        label={tareasColumna.length}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          bgcolor: col.bg,
                          color: col.color,
                          border: `1px solid ${col.border}`
                        }}
                      />
                    </Box>

                    {permiteCrearDirecto && (
                      <Tooltip title={`Añadir tarea en ${col.titulo}`}>
                        <IconButton size="small" onClick={() => abrirModalNuevaTarea(col.id)}>
                          <Plus size={16} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>

                  {/* TARJETAS DE LA COLUMNA */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                    {tareasColumna.map((tarea) => {
                      const prio = PRIORIDADES_TAREA[tarea.prioridad] || PRIORIDADES_TAREA.media;
                      const { total: totalSub, completadas: compSub, pct: pctSub, todasListas } =
                        evaluarSubtareas(tarea);
                      const soyRevisor = esRevisorDeTarea(tarea);
                      const nombreRevisor =
                        tarea.revisorNombre || obtenerNombreUsuario(tarea.revisorEmail || tarea.creadoPorEmail);
                      const canalTarea = canalesDisponibles.find((c) => c.id === tarea.canalId);
                      const inconsistenteEnCompletado =
                        (tarea.estado === 'completado' || tarea.estado === 'en_revision') && !todasListas;

                      return (
                        <Paper
                          key={tarea.id}
                          elevation={0}
                          onClick={() => setTareaSeleccionada(tarea)}
                          sx={{
                            p: 1.75,
                            borderRadius: '0 10px 10px 0',
                            bgcolor: '#ffffff',
                            border: inconsistenteEnCompletado
                              ? '1.5px solid #ef4444'
                              : '1px solid #e2e8f0',
                            borderLeft: `4px solid ${
                              inconsistenteEnCompletado ? '#dc2626' : tarea.proyectoColor || '#1a365d'
                            }`,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: '0 6px 16px rgba(15, 35, 60, 0.08)'
                            }
                          }}
                        >
                          {/* PROYECTO, CANAL Y PRIORIDAD */}
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 0.5,
                              mb: 0.6,
                              flexWrap: 'wrap'
                            }}
                          >
                            <Typography
                              variant="caption"
                              fontWeight="800"
                              noWrap
                              sx={{ color: tarea.proyectoColor || '#1a365d', fontSize: '0.67rem' }}
                            >
                              {tarea.proyectoNombre || 'General'}
                            </Typography>
                            <Chip
                              label={prio.label}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                bgcolor: prio.bg,
                                color: prio.color
                              }}
                            />
                          </Box>

                          {/* CANAL / EQUIPO VINCULADO */}
                          {tarea.canalId && (
                            <Box sx={{ mb: 0.75 }}>
                              <Chip
                                icon={
                                  canalTarea?.esPrivado || tarea.esCanalPrivado ? (
                                    <Lock size={10} color="#92400e" />
                                  ) : (
                                    <Hash size={10} color="#1D3557" />
                                  )
                                }
                                label={`#${canalTarea?.nombre || tarea.canalNombre || tarea.canalId}`}
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: '0.63rem',
                                  fontWeight: 700,
                                  bgcolor:
                                    canalTarea?.esPrivado || tarea.esCanalPrivado
                                      ? '#fef3c7'
                                      : '#f1f5f9',
                                  color:
                                    canalTarea?.esPrivado || tarea.esCanalPrivado
                                      ? '#92400e'
                                      : '#334155'
                                }}
                              />
                            </Box>
                          )}

                          {/* TÍTULO DE LA TAREA */}
                          <Typography variant="body2" fontWeight="700" color="#0f233c" sx={{ lineHeight: 1.35, mb: 0.75 }}>
                            {tarea.titulo}
                          </Typography>

                          {/* ALERTA SI FUE DEVUELTA CON OBSERVACIONES POR EL REVISOR */}
                          {tarea.observacionesDevolucion && tarea.estado === 'en_curso' && (
                            <Box
                              sx={{
                                p: 1,
                                mb: 1,
                                borderRadius: 1.5,
                                bgcolor: '#fffbeb',
                                border: '1px solid #fde68a'
                              }}
                            >
                              <Typography variant="caption" fontWeight="800" color="#92400e" sx={{ display: 'block', fontSize: '0.66rem' }}>
                                ↩️ Corrección solicitada por {tarea.devueltoPorNombre || nombreRevisor}:
                              </Typography>
                              <Typography variant="caption" color="#78350f" sx={{ fontSize: '0.68rem', display: 'block' }}>
                                {tarea.observacionesDevolucion}
                              </Typography>
                            </Box>
                          )}

                          {/* ALERTA DE INCONSISTENCIA (EJ. TAREA ANTIGUA EN COMPLETADO CON 1/3 SUBTAREAS) */}
                          {inconsistenteEnCompletado && (
                            <Box
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCambiarEstadoTarea(
                                  tarea,
                                  'en_curso',
                                  'Regresada automáticamente por tener subtareas incompletas.'
                                );
                              }}
                              sx={{
                                p: 0.85,
                                mb: 1,
                                borderRadius: 1.5,
                                bgcolor: '#fef2f2',
                                border: '1px solid #fecaca',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 0.5
                              }}
                            >
                              <Typography variant="caption" fontWeight="800" color="#b91c1c" sx={{ fontSize: '0.66rem' }}>
                                ⚠️ Subtareas incompletas ({compSub}/{totalSub})
                              </Typography>
                              <Chip
                                label="↩️ Volver a En Curso"
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: '0.62rem',
                                  fontWeight: 800,
                                  bgcolor: '#dc2626',
                                  color: '#ffffff',
                                  cursor: 'pointer'
                                }}
                              />
                            </Box>
                          )}

                          {/* BARRA DE PROGRESO DE SUBTAREAS */}
                          {totalSub > 0 && (
                            <Box sx={{ mb: 1 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                                  Subtareas {todasListas ? '✓' : '(Requerido 100%)'}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  fontWeight="bold"
                                  sx={{
                                    fontSize: '0.68rem',
                                    color: todasListas ? '#047857' : '#b45309'
                                  }}
                                >
                                  {compSub}/{totalSub} ({pctSub}%)
                                </Typography>
                              </Box>
                              <LinearProgress
                                variant="determinate"
                                value={pctSub}
                                color={todasListas ? 'success' : 'primary'}
                                sx={{ height: 5, borderRadius: 2 }}
                              />
                            </Box>
                          )}

                          {/* VINCULO GOOGLE DRIVE SI TIENE */}
                          {tarea.driveUrl && (
                            <Chip
                              icon={<HardDrive size={12} />}
                              label={tarea.driveTitulo || 'Archivo Drive'}
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onAbrirDrivePreview) {
                                  onAbrirDrivePreview({
                                    id: `task_drive_${tarea.id}`,
                                    titulo: tarea.driveTitulo || tarea.titulo,
                                    url: tarea.driveUrl,
                                    tipo: 'doc'
                                  });
                                }
                              }}
                              sx={{
                                mb: 1,
                                height: 21,
                                fontSize: '0.68rem',
                                fontWeight: 600,
                                bgcolor: '#eff6ff',
                                color: '#1d4ed8',
                                maxWidth: '100%'
                              }}
                            />
                          )}

                          {/* REVISOR ASIGNADO Y SELLO DE APROBACIÓN */}
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 0.5,
                              mb: 0.75,
                              px: 0.75,
                              py: 0.4,
                              borderRadius: 1.5,
                              bgcolor: '#f8fafc',
                              border: '1px solid #f1f5f9'
                            }}
                          >
                            <Typography variant="caption" color="#475569" sx={{ fontSize: '0.66rem', fontWeight: 600 }} noWrap>
                              🔎 Revisa: <strong>{nombreRevisor}</strong>
                            </Typography>
                            {tarea.estado === 'completado' && tarea.aprobadoPorNombre && (
                              <Tooltip title={`Aprobado por ${tarea.aprobadoPorNombre}`}>
                                <CheckCircle2 size={13} color="#047857" />
                              </Tooltip>
                            )}
                          </Box>

                          {/* PANEL DE DICTAMEN RÁPIDO CUANDO ESTÁ EN REVISIÓN */}
                          {tarea.estado === 'en_revision' && (
                            <Box
                              onClick={(e) => e.stopPropagation()}
                              sx={{
                                mt: 0.75,
                                mb: 0.75,
                                p: 1,
                                borderRadius: 1.5,
                                bgcolor: soyRevisor ? '#ecfdf5' : '#fffbeb',
                                border: soyRevisor ? '1px solid #a7f3d0' : '1px solid #fde68a'
                              }}
                            >
                              {soyRevisor ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                                  <Typography variant="caption" fontWeight="800" color="#065f46" sx={{ fontSize: '0.66rem' }}>
                                    🔎 Eres el Revisor de esta entrega:
                                  </Typography>
                                  <Box sx={{ display: 'flex', gap: 0.75 }}>
                                    <Button
                                      size="small"
                                      variant="contained"
                                      color="success"
                                      fullWidth
                                      disabled={!todasListas}
                                      onClick={() =>
                                        handleCambiarEstadoTarea(tarea, 'completado', 'Entrega verificada y aprobada.')
                                      }
                                      sx={{ textTransform: 'none', fontSize: '0.68rem', fontWeight: 800, py: 0.25 }}
                                    >
                                      ✓ Aprobar
                                    </Button>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="warning"
                                      fullWidth
                                      onClick={() => abrirModalDevolverConObservaciones(tarea)}
                                      sx={{ textTransform: 'none', fontSize: '0.68rem', fontWeight: 700, py: 0.25 }}
                                    >
                                      ↩️ Devolver
                                    </Button>
                                  </Box>
                                </Box>
                              ) : (
                                <Typography variant="caption" color="#92400e" sx={{ fontSize: '0.66rem', display: 'block', fontWeight: 600 }}>
                                  ⏳ Pendiente de revisión y aprobación por <strong>{nombreRevisor}</strong>
                                </Typography>
                              )}
                            </Box>
                          )}

                          {/* PIE DE TARJETA: FECHA, RESPONSABLES Y CONTROLES DE FLUJO */}
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {tarea.fechaLimite && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.4,
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    color: '#475569'
                                  }}
                                >
                                  <CalendarIcon size={12} />
                                  {tarea.fechaLimite}
                                </Typography>
                              )}

                              {(tarea.responsables || []).length > 0 && (
                                <AvatarGroup
                                  max={3}
                                  sx={{ '& .MuiAvatar-root': { width: 22, height: 22, fontSize: '0.65rem', bgcolor: '#1a365d' } }}
                                >
                                  {tarea.responsables.map((em) => (
                                    <Tooltip key={em} title={`Ejecuta: ${obtenerNombreUsuario(em)}`}>
                                      <Avatar>{obtenerNombreUsuario(em).charAt(0).toUpperCase()}</Avatar>
                                    </Tooltip>
                                  ))}
                                </AvatarGroup>
                              )}
                            </Box>

                            {/* BOTONES DE AVANCE CON REGLAS DE NEGOCIO */}
                            <Box sx={{ display: 'flex', gap: 0.25 }} onClick={(e) => e.stopPropagation()}>
                              {colIndex > 0 && tarea.estado !== 'en_revision' && (
                                <Tooltip title={`Regresar a ${COLUMNAS_KANBAN[colIndex - 1].titulo}`}>
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      handleCambiarEstadoTarea(tarea, COLUMNAS_KANBAN[colIndex - 1].id)
                                    }
                                    sx={{ p: 0.3 }}
                                  >
                                    <ArrowLeft size={14} />
                                  </IconButton>
                                </Tooltip>
                              )}

                              {tarea.estado === 'pendiente' && (
                                <Tooltip title="Iniciar tarea (Mover a En Curso)">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleCambiarEstadoTarea(tarea, 'en_curso')}
                                    sx={{ p: 0.3, color: '#2563eb' }}
                                  >
                                    <ArrowRight size={14} />
                                  </IconButton>
                                </Tooltip>
                              )}

                              {tarea.estado === 'en_curso' && (
                                <Tooltip
                                  title={
                                    todasListas
                                      ? `Enviar a Revisión de ${nombreRevisor}`
                                      : `Completa primero todas las subtareas (${compSub}/${totalSub}) para enviar a Revisión`
                                  }
                                >
                                  <span>
                                    <Button
                                      size="small"
                                      variant={todasListas ? 'contained' : 'outlined'}
                                      disabled={!todasListas}
                                      onClick={() => handleCambiarEstadoTarea(tarea, 'en_revision')}
                                      sx={{
                                        textTransform: 'none',
                                        fontSize: '0.66rem',
                                        fontWeight: 700,
                                        py: 0.2,
                                        px: 0.9,
                                        minWidth: 'auto',
                                        borderRadius: 1.25,
                                        ...(todasListas
                                          ? { bgcolor: '#b45309', '&:hover': { bgcolor: '#92400e' } }
                                          : {})
                                      }}
                                    >
                                      🔎 Solicitar Revisión
                                    </Button>
                                  </span>
                                </Tooltip>
                              )}
                            </Box>
                          </Box>
                        </Paper>
                      );
                    })}
                  </Box>
                </Paper>
              );
            })}
          </Box>
        ) : (
          /* VISTA DE LISTA / TABLA EJECUTIVA */
          <TableContainer
            component={Paper}
            elevation={0}
            sx={{ borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}
          >
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Tarea</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Canal / Equipo</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Estado</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Subtareas</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Ejecuta</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Revisor</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Fecha Límite</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="right">
                    Acciones
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tareasFiltradas.map((tarea) => {
                  const { total: totalSub, completadas: compSub, todasListas } = evaluarSubtareas(tarea);
                  const soyRevisor = esRevisorDeTarea(tarea);
                  const nombreRevisor =
                    tarea.revisorNombre || obtenerNombreUsuario(tarea.revisorEmail || tarea.creadoPorEmail);

                  return (
                    <TableRow
                      key={tarea.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => setTareaSeleccionada(tarea)}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight="700" color="#0f233c">
                          {tarea.titulo}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {tarea.proyectoNombre || 'General'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`#${tarea.canalNombre || tarea.canalId || 'general'}`}
                          size="small"
                          sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          size="small"
                          value={tarea.estado}
                          onChange={(e) => handleCambiarEstadoTarea(tarea, e.target.value)}
                          sx={{ height: 28, fontSize: '0.75rem', borderRadius: 1.5 }}
                        >
                          {COLUMNAS_KANBAN.map((c) => {
                            const deshabilitadoPorSubtareas =
                              (c.id === 'en_revision' || c.id === 'completado') && !todasListas;
                            const deshabilitadoPorRevisor = c.id === 'completado' && !soyRevisor;
                            return (
                              <MenuItem
                                key={c.id}
                                value={c.id}
                                disabled={deshabilitadoPorSubtareas || deshabilitadoPorRevisor}
                                sx={{ fontSize: '0.75rem' }}
                              >
                                {c.emoji} {c.titulo}
                                {deshabilitadoPorSubtareas ? ' (Completa subtareas)' : ''}
                                {deshabilitadoPorRevisor ? ` (Solo ${nombreRevisor})` : ''}
                              </MenuItem>
                            );
                          })}
                        </Select>
                      </TableCell>
                      <TableCell>
                        {totalSub > 0 ? (
                          <Chip
                            label={`${compSub}/${totalSub}`}
                            size="small"
                            color={todasListas ? 'success' : 'warning'}
                            sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }}
                          />
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <AvatarGroup
                          max={3}
                          sx={{
                            justifyContent: 'flex-start',
                            '& .MuiAvatar-root': { width: 24, height: 24, fontSize: '0.7rem', bgcolor: '#1a365d' }
                          }}
                        >
                          {(tarea.responsables || []).map((em) => (
                            <Avatar key={em} title={obtenerNombreUsuario(em)}>
                              {obtenerNombreUsuario(em).charAt(0).toUpperCase()}
                            </Avatar>
                          ))}
                        </AvatarGroup>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={<UserCheck size={12} />}
                          label={nombreRevisor}
                          size="small"
                          sx={{ height: 21, fontSize: '0.7rem', fontWeight: 700, bgcolor: '#fffbeb', color: '#92400e' }}
                        />
                      </TableCell>
                      <TableCell>{tarea.fechaLimite || '—'}</TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <IconButton size="small" onClick={() => abrirModalEditarTarea(tarea)}>
                          <Edit3 size={14} />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleEliminarTarea(tarea.id)}>
                          <Trash2 size={14} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* ===================================================================== */}
      {/* MODAL DE DETALLE DE TAREA, CHECKLIST Y DICTAMEN DE REVISIÓN           */}
      {/* ===================================================================== */}
      <Dialog
        open={Boolean(tareaSeleccionada)}
        onClose={() => setTareaSeleccionada(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        {tareaSeleccionada &&
          (() => {
            const { total: totalSub, completadas: compSub, todasListas } = evaluarSubtareas(tareaSeleccionada);
            const soyRevisor = esRevisorDeTarea(tareaSeleccionada);
            const nombreRevisor =
              tareaSeleccionada.revisorNombre ||
              obtenerNombreUsuario(tareaSeleccionada.revisorEmail || tareaSeleccionada.creadoPorEmail);

            return (
              <>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={tareaSeleccionada.proyectoNombre || 'Proyecto'}
                      size="small"
                      sx={{ bgcolor: '#1a365d', color: '#ffffff', fontWeight: 'bold' }}
                    />
                    {tareaSeleccionada.canalId && (
                      <Chip
                        icon={<Hash size={12} />}
                        label={`#${tareaSeleccionada.canalNombre || tareaSeleccionada.canalId}`}
                        size="small"
                        sx={{ fontWeight: 700 }}
                      />
                    )}
                  </Box>
                  <IconButton size="small" onClick={() => setTareaSeleccionada(null)}>
                    <X size={18} />
                  </IconButton>
                </DialogTitle>
                <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="h6" fontWeight="800" color="#0f233c">
                    {tareaSeleccionada.titulo}
                  </Typography>

                  {/* FICHA DE ROLES: EJECUTORES VS REVISOR */}
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                      gap: 1.5
                    }}
                  >
                    <Box>
                      <Typography variant="caption" fontWeight="800" color="text.secondary" sx={{ display: 'block' }}>
                        👤 EJECUTOR(ES) RESPONSABLES
                      </Typography>
                      <Typography variant="body2" fontWeight="700" color="#0f233c">
                        {(tareaSeleccionada.responsables || []).map((em) => obtenerNombreUsuario(em)).join(', ') ||
                          'Sin asignar'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" fontWeight="800" color="#b45309" sx={{ display: 'block' }}>
                        🔎 REVISOR / APROBADOR
                      </Typography>
                      <Typography variant="body2" fontWeight="800" color="#92400e">
                        {nombreRevisor}
                      </Typography>
                    </Box>
                  </Paper>

                  {tareaSeleccionada.observacionesDevolucion && (
                    <Alert severity="warning" sx={{ borderRadius: 2 }}>
                      <strong>Observaciones de revisión ({tareaSeleccionada.devueltoPorNombre || nombreRevisor}):</strong>{' '}
                      {tareaSeleccionada.observacionesDevolucion}
                    </Alert>
                  )}

                  {tareaSeleccionada.estado === 'completado' && tareaSeleccionada.aprobadoPorNombre && (
                    <Alert severity="success" sx={{ borderRadius: 2 }}>
                      <strong>Aprobada en Revisión por:</strong> {tareaSeleccionada.aprobadoPorNombre}
                      {tareaSeleccionada.comentarioAprobacion ? ` — "${tareaSeleccionada.comentarioAprobacion}"` : ''}
                    </Alert>
                  )}

                  {tareaSeleccionada.descripcion && (
                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                      {tareaSeleccionada.descripcion}
                    </Typography>
                  )}

                  {/* VINCULO DE GOOGLE DRIVE */}
                  {tareaSeleccionada.driveUrl && (
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <HardDrive size={18} color="#1d4ed8" />
                        <Typography variant="body2" fontWeight="bold" color="#1e3a8a">
                          {tareaSeleccionada.driveTitulo || 'Documento de Google Drive vinculado'}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => {
                          const item = {
                            id: `task_drive_${tareaSeleccionada.id}`,
                            titulo: tareaSeleccionada.driveTitulo || tareaSeleccionada.titulo,
                            url: tareaSeleccionada.driveUrl,
                            tipo: 'doc'
                          };
                          setTareaSeleccionada(null);
                          if (onAbrirDrivePreview) onAbrirDrivePreview(item);
                        }}
                        sx={{ textTransform: 'none', borderRadius: 1.5, bgcolor: '#1d4ed8', fontSize: '0.75rem' }}
                      >
                        Abrir en Visor Drive
                      </Button>
                    </Paper>
                  )}

                  {/* CHECKLIST DE SUBTAREAS INTERACTIVO */}
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" fontWeight="bold" color="text.secondary">
                        CHECKLIST DE SUBTAREAS ({compSub}/{totalSub})
                      </Typography>
                      {totalSub > 0 && !todasListas && (
                        <Chip
                          label="Obligatorio 100% para enviar a Revisión"
                          size="small"
                          color="warning"
                          sx={{ height: 19, fontSize: '0.65rem', fontWeight: 700 }}
                        />
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1 }}>
                      {totalSub === 0 ? (
                        <Typography variant="caption" color="text.secondary" fontStyle="italic">
                          Sin subtareas registradas.
                        </Typography>
                      ) : (
                        tareaSeleccionada.subtareas.map((sub) => (
                          <Paper
                            key={sub.id}
                            elevation={0}
                            onClick={() => handleToggleSubtarea(tareaSeleccionada, sub.id)}
                            sx={{
                              p: 1,
                              borderRadius: 2,
                              border: '1px solid #e2e8f0',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              cursor: 'pointer',
                              bgcolor: sub.completada ? '#f8fafc' : '#ffffff'
                            }}
                          >
                            <Checkbox size="small" checked={Boolean(sub.completada)} sx={{ p: 0.25 }} />
                            <Typography
                              variant="body2"
                              sx={{
                                textDecoration: sub.completada ? 'line-through' : 'none',
                                color: sub.completada ? 'text.secondary' : 'text.primary'
                              }}
                            >
                              {sub.texto}
                            </Typography>
                          </Paper>
                        ))
                      )}
                    </Box>
                  </Box>

                  {/* BOTONES DE FLUJO DE REVISIÓN DENTRO DEL MODAL */}
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 1
                    }}
                  >
                    <Typography variant="caption" fontWeight="800" color="#1D3557">
                      Estado actual: {COLUMNAS_KANBAN.find((c) => c.id === tareaSeleccionada.estado)?.emoji}{' '}
                      {COLUMNAS_KANBAN.find((c) => c.id === tareaSeleccionada.estado)?.titulo}
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {tareaSeleccionada.estado === 'pendiente' && (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleCambiarEstadoTarea(tareaSeleccionada, 'en_curso')}
                          sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#1d4ed8', borderRadius: 1.5 }}
                        >
                          ⚡ Iniciar (Pasar a En Curso)
                        </Button>
                      )}

                      {tareaSeleccionada.estado === 'en_curso' && (
                        <Button
                          size="small"
                          variant="contained"
                          disabled={!todasListas}
                          startIcon={<Send size={14} />}
                          onClick={() => handleCambiarEstadoTarea(tareaSeleccionada, 'en_revision')}
                          sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#b45309', borderRadius: 1.5 }}
                        >
                          {todasListas
                            ? `Enviar a Revisión de ${nombreRevisor}`
                            : `Completa las subtareas (${compSub}/${totalSub})`}
                        </Button>
                      )}

                      {tareaSeleccionada.estado === 'en_revision' && soyRevisor && (
                        <>
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            startIcon={<RotateCcw size={14} />}
                            onClick={() => abrirModalDevolverConObservaciones(tareaSeleccionada)}
                            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5 }}
                          >
                            Devolver con Observaciones
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            disabled={!todasListas}
                            startIcon={<CheckCircle2 size={14} />}
                            onClick={() =>
                              handleCambiarEstadoTarea(
                                tareaSeleccionada,
                                'completado',
                                'Aprobado tras revisión.'
                              )
                            }
                            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5 }}
                          >
                            Aprobar y Completar
                          </Button>
                        </>
                      )}

                      {tareaSeleccionada.estado === 'en_revision' && !soyRevisor && (
                        <Chip
                          label={`Esperando aprobación de ${nombreRevisor}`}
                          size="small"
                          sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700 }}
                        />
                      )}
                    </Box>
                  </Paper>
                </DialogContent>
                <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
                  <Button
                    color="error"
                    size="small"
                    startIcon={<Trash2 size={15} />}
                    onClick={() => handleEliminarTarea(tareaSeleccionada.id)}
                    sx={{ textTransform: 'none' }}
                  >
                    Eliminar
                  </Button>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Edit3 size={15} />}
                      onClick={() => abrirModalEditarTarea(tareaSeleccionada)}
                      sx={{ textTransform: 'none', borderRadius: 2 }}
                    >
                      Editar Tarea
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => setTareaSeleccionada(null)}
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

      {/* ===================================================================== */}
      {/* MODAL DEVOLVER TAREA CON OBSERVACIONES (EXCLUSIVO REVISOR)            */}
      {/* ===================================================================== */}
      <Dialog
        open={modalDevolverOpen}
        onClose={() => setModalDevolverOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#92400e' }}>
          ↩️ Devolver Tarea a En Curso
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            Indica las correcciones o ajustes que debe realizar el responsable antes de volver a enviar <strong>{tareaADevolver?.titulo}</strong> a revisión:
          </Typography>
          <TextField
            label="Observaciones o correcciones requeridas"
            placeholder="Ej: Falta adjuntar el anexo 2 y corregir la cita jurisprudencial..."
            multiline
            rows={3}
            size="small"
            fullWidth
            required
            value={motivoDevolucion}
            onChange={(e) => setMotivoDevolucion(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalDevolverOpen(false)} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="warning"
            disabled={!motivoDevolucion.trim()}
            onClick={handleConfirmarDevolucion}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
          >
            Devolver para Corrección
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===================================================================== */}
      {/* MODAL CREAR / EDITAR TAREA (CON CANAL Y REVISOR OBLIGATORIO)          */}
      {/* ===================================================================== */}
      <Dialog
        open={modalTareaOpen}
        onClose={() => setModalTareaOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: '800', color: '#1a365d' }}>
          {tareaEditandoId ? 'Modificar Tarea y Asignación de Revisor' : 'Nueva Tarea de Proyecto'}
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="Título de la tarea o entregable"
            placeholder="Ej: Redactar observaciones de fondo Caso CIDH..."
            size="small"
            fullWidth
            required
            value={formTarea.titulo}
            onChange={(e) => setFormTarea((p) => ({ ...p, titulo: e.target.value }))}
          />

          {/* PROYECTO Y CANAL VINCULADO */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Proyecto</InputLabel>
              <Select
                label="Proyecto"
                value={formTarea.proyectoId}
                onChange={(e) => {
                  const nuevoProyId = e.target.value;
                  const proyObj = proyectos.find((x) => x.id === nuevoProyId);
                  setFormTarea((p) => ({
                    ...p,
                    proyectoId: nuevoProyId,
                    canalId: proyObj?.canalId || p.canalId
                  }));
                }}
              >
                {proyectosVisibles.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth required>
              <InputLabel>Canal / Equipo Vinculado</InputLabel>
              <Select
                label="Canal / Equipo Vinculado"
                value={formTarea.canalId}
                onChange={(e) => setFormTarea((p) => ({ ...p, canalId: e.target.value }))}
              >
                {canalesEquipo.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.esPrivado ? `🔒 #${c.nombre} (Solo miembros)` : `#${c.nombre}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* EJECUTORES Y REVISOR / APROBADOR */}
          <Paper
            elevation={0}
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: '#f8fafc',
              border: '1px solid #cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5
            }}
          >
            <Typography variant="caption" fontWeight="800" color="#1D3557">
              ASIGNACIÓN DE RESPONSABLES Y REVISOR (CONTROL DE CALIDAD)
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>👤 Ejecutor(es) de la tarea</InputLabel>
                <Select
                  multiple
                  value={formTarea.responsables}
                  onChange={(e) =>
                    setFormTarea((p) => ({
                      ...p,
                      responsables:
                        typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value
                    }))
                  }
                  input={<OutlinedInput label="👤 Ejecutor(es) de la tarea" />}
                  renderValue={(sel) => `${sel.length} asignado(s)`}
                >
                  {usuariosEquipo.map((u) => (
                    <MenuItem key={u.email} value={u.email}>
                      <Checkbox size="small" checked={formTarea.responsables.indexOf(u.email) > -1} />
                      <ListItemText primary={u.nombre} secondary={u.rol} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth required>
                <InputLabel>🔎 Revisor / Aprobador</InputLabel>
                <Select
                  label="🔎 Revisor / Aprobador"
                  value={formTarea.revisorEmail}
                  onChange={(e) => setFormTarea((p) => ({ ...p, revisorEmail: e.target.value }))}
                >
                  {usuariosEquipo.map((u) => (
                    <MenuItem key={u.email} value={u.email}>
                      {u.nombre} ({u.rol})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              El ejecutor deberá completar el 100% de las subtareas para enviar a <strong>En Revisión</strong>, y solo el <strong>Revisor</strong> podrá aprobarla a <strong>Completado</strong>.
            </Typography>
          </Paper>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Prioridad</InputLabel>
              <Select
                label="Prioridad"
                value={formTarea.prioridad}
                onChange={(e) => setFormTarea((p) => ({ ...p, prioridad: e.target.value }))}
              >
                {Object.values(PRIORIDADES_TAREA).map((pr) => (
                  <MenuItem key={pr.id} value={pr.id}>
                    {pr.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Fecha límite"
              type="date"
              size="small"
              fullWidth
              value={formTarea.fechaLimite}
              onChange={(e) => setFormTarea((p) => ({ ...p, fechaLimite: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>

          <TextField
            label="Descripción o instrucciones"
            size="small"
            fullWidth
            multiline
            rows={2}
            value={formTarea.descripcion}
            onChange={(e) => setFormTarea((p) => ({ ...p, descripcion: e.target.value }))}
          />

          {/* SUBTAREAS / CHECKLIST */}
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <Typography variant="caption" fontWeight="bold" color="#1a365d">
              SUBTAREAS / PASOS DE CONTROL (REQUERIDOS AL 100% PARA REVISIÓN)
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <TextField
                size="small"
                placeholder="Añadir paso o subtarea..."
                fullWidth
                value={nuevaSubtareaTexto}
                onChange={(e) => setNuevaSubtareaTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAgregarSubtareaForm();
                  }
                }}
              />
              <Button variant="outlined" size="small" onClick={handleAgregarSubtareaForm}>
                Añadir
              </Button>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
              {(formTarea.subtareas || []).map((s) => (
                <Chip
                  key={s.id}
                  label={s.texto}
                  size="small"
                  onDelete={() =>
                    setFormTarea((p) => ({
                      ...p,
                      subtareas: p.subtareas.filter((x) => x.id !== s.id)
                    }))
                  }
                />
              ))}
            </Box>
          </Box>

          {/* VINCULAR DOCUMENTO O CARPETA DE GOOGLE DRIVE */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="caption" fontWeight="800" color="#1D3557">
                ARCHIVO O CARPETA DE GOOGLE DRIVE VINCULADO (SE BLINDA AL CANAL)
              </Typography>
              <Button
                size="small"
                variant={mostrarSelectorDriveTarea ? 'contained' : 'outlined'}
                startIcon={<HardDrive size={14} />}
                onClick={() => setMostrarSelectorDriveTarea((v) => !v)}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  py: 0.25,
                  px: 1.25,
                  borderRadius: 1.5,
                  ...(mostrarSelectorDriveTarea
                    ? { bgcolor: '#1D3557', '&:hover': { bgcolor: '#152742' } }
                    : { borderColor: '#cbd5e1', color: '#1D3557' })
                }}
              >
                {mostrarSelectorDriveTarea ? 'Ocultar explorador de Drive' : 'Elegir desde Google Drive'}
              </Button>
            </Box>

            {mostrarSelectorDriveTarea && (
              <GoogleDriveSelectorBrowser
                userEmail={userEmail}
                itemSeleccionadoUrl={formTarea.driveUrl}
                onSelectItem={(itemElegido) => {
                  setFormTarea((p) => ({
                    ...p,
                    driveUrl: itemElegido.url,
                    driveTitulo: itemElegido.titulo
                  }));
                  setMostrarSelectorDriveTarea(false);
                }}
              />
            )}

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <TextField
                label="Nombre del archivo o carpeta Drive"
                placeholder="Se completa al elegir en Drive o escríbelo..."
                size="small"
                fullWidth
                value={formTarea.driveTitulo}
                onChange={(e) => setFormTarea((p) => ({ ...p, driveTitulo: e.target.value }))}
              />
              <TextField
                label="Enlace de Google Drive (Opcional)"
                placeholder="https://drive.google.com/..."
                size="small"
                fullWidth
                value={formTarea.driveUrl}
                onChange={(e) => setFormTarea((p) => ({ ...p, driveUrl: e.target.value }))}
              />
            </Box>
          </Box>

          {!tareaEditandoId && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1.5,
                  border: '1px solid #cbd5e1'
                }}
              >
                <Typography variant="caption" fontWeight="bold">
                  Notificar en el canal vinculado
                </Typography>
                <Switch
                  size="small"
                  checked={formTarea.notificarEnCanal}
                  onChange={(e) => setFormTarea((p) => ({ ...p, notificarEnCanal: e.target.checked }))}
                />
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1.5,
                  border: '1px solid #cbd5e1'
                }}
              >
                <Typography variant="caption" fontWeight="bold">
                  Agendar fecha en Calendario
                </Typography>
                <Switch
                  size="small"
                  checked={formTarea.agendarEnCalendario}
                  onChange={(e) => setFormTarea((p) => ({ ...p, agendarEnCalendario: e.target.checked }))}
                />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalTareaOpen(false)} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleGuardarTarea}
            disabled={!formTarea.titulo.trim() || !formTarea.revisorEmail}
            sx={{ bgcolor: '#1a365d', textTransform: 'none', fontWeight: 'bold', borderRadius: 2 }}
          >
            {tareaEditandoId ? 'Guardar Cambios' : 'Crear Tarea'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODAL NUEVO PROYECTO (CON CANAL / EQUIPO VINCULADO) */}
      <Dialog open={modalProyectoOpen} onClose={() => setModalProyectoOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', color: '#1a365d' }}>Crear Nuevo Proyecto</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Nombre del proyecto"
            size="small"
            fullWidth
            required
            value={nuevoProyecto.nombre}
            onChange={(e) => setNuevoProyecto((p) => ({ ...p, nombre: e.target.value }))}
          />
          <FormControl size="small" fullWidth>
            <InputLabel>Canal / Equipo del Proyecto</InputLabel>
            <Select
              label="Canal / Equipo del Proyecto"
              value={nuevoProyecto.canalId}
              onChange={(e) => setNuevoProyecto((p) => ({ ...p, canalId: e.target.value }))}
            >
              {canalesEquipo.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.esPrivado ? `🔒 #${c.nombre} (Privado - Solo miembros)` : `#${c.nombre}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Descripción"
            size="small"
            fullWidth
            multiline
            rows={2}
            value={nuevoProyecto.descripcion}
            onChange={(e) => setNuevoProyecto((p) => ({ ...p, descripcion: e.target.value }))}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalProyectoOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleCrearProyecto}
            disabled={!nuevoProyecto.nombre.trim()}
            sx={{ bgcolor: '#1a365d', textTransform: 'none', fontWeight: 'bold' }}
          >
            Crear Proyecto
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4200}
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
