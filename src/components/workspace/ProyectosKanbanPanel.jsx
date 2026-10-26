// src/components/workspace/ProyectosKanbanPanel.jsx
import React, { useState, useEffect, useMemo } from 'react';
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
  CheckSquare,
  Clock,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Edit3,
  FolderKanban,
  HardDrive,
  ExternalLink,
  CheckCircle2,
  Circle,
  X,
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
    descripcion: 'Escritos judiciales, audiencias ante la Corte IDH y control de plazos procesales.'
  },
  {
    slug: 'gestion-administrativa',
    nombre: 'Gestión Operativa & Finanzas',
    color: '#059669',
    descripcion: 'Coordinación administrativa, conciliación, convenios y logística interna.'
  },
  {
    slug: 'comunicacion-institucional',
    nombre: 'Comunicación & Portal Web',
    color: '#2563eb',
    descripcion: 'Publicaciones oficiales, boletines, recursos institucionales y difusión.'
  }
];

export default function ProyectosKanbanPanel({
  currentUser,
  userName,
  userRole,
  usuariosEquipo = [],
  canalesDisponibles = [],
  onAbrirDrivePreview,
  onIrACanal
}) {
  const [proyectos, setProyectos] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [proyectoFiltro, setProyectoFiltro] = useState('todos');
  const [responsableFiltro, setResponsableFiltro] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [vistaModo, setVistaModo] = useState('kanban'); // 'kanban' | 'lista'

  // Modal de Nueva/Editar Tarea
  const [modalTareaOpen, setModalTareaOpen] = useState(false);
  const [tareaEditandoId, setTareaEditandoId] = useState(null);
  const [nuevaSubtareaTexto, setNuevaSubtareaTexto] = useState('');
  const [formTarea, setFormTarea] = useState({
    titulo: '',
    descripcion: '',
    proyectoId: 'litigios-cidh',
    estado: 'pendiente',
    prioridad: 'media',
    responsables: [],
    fechaLimite: '',
    subtareas: [],
    driveUrl: '',
    driveTitulo: '',
    agendarEnCalendario: true,
    notificarCanalId: ''
  });

  // Modal de Detalle Interactivo de Tarea
  const [tareaSeleccionada, setTareaSeleccionada] = useState(null);

  // Modal de Nuevo Proyecto
  const [modalProyectoOpen, setModalProyectoOpen] = useState(false);
  const [nuevoProyecto, setNuevoProyecto] = useState({
    nombre: '',
    descripcion: '',
    color: '#1a365d'
  });

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  const userEmail = (currentUser?.email || '').toLowerCase();

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
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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

  // Filtrado de tareas
  const tareasFiltradas = useMemo(() => {
    return tareas.filter((t) => {
      if (proyectoFiltro !== 'todos' && t.proyectoId !== proyectoFiltro) return false;
      if (
        responsableFiltro !== 'todos' &&
        !(t.responsables || []).includes(responsableFiltro)
      ) {
        return false;
      }
      if (!busqueda.trim()) return true;
      const term = busqueda.toLowerCase();
      return (
        (t.titulo || '').toLowerCase().includes(term) ||
        (t.descripcion || '').toLowerCase().includes(term)
      );
    });
  }, [tareas, proyectoFiltro, responsableFiltro, busqueda]);

  const abrirModalNuevaTarea = (estadoInicial = 'pendiente') => {
    setTareaEditandoId(null);
    setNuevaSubtareaTexto('');
    setFormTarea({
      titulo: '',
      descripcion: '',
      proyectoId: proyectoFiltro !== 'todos' ? proyectoFiltro : proyectos[0]?.id || 'litigios-cidh',
      estado: estadoInicial,
      prioridad: 'media',
      responsables: [userEmail],
      fechaLimite: '',
      subtareas: [],
      driveUrl: '',
      driveTitulo: '',
      agendarEnCalendario: false,
      notificarCanalId: ''
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
      estado: tarea.estado || 'pendiente',
      prioridad: tarea.prioridad || 'media',
      responsables: tarea.responsables || [],
      fechaLimite: tarea.fechaLimite || '',
      subtareas: tarea.subtareas || [],
      driveUrl: tarea.driveUrl || '',
      driveTitulo: tarea.driveTitulo || '',
      agendarEnCalendario: false,
      notificarCanalId: ''
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
    if (!formTarea.titulo.trim()) return;

    const proy = proyectos.find((p) => p.id === formTarea.proyectoId);
    const payload = {
      titulo: formTarea.titulo.trim(),
      descripcion: formTarea.descripcion.trim(),
      proyectoId: formTarea.proyectoId,
      proyectoNombre: proy?.nombre || 'General',
      proyectoColor: proy?.color || '#1a365d',
      estado: formTarea.estado,
      prioridad: formTarea.prioridad,
      responsables: formTarea.responsables || [],
      fechaLimite: formTarea.fechaLimite || '',
      subtareas: formTarea.subtareas || [],
      driveUrl: formTarea.driveUrl.trim(),
      driveTitulo: formTarea.driveTitulo.trim() || (formTarea.driveUrl ? 'Documento de Google Drive' : ''),
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
          ubicacion: proy?.nombre || 'Proyectos IIRESODH',
          descripcion: formTarea.descripcion.trim() || `Fecha límite de la tarea asignada en ${proy?.nombre || 'Workspace'}.`,
          participantes: formTarea.responsables || [],
          creadoPorEmail: userEmail,
          creadoPorNombre: userName || 'Proyectos',
          creadoEn: serverTimestamp()
        });
      }

      // Si eligió anunciar en un canal de Slack
      if (!tareaEditandoId && formTarea.notificarCanalId) {
        const prioInfo = PRIORIDADES_TAREA[formTarea.prioridad] || PRIORIDADES_TAREA.media;
        const menciones = (formTarea.responsables || [])
          .map((em) => {
            const u = usuariosEquipo.find((x) => x.email === em);
            return `@${(u?.nombre || em.split('@')[0]).replace(/\s+/g, '')}`;
          })
          .join(' ');

        await addDoc(collection(db, 'workspace_canales', formTarea.notificarCanalId, 'mensajes'), {
          texto: `📋 *Nueva tarea de proyecto asignada:* *${formTarea.titulo.trim()}*\n• *Proyecto:* ${proy?.nombre || 'General'}\n• *Prioridad:* ${prioInfo.label}${formTarea.fechaLimite ? `\n• *Fecha límite:* ${formTarea.fechaLimite}` : ''}${menciones ? `\n• *Responsables:* ${menciones}` : ''}`,
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

        await updateDoc(doc(db, 'workspace_canales', formTarea.notificarCanalId), {
          ultimoMensajeAt: serverTimestamp(),
          ultimoMensajeMs: Date.now(),
          ultimoMensajeTexto: `📋 Tarea: ${formTarea.titulo.trim()}`,
          ultimoMensajeAutor: userName || 'Equipo'
        });
      }

      setModalTareaOpen(false);
      setSnackbar({
        open: true,
        message: tareaEditandoId ? 'Tarea actualizada.' : 'Tarea creada exitosamente.',
        severity: 'success'
      });
    } catch (err) {
      console.error('Error guardando tarea:', err);
    }
  };

  // Cambiar estado rápido de una tarea (mover columna en Kanban o cambiar selector en Lista)
  const handleCambiarEstadoTarea = async (tarea, nuevoEstado) => {
    try {
      await updateDoc(doc(db, 'workspace_tareas', tarea.id), {
        estado: nuevoEstado,
        actualizadoEn: serverTimestamp()
      });
    } catch (err) {
      console.error('Error cambiando estado de tarea:', err);
    }
  };

  // Alternar subtarea directamente desde el modal de detalle
  const handleToggleSubtarea = async (tarea, subtareaId) => {
    const nuevas = (tarea.subtareas || []).map((s) =>
      s.id === subtareaId ? { ...s, completada: !s.completada } : s
    );
    try {
      await updateDoc(doc(db, 'workspace_tareas', tarea.id), {
        subtareas: nuevas,
        actualizadoEn: serverTimestamp()
      });
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

  // Crear nuevo proyecto
  const handleCrearProyecto = async () => {
    if (!nuevoProyecto.nombre.trim()) return;
    const slug = nuevoProyecto.nombre
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '');

    await setDoc(doc(db, 'workspace_proyectos', slug || `proy_${Date.now()}`), {
      nombre: nuevoProyecto.nombre.trim(),
      descripcion: nuevoProyecto.descripcion.trim(),
      color: nuevoProyecto.color || '#1a365d',
      creadoEn: serverTimestamp()
    });

    setModalProyectoOpen(false);
    setNuevoProyecto({ nombre: '', descripcion: '', color: '#1a365d' });
  };

  const obtenerNombreUsuario = (email) => {
    const u = usuariosEquipo.find((x) => x.email === email);
    return u?.nombre || email.split('@')[0];
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
            <Typography variant="subtitle1" fontWeight="800" color="#0f233c" sx={{ lineHeight: 1.2 }}>
              Seguimiento de Proyectos y Tareas
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Tablero Kanban, listas de control, responsables y archivos de Google Drive vinculados
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

      {/* SUB-BARRA DE FILTROS POR PROYECTO, RESPONSABLE Y BUSCADOR */}
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
            label={`Todos (${tareas.length})`}
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
          {proyectos.map((p) => (
            <Chip
              key={p.id}
              label={p.nombre}
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
          ))}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <Select
              value={responsableFiltro}
              onChange={(e) => setResponsableFiltro(e.target.value)}
              sx={{ height: 32, fontSize: '0.78rem', borderRadius: 2, bgcolor: '#f8fafc' }}
            >
              <MenuItem value="todos" sx={{ fontSize: '0.78rem' }}>
                Todos los responsables
              </MenuItem>
              <MenuItem value={userEmail} sx={{ fontSize: '0.78rem', fontWeight: 'bold' }}>
                👤 Mis tareas asignadas
              </MenuItem>
              {usuariosEquipo.map((u) => (
                <MenuItem key={u.email} value={u.email} sx={{ fontSize: '0.78rem' }}>
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
            sx={{ width: { xs: 150, sm: 210 } }}
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
                lg: 'repeat(4, minmax(250px, 1fr))'
              },
              gap: 2,
              alignItems: 'flex-start',
              minHeight: '100%'
            }}
          >
            {COLUMNAS_KANBAN.map((col, colIndex) => {
              const tareasColumna = tareasFiltradas.filter((t) => t.estado === col.id);

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

                    <Tooltip title={`Añadir tarea en ${col.titulo}`}>
                      <IconButton size="small" onClick={() => abrirModalNuevaTarea(col.id)}>
                        <Plus size={16} />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {/* TARJETAS DE LA COLUMNA */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                    {tareasColumna.map((tarea) => {
                      const prio = PRIORIDADES_TAREA[tarea.prioridad] || PRIORIDADES_TAREA.media;
                      const totalSub = (tarea.subtareas || []).length;
                      const compSub = (tarea.subtareas || []).filter((s) => s.completada).length;
                      const pctSub = totalSub > 0 ? Math.round((compSub / totalSub) * 100) : 0;

                      return (
                        <Paper
                          key={tarea.id}
                          elevation={0}
                          onClick={() => setTareaSeleccionada(tarea)}
                          sx={{
                            p: 1.75,
                            borderRadius: '0 10px 10px 0',
                            bgcolor: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderLeft: `4px solid ${tarea.proyectoColor || '#1a365d'}`,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: '0 6px 16px rgba(15, 35, 60, 0.08)'
                            }
                          }}
                        >
                          {/* PROYECTO Y PRIORIDAD */}
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
                            <Typography
                              variant="caption"
                              fontWeight="800"
                              noWrap
                              sx={{ color: tarea.proyectoColor || '#1a365d', fontSize: '0.68rem' }}
                            >
                              {tarea.proyectoNombre || 'General'}
                            </Typography>
                            <Chip
                              label={prio.label}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.63rem',
                                fontWeight: 700,
                                bgcolor: prio.bg,
                                color: prio.color
                              }}
                            />
                          </Box>

                          {/* TÍTULO DE LA TAREA */}
                          <Typography variant="body2" fontWeight="700" color="#0f233c" sx={{ lineHeight: 1.35, mb: 0.75 }}>
                            {tarea.titulo}
                          </Typography>

                          {/* BARRA DE PROGRESO DE SUBTAREAS */}
                          {totalSub > 0 && (
                            <Box sx={{ mb: 1 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                                  Subtareas
                                </Typography>
                                <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.68rem' }}>
                                  {compSub}/{totalSub} ({pctSub}%)
                                </Typography>
                              </Box>
                              <LinearProgress
                                variant="determinate"
                                value={pctSub}
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

                          {/* PIE DE TARJETA: FECHA, RESPONSABLES Y FLECHAS DE MOVIMIENTO */}
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
                                    <Tooltip key={em} title={obtenerNombreUsuario(em)}>
                                      <Avatar>{obtenerNombreUsuario(em).charAt(0).toUpperCase()}</Avatar>
                                    </Tooltip>
                                  ))}
                                </AvatarGroup>
                              )}
                            </Box>

                            {/* BOTONES RÁPIDOS PARA AVANZAR / RETROCEDER ESTADO */}
                            <Box sx={{ display: 'flex', gap: 0.25 }} onClick={(e) => e.stopPropagation()}>
                              {colIndex > 0 && (
                                <Tooltip title={`Mover a ${COLUMNAS_KANBAN[colIndex - 1].titulo}`}>
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
                              {colIndex < COLUMNAS_KANBAN.length - 1 && (
                                <Tooltip title={`Mover a ${COLUMNAS_KANBAN[colIndex + 1].titulo}`}>
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      handleCambiarEstadoTarea(tarea, COLUMNAS_KANBAN[colIndex + 1].id)
                                    }
                                    sx={{ p: 0.3, color: '#2563eb' }}
                                  >
                                    <ArrowRight size={14} />
                                  </IconButton>
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
                  <TableCell sx={{ fontWeight: 'bold' }}>Proyecto</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Estado</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Prioridad</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Subtareas</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Responsables</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Fecha Límite</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="right">
                    Acciones
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tareasFiltradas.map((tarea) => {
                  const prio = PRIORIDADES_TAREA[tarea.prioridad] || PRIORIDADES_TAREA.media;
                  const totalSub = (tarea.subtareas || []).length;
                  const compSub = (tarea.subtareas || []).filter((s) => s.completada).length;

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
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={tarea.proyectoNombre || 'General'}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            bgcolor: 'rgba(26, 54, 93, 0.08)',
                            color: tarea.proyectoColor || '#1a365d'
                          }}
                        />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          size="small"
                          value={tarea.estado}
                          onChange={(e) => handleCambiarEstadoTarea(tarea, e.target.value)}
                          sx={{ height: 28, fontSize: '0.75rem', borderRadius: 1.5 }}
                        >
                          {COLUMNAS_KANBAN.map((c) => (
                            <MenuItem key={c.id} value={c.id} sx={{ fontSize: '0.75rem' }}>
                              {c.emoji} {c.titulo}
                            </MenuItem>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={prio.label}
                          size="small"
                          sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, bgcolor: prio.bg, color: prio.color }}
                        />
                      </TableCell>
                      <TableCell>
                        {totalSub > 0 ? `${compSub}/${totalSub}` : '—'}
                      </TableCell>
                      <TableCell>
                        <AvatarGroup max={3} sx={{ justifyContent: 'flex-end', '& .MuiAvatar-root': { width: 24, height: 24, fontSize: '0.7rem', bgcolor: '#1a365d' } }}>
                          {(tarea.responsables || []).map((em) => (
                            <Avatar key={em} title={obtenerNombreUsuario(em)}>
                              {obtenerNombreUsuario(em).charAt(0).toUpperCase()}
                            </Avatar>
                          ))}
                        </AvatarGroup>
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
      {/* MODAL DE DETALLE DE TAREA Y CHECKLIST DE SUBTAREAS                    */}
      {/* ===================================================================== */}
      <Dialog
        open={Boolean(tareaSeleccionada)}
        onClose={() => setTareaSeleccionada(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        {tareaSeleccionada && (
          <>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Chip
                label={tareaSeleccionada.proyectoNombre || 'Proyecto'}
                size="small"
                sx={{ bgcolor: '#1a365d', color: '#ffffff', fontWeight: 'bold' }}
              />
              <IconButton size="small" onClick={() => setTareaSeleccionada(null)}>
                <X size={18} />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="h6" fontWeight="800" color="#0f233c">
                {tareaSeleccionada.titulo}
              </Typography>

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
                <Typography variant="caption" fontWeight="bold" color="text.secondary">
                  CHECKLIST DE SUBTAREAS ({(tareaSeleccionada.subtareas || []).filter((s) => s.completada).length}/
                  {(tareaSeleccionada.subtareas || []).length})
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1 }}>
                  {(tareaSeleccionada.subtareas || []).length === 0 ? (
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
        )}
      </Dialog>

      {/* ===================================================================== */}
      {/* MODAL CREAR / EDITAR TAREA                                            */}
      {/* ===================================================================== */}
      <Dialog open={modalTareaOpen} onClose={() => setModalTareaOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: '800', color: '#1a365d' }}>
          {tareaEditandoId ? 'Modificar Tarea' : 'Nueva Tarea de Proyecto'}
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

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Proyecto</InputLabel>
              <Select
                label="Proyecto"
                value={formTarea.proyectoId}
                onChange={(e) => setFormTarea((p) => ({ ...p, proyectoId: e.target.value }))}
              >
                {proyectos.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

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
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Responsables asignados</InputLabel>
              <Select
                multiple
                value={formTarea.responsables}
                onChange={(e) =>
                  setFormTarea((p) => ({
                    ...p,
                    responsables: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value
                  }))
                }
                input={<OutlinedInput label="Responsables asignados" />}
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
              SUBTAREAS / PASOS DE CONTROL
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
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            <TextField
              label="Enlace de Google Drive (Opcional)"
              placeholder="https://docs.google.com/..."
              size="small"
              fullWidth
              value={formTarea.driveUrl}
              onChange={(e) => setFormTarea((p) => ({ ...p, driveUrl: e.target.value }))}
            />
            <TextField
              label="Nombre del archivo Drive"
              placeholder="Ej: Borrador Escrito CIDH"
              size="small"
              fullWidth
              value={formTarea.driveTitulo}
              onChange={(e) => setFormTarea((p) => ({ ...p, driveTitulo: e.target.value }))}
            />
          </Box>

          {!tareaEditandoId && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Notificar en canal de Slack</InputLabel>
                <Select
                  label="Notificar en canal de Slack"
                  value={formTarea.notificarCanalId}
                  onChange={(e) => setFormTarea((p) => ({ ...p, notificarCanalId: e.target.value }))}
                >
                  <MenuItem value="">
                    <em>No anunciar en canal</em>
                  </MenuItem>
                  {canalesDisponibles
                    .filter((c) => c.tipo !== 'dm')
                    .map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        #{c.nombre}
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
            disabled={!formTarea.titulo.trim()}
            sx={{ bgcolor: '#1a365d', textTransform: 'none', fontWeight: 'bold', borderRadius: 2 }}
          >
            {tareaEditandoId ? 'Guardar Cambios' : 'Crear Tarea'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODAL NUEVO PROYECTO */}
      <Dialog open={modalProyectoOpen} onClose={() => setModalProyectoOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', color: '#1a365d' }}>Crear Nuevo Proyecto</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Nombre del proyecto"
            size="small"
            fullWidth
            value={nuevoProyecto.nombre}
            onChange={(e) => setNuevoProyecto((p) => ({ ...p, nombre: e.target.value }))}
          />
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
        autoHideDuration={3500}
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
