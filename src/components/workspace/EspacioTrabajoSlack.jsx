// src/components/workspace/EspacioTrabajoSlack.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Avatar,
  Chip,
  TextField,
  Tooltip,
  Badge,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  Popover,
  Switch,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  ListItemText,
  OutlinedInput,
  CircularProgress,
  LinearProgress,
  Paper,
  InputAdornment,
  Snackbar,
  Alert
} from '@mui/material';
import {
  Hash,
  Lock,
  Plus,
  Send,
  Paperclip,
  Smile,
  AtSign,
  MessageSquare,
  Pin,
  Search,
  Calendar as CalendarIcon,
  Maximize2,
  Minimize2,
  Edit3,
  Trash2,
  X,
  FileText,
  Download,
  Users,
  Bold,
  Italic,
  Code,
  ChevronRight,
  Menu as MenuIcon,
  FolderKanban,
  HardDrive,
  Bookmark,
  BookOpen,
  Mic,
  Square,
  BarChart2,
  Zap,
  List as ListIcon,
  Quote,
  Volume2,
  CheckCircle2,
  Video,
  ExternalLink,
  Copy,
  PhoneOff,
  Settings,
  Globe
} from 'lucide-react';
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import {
  ref as rtdbRef,
  onValue,
  onDisconnect,
  update as rtdbUpdate,
  set as rtdbSet,
  remove as rtdbRemove,
  serverTimestamp as rtdbServerTimestamp
} from 'firebase/database';
import { db, rtdb, storage } from '../../config/firebase';
import { useAuth, crearEspacioGoogleMeet } from '../../context/AuthContext';
import { registrarLogAuditoria } from '../../utils/auditLogger';
import CalendarioHibridoPanel, { CATEGORIAS_EVENTO } from './CalendarioHibridoPanel';
import ProyectosKanbanPanel from './ProyectosKanbanPanel';
import GoogleDriveWorkspacePanel from './GoogleDriveWorkspacePanel';

const emailToRtdbKey = (email = '') => email.toLowerCase().replace(/[.#$[\]/]/g, '_');

const EMOJIS_RAPIDOS = ['👍', '❤️', '⚖️', '✅', '🙏', '🔥', '👀'];

const ESTADOS_USUARIO = [
  { id: 'disponible', emoji: '🟢', texto: 'Disponible', color: '#22c55e' },
  { id: 'audiencia', emoji: '🏛️', texto: 'En audiencia judicial', color: '#dc2626' },
  { id: 'reunion', emoji: '📅', texto: 'En reunión', color: '#f59e0b' },
  { id: 'enfoque', emoji: '📝', texto: 'Redactando escrito / Enfoque', color: '#3b82f6' },
  { id: 'mision', emoji: '✈️', texto: 'En misión oficial', color: '#0284c7' },
  { id: 'plazo', emoji: '🔕', texto: 'Plazo fatal / No molestar', color: '#b91c1c' },
  { id: 'ausente', emoji: '🌴', texto: 'Ausente / Vacaciones', color: '#94a3b8' }
];

const SLASH_COMMANDS = [
  {
    cmd: '/meet',
    ejemplo: '/meet Coordinación urgente CIDH',
    desc: 'Inicia una sala real de Google Meet en este canal o mensaje directo'
  },
  {
    cmd: '/tarea',
    ejemplo: '/tarea Revisar jurisprudencia CIDH',
    desc: 'Crea una tarea rápida en Proyectos Kanban y la comparte en el canal'
  },
  {
    cmd: '/encuesta',
    ejemplo: '/encuesta',
    desc: 'Abre el creador de encuestas y votaciones en tiempo real para este canal'
  },
  {
    cmd: '/evento',
    ejemplo: '/evento',
    desc: 'Agenda una reunión o plazo procesal en el Calendario Híbrido'
  },
  {
    cmd: '/canvas',
    ejemplo: '/canvas',
    desc: 'Abre el Canvas colaborativo (notas, acuerdos y enlaces) de este canal'
  },
  {
    cmd: '/guardados',
    ejemplo: '/guardados',
    desc: 'Muestra tu bandeja personal de mensajes guardados ("Para más tarde")'
  }
];

const CANALES_INICIALES = [
  {
    slug: 'general',
    nombre: 'general',
    descripcion: 'Canal principal de coordinación, avisos y comunicación general del equipo IIRESODH.',
    esPrivado: false,
    orden: 1
  },
  {
    slug: 'anuncios-oficiales',
    nombre: 'anuncios-oficiales',
    descripcion: 'Comunicados institucionales de dirección, normativas y avisos prioritarios.',
    esPrivado: false,
    orden: 2
  },
  {
    slug: 'litigios-y-casos',
    nombre: 'litigios-y-casos',
    descripcion: 'Seguimiento de expedientes, plazos fatales, audiencias CIDH y estrategia jurídica.',
    esPrivado: false,
    orden: 3
  },
  {
    slug: 'administracion',
    nombre: 'administracion',
    descripcion: 'Coordinación administrativa, facturación, soporte operativo y logística.',
    esPrivado: false,
    orden: 4
  }
];

export default function EspacioTrabajoSlack({
  initialSection = 'chat', // 'chat' | 'calendario'
  userRole = 'Abogado/a',
  userName = ''
}) {
  const { user } = useAuth();
  const currentUserEmail = (user?.email || '').toLowerCase();
  const currentUserName =
    userName || user?.displayName || (currentUserEmail ? currentUserEmail.split('@')[0] : 'Usuario IIRESODH');

  // Navegación principal interna ('chat' | 'proyectos' | 'calendario' | 'drive')
  const [seccionActiva, setSeccionActiva] = useState(initialSection);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Sincronizar cuando cambia desde el acordeón externo
  useEffect(() => {
    if (initialSection === 'chat' || initialSection === 'calendario') {
      setSeccionActiva(initialSection);
    }
  }, [initialSection]);

  // Permitir salir de pantalla completa con la tecla Escape
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Estado de canales, usuarios y presencia
  const [canales, setCanales] = useState([]);
  const [canalActivoId, setCanalActivoId] = useState('general');
  const [usuariosEquipo, setUsuariosEquipo] = useState([]);
  const [presenciaMap, setPresenciaMap] = useState({});
  const [busquedaSidebar, setBusquedaSidebar] = useState('');

  // Indicador "Está escribiendo..." en tiempo real (RTDB)
  const [usuariosEscribiendo, setUsuariosEscribiendo] = useState([]);
  const typingTimeoutRef = useRef(null);

  // Estado personalizado libre del usuario
  const [customStatusEmoji, setCustomStatusEmoji] = useState('💬');
  const [customStatusTexto, setCustomStatusTexto] = useState('');
  const [mostrarSelectorEmojiEstado, setMostrarSelectorEmojiEstado] = useState(false);

  // Mensajes del canal activo
  const [mensajes, setMensajes] = useState([]);
  const [loadingMensajes, setLoadingMensajes] = useState(false);
  const [busquedaEnCanal, setBusquedaEnCanal] = useState('');
  const [mostrarBuscadorCanal, setMostrarBuscadorCanal] = useState(false);

  // Elementos Guardados ("Para más tarde") del usuario actual
  const [mensajesGuardados, setMensajesGuardados] = useState([]);

  // Compositor de mensaje principal
  const [textoMensaje, setTextoMensaje] = useState('');
  const [archivosSubiendo, setArchivosSubiendo] = useState(false);
  const [progresoSubida, setProgresoSubida] = useState(0);
  const [adjuntosPendientes, setAdjuntosPendientes] = useState([]);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Grabación de notas de voz (Audio Clips)
  const [grabandoAudio, setGrabandoAudio] = useState(false);
  const [segundosGrabacion, setSegundosGrabacion] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const grabacionIntervalRef = useRef(null);
  const cancelarGrabacionFlagRef = useRef(false);

  // Menús flotantes del compositor (Emojis, @Menciones, /Comandos)
  const [anchorEmojiComposer, setAnchorEmojiComposer] = useState(null);
  const [anchorMencionComposer, setAnchorMencionComposer] = useState(null);
  const [anchorEstadoUsuario, setAnchorEstadoUsuario] = useState(null);
  const [mostrarMenuSlash, setMostrarMenuSlash] = useState(false);

  // Edición de mensaje inline
  const [editandoMensajeId, setEditandoMensajeId] = useState(null);
  const [textoEdicion, setTextoEdicion] = useState('');

  // Panel lateral derecho ('hilo' | 'fijados' | 'guardados' | 'canvas' | null)
  const [panelDerecho, setPanelDerecho] = useState(null);
  const [mensajeHiloPadre, setMensajeHiloPadre] = useState(null);
  const [textoRespuestaHilo, setTextoRespuestaHilo] = useState('');

  // Estado del Canvas colaborativo del canal activo
  const [canvasTexto, setCanvasTexto] = useState('');
  const [guardandoCanvas, setGuardandoCanvas] = useState(false);
  const [canvasGuardadoOk, setCanvasGuardadoOk] = useState(false);

  // Modal de Encuesta / Votación Rápida
  const [modalEncuestaOpen, setModalEncuestaOpen] = useState(false);
  const [encuestaForm, setEncuestaForm] = useState({
    pregunta: '',
    opciones: ['', '']
  });

  // Modal de creación de nuevo canal
  const [modalCanalOpen, setModalCanalOpen] = useState(false);
  const [nuevoCanalForm, setNuevoCanalForm] = useState({
    nombre: '',
    descripcion: '',
    esPrivado: false,
    miembros: []
  });

  // Modal de gestión de canal existente (miembros, privacidad y eliminación)
  const [modalGestionCanalOpen, setModalGestionCanalOpen] = useState(false);
  const [canalEnGestion, setCanalEnGestion] = useState(null);
  const [editCanalForm, setEditCanalForm] = useState({
    descripcion: '',
    esPrivado: false,
    miembros: []
  });
  const [guardandoGestionCanal, setGuardandoGestionCanal] = useState(false);
  const [confirmDeleteCanalOpen, setConfirmDeleteCanalOpen] = useState(false);
  const [eliminandoCanal, setEliminandoCanal] = useState(false);

  // Señal para abrir modal de nuevo evento en el calendario pre-vinculado al canal
  const [signalNuevoEvento, setSignalNuevoEvento] = useState(0);
  // Item de Google Drive seleccionado para abrir en el visor embebido
  const [drivePreviewItem, setDrivePreviewItem] = useState(null);

  // Integración Nativa Google Meet (Por canal/DM y Sala Instantánea Global)
  const [creandoMeetCanal, setCreandoMeetCanal] = useState(false);
  const [modalMeetExternoOpen, setModalMeetExternoOpen] = useState(false);
  const [creandoMeetExterno, setCreandoMeetExterno] = useState(false);
  const [meetExternoForm, setMeetExternoForm] = useState({
    titulo: 'Reunión Institucional IIRESODH',
    meetingUri: '',
    meetingCode: '',
    compartirCanalId: 'general'
  });
  const [meetToast, setMeetToast] = useState({ open: false, text: '', severity: 'success' });

  // =========================================================================
  // 1. CARGAR USUARIOS AUTORIZADOS Y PRESENCIA NATIVA EN REALTIME DATABASE
  // =========================================================================
  useEffect(() => {
    const unsubUsers = onSnapshot(
      collection(db, 'usuarios_autorizados'),
      (snap) => {
        const lista = snap.docs
          .map((d) => {
            const data = d.data();
            const email = d.id.toLowerCase();
            return {
              email,
              nombre: data.nombre || email.split('@')[0],
              rol: data.rol || 'Abogado/a'
            };
          })
          .filter((u) => u.email !== 'webmaster@iiresodh.org');

        if (
          currentUserEmail &&
          currentUserEmail !== 'webmaster@iiresodh.org' &&
          !lista.some((u) => u.email === currentUserEmail)
        ) {
          lista.push({
            email: currentUserEmail,
            nombre: currentUserName,
            rol: userRole
          });
        }

        setUsuariosEquipo(lista);
      },
      (err) => console.error('Error cargando usuarios del workspace:', err)
    );

    const presenciaRootRef = rtdbRef(rtdb, 'presencia');
    const unsubPresencia = onValue(
      presenciaRootRef,
      (snap) => {
        const val = snap.val() || {};
        const mapa = {};
        Object.values(val).forEach((item) => {
          if (item && item.email) {
            mapa[item.email.toLowerCase()] = item;
          }
        });
        setPresenciaMap(mapa);
      },
      (err) => console.error('Error escuchando presencia RTDB:', err)
    );

    return () => {
      unsubUsers();
      unsubPresencia();
    };
  }, [currentUserEmail, currentUserName, userRole]);

  // Conexión WebSocket nativa (.info/connected + onDisconnect) en Realtime Database
  useEffect(() => {
    if (!currentUserEmail) return;

    const userKey = emailToRtdbKey(currentUserEmail);
    const miPresenciaRtdbRef = rtdbRef(rtdb, `presencia/${userKey}`);
    const connectedRef = rtdbRef(rtdb, '.info/connected');

    const unsubConnected = onValue(connectedRef, async (snap) => {
      if (snap.val() === true) {
        try {
          await onDisconnect(miPresenciaRtdbRef).update({
            email: currentUserEmail,
            enLinea: false,
            ultimaConexionMs: rtdbServerTimestamp()
          });

          await rtdbUpdate(miPresenciaRtdbRef, {
            email: currentUserEmail,
            nombre: currentUserName,
            avatar: user?.photoURL || '',
            rol: userRole,
            enLinea: true,
            ultimaConexionMs: rtdbServerTimestamp()
          });
        } catch (e) {
          console.error('Error registrando presencia en RTDB:', e);
        }
      }
    });

    return () => {
      unsubConnected();
    };
  }, [currentUserEmail, currentUserName, user?.photoURL, userRole]);

  // Escuchar indicador "Está escribiendo..." del canal activo en Realtime Database
  useEffect(() => {
    if (!canalActivoId || !currentUserEmail) return;
    const typingCanalRef = rtdbRef(rtdb, `typing/${canalActivoId}`);
    const unsubTyping = onValue(typingCanalRef, (snap) => {
      const val = snap.val() || {};
      const ahora = Date.now();
      const activos = Object.values(val).filter(
        (t) =>
          t &&
          t.email &&
          t.email.toLowerCase() !== currentUserEmail &&
          ahora - (t.timestamp || 0) < 7000
      );
      setUsuariosEscribiendo(activos);
    });

    return () => unsubTyping();
  }, [canalActivoId, currentUserEmail]);

  const notificarEscritura = (nuevoTexto) => {
    setTextoMensaje(nuevoTexto);
    setMostrarMenuSlash(nuevoTexto.startsWith('/') && !nuevoTexto.includes(' '));

    if (!canalActivoId || !currentUserEmail) return;
    const userKey = emailToRtdbKey(currentUserEmail);
    const miTypingRef = rtdbRef(rtdb, `typing/${canalActivoId}/${userKey}`);

    if (!nuevoTexto.trim()) {
      rtdbRemove(miTypingRef).catch(() => {});
      return;
    }

    rtdbSet(miTypingRef, {
      email: currentUserEmail,
      nombre: currentUserName,
      timestamp: Date.now()
    }).catch(() => {});

    onDisconnect(miTypingRef).remove().catch(() => {});

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      rtdbRemove(miTypingRef).catch(() => {});
    }, 3000);
  };

  // Cambiar estado personalizado del usuario en Realtime Database
  const handleCambiarEstado = async (estadoObj) => {
    setAnchorEstadoUsuario(null);
    if (!currentUserEmail) return;
    try {
      const userKey = emailToRtdbKey(currentUserEmail);
      await rtdbUpdate(rtdbRef(rtdb, `presencia/${userKey}`), {
        email: currentUserEmail,
        estadoId: estadoObj.id,
        estadoEmoji: estadoObj.emoji,
        estadoTexto: estadoObj.texto,
        enLinea: estadoObj.id !== 'ausente',
        ultimaConexionMs: rtdbServerTimestamp()
      });
    } catch (e) {
      console.error('Error actualizando estado en RTDB:', e);
    }
  };

  const handleGuardarEstadoLibre = async () => {
    if (!customStatusTexto.trim()) return;
    await handleCambiarEstado({
      id: 'personalizado',
      emoji: customStatusEmoji || '💬',
      texto: customStatusTexto.trim()
    });
    setCustomStatusTexto('');
  };

  // =========================================================================
  // 2. ESCUCHAR ELEMENTOS GUARDADOS ("PARA MÁS TARDE") DEL USUARIO ACTUAL
  // =========================================================================
  useEffect(() => {
    if (!currentUserEmail) return;
    const q = query(
      collection(db, 'workspace_guardados'),
      where('userEmail', '==', currentUserEmail)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => (b.guardadoEnMs || 0) - (a.guardadoEnMs || 0));
        setMensajesGuardados(docs);
      },
      (err) => console.error('Error escuchando workspace_guardados:', err)
    );
    return () => unsub();
  }, [currentUserEmail]);

  const estaGuardadoPorMi = (mensajeId) => {
    const docId = `${emailToRtdbKey(currentUserEmail)}_${mensajeId}`;
    return mensajesGuardados.some((g) => g.id === docId || g.mensajeId === mensajeId);
  };

  const handleToggleGuardado = async (msg) => {
    if (!currentUserEmail) return;
    const docId = `${emailToRtdbKey(currentUserEmail)}_${msg.id}`;
    const refGuardado = doc(db, 'workspace_guardados', docId);
    try {
      if (estaGuardadoPorMi(msg.id)) {
        await deleteDoc(refGuardado);
      } else {
        await setDoc(refGuardado, {
          userEmail: currentUserEmail,
          mensajeId: msg.id,
          canalId: canalActivoId,
          canalNombre: obtenerTituloCanal(canalActivo),
          autorNombre: msg.autorNombre || 'Colega',
          autorRol: msg.autorRol || '',
          texto: msg.texto || '',
          adjuntos: msg.adjuntos || [],
          audioAdjunto: msg.audioAdjunto || null,
          creadoEnMs: msg.creadoEnMs || Date.now(),
          guardadoEnMs: Date.now()
        });
      }
    } catch (e) {
      console.error('Error al guardar/quitar marcador:', e);
    }
  };

  // =========================================================================
  // 3. ESCUCHAR Y SEMBRAR CANALES INSTITUCIONALES
  // =========================================================================
  useEffect(() => {
    const q = query(collection(db, 'workspace_canales'));
    const unsub = onSnapshot(
      q,
      async (snap) => {
        if (snap.empty) {
          for (const ch of CANALES_INICIALES) {
            await setDoc(doc(db, 'workspace_canales', ch.slug), {
              nombre: ch.nombre,
              descripcion: ch.descripcion,
              tipo: 'canal',
              esPrivado: ch.esPrivado,
              orden: ch.orden,
              miembros: [],
              creadoPor: currentUserEmail,
              creadoEn: serverTimestamp(),
              ultimoMensajeAt: serverTimestamp(),
              ultimoMensajeTexto: `Canal #${ch.nombre} habilitado para el equipo IIRESODH.`
            });
          }
          return;
        }

        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const visibles = docs.filter((c) => {
          if (c.tipo === 'dm') {
            const parts = c.participantes || [];
            // Excluir DMs consigo mismo
            const otros = parts.filter((p) => p !== currentUserEmail);
            return parts.includes(currentUserEmail) && otros.length > 0;
          }
          if (!c.esPrivado || userRole === 'Superadmin') return true;
          return (c.miembros || []).includes(currentUserEmail) || c.creadoPor === currentUserEmail;
        });

        visibles.sort((a, b) => (a.orden || 99) - (b.orden || 99) || (a.nombre || '').localeCompare(b.nombre || ''));
        setCanales(visibles);
      },
      (err) => console.error('Error escuchando workspace_canales:', err)
    );

    return () => unsub();
  }, [currentUserEmail, userRole]);

  // Marcar canal activo como leído en Realtime Database
  useEffect(() => {
    if (!canalActivoId || !currentUserEmail) return;
    const marcarLeido = async () => {
      try {
        const userKey = emailToRtdbKey(currentUserEmail);
        await rtdbUpdate(rtdbRef(rtdb, `presencia/${userKey}/lecturasCanales`), {
          [canalActivoId]: Date.now()
        });
      } catch {
        // Silencioso
      }
    };
    marcarLeido();
  }, [canalActivoId, mensajes.length, currentUserEmail]);

  // =========================================================================
  // 4. ESCUCHAR MENSAJES DEL CANAL ACTIVO EN TIEMPO REAL
  // =========================================================================
  useEffect(() => {
    if (!canalActivoId) return;
    setLoadingMensajes(true);

    const q = query(
      collection(db, 'workspace_canales', canalActivoId, 'mensajes'),
      orderBy('creadoEn', 'asc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }));
        setMensajes(items);
        setLoadingMensajes(false);
      },
      (err) => {
        console.error('Error escuchando mensajes:', err);
        setLoadingMensajes(false);
      }
    );

    return () => unsub();
  }, [canalActivoId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [mensajes.length, canalActivoId]);

  useEffect(() => {
    if (mensajeHiloPadre) {
      const actualizado = mensajes.find((m) => m.id === mensajeHiloPadre.id);
      if (actualizado) setMensajeHiloPadre(actualizado);
    }
  }, [mensajes, mensajeHiloPadre]);

  const canalActivo = useMemo(
    () => canales.find((c) => c.id === canalActivoId) || canales[0] || null,
    [canales, canalActivoId]
  );

  // Sincronizar el texto del Canvas colaborativo cuando cambia el canal activo
  useEffect(() => {
    if (canalActivo) {
      setCanvasTexto(
        canalActivo.canvasContenido ||
          `# Notas y Acuerdos de #${canalActivo.nombre || 'canal'}\n\n• Objetivos actuales:\n• Enlaces de expediente / Drive:\n• Acuerdos de equipo:`
      );
    }
  }, [canalActivo?.id, canalActivo?.canvasContenido]);

  const handleGuardarCanvas = async () => {
    if (!canalActivoId) return;
    setGuardandoCanvas(true);
    try {
      await updateDoc(doc(db, 'workspace_canales', canalActivoId), {
        canvasContenido: canvasTexto,
        canvasActualizadoPor: currentUserName,
        canvasActualizadoEnMs: Date.now()
      });
      setCanvasGuardadoOk(true);
      setTimeout(() => setCanvasGuardadoOk(false), 2500);
    } catch (e) {
      console.error('Error guardando Canvas del canal:', e);
    } finally {
      setGuardandoCanvas(false);
    }
  };

  // Mensajes principales y respuestas del hilo activo
  const mensajesPrincipales = useMemo(() => {
    const base = mensajes.filter((m) => !m.parentId);
    if (!busquedaEnCanal.trim()) return base;
    const term = busquedaEnCanal.toLowerCase();
    return base.filter(
      (m) =>
        (m.texto || '').toLowerCase().includes(term) ||
        (m.autorNombre || '').toLowerCase().includes(term)
    );
  }, [mensajes, busquedaEnCanal]);

  const respuestasHiloActivo = useMemo(() => {
    if (!mensajeHiloPadre) return [];
    return mensajes.filter((m) => m.parentId === mensajeHiloPadre.id);
  }, [mensajes, mensajeHiloPadre]);

  const mensajesFijados = useMemo(
    () => mensajes.filter((m) => m.fijado === true),
    [mensajes]
  );

  // =========================================================================
  // 5. ACCIONES DE CANALES Y MENSAJES DIRECTOS (1 A 1)
  // =========================================================================
  const abrirMensajeDirecto = async (colega) => {
    if (!colega || colega.email.toLowerCase() === currentUserEmail) return;
    const emailsOrdenados = [currentUserEmail, colega.email.toLowerCase()].sort();
    const dmId = `dm_${emailsOrdenados[0].replace(/[^a-z0-9]/g, '_')}_${emailsOrdenados[1].replace(/[^a-z0-9]/g, '_')}`;

    const existente = canales.find((c) => c.id === dmId);
    if (!existente) {
      await setDoc(
        doc(db, 'workspace_canales', dmId),
        {
          tipo: 'dm',
          nombre: `${currentUserName} & ${colega.nombre}`,
          participantes: emailsOrdenados,
          nombresMap: {
            [currentUserEmail]: currentUserName,
            [colega.email.toLowerCase()]: colega.nombre
          },
          creadoEn: serverTimestamp(),
          ultimoMensajeAt: serverTimestamp()
        },
        { merge: true }
      );
    }

    setCanalActivoId(dmId);
    setSeccionActiva('chat');
    setPanelDerecho(null);
    setMobileSidebarOpen(false);
  };

  const esAdminOSuperadmin = userRole === 'Superadmin' || userRole === 'Admin';

  const puedeGestionarCanal = (canal) => {
    if (!canal || canal.tipo === 'dm') return false;
    return esAdminOSuperadmin || (canal.creadoPor || '').toLowerCase() === currentUserEmail;
  };

  const puedeBorrarCanal = (canal) => {
    if (!canal || canal.tipo === 'dm' || canal.id === 'general') return false;
    return (
      esAdminOSuperadmin ||
      (canal.esPrivado && (canal.creadoPor || '').toLowerCase() === currentUserEmail)
    );
  };

  const abrirModalGestionCanal = (canal) => {
    if (!canal || canal.tipo === 'dm') return;
    const miembrosBase = Array.from(
      new Set([
        ...(canal.miembros || []).map((m) => m.toLowerCase()),
        (canal.creadoPor || currentUserEmail).toLowerCase()
      ].filter(Boolean))
    );
    setCanalEnGestion(canal);
    setEditCanalForm({
      descripcion: canal.descripcion || '',
      esPrivado: Boolean(canal.esPrivado),
      miembros: miembrosBase
    });
    setModalGestionCanalOpen(true);
  };

  const handleGuardarGestionCanal = async () => {
    if (!canalEnGestion || !puedeGestionarCanal(canalEnGestion)) return;
    setGuardandoGestionCanal(true);
    try {
      const miembrosFinal = Array.from(
        new Set([
          ...(editCanalForm.miembros || []).map((m) => m.toLowerCase()),
          (canalEnGestion.creadoPor || currentUserEmail).toLowerCase(),
          currentUserEmail
        ].filter(Boolean))
      );

      await setDoc(
        doc(db, 'workspace_canales', canalEnGestion.id),
        {
          descripcion: editCanalForm.descripcion.trim() || `Canal temático #${canalEnGestion.nombre}`,
          esPrivado: Boolean(editCanalForm.esPrivado),
          miembros: editCanalForm.esPrivado ? miembrosFinal : []
        },
        { merge: true }
      );

      // Sincronizar perímetro de privacidad en recursos de Drive vinculados a este canal
      try {
        const driveQ = query(
          collection(db, 'workspace_drive'),
          where('canalId', '==', canalEnGestion.id)
        );
        const driveSnap = await getDocs(driveQ);
        const miembrosCanalActualizados = editCanalForm.esPrivado
          ? miembrosFinal
          : Array.from(
              new Set([
                ...usuariosEquipo.map((u) => (u.email || '').toLowerCase()).filter(Boolean),
                currentUserEmail
              ])
            );
        await Promise.all(
          driveSnap.docs.map((d) =>
            updateDoc(doc(db, 'workspace_drive', d.id), {
              esCanalPrivado: Boolean(editCanalForm.esPrivado),
              miembrosAutorizados: miembrosCanalActualizados
            })
          )
        );
      } catch (e) {
        console.warn('No se pudieron sincronizar metadatos de Drive del canal:', e);
      }

      await registrarLogAuditoria(
        currentUserEmail,
        'Actualización de Canal (Workspace)',
        `Canal #${canalEnGestion.nombre} actualizado (${editCanalForm.esPrivado ? `Privado: ${miembrosFinal.length} miembros` : 'Abierto para todos'})`
      );

      setMeetToast({
        open: true,
        text: `Configuración del canal #${canalEnGestion.nombre} actualizada.`,
        severity: 'success'
      });
      setModalGestionCanalOpen(false);
    } catch (err) {
      console.error('Error actualizando canal:', err);
      setMeetToast({
        open: true,
        text: 'No se pudo actualizar el canal.',
        severity: 'error'
      });
    } finally {
      setGuardandoGestionCanal(false);
    }
  };

  const handleConfirmarEliminarCanal = async () => {
    if (!canalEnGestion || !puedeBorrarCanal(canalEnGestion)) return;
    setEliminandoCanal(true);
    try {
      const canalIdBorrar = canalEnGestion.id;
      const canalNombreBorrar = canalEnGestion.nombre;

      // 1. Eliminar los mensajes de la subcolección del canal
      const msgsSnap = await getDocs(collection(db, 'workspace_canales', canalIdBorrar, 'mensajes'));
      if (!msgsSnap.empty) {
        await Promise.all(msgsSnap.docs.map((d) => deleteDoc(d.ref)));
      }

      // 2. Eliminar el documento del canal
      await deleteDoc(doc(db, 'workspace_canales', canalIdBorrar));

      await registrarLogAuditoria(
        currentUserEmail,
        'Eliminación de Canal (Workspace)',
        `Canal #${canalNombreBorrar} eliminado permanentemente por ${currentUserEmail}`
      );

      setConfirmDeleteCanalOpen(false);
      setModalGestionCanalOpen(false);
      setCanalEnGestion(null);

      if (canalActivoId === canalIdBorrar) {
        setCanalActivoId('general');
      }

      setMeetToast({
        open: true,
        text: `El canal #${canalNombreBorrar} ha sido eliminado permanentemente.`,
        severity: 'info'
      });
    } catch (err) {
      console.error('Error eliminando canal:', err);
      setMeetToast({
        open: true,
        text: err?.message || 'No se pudo eliminar el canal.',
        severity: 'error'
      });
    } finally {
      setEliminandoCanal(false);
    }
  };

  const handleCrearCanal = async () => {
    const slug = nuevoCanalForm.nombre
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '');

    if (!slug) return;

    const miembrosFinal = Array.from(
      new Set([...(nuevoCanalForm.miembros || []).map((m) => m.toLowerCase()), currentUserEmail])
    );

    await setDoc(doc(db, 'workspace_canales', slug), {
      nombre: slug,
      descripcion: nuevoCanalForm.descripcion.trim() || `Canal temático #${slug}`,
      tipo: 'canal',
      esPrivado: nuevoCanalForm.esPrivado,
      miembros: nuevoCanalForm.esPrivado ? miembrosFinal : [],
      orden: 50,
      creadoPor: currentUserEmail,
      creadoPorNombre: currentUserName,
      creadoEn: serverTimestamp(),
      ultimoMensajeAt: serverTimestamp(),
      ultimoMensajeTexto: `Canal #${slug} creado por ${currentUserName}`
    });

    await registrarLogAuditoria(
      currentUserEmail,
      'Creación de Canal (Workspace)',
      `Canal #${slug} creado (${nuevoCanalForm.esPrivado ? `Privado para ${miembrosFinal.length} miembros` : 'Abierto'})`
    );

    setModalCanalOpen(false);
    setNuevoCanalForm({ nombre: '', descripcion: '', esPrivado: false, miembros: [] });
    setCanalActivoId(slug);
    setSeccionActiva('chat');
  };

  // =========================================================================
  // 6. SUBIDA DE ARCHIVOS, NOTAS DE VOZ, ENCUESTAS Y ENVÍO DE MENSAJES
  // =========================================================================
  const handleSeleccionarArchivos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setArchivosSubiendo(true);
    setProgresoSubida(10);

    try {
      const subidos = [];
      for (const file of files) {
        const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const sRef = storageRef(storage, `workspace_adjuntos/${canalActivoId}/${safeName}`);
        const uploadTask = uploadBytesResumable(sRef, file);

        await new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snap) => {
              const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
              setProgresoSubida(pct);
            },
            reject,
            async () => {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              subidos.push({
                nombre: file.name,
                url,
                tipo: file.type || 'application/octet-stream',
                tamano: file.size
              });
              resolve();
            }
          );
        });
      }

      setAdjuntosPendientes((prev) => [...prev, ...subidos]);
    } catch (err) {
      console.error('Error subiendo adjunto al workspace:', err);
    } finally {
      setArchivosSubiendo(false);
      setProgresoSubida(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // GRABACIÓN DE NOTAS DE VOZ (CLIPS DE AUDIO)
  const iniciarGrabacionAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      cancelarGrabacionFlagRef.current = false;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (grabacionIntervalRef.current) clearInterval(grabacionIntervalRef.current);

        if (cancelarGrabacionFlagRef.current || audioChunksRef.current.length === 0) {
          setGrabandoAudio(false);
          setSegundosGrabacion(0);
          return;
        }

        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const duracionFinal = segundosGrabacion || 1;
        setGrabandoAudio(false);
        setSegundosGrabacion(0);
        setArchivosSubiendo(true);
        setProgresoSubida(20);

        try {
          const ext = (recorder.mimeType || '').includes('mp4') ? 'm4a' : 'webm';
          const fileName = `nota_voz_${Date.now()}.${ext}`;
          const sRef = storageRef(storage, `workspace_adjuntos/${canalActivoId}/${fileName}`);
          const uploadTask = uploadBytesResumable(sRef, blob);

          await new Promise((resolve, reject) => {
            uploadTask.on(
              'state_changed',
              (snap) => {
                setProgresoSubida(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
              },
              reject,
              async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                await addDoc(collection(db, 'workspace_canales', canalActivoId, 'mensajes'), {
                  texto: '🎙️ Nota de voz enviada',
                  autorEmail: currentUserEmail,
                  autorNombre: currentUserName,
                  autorAvatar: user?.photoURL || '',
                  autorRol: userRole,
                  creadoEn: serverTimestamp(),
                  creadoEnMs: Date.now(),
                  reacciones: {},
                  fijado: false,
                  adjuntos: [],
                  audioAdjunto: {
                    url,
                    duracionSegundos: duracionFinal,
                    nombre: `Nota de voz (${Math.floor(duracionFinal / 60)}:${String(duracionFinal % 60).padStart(2, '0')})`
                  },
                  parentId: null,
                  respuestasCount: 0
                });

                await updateDoc(doc(db, 'workspace_canales', canalActivoId), {
                  ultimoMensajeAt: serverTimestamp(),
                  ultimoMensajeMs: Date.now(),
                  ultimoMensajeTexto: '🎙️ Nota de voz',
                  ultimoMensajeAutor: currentUserName
                });
                resolve();
              }
            );
          });
        } catch (err) {
          console.error('Error subiendo nota de voz:', err);
        } finally {
          setArchivosSubiendo(false);
          setProgresoSubida(0);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setGrabandoAudio(true);
      setSegundosGrabacion(0);
      grabacionIntervalRef.current = setInterval(() => {
        setSegundosGrabacion((s) => s + 1);
      }, 1000);
    } catch (err) {
      console.error('No se pudo acceder al micrófono:', err);
      alert('Para grabar una nota de voz, permita el acceso al micrófono en su navegador.');
    }
  };

  const cancelarGrabacionAudio = () => {
    cancelarGrabacionFlagRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      setGrabandoAudio(false);
      setSegundosGrabacion(0);
    }
  };

  const finalizarYEnviarAudio = () => {
    cancelarGrabacionFlagRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // ENCUESTAS Y VOTACIONES RÁPIDAS
  const handleCrearEncuesta = async () => {
    const pregunta = encuestaForm.pregunta.trim();
    const opcionesValidas = encuestaForm.opciones.map((o) => o.trim()).filter(Boolean);
    if (!pregunta || opcionesValidas.length < 2 || !canalActivoId) return;

    const estructuraEncuesta = {
      pregunta,
      cerrada: false,
      opciones: opcionesValidas.map((texto, idx) => ({
        id: `opt_${idx}_${Date.now()}`,
        texto,
        votos: []
      }))
    };

    try {
      await addDoc(collection(db, 'workspace_canales', canalActivoId, 'mensajes'), {
        texto: `📊 *Encuesta:* ${pregunta}`,
        autorEmail: currentUserEmail,
        autorNombre: currentUserName,
        autorAvatar: user?.photoURL || '',
        autorRol: userRole,
        creadoEn: serverTimestamp(),
        creadoEnMs: Date.now(),
        reacciones: {},
        fijado: false,
        adjuntos: [],
        encuesta: estructuraEncuesta,
        parentId: null,
        respuestasCount: 0
      });

      await updateDoc(doc(db, 'workspace_canales', canalActivoId), {
        ultimoMensajeAt: serverTimestamp(),
        ultimoMensajeMs: Date.now(),
        ultimoMensajeTexto: `📊 Encuesta: ${pregunta}`,
        ultimoMensajeAutor: currentUserName
      });

      setModalEncuestaOpen(false);
      setEncuestaForm({ pregunta: '', opciones: ['', ''] });
    } catch (e) {
      console.error('Error creando encuesta:', e);
    }
  };

  const handleVotarEncuesta = async (msg, opcionId) => {
    if (!msg.encuesta || msg.encuesta.cerrada) return;
    try {
      const nuevasOpciones = (msg.encuesta.opciones || []).map((opt) => {
        const votosActuales = Array.isArray(opt.votos) ? [...opt.votos] : [];
        if (opt.id === opcionId) {
          const idx = votosActuales.indexOf(currentUserEmail);
          if (idx > -1) {
            votosActuales.splice(idx, 1);
          } else {
            votosActuales.push(currentUserEmail);
          }
        }
        return { ...opt, votos: votosActuales };
      });

      await updateDoc(doc(db, 'workspace_canales', canalActivoId, 'mensajes', msg.id), {
        'encuesta.opciones': nuevasOpciones
      });
    } catch (e) {
      console.error('Error registrando voto:', e);
    }
  };

  const handleToggleCerrarEncuesta = async (msg) => {
    if (!msg.encuesta) return;
    try {
      await updateDoc(doc(db, 'workspace_canales', canalActivoId, 'mensajes', msg.id), {
        'encuesta.cerrada': !msg.encuesta.cerrada
      });
    } catch (e) {
      console.error('Error cerrando encuesta:', e);
    }
  };

  // =========================================================================
  // 6.B INTEGRACIÓN NATIVA GOOGLE MEET (EN CANALES/DMs Y SALAS EXTERNAS)
  // =========================================================================
  const obtenerUrlMeetConCuenta = (url = '') => {
    if (!url) return '';
    if (!currentUserEmail) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}authuser=${encodeURIComponent(currentUserEmail)}`;
  };

  const handleCopiarEnlaceMeet = async (url, label = 'Enlace de Google Meet copiado al portapapeles') => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setMeetToast({ open: true, text: label, severity: 'success' });
    } catch {
      setMeetToast({ open: true, text: url, severity: 'info' });
    }
  };

  const handleIniciarMeetEnCanal = async (temaOpcional = '') => {
    if (!canalActivoId || creandoMeetCanal) return;
    setCreandoMeetCanal(true);
    try {
      const espacio = await crearEspacioGoogleMeet(currentUserEmail);
      const tituloBase =
        canalActivo?.tipo === 'dm'
          ? `Videollamada con ${obtenerTituloCanal(canalActivo)}`
          : `Sala de #${obtenerTituloCanal(canalActivo)}`;
      const tituloReunion = temaOpcional ? temaOpcional.trim() : tituloBase;

      const meetObj = {
        meetingUri: espacio.meetingUri,
        meetingCode: espacio.meetingCode,
        spaceName: espacio.spaceName,
        titulo: tituloReunion,
        creadoPorEmail: currentUserEmail,
        creadoPorNombre: currentUserName,
        creadoEnMs: Date.now()
      };

      await setDoc(
        doc(db, 'workspace_canales', canalActivoId),
        {
          meetActivo: meetObj,
          ultimoMensajeAt: serverTimestamp(),
          ultimoMensajeMs: Date.now(),
          ultimoMensajeTexto: `📹 Videollamada de Google Meet activa: ${tituloReunion}`,
          ultimoMensajeAutor: currentUserName
        },
        { merge: true }
      );

      await addDoc(collection(db, 'workspace_canales', canalActivoId, 'mensajes'), {
        texto: `📹 *${currentUserName}* inició una sala de Google Meet en vivo: *${tituloReunion}*`,
        autorEmail: currentUserEmail,
        autorNombre: currentUserName,
        autorAvatar: user?.photoURL || '',
        autorRol: userRole,
        creadoEn: serverTimestamp(),
        creadoEnMs: Date.now(),
        reacciones: {},
        fijado: false,
        adjuntos: [],
        meetAdjunto: meetObj,
        parentId: null,
        respuestasCount: 0
      });

      setMeetToast({
        open: true,
        text: `Sala de Google Meet (${espacio.meetingCode}) iniciada y publicada en el canal.`,
        severity: 'success'
      });

      window.open(obtenerUrlMeetConCuenta(espacio.meetingUri), '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Error iniciando Google Meet en el canal:', err);
      setMeetToast({
        open: true,
        text: err?.message || 'No se pudo crear la sala de Google Meet.',
        severity: 'error'
      });
    } finally {
      setCreandoMeetCanal(false);
    }
  };

  const handleFinalizarMeetEnCanal = async () => {
    if (!canalActivoId) return;
    try {
      await setDoc(
        doc(db, 'workspace_canales', canalActivoId),
        { meetActivo: null },
        { merge: true }
      );
      setMeetToast({
        open: true,
        text: 'Sala activa marcada como finalizada en el canal.',
        severity: 'info'
      });
    } catch (err) {
      console.error('Error finalizando sala Meet:', err);
    }
  };

  const handleGenerarMeetExterno = async () => {
    if (creandoMeetExterno) return;
    setCreandoMeetExterno(true);
    try {
      const espacio = await crearEspacioGoogleMeet(currentUserEmail);
      setMeetExternoForm((prev) => ({
        ...prev,
        meetingUri: espacio.meetingUri,
        meetingCode: espacio.meetingCode,
        compartirCanalId: canalActivo?.tipo !== 'dm' ? canalActivoId : 'general'
      }));
      setMeetToast({
        open: true,
        text: `Sala oficial generada: ${espacio.meetingUri}`,
        severity: 'success'
      });
    } catch (err) {
      console.error('Error generando sala Meet externa:', err);
      setMeetToast({
        open: true,
        text: err?.message || 'No se pudo generar la sala de Google Meet.',
        severity: 'error'
      });
    } finally {
      setCreandoMeetExterno(false);
    }
  };

  const handleCompartirMeetExternoEnCanal = async () => {
    if (!meetExternoForm.meetingUri || !meetExternoForm.compartirCanalId) return;
    try {
      const titulo = (meetExternoForm.titulo || 'Reunión Institucional IIRESODH').trim();
      const meetObj = {
        meetingUri: meetExternoForm.meetingUri,
        meetingCode: meetExternoForm.meetingCode,
        titulo,
        creadoPorEmail: currentUserEmail,
        creadoPorNombre: currentUserName,
        creadoEnMs: Date.now()
      };

      await addDoc(collection(db, 'workspace_canales', meetExternoForm.compartirCanalId, 'mensajes'), {
        texto: `📹 *${currentUserName}* compartió una sala de Google Meet: *${titulo}*`,
        autorEmail: currentUserEmail,
        autorNombre: currentUserName,
        autorAvatar: user?.photoURL || '',
        autorRol: userRole,
        creadoEn: serverTimestamp(),
        creadoEnMs: Date.now(),
        reacciones: {},
        fijado: false,
        adjuntos: [],
        meetAdjunto: meetObj,
        parentId: null,
        respuestasCount: 0
      });

      await setDoc(
        doc(db, 'workspace_canales', meetExternoForm.compartirCanalId),
        {
          ultimoMensajeAt: serverTimestamp(),
          ultimoMensajeMs: Date.now(),
          ultimoMensajeTexto: `📹 Sala de Google Meet: ${titulo}`,
          ultimoMensajeAutor: currentUserName
        },
        { merge: true }
      );

      setMeetToast({
        open: true,
        text: 'Enlace de Google Meet publicado en el canal seleccionado.',
        severity: 'success'
      });
    } catch (err) {
      console.error('Error compartiendo Meet en canal:', err);
    }
  };

  // EJECUCIÓN DE COMANDOS SLASH (/)
  const ejecutarComandoSlash = async (cmdTexto) => {
    const limpio = cmdTexto.trim();
    if (limpio === '/meet' || limpio.startsWith('/meet ')) {
      const temaMeet = limpio.replace('/meet', '').trim();
      setTextoMensaje('');
      setMostrarMenuSlash(false);
      await handleIniciarMeetEnCanal(temaMeet);
      return true;
    }
    if (limpio === '/encuesta') {
      setTextoMensaje('');
      setMostrarMenuSlash(false);
      setModalEncuestaOpen(true);
      return true;
    }
    if (limpio === '/evento') {
      setTextoMensaje('');
      setMostrarMenuSlash(false);
      setSeccionActiva('calendario');
      setSignalNuevoEvento((n) => n + 1);
      return true;
    }
    if (limpio === '/canvas') {
      setTextoMensaje('');
      setMostrarMenuSlash(false);
      setPanelDerecho('canvas');
      return true;
    }
    if (limpio === '/guardados') {
      setTextoMensaje('');
      setMostrarMenuSlash(false);
      setPanelDerecho('guardados');
      return true;
    }
    if (limpio.startsWith('/tarea')) {
      const tituloTarea = limpio.replace('/tarea', '').trim();
      setTextoMensaje('');
      setMostrarMenuSlash(false);
      if (!tituloTarea) {
        setSeccionActiva('proyectos');
        return true;
      }
      // Crear la tarea directamente en Firestore y publicar tarjeta en el canal
      try {
        await addDoc(collection(db, 'workspace_tareas'), {
          titulo: tituloTarea,
          descripcion: `Creada mediante comando rápido /tarea desde #${obtenerTituloCanal(canalActivo)}`,
          estado: 'pendiente',
          prioridad: 'media',
          proyectoId: 'litigios-cidh',
          proyectoNombre: 'Litigios Estratégicos & CIDH',
          proyectoColor: '#1a365d',
          responsables: [currentUserEmail],
          revisorEmail: currentUserEmail,
          revisorNombre: currentUserName,
          subtareas: [],
          enlacesDrive: [],
          canalId: canalActivoId,
          canalNombre: obtenerTituloCanal(canalActivo),
          esCanalPrivado: Boolean(canalActivo?.esPrivado || canalActivo?.tipo === 'dm'),
          creadoPorEmail: currentUserEmail,
          creadoPor: currentUserEmail,
          creadoPorNombre: currentUserName,
          creadoEn: serverTimestamp(),
          creadoEnMs: Date.now()
        });

        await addDoc(collection(db, 'workspace_canales', canalActivoId, 'mensajes'), {
          texto: `⚡ Tarea rápida creada por comando \`/tarea\`: *${tituloTarea}*`,
          autorEmail: currentUserEmail,
          autorNombre: currentUserName,
          autorAvatar: user?.photoURL || '',
          autorRol: userRole,
          creadoEn: serverTimestamp(),
          creadoEnMs: Date.now(),
          reacciones: {},
          fijado: false,
          adjuntos: [],
          tareaAdjunta: {
            titulo: tituloTarea,
            proyectoNombre: 'Gestión General IIRESODH',
            prioridad: 'media'
          },
          parentId: null,
          respuestasCount: 0
        });
      } catch (e) {
        console.error('Error creando tarea por comando:', e);
      }
      return true;
    }
    return false;
  };

  const handleEnviarMensaje = async (esHilo = false) => {
    const texto = esHilo ? textoRespuestaHilo.trim() : textoMensaje.trim();
    const adjuntos = esHilo ? [] : adjuntosPendientes;

    if (!texto && adjuntos.length === 0) return;
    if (!canalActivoId) return;

    // Verificar si es un comando slash (/)
    if (!esHilo && texto.startsWith('/')) {
      const fueComando = await ejecutarComandoSlash(texto);
      if (fueComando) return;
    }

    // Limpiar indicador de escritura en RTDB
    if (!esHilo && currentUserEmail) {
      const userKey = emailToRtdbKey(currentUserEmail);
      rtdbRemove(rtdbRef(rtdb, `typing/${canalActivoId}/${userKey}`)).catch(() => {});
    }

    if (esHilo) {
      setTextoRespuestaHilo('');
    } else {
      setTextoMensaje('');
      setMostrarMenuSlash(false);
      setAdjuntosPendientes([]);
    }

    try {
      const payload = {
        texto,
        autorEmail: currentUserEmail,
        autorNombre: currentUserName,
        autorAvatar: user?.photoURL || '',
        autorRol: userRole,
        creadoEn: serverTimestamp(),
        creadoEnMs: Date.now(),
        reacciones: {},
        fijado: false,
        adjuntos: adjuntos.length > 0 ? adjuntos : [],
        parentId: esHilo && mensajeHiloPadre ? mensajeHiloPadre.id : null,
        respuestasCount: 0
      };

      await addDoc(collection(db, 'workspace_canales', canalActivoId, 'mensajes'), payload);

      if (esHilo && mensajeHiloPadre) {
        await updateDoc(
          doc(db, 'workspace_canales', canalActivoId, 'mensajes', mensajeHiloPadre.id),
          {
            respuestasCount: increment(1),
            ultimaRespuestaAt: serverTimestamp(),
            ultimaRespuestaAutor: currentUserName
          }
        );
      } else {
        await updateDoc(doc(db, 'workspace_canales', canalActivoId), {
          ultimoMensajeAt: serverTimestamp(),
          ultimoMensajeMs: Date.now(),
          ultimoMensajeTexto: texto || `📎 ${adjuntos.length} archivo(s) adjunto(s)`,
          ultimoMensajeAutor: currentUserName
        });
      }
    } catch (err) {
      console.error('Error enviando mensaje:', err);
    }
  };

  // Alternar reacción con emoji
  const handleToggleReaccion = async (mensaje, emoji) => {
    try {
      const reaccionesActuales = { ...(mensaje.reacciones || {}) };
      const listaUsuarios = Array.isArray(reaccionesActuales[emoji])
        ? [...reaccionesActuales[emoji]]
        : [];

      const idx = listaUsuarios.indexOf(currentUserEmail);
      if (idx > -1) {
        listaUsuarios.splice(idx, 1);
      } else {
        listaUsuarios.push(currentUserEmail);
      }

      if (listaUsuarios.length === 0) {
        delete reaccionesActuales[emoji];
      } else {
        reaccionesActuales[emoji] = listaUsuarios;
      }

      await updateDoc(doc(db, 'workspace_canales', canalActivoId, 'mensajes', mensaje.id), {
        reacciones: reaccionesActuales
      });
    } catch (err) {
      console.error('Error actualizando reacción:', err);
    }
  };

  // Fijar / Desfijar mensaje
  const handleTogglePin = async (mensaje) => {
    try {
      await updateDoc(doc(db, 'workspace_canales', canalActivoId, 'mensajes', mensaje.id), {
        fijado: !mensaje.fijado
      });
    } catch (err) {
      console.error('Error fijando mensaje:', err);
    }
  };

  // Guardar edición de mensaje
  const handleGuardarEdicion = async (mensajeId) => {
    if (!textoEdicion.trim()) return;
    try {
      await updateDoc(doc(db, 'workspace_canales', canalActivoId, 'mensajes', mensajeId), {
        texto: textoEdicion.trim(),
        editado: true,
        editadoEn: serverTimestamp()
      });
      setEditandoMensajeId(null);
      setTextoEdicion('');
    } catch (err) {
      console.error('Error editando mensaje:', err);
    }
  };

  // Eliminar mensaje
  const handleEliminarMensaje = async (mensaje) => {
    try {
      await deleteDoc(doc(db, 'workspace_canales', canalActivoId, 'mensajes', mensaje.id));
      if (mensaje.parentId) {
        await updateDoc(
          doc(db, 'workspace_canales', canalActivoId, 'mensajes', mensaje.parentId),
          {
            respuestasCount: increment(-1)
          }
        );
      }
      if (mensajeHiloPadre?.id === mensaje.id) {
        setPanelDerecho(null);
        setMensajeHiloPadre(null);
      }
    } catch (err) {
      console.error('Error eliminando mensaje:', err);
    }
  };

  // =========================================================================
  // 7. HELPERS DE FORMATO Y PRESENCIA
  // =========================================================================
  const miPresencia = presenciaMap[currentUserEmail] || {};
  const miRegistroEquipo = useMemo(
    () => usuariosEquipo.find((u) => u.email.toLowerCase() === currentUserEmail),
    [usuariosEquipo, currentUserEmail]
  );
  const nombrePersonaConectada =
    miRegistroEquipo?.nombre || miPresencia?.nombre || currentUserName;

  const miEstadoActual = useMemo(() => {
    if (miPresencia.estadoId === 'personalizado' && miPresencia.estadoTexto) {
      return {
        id: 'personalizado',
        emoji: miPresencia.estadoEmoji || '💬',
        texto: miPresencia.estadoTexto,
        color: '#457B9D'
      };
    }
    return ESTADOS_USUARIO.find((e) => e.id === miPresencia.estadoId) || ESTADOS_USUARIO[0];
  }, [miPresencia]);

  const estaEnLinea = (email) => {
    const p = presenciaMap[email.toLowerCase()];
    if (!p || p.enLinea !== true || p.estadoId === 'ausente') {
      return false;
    }
    return true;
  };

  const tieneNoLeidos = (canal) => {
    if (canal.id === canalActivoId) return false;
    const ultimoMs = canal.ultimoMensajeMs || 0;
    const miLecturaMs = miPresencia?.lecturasCanales?.[canal.id] || 0;
    return ultimoMs > miLecturaMs && canal.ultimoMensajeAutor !== currentUserName;
  };

  const obtenerTituloCanal = (canal) => {
    if (!canal) return 'general';
    if (canal.tipo === 'dm') {
      const otroEmail = (canal.participantes || []).find((e) => e !== currentUserEmail) || currentUserEmail;
      const colega = usuariosEquipo.find((u) => u.email === otroEmail);
      return colega?.nombre || canal.nombresMap?.[otroEmail] || otroEmail;
    }
    return canal.nombre;
  };

  // Formatear texto con soporte para *negrita*, _cursiva_, `código`, > citas jurídicas, enlaces y @menciones
  const renderizarTextoRico = (texto = '') => {
    if (!texto) return null;
    const lineas = texto.split('\n');

    return lineas.map((linea, idxLinea) => {
      const esCita = linea.trimStart().startsWith('> ');
      const contenidoLinea = esCita ? linea.trimStart().slice(2) : linea;
      const partes = contenidoLinea.split(/(@[\w.-]+|\*[^*]+\*|_[^_]+_|`[^`]+`|https?:\/\/[^\s]+)/g);

      const nodos = partes.map((parte, i) => {
        if (parte.startsWith('@') && parte.length > 1) {
          return (
            <Box
              component="span"
              key={i}
              sx={{
                bgcolor: 'rgba(29, 53, 87, 0.10)',
                color: '#1D3557',
                fontWeight: 700,
                px: 0.6,
                py: 0.1,
                borderRadius: 1,
                fontSize: '0.88em'
              }}
            >
              {parte}
            </Box>
          );
        }
        if (parte.startsWith('*') && parte.endsWith('*') && parte.length > 2) {
          return <strong key={i}>{parte.slice(1, -1)}</strong>;
        }
        if (parte.startsWith('_') && parte.endsWith('_') && parte.length > 2) {
          return <em key={i}>{parte.slice(1, -1)}</em>;
        }
        if (parte.startsWith('`') && parte.endsWith('`') && parte.length > 2) {
          return (
            <Box
              component="code"
              key={i}
              sx={{
                bgcolor: '#f1f5f9',
                color: '#B92F32',
                px: 0.6,
                py: 0.15,
                borderRadius: 1,
                fontFamily: 'monospace',
                fontSize: '0.85em',
                border: '1px solid #e2e8f0'
              }}
            >
              {parte.slice(1, -1)}
            </Box>
          );
        }
        if (parte.startsWith('http://') || parte.startsWith('https://')) {
          return (
            <a
              key={i}
              href={parte}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#457B9D', fontWeight: 600, textDecoration: 'underline', wordBreak: 'break-all' }}
            >
              {parte}
            </a>
          );
        }
        return parte;
      });

      if (esCita) {
        return (
          <Box
            key={idxLinea}
            sx={{
              pl: 1.5,
              py: 0.35,
              my: 0.4,
              borderLeft: '3px solid #457B9D',
              bgcolor: 'rgba(69, 123, 157, 0.06)',
              borderRadius: '0 6px 6px 0',
              color: '#334155',
              fontStyle: 'italic'
            }}
          >
            {nodos}
          </Box>
        );
      }

      return (
        <React.Fragment key={idxLinea}>
          {nodos}
          {idxLinea < lineas.length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  const formatearHoraMensaje = (msg) => {
    try {
      const fecha = msg.creadoEn?.toDate ? msg.creadoEn.toDate() : new Date(msg.creadoEnMs || Date.now());
      return fecha.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  };

  const insertarFormatoEnComposer = (prefijo, sufijo = prefijo) => {
    setTextoMensaje((prev) => `${prev}${prefijo}texto${sufijo}`);
  };

  // Filtrado de barra lateral
  const canalesTematicos = useMemo(() => {
    const lista = canales.filter((c) => c.tipo !== 'dm');
    if (!busquedaSidebar.trim()) return lista;
    return lista.filter((c) => c.nombre.toLowerCase().includes(busquedaSidebar.toLowerCase()));
  }, [canales, busquedaSidebar]);

  const colegasFiltrados = useMemo(() => {
    const soloOtrosColegas = usuariosEquipo.filter(
      (u) => u.email.toLowerCase() !== currentUserEmail
    );
    const base = !busquedaSidebar.trim()
      ? soloOtrosColegas
      : soloOtrosColegas.filter((u) => {
          const term = busquedaSidebar.toLowerCase();
          return (
            u.nombre.toLowerCase().includes(term) ||
            u.email.toLowerCase().includes(term)
          );
        });

    return [...base].sort((a, b) => {
      const aOnline = estaEnLinea(a.email) ? 1 : 0;
      const bOnline = estaEnLinea(b.email) ? 1 : 0;
      if (bOnline !== aOnline) return bOnline - aOnline;
      return (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' });
    });
  }, [usuariosEquipo, busquedaSidebar, currentUserEmail, presenciaMap]);

  return (
    <Box
      sx={{
        ...(isFullscreen
          ? {
              position: 'fixed',
              top: { xs: 56, sm: 64 },
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1300,
              height: { xs: 'calc(100vh - 56px)', sm: 'calc(100vh - 64px)' },
              width: '100vw',
              borderRadius: 0
            }
          : {
              height: { xs: 680, md: 740 },
              width: '100%',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 12px 32px -4px rgba(29, 53, 87, 0.10)'
            }),
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#ffffff',
        overflow: 'hidden'
      }}
    >
      {/* ===================================================================== */}
      {/* BARRA SUPERIOR GLOBAL ESTILO SLACK WORKSPACE                          */}
      {/* ===================================================================== */}
      <Box
        sx={{
          height: 50,
          px: 2,
          bgcolor: '#1D3557',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          flexShrink: 0
        }}
      >
        {/* IZQUIERDA: BRANDING Y PESTAÑAS UNIFICADAS */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
          <IconButton
            size="small"
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            sx={{ color: '#ffffff', display: { xs: 'inline-flex', md: 'none' } }}
          >
            <MenuIcon size={20} />
          </IconButton>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <img
              src="/Isotipo-w.png"
              alt="IIRESODH"
              style={{ width: 28, height: 28, objectFit: 'contain', display: 'block' }}
            />
            <Typography
              variant="subtitle2"
              fontWeight="800"
              sx={{ letterSpacing: 0.3, display: { xs: 'none', sm: 'block' } }}
            >
              IIRESODH Workspace
            </Typography>
          </Box>

          {/* CONMUTADOR PRINCIPAL: MENSAJERÍA + PROYECTOS + CALENDARIO + GOOGLE DRIVE */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: 'rgba(255,255,255,0.08)',
              p: 0.4,
              borderRadius: 2,
              gap: 0.5,
              overflowX: 'auto'
            }}
          >
            <Button
              size="small"
              startIcon={<MessageSquare size={15} />}
              onClick={() => setSeccionActiva('chat')}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.78rem',
                px: 1.25,
                py: 0.4,
                borderRadius: 1.5,
                whiteSpace: 'nowrap',
                color: seccionActiva === 'chat' ? '#1D3557' : 'rgba(255,255,255,0.88)',
                bgcolor: seccionActiva === 'chat' ? '#F1FAEE' : 'transparent',
                '&:hover': {
                  bgcolor: seccionActiva === 'chat' ? '#FFFFFF' : 'rgba(255,255,255,0.14)'
                }
              }}
            >
              Canales y Mensajes
            </Button>

            <Button
              size="small"
              startIcon={<FolderKanban size={15} />}
              onClick={() => setSeccionActiva('proyectos')}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.78rem',
                px: 1.25,
                py: 0.4,
                borderRadius: 1.5,
                whiteSpace: 'nowrap',
                color: seccionActiva === 'proyectos' ? '#1D3557' : 'rgba(255,255,255,0.88)',
                bgcolor: seccionActiva === 'proyectos' ? '#F1FAEE' : 'transparent',
                '&:hover': {
                  bgcolor: seccionActiva === 'proyectos' ? '#FFFFFF' : 'rgba(255,255,255,0.14)'
                }
              }}
            >
              Proyectos y Tareas
            </Button>

            <Button
              size="small"
              startIcon={<CalendarIcon size={15} />}
              onClick={() => setSeccionActiva('calendario')}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.78rem',
                px: 1.25,
                py: 0.4,
                borderRadius: 1.5,
                whiteSpace: 'nowrap',
                color: seccionActiva === 'calendario' ? '#1D3557' : 'rgba(255,255,255,0.88)',
                bgcolor: seccionActiva === 'calendario' ? '#F1FAEE' : 'transparent',
                '&:hover': {
                  bgcolor: seccionActiva === 'calendario' ? '#FFFFFF' : 'rgba(255,255,255,0.14)'
                }
              }}
            >
              Calendario & Agenda
            </Button>

            <Button
              size="small"
              startIcon={<HardDrive size={15} />}
              onClick={() => setSeccionActiva('drive')}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.78rem',
                px: 1.25,
                py: 0.4,
                borderRadius: 1.5,
                whiteSpace: 'nowrap',
                color: seccionActiva === 'drive' ? '#1D3557' : 'rgba(255,255,255,0.88)',
                bgcolor: seccionActiva === 'drive' ? '#F1FAEE' : 'transparent',
                '&:hover': {
                  bgcolor: seccionActiva === 'drive' ? '#FFFFFF' : 'rgba(255,255,255,0.14)'
                }
              }}
            >
              Google Drive
            </Button>
          </Box>
        </Box>

        {/* DERECHA: SALA INSTANTÁNEA MEET, ESTADO PERSONALIZADO DEL USUARIO Y MODO PANTALLA COMPLETA */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Crear sala instantánea de Google Meet (para reuniones externas, clientes, testigos o equipo)">
            <Button
              size="small"
              startIcon={<Video size={15} />}
              onClick={() => {
                setMeetExternoForm((prev) => ({
                  ...prev,
                  compartirCanalId: canalActivo?.tipo !== 'dm' ? canalActivoId : 'general'
                }));
                setModalMeetExternoOpen(true);
              }}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.76rem',
                px: 1.35,
                py: 0.4,
                borderRadius: 1.5,
                whiteSpace: 'nowrap',
                color: '#ffffff',
                bgcolor: '#0f9d58',
                border: '1px solid rgba(255,255,255,0.24)',
                '&:hover': { bgcolor: '#0b8043' }
              }}
            >
              Sala Meet
            </Button>
          </Tooltip>

          <Popover
            anchorEl={anchorEstadoUsuario}
            open={Boolean(anchorEstadoUsuario)}
            onClose={() => {
              setAnchorEstadoUsuario(null);
              setMostrarSelectorEmojiEstado(false);
            }}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            PaperProps={{
              sx: {
                width: 315,
                p: 1,
                mt: 0.75,
                borderRadius: '0 0 10px 10px',
                borderTop: '3px solid #1D3557',
                boxShadow: '0 10px 28px rgba(29, 53, 87, 0.18)'
              }
            }}
          >
            <Box sx={{ px: 1, py: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="caption" fontWeight="800" color="#1D3557" sx={{ letterSpacing: '0.04em' }}>
                ESTADO DE DISPONIBILIDAD
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.68rem', color: '#64748b' }}>
                {nombrePersonaConectada}
              </Typography>
            </Box>

            {/* Input para estado personalizado libre + botón selector de emoji */}
            <Box sx={{ px: 1, pb: 1, display: 'flex', gap: 0.75, alignItems: 'center' }}>
              <Tooltip title="Elegir ícono / emoji para tu estado">
                <Button
                  variant="outlined"
                  onClick={() => setMostrarSelectorEmojiEstado((v) => !v)}
                  sx={{
                    minWidth: 40,
                    width: 40,
                    height: 37,
                    p: 0,
                    fontSize: '1.15rem',
                    lineHeight: 1,
                    borderRadius: 1.5,
                    borderColor: mostrarSelectorEmojiEstado ? '#1D3557' : '#cbd5e1',
                    bgcolor: mostrarSelectorEmojiEstado ? 'rgba(29, 53, 87, 0.08)' : '#f8fafc',
                    '&:hover': { bgcolor: '#f1f5f9', borderColor: '#1D3557' }
                  }}
                >
                  {customStatusEmoji || '💬'}
                </Button>
              </Tooltip>

              <TextField
                size="small"
                placeholder="Estado personalizado..."
                fullWidth
                value={customStatusTexto}
                onChange={(e) => setCustomStatusTexto(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter' && customStatusTexto.trim()) {
                    e.preventDefault();
                    handleGuardarEstadoLibre();
                    setMostrarSelectorEmojiEstado(false);
                  }
                }}
                slotProps={{ input: { sx: { fontSize: '0.82rem', bgcolor: '#ffffff' } } }}
              />
              <Button
                size="small"
                variant="contained"
                disabled={!customStatusTexto.trim()}
                onClick={() => {
                  handleGuardarEstadoLibre();
                  setMostrarSelectorEmojiEstado(false);
                }}
                sx={{
                  minWidth: 'auto',
                  height: 37,
                  px: 1.4,
                  bgcolor: '#1D3557',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.76rem',
                  '&:hover': { bgcolor: '#152742' }
                }}
              >
                OK
              </Button>
            </Box>

            {/* Paleta desplegable de emojis al pulsar el recuadro de ícono */}
            {mostrarSelectorEmojiEstado && (
              <Box
                sx={{
                  mx: 1,
                  mb: 1,
                  p: 1,
                  borderRadius: 1.5,
                  bgcolor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(8, 1fr)',
                  gap: 0.5
                }}
              >
                {[
                  '💬', '⚖️', '🏛️', '📅', '📝', '📞', '✈️', '☕',
                  '🍽️', '🏠', '🔕', '⏳', '🔍', '🌴', '🤒', '💡'
                ].map((emo) => (
                  <IconButton
                    key={emo}
                    size="small"
                    onClick={() => {
                      setCustomStatusEmoji(emo);
                      setMostrarSelectorEmojiEstado(false);
                    }}
                    sx={{
                      fontSize: '1.05rem',
                      p: 0.4,
                      borderRadius: 1,
                      bgcolor: customStatusEmoji === emo ? 'rgba(29, 53, 87, 0.14)' : 'transparent',
                      '&:hover': { bgcolor: 'rgba(29, 53, 87, 0.1)' }
                    }}
                  >
                    <span>{emo}</span>
                  </IconButton>
                ))}
              </Box>
            )}

            <Divider sx={{ my: 0.5 }} />
            {ESTADOS_USUARIO.map((est) => (
              <MenuItem
                key={est.id}
                selected={miEstadoActual.id === est.id}
                onClick={() => {
                  handleCambiarEstado(est);
                  setMostrarSelectorEmojiEstado(false);
                }}
                sx={{ fontSize: '0.84rem', gap: 1.25, borderRadius: 1.25, py: 0.8 }}
              >
                <span style={{ fontSize: '1rem' }}>{est.emoji}</span>
                <span>{est.texto}</span>
              </MenuItem>
            ))}
          </Popover>

          <Button
            size="small"
            onClick={() => setIsFullscreen(!isFullscreen)}
            startIcon={isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.78rem',
              px: 1.5,
              py: 0.4,
              borderRadius: 1.5,
              color: '#ffffff',
              bgcolor: isFullscreen ? '#B92F32' : 'rgba(255,255,255,0.12)',
              border: isFullscreen ? 'none' : '1px solid rgba(255,255,255,0.2)',
              '&:hover': {
                bgcolor: isFullscreen ? '#9e2528' : 'rgba(255,255,255,0.22)'
              }
            }}
          >
            {isFullscreen ? 'Volver al Hub (Esc)' : 'Expandir'}
          </Button>
        </Box>
      </Box>

      {/* ===================================================================== */}
      {/* CUERPO PRINCIPAL: SIDEBAR + ÁREA CENTRAL + PANEL DERECHO              */}
      {/* ===================================================================== */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden', position: 'relative' }}>
        {/* ------------------------------------------------------------------- */}
        {/* 1. BARRA LATERAL IZQUIERDA (PERFIL/ESTADO, GUARDADOS, CANALES Y DM) */}
        {/* ------------------------------------------------------------------- */}
        <Box
          sx={{
            width: 265,
            bgcolor: '#162944',
            color: '#e2e8f0',
            display: {
              xs: mobileSidebarOpen ? 'flex' : 'none',
              md: 'flex'
            },
            position: { xs: 'absolute', md: 'relative' },
            zIndex: { xs: 20, md: 1 },
            height: '100%',
            flexDirection: 'column',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0
          }}
        >
          {/* BLOQUE DE PERSONA CONECTADA + DISPONIBILIDAD Y ESTADO PERSONALIZADO (DEBAJO DE IIRESODH WORKSPACE) */}
          <Box sx={{ px: 1.5, pt: 1.25, pb: 0.5 }}>
            <Tooltip title="Haz clic para cambiar tu disponibilidad o escribir un estado personalizado">
              <Box
                onClick={(e) => setAnchorEstadoUsuario(e.currentTarget)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  px: 1.2,
                  py: 0.75,
                  borderRadius: '0 8px 8px 0',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderLeft: `3px solid ${miEstadoActual.color || '#22c55e'}`,
                  bgcolor: 'rgba(15, 28, 48, 0.55)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.09)',
                    borderColor: 'rgba(255,255,255,0.24)'
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
                  <Box sx={{ position: 'relative', flexShrink: 0 }}>
                    <Avatar
                      src={user?.photoURL}
                      sx={{
                        width: 28,
                        height: 28,
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        bgcolor: '#457B9D',
                        color: '#ffffff',
                        border: '1px solid rgba(255,255,255,0.22)'
                      }}
                    >
                      {(nombrePersonaConectada || 'U').charAt(0).toUpperCase()}
                    </Avatar>
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: -1,
                        right: -1,
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        bgcolor: miEstadoActual.color || '#22c55e',
                        border: '1.5px solid #162944'
                      }}
                    />
                  </Box>

                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      noWrap
                      sx={{
                        fontSize: '0.79rem',
                        fontWeight: 800,
                        color: '#ffffff',
                        lineHeight: 1.15
                      }}
                    >
                      {nombrePersonaConectada}
                    </Typography>
                    <Typography
                      noWrap
                      sx={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: '#A8DADC',
                        lineHeight: 1.2,
                        mt: 0.15,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.4
                      }}
                    >
                      <span>{miEstadoActual.emoji}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {miEstadoActual.texto}
                      </span>
                    </Typography>
                  </Box>
                </Box>

                <Edit3 size={13} color="#94a3b8" style={{ flexShrink: 0, opacity: 0.85 }} />
              </Box>
            </Tooltip>
          </Box>

          {/* BUSCADOR DE CANALES Y COLEGAS */}
          <Box sx={{ p: 1.5, pt: 1, pb: 1 }}>
            <TextField
              size="small"
              placeholder="Ir a canal o colega..."
              value={busquedaSidebar}
              onChange={(e) => setBusquedaSidebar(e.target.value)}
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={15} color="#94a3b8" />
                    </InputAdornment>
                  ),
                  sx: {
                    bgcolor: 'rgba(15, 28, 48, 0.7)',
                    color: '#ffffff',
                    borderRadius: 2,
                    fontSize: '0.82rem',
                    height: 34,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' }
                  }
                }
              }}
            />
          </Box>

          {/* ACCESO RÁPIDO A ELEMENTOS GUARDADOS ("PARA MÁS TARDE") */}
          <Box sx={{ px: 1.5, pb: 1 }}>
            <Box
              onClick={() => {
                setSeccionActiva('chat');
                setPanelDerecho(panelDerecho === 'guardados' ? null : 'guardados');
                setMobileSidebarOpen(false);
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 1.25,
                py: 0.8,
                borderRadius: '0 8px 8px 0',
                borderLeft: panelDerecho === 'guardados' ? '3px solid #B92F32' : '3px solid transparent',
                cursor: 'pointer',
                bgcolor: panelDerecho === 'guardados' ? 'rgba(69, 123, 157, 0.28)' : 'rgba(255,255,255,0.04)',
                color: '#F1FAEE',
                '&:hover': { bgcolor: 'rgba(69, 123, 157, 0.22)' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Bookmark size={15} color="#A8DADC" />
                <Typography variant="body2" sx={{ fontSize: '0.82rem', fontWeight: 700 }}>
                  Guardados (Para más tarde)
                </Typography>
              </Box>
              {mensajesGuardados.length > 0 && (
                <Chip
                  label={mensajesGuardados.length}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    bgcolor: '#B92F32',
                    color: '#FFFFFF'
                  }}
                />
              )}
            </Box>
          </Box>

          {/* LISTA NAVEGABLE DE CANALES Y MENSAJES DIRECTOS */}
          <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 1, pb: 2 }}>
            {/* SECCIÓN CANALES */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 1,
                py: 0.75
              }}
            >
              <Typography
                variant="caption"
                fontWeight="800"
                sx={{ color: '#A8DADC', letterSpacing: 0.6, fontSize: '0.7rem' }}
              >
                CANALES INSTITUCIONALES
              </Typography>
              <Tooltip title="Crear nuevo canal">
                <IconButton
                  size="small"
                  onClick={() => setModalCanalOpen(true)}
                  sx={{ color: '#cbd5e1', p: 0.3, '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
                >
                  <Plus size={15} />
                </IconButton>
              </Tooltip>
            </Box>

            {canalesTematicos.map((canal) => {
              const activo = seccionActiva === 'chat' && canalActivo?.id === canal.id;
              const noLeido = tieneNoLeidos(canal);
              const cantMiembros = Array.from(
                new Set([...(canal.miembros || []), canal.creadoPor].filter(Boolean))
              ).length;
              return (
                <Box
                  key={canal.id}
                  onClick={() => {
                    setCanalActivoId(canal.id);
                    setSeccionActiva('chat');
                    if (panelDerecho === 'hilo') setPanelDerecho(null);
                    setMobileSidebarOpen(false);
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 1.25,
                    py: 0.75,
                    mb: 0.3,
                    borderRadius: '0 6px 6px 0',
                    borderLeft: activo ? '3px solid #B92F32' : '3px solid transparent',
                    cursor: 'pointer',
                    bgcolor: activo ? '#457B9D' : 'transparent',
                    color: activo ? '#ffffff' : noLeido ? '#ffffff' : '#cbd5e1',
                    fontWeight: activo || noLeido ? 700 : 500,
                    '&:hover': {
                      bgcolor: activo ? '#457B9D' : 'rgba(255,255,255,0.07)',
                      '& .canal-manage-icon': { opacity: 1 }
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
                    {canal.esPrivado ? (
                      <Tooltip title={`Canal privado (${cantMiembros} miembro${cantMiembros === 1 ? '' : 's'})`}>
                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                          <Lock size={14} style={{ flexShrink: 0, color: '#fbbf24' }} />
                        </Box>
                      </Tooltip>
                    ) : (
                      <Hash size={15} style={{ flexShrink: 0, opacity: 0.85 }} />
                    )}
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{ fontSize: '0.85rem', fontWeight: 'inherit' }}
                    >
                      {canal.nombre}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                    {canal.esPrivado && (
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.66rem',
                          px: 0.5,
                          py: 0.05,
                          borderRadius: 1,
                          bgcolor: 'rgba(251, 191, 36, 0.16)',
                          color: '#fde68a',
                          fontWeight: 700
                        }}
                      >
                        {cantMiembros}
                      </Typography>
                    )}
                    {canal.meetActivo?.meetingUri && (
                      <Tooltip title={`Sala de Google Meet activa: ${canal.meetActivo.titulo || canal.meetActivo.meetingCode}`}>
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            px: 0.5,
                            py: 0.15,
                            borderRadius: 1,
                            bgcolor: '#16a34a',
                            color: '#ffffff'
                          }}
                        >
                          <Video size={11} />
                        </Box>
                      </Tooltip>
                    )}
                    {(puedeGestionarCanal(canal) || puedeBorrarCanal(canal)) && (
                      <Tooltip title="Gestionar miembros o eliminar canal">
                        <IconButton
                          size="small"
                          className="canal-manage-icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirModalGestionCanal(canal);
                          }}
                          sx={{
                            p: 0.25,
                            color: '#e2e8f0',
                            opacity: { xs: 0.8, md: 0 },
                            transition: 'opacity 0.15s',
                            '&:hover': { color: '#ffffff', bgcolor: 'rgba(255,255,255,0.16)' }
                          }}
                        >
                          <Settings size={13} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {noLeido && (
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: '#A8DADC',
                          flexShrink: 0
                        }}
                      />
                    )}
                  </Box>
                </Box>
              );
            })}

            <Button
              size="small"
              startIcon={<Plus size={14} />}
              onClick={() => setModalCanalOpen(true)}
              sx={{
                mt: 0.5,
                mb: 2,
                color: '#A8DADC',
                textTransform: 'none',
                fontSize: '0.78rem',
                justifyContent: 'flex-start',
                px: 1.25,
                '&:hover': { color: '#ffffff', bgcolor: 'rgba(255,255,255,0.06)' }
              }}
            >
              Añadir canal
            </Button>

            {/* SECCIÓN MENSAJES DIRECTOS (1 A 1) */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 1,
                py: 0.75
              }}
            >
              <Typography
                variant="caption"
                fontWeight="800"
                sx={{ color: '#A8DADC', letterSpacing: 0.6, fontSize: '0.7rem' }}
              >
                MENSAJES DIRECTOS ({colegasFiltrados.length})
              </Typography>
            </Box>

            {colegasFiltrados.map((colega) => {
              const emailsOrd = [currentUserEmail, colega.email.toLowerCase()].sort();
              const dmId = `dm_${emailsOrd[0].replace(/[^a-z0-9]/g, '_')}_${emailsOrd[1].replace(/[^a-z0-9]/g, '_')}`;
              const canalDm = canales.find((c) => c.id === dmId);
              const activo = seccionActiva === 'chat' && canalActivo?.id === dmId;
              const noLeido = canalDm ? tieneNoLeidos(canalDm) : false;
              const online = estaEnLinea(colega.email);
              const presColega = presenciaMap[colega.email.toLowerCase()];
              const esYo = colega.email.toLowerCase() === currentUserEmail;

              return (
                <Box
                  key={colega.email}
                  onClick={() => abrirMensajeDirecto(colega)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 1.25,
                    py: 0.7,
                    mb: 0.3,
                    borderRadius: '0 6px 6px 0',
                    borderLeft: activo ? '3px solid #B92F32' : '3px solid transparent',
                    cursor: 'pointer',
                    bgcolor: activo ? '#457B9D' : 'transparent',
                    color: activo ? '#ffffff' : '#cbd5e1',
                    '&:hover': {
                      bgcolor: activo ? '#457B9D' : 'rgba(255,255,255,0.07)'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, overflow: 'hidden' }}>
                    <Box sx={{ position: 'relative', flexShrink: 0 }}>
                      <Avatar
                        src={presColega?.avatar || ''}
                        sx={{
                          width: 24,
                          height: 24,
                          fontSize: '0.72rem',
                          fontWeight: 'bold',
                          bgcolor: '#334155'
                        }}
                      >
                        {colega.nombre.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: -1,
                          right: -1,
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: online ? '#22c55e' : '#64748b',
                          border: '1.5px solid #162944'
                        }}
                      />
                    </Box>

                    <Box sx={{ overflow: 'hidden' }}>
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{
                          fontSize: '0.83rem',
                          fontWeight: activo || noLeido ? 700 : 500,
                          lineHeight: 1.2
                        }}
                      >
                        {colega.nombre} {esYo && '(tú)'}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {canalDm?.meetActivo?.meetingUri && (
                      <Tooltip title="Videollamada de Google Meet activa">
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            px: 0.5,
                            py: 0.15,
                            borderRadius: 1,
                            bgcolor: '#16a34a',
                            color: '#ffffff'
                          }}
                        >
                          <Video size={11} />
                        </Box>
                      </Tooltip>
                    )}
                    {presColega?.estadoEmoji && presColega.estadoId !== 'disponible' && (
                      <Tooltip title={presColega.estadoTexto || ''}>
                        <span style={{ fontSize: '0.75rem' }}>{presColega.estadoEmoji}</span>
                      </Tooltip>
                    )}
                    {noLeido && (
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: '#A8DADC'
                        }}
                      />
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* ------------------------------------------------------------------- */}
        {/* 2. ÁREA CENTRAL: CHAT, PROYECTOS KANBAN, CALENDARIO O GOOGLE DRIVE  */}
        {/* ------------------------------------------------------------------- */}
        {seccionActiva === 'calendario' ? (
          <Box sx={{ flexGrow: 1, height: '100%', overflow: 'hidden' }}>
            <CalendarioHibridoPanel
              currentUser={user}
              userName={currentUserName}
              userRole={userRole}
              usuariosEquipo={usuariosEquipo}
              canalesDisponibles={canales}
              initialChannelId={canalActivo?.tipo !== 'dm' ? canalActivo?.id : 'general'}
              openNewModalSignal={signalNuevoEvento}
              onIrACanal={(chId) => {
                setCanalActivoId(chId);
                setSeccionActiva('chat');
              }}
            />
          </Box>
        ) : seccionActiva === 'proyectos' ? (
          <Box sx={{ flexGrow: 1, height: '100%', overflow: 'hidden' }}>
            <ProyectosKanbanPanel
              currentUser={user}
              userName={currentUserName}
              userRole={userRole}
              isFullscreen={isFullscreen}
              usuariosEquipo={usuariosEquipo}
              canalesDisponibles={canales}
              canalActivoInicialId={canalActivo?.tipo !== 'dm' ? canalActivo?.id : 'general'}
              onAbrirDrivePreview={(item) => {
                setDrivePreviewItem(item);
                setSeccionActiva('drive');
              }}
              onIrACanal={(chId) => {
                setCanalActivoId(chId);
                setSeccionActiva('chat');
              }}
            />
          </Box>
        ) : seccionActiva === 'drive' ? (
          <Box sx={{ flexGrow: 1, height: '100%', overflow: 'hidden' }}>
            <GoogleDriveWorkspacePanel
              currentUser={user}
              userName={currentUserName}
              userRole={userRole}
              usuariosEquipo={usuariosEquipo}
              canalesDisponibles={canales}
              canalActivoInicialId={canalActivo?.id || 'general'}
              initialPreviewItem={drivePreviewItem}
              onClearInitialPreview={() => setDrivePreviewItem(null)}
              onIrACanal={(chId) => {
                setCanalActivoId(chId);
                setSeccionActiva('chat');
              }}
            />
          </Box>
        ) : (
          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* CABECERA DEL CANAL / DM ACTIVO */}
            <Box
              sx={{
                px: { xs: 2, sm: 2.5 },
                py: 1.25,
                bgcolor: '#ffffff',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
                flexShrink: 0
              }}
            >
              <Box sx={{ overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  {canalActivo?.tipo === 'dm' ? (
                    <Users size={18} color="#1D3557" />
                  ) : canalActivo?.esPrivado ? (
                    <Lock size={18} color="#b45309" />
                  ) : (
                    <Hash size={19} color="#1D3557" />
                  )}
                  <Typography variant="subtitle1" fontWeight="800" color="#1D3557" noWrap>
                    {obtenerTituloCanal(canalActivo)}
                  </Typography>
                  {canalActivo?.tipo === 'dm' ? (
                    <Chip
                      label="Mensaje Directo"
                      size="small"
                      sx={{ height: 20, fontSize: '0.68rem', bgcolor: '#f1f5f9', fontWeight: 600 }}
                    />
                  ) : canalActivo?.esPrivado ? (
                    <Tooltip title="Ver o editar los miembros autorizados en este canal privado">
                      <Chip
                        icon={<Lock size={11} />}
                        label={`Privado • ${
                          Array.from(
                            new Set([...(canalActivo.miembros || []), canalActivo.creadoPor].filter(Boolean))
                          ).length
                        } miembro(s)`}
                        size="small"
                        onClick={() => abrirModalGestionCanal(canalActivo)}
                        sx={{
                          height: 21,
                          fontSize: '0.68rem',
                          bgcolor: '#fef3c7',
                          color: '#92400e',
                          fontWeight: 700,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: '#fde68a' }
                        }}
                      />
                    </Tooltip>
                  ) : (
                    <Tooltip title="Canal abierto para todo el equipo. Haz clic para ver miembros o gestionar el canal.">
                      <Chip
                        icon={<Globe size={11} />}
                        label="Abierto a todos"
                        size="small"
                        onClick={() => abrirModalGestionCanal(canalActivo)}
                        sx={{
                          height: 21,
                          fontSize: '0.68rem',
                          bgcolor: '#f1f5f9',
                          color: '#475569',
                          fontWeight: 600,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: '#e2e8f0' }
                        }}
                      />
                    </Tooltip>
                  )}
                </Box>
                {canalActivo?.descripcion && (
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                    {canalActivo.descripcion}
                  </Typography>
                )}
              </Box>

              {/* ACCIONES DEL CANAL */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                {mostrarBuscadorCanal && (
                  <TextField
                    size="small"
                    placeholder="Buscar en este canal..."
                    value={busquedaEnCanal}
                    onChange={(e) => setBusquedaEnCanal(e.target.value)}
                    sx={{ width: { xs: 140, sm: 200 } }}
                    slotProps={{
                      input: {
                        sx: { height: 32, fontSize: '0.8rem', borderRadius: 2 },
                        endAdornment: busquedaEnCanal && (
                          <IconButton size="small" onClick={() => setBusquedaEnCanal('')}>
                            <X size={13} />
                          </IconButton>
                        )
                      }
                    }}
                  />
                )}

                <Tooltip title="Buscar mensajes en este canal">
                  <IconButton
                    size="small"
                    onClick={() => setMostrarBuscadorCanal(!mostrarBuscadorCanal)}
                    sx={{ color: mostrarBuscadorCanal ? '#1D3557' : '#64748b' }}
                  >
                    <Search size={18} />
                  </IconButton>
                </Tooltip>

                <Tooltip title="Canvas / Notas colaborativas del canal">
                  <Button
                    size="small"
                    variant={panelDerecho === 'canvas' ? 'contained' : 'outlined'}
                    startIcon={<BookOpen size={14} />}
                    onClick={() => setPanelDerecho(panelDerecho === 'canvas' ? null : 'canvas')}
                    sx={{
                      textTransform: 'none',
                      borderRadius: 2,
                      fontWeight: 700,
                      fontSize: '0.74rem',
                      py: 0.35,
                      ...(panelDerecho === 'canvas'
                        ? { bgcolor: '#1D3557', color: '#FFFFFF' }
                        : { borderColor: '#cbd5e1', color: '#1D3557' })
                    }}
                  >
                    Canvas
                  </Button>
                </Tooltip>

                <Tooltip title={`Mensajes fijados (${mensajesFijados.length})`}>
                  <IconButton
                    size="small"
                    onClick={() => setPanelDerecho(panelDerecho === 'fijados' ? null : 'fijados')}
                    sx={{ color: panelDerecho === 'fijados' ? '#1D3557' : '#64748b' }}
                  >
                    <Badge badgeContent={mensajesFijados.length} color="primary">
                      <Pin size={17} />
                    </Badge>
                  </IconButton>
                </Tooltip>

                <Tooltip title={`Elementos guardados (${mensajesGuardados.length})`}>
                  <IconButton
                    size="small"
                    onClick={() => setPanelDerecho(panelDerecho === 'guardados' ? null : 'guardados')}
                    sx={{ color: panelDerecho === 'guardados' ? '#B92F32' : '#64748b' }}
                  >
                    <Badge badgeContent={mensajesGuardados.length} color="secondary">
                      <Bookmark size={17} />
                    </Badge>
                  </IconButton>
                </Tooltip>

                {canalActivo?.tipo !== 'dm' && (
                  <Tooltip title="Miembros, privacidad y opciones del canal">
                    <IconButton
                      size="small"
                      onClick={() => abrirModalGestionCanal(canalActivo)}
                      sx={{ color: '#475569' }}
                    >
                      <Settings size={17} />
                    </IconButton>
                  </Tooltip>
                )}

                {puedeBorrarCanal(canalActivo) && (
                  <Tooltip title={`Eliminar canal #${canalActivo?.nombre}`}>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => {
                        setCanalEnGestion(canalActivo);
                        setConfirmDeleteCanalOpen(true);
                      }}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </Tooltip>
                )}

                {/* BOTÓN NATIVO GOOGLE MEET POR CANAL O MENSAJE DIRECTO */}
                {canalActivo?.meetActivo?.meetingUri ? (
                  <Tooltip title="Hay una videollamada de Google Meet activa en este canal. Haz clic para unirte.">
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<Video size={15} />}
                      onClick={() =>
                        window.open(
                          obtenerUrlMeetConCuenta(canalActivo.meetActivo.meetingUri),
                          '_blank',
                          'noopener,noreferrer'
                        )
                      }
                      sx={{
                        textTransform: 'none',
                        borderRadius: 2,
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        bgcolor: '#0f9d58',
                        color: '#ffffff',
                        '&:hover': { bgcolor: '#0b8043' }
                      }}
                    >
                      Unirse al Meet
                    </Button>
                  </Tooltip>
                ) : (
                  <Tooltip title="Iniciar videollamada oficial de Google Meet en este canal / conversación (o escribe /meet)">
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={creandoMeetCanal}
                      startIcon={
                        creandoMeetCanal ? (
                          <CircularProgress size={13} color="inherit" />
                        ) : (
                          <Video size={15} color="#0f9d58" />
                        )
                      }
                      onClick={() => handleIniciarMeetEnCanal('')}
                      sx={{
                        textTransform: 'none',
                        borderRadius: 2,
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        borderColor: '#86efac',
                        bgcolor: '#f0fdf4',
                        color: '#166534',
                        '&:hover': { bgcolor: '#dcfce7', borderColor: '#22c55e' }
                      }}
                    >
                      {creandoMeetCanal ? 'Creando...' : 'Iniciar Meet'}
                    </Button>
                  </Tooltip>
                )}

                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<CalendarIcon size={15} />}
                  onClick={() => {
                    setSeccionActiva('calendario');
                    setSignalNuevoEvento((n) => n + 1);
                  }}
                  sx={{
                    textTransform: 'none',
                    borderRadius: 2,
                    fontWeight: 600,
                    fontSize: '0.76rem',
                    borderColor: '#cbd5e1',
                    color: '#1D3557',
                    display: { xs: 'none', lg: 'inline-flex' }
                  }}
                >
                  Agendar Evento
                </Button>
              </Box>
            </Box>

            {/* BARRA EN TIEMPO REAL DE SALA ACTIVA DE GOOGLE MEET EN EL CANAL / DM */}
            {canalActivo?.meetActivo?.meetingUri && (
              <Box
                sx={{
                  px: { xs: 1.5, sm: 2.5 },
                  py: 1,
                  bgcolor: '#ecfdf5',
                  borderBottom: '1px solid #a7f3d0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 1.5,
                  flexShrink: 0
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                  <Box
                    sx={{
                      width: 30,
                      height: 30,
                      borderRadius: 1.5,
                      bgcolor: '#0f9d58',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Video size={16} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight="800" color="#065f46" noWrap>
                      🟢 Sala de Google Meet en curso: {canalActivo.meetActivo.titulo}
                    </Typography>
                    <Typography variant="caption" color="#047857" sx={{ display: 'block' }}>
                      Iniciada por {canalActivo.meetActivo.creadoPorNombre || 'Equipo'} • Código:{' '}
                      <strong>{canalActivo.meetActivo.meetingCode || 'meet.google.com'}</strong>
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<ExternalLink size={13} />}
                    onClick={() =>
                      window.open(
                        obtenerUrlMeetConCuenta(canalActivo.meetActivo.meetingUri),
                        '_blank',
                        'noopener,noreferrer'
                      )
                    }
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.74rem',
                      borderRadius: 1.5,
                      bgcolor: '#0f9d58',
                      '&:hover': { bgcolor: '#0b8043' }
                    }}
                  >
                    Unirse ahora
                  </Button>
                  <Tooltip title="Copiar enlace de la reunión para compartir">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Copy size={13} />}
                      onClick={() => handleCopiarEnlaceMeet(canalActivo.meetActivo.meetingUri)}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        fontSize: '0.73rem',
                        borderRadius: 1.5,
                        borderColor: '#6ee7b7',
                        color: '#065f46',
                        bgcolor: '#ffffff'
                      }}
                    >
                      Copiar enlace
                    </Button>
                  </Tooltip>
                  <Tooltip title="Finalizar el aviso de sala activa en el canal">
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      startIcon={<PhoneOff size={13} />}
                      onClick={handleFinalizarMeetEnCanal}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        fontSize: '0.73rem',
                        borderRadius: 1.5,
                        bgcolor: '#ffffff'
                      }}
                    >
                      Finalizar sala
                    </Button>
                  </Tooltip>
                </Box>
              </Box>
            )}

            {/* FEED DE MENSAJES */}
            <Box
              ref={messagesEndRef}
              sx={{
                flexGrow: 1,
                overflowY: 'auto',
                p: { xs: 1.5, sm: 2.5 },
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
                bgcolor: '#ffffff'
              }}
            >
              {loadingMensajes ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : mensajesPrincipales.length === 0 ? (
                <Box
                  sx={{
                    my: 'auto',
                    textAlign: 'center',
                    p: 4,
                    maxWidth: 460,
                    mx: 'auto'
                  }}
                >
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: 3,
                      bgcolor: 'rgba(29, 53, 87, 0.06)',
                      color: '#1D3557',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 1.5
                    }}
                  >
                    {canalActivo?.tipo === 'dm' ? <Users size={26} /> : <Hash size={26} />}
                  </Box>
                  <Typography variant="subtitle1" fontWeight="800" color="#1D3557">
                    Este es el comienzo de {canalActivo?.tipo === 'dm' ? '' : '#'}{obtenerTituloCanal(canalActivo)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {canalActivo?.descripcion ||
                      'Envía un mensaje, graba una nota de voz, lanza una encuesta o escribe / para comandos rápidos.'}
                  </Typography>
                </Box>
              ) : (
                mensajesPrincipales.map((msg) => {
                  const esAutor = msg.autorEmail === currentUserEmail;
                  const puedeBorrar = esAutor || userRole === 'Superadmin' || userRole === 'Admin';
                  const reaccionesEntries = Object.entries(msg.reacciones || {});
                  const guardado = estaGuardadoPorMi(msg.id);
                  const presAutor = presenciaMap[(msg.autorEmail || '').toLowerCase()];

                  return (
                    <Box
                      key={msg.id}
                      sx={{
                        position: 'relative',
                        display: 'flex',
                        gap: 1.5,
                        p: 1.25,
                        borderRadius: msg.fijado || guardado ? '0 8px 8px 0' : 2,
                        bgcolor: msg.fijado
                          ? 'rgba(245, 158, 11, 0.05)'
                          : guardado
                          ? 'rgba(69, 123, 157, 0.05)'
                          : 'transparent',
                        borderLeft: msg.fijado
                          ? '3px solid #f59e0b'
                          : guardado
                          ? '3px solid #457B9D'
                          : '3px solid transparent',
                        transition: 'background-color 0.12s',
                        '&:hover': {
                          bgcolor: msg.fijado ? 'rgba(245, 158, 11, 0.08)' : '#f8fafc',
                          '& .slack-msg-toolbar': { opacity: 1, pointerEvents: 'auto' }
                        }
                      }}
                    >
                      {/* BARRA DE ACCIONES FLOTANTE AL PASAR EL CURSOR (ESTILO SLACK) */}
                      <Paper
                        elevation={2}
                        className="slack-msg-toolbar"
                        sx={{
                          position: 'absolute',
                          top: -12,
                          right: 12,
                          opacity: 0,
                          pointerEvents: 'none',
                          transition: 'opacity 0.15s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.25,
                          px: 0.75,
                          py: 0.25,
                          borderRadius: 2,
                          border: '1px solid #e2e8f0',
                          bgcolor: '#ffffff',
                          zIndex: 5
                        }}
                      >
                        {EMOJIS_RAPIDOS.slice(0, 4).map((em) => (
                          <IconButton
                            key={em}
                            size="small"
                            onClick={() => handleToggleReaccion(msg, em)}
                            sx={{ p: 0.4, fontSize: '0.85rem' }}
                          >
                            {em}
                          </IconButton>
                        ))}
                        <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
                        <Tooltip title="Responder en hilo">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setMensajeHiloPadre(msg);
                              setPanelDerecho('hilo');
                            }}
                            sx={{ p: 0.5 }}
                          >
                            <MessageSquare size={14} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={guardado ? 'Quitar de Guardados' : 'Guardar para más tarde'}>
                          <IconButton
                            size="small"
                            onClick={() => handleToggleGuardado(msg)}
                            sx={{ p: 0.5, color: guardado ? '#B92F32' : 'inherit' }}
                          >
                            <Bookmark size={14} fill={guardado ? '#B92F32' : 'none'} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={msg.fijado ? 'Desfijar mensaje' : 'Fijar en el canal'}>
                          <IconButton
                            size="small"
                            onClick={() => handleTogglePin(msg)}
                            sx={{ p: 0.5, color: msg.fijado ? '#d97706' : 'inherit' }}
                          >
                            <Pin size={14} />
                          </IconButton>
                        </Tooltip>
                        {esAutor && (
                          <Tooltip title="Editar mensaje">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setEditandoMensajeId(msg.id);
                                setTextoEdicion(msg.texto || '');
                              }}
                              sx={{ p: 0.5 }}
                            >
                              <Edit3 size={14} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {puedeBorrar && (
                          <Tooltip title="Eliminar mensaje">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleEliminarMensaje(msg)}
                              sx={{ p: 0.5 }}
                            >
                              <Trash2 size={14} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Paper>

                      {/* AVATAR DEL AUTOR */}
                      <Avatar
                        src={msg.autorAvatar || ''}
                        sx={{
                          width: 38,
                          height: 38,
                          borderRadius: 2,
                          bgcolor: '#1D3557',
                          fontWeight: 'bold',
                          fontSize: '0.95rem',
                          flexShrink: 0,
                          mt: 0.25
                        }}
                      >
                        {(msg.autorNombre || 'U').charAt(0).toUpperCase()}
                      </Avatar>

                      {/* CONTENIDO DEL MENSAJE */}
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
                          <Typography variant="subtitle2" fontWeight="800" color="#1D3557">
                            {msg.autorNombre}
                          </Typography>
                          {presAutor?.estadoEmoji && presAutor.estadoId !== 'disponible' && (
                            <Tooltip title={presAutor.estadoTexto || ''}>
                              <span style={{ fontSize: '0.8rem', cursor: 'help' }}>{presAutor.estadoEmoji}</span>
                            </Tooltip>
                          )}
                          {msg.autorRol && (
                            <Chip
                              label={msg.autorRol}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                bgcolor: 'rgba(29, 53, 87, 0.07)',
                                color: '#1D3557'
                              }}
                            />
                          )}
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                            {formatearHoraMensaje(msg)}
                          </Typography>
                          {msg.editado && (
                            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem' }}>
                              (editado)
                            </Typography>
                          )}
                          {msg.fijado && (
                            <Chip
                              icon={<Pin size={11} />}
                              label="Fijado"
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.65rem',
                                bgcolor: 'rgba(245, 158, 11, 0.15)',
                                color: '#b45309',
                                fontWeight: 'bold'
                              }}
                            />
                          )}
                          {guardado && (
                            <Chip
                              icon={<Bookmark size={11} />}
                              label="Guardado"
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.65rem',
                                bgcolor: 'rgba(69, 123, 157, 0.14)',
                                color: '#1D3557',
                                fontWeight: 'bold'
                              }}
                            />
                          )}
                        </Box>

                        {/* TEXTO O MODO EDICIÓN */}
                        {editandoMensajeId === msg.id ? (
                          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <TextField
                              size="small"
                              multiline
                              fullWidth
                              value={textoEdicion}
                              onChange={(e) => setTextoEdicion(e.target.value)}
                            />
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => handleGuardarEdicion(msg.id)}
                                sx={{ textTransform: 'none', bgcolor: '#1D3557', fontSize: '0.75rem' }}
                              >
                                Guardar
                              </Button>
                              <Button
                                size="small"
                                onClick={() => setEditandoMensajeId(null)}
                                sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                              >
                                Cancelar
                              </Button>
                            </Box>
                          </Box>
                        ) : (
                          <Typography
                            variant="body2"
                            color="#1e293b"
                            sx={{ mt: 0.35, lineHeight: 1.55, wordBreak: 'break-word' }}
                          >
                            {renderizarTextoRico(msg.texto)}
                          </Typography>
                        )}

                        {/* REPRODUCTOR DE NOTA DE VOZ / CLIP DE AUDIO */}
                        {msg.audioAdjunto && (
                          <Paper
                            elevation={0}
                            sx={{
                              mt: 1,
                              p: 1.25,
                              maxWidth: 380,
                              borderRadius: '0 8px 8px 0',
                              border: '1px solid #cbd5e1',
                              borderLeft: '4px solid #1D3557',
                              bgcolor: '#f8fafc',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 0.75
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Volume2 size={15} color="#1D3557" />
                                <Typography variant="caption" fontWeight="800" color="#1D3557">
                                  {msg.audioAdjunto.nombre || 'Nota de voz'}
                                </Typography>
                              </Box>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                Clip de audio
                              </Typography>
                            </Box>
                            <audio
                              controls
                              src={msg.audioAdjunto.url}
                              style={{ width: '100%', height: 34 }}
                            />
                          </Paper>
                        )}

                        {/* TARJETA INTERACTIVA DE ENCUESTA / VOTACIÓN */}
                        {msg.encuesta && (
                          <Paper
                            elevation={0}
                            sx={{
                              mt: 1.25,
                              p: 2,
                              maxWidth: 460,
                              borderRadius: '0 10px 10px 0',
                              border: '1px solid #cbd5e1',
                              borderLeft: '4px solid #457B9D',
                              bgcolor: '#F8FAF8'
                            }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1.25 }}>
                              <Box>
                                <Typography variant="subtitle2" fontWeight="800" color="#1D3557">
                                  📊 {msg.encuesta.pregunta}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {msg.encuesta.cerrada
                                    ? 'Encuesta finalizada'
                                    : 'Haz clic en una opción para emitir o cambiar tu voto'}
                                </Typography>
                              </Box>
                              {(esAutor || userRole === 'Superadmin' || userRole === 'Admin') && (
                                <Chip
                                  label={msg.encuesta.cerrada ? 'Reabrir' : 'Cerrar votación'}
                                  size="small"
                                  onClick={() => handleToggleCerrarEncuesta(msg)}
                                  sx={{
                                    cursor: 'pointer',
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    bgcolor: msg.encuesta.cerrada ? '#e2e8f0' : 'rgba(185, 47, 50, 0.1)',
                                    color: msg.encuesta.cerrada ? '#475569' : '#B92F32'
                                  }}
                                />
                              )}
                            </Box>

                            {(() => {
                              const totalVotos = (msg.encuesta.opciones || []).reduce(
                                (acc, o) => acc + (o.votos?.length || 0),
                                0
                              );
                              return (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                  {(msg.encuesta.opciones || []).map((opt) => {
                                    const cant = opt.votos?.length || 0;
                                    const pct = totalVotos > 0 ? Math.round((cant / totalVotos) * 100) : 0;
                                    const yoVote = (opt.votos || []).includes(currentUserEmail);

                                    return (
                                      <Tooltip
                                        key={opt.id}
                                        title={cant > 0 ? `Votaron: ${(opt.votos || []).join(', ')}` : 'Sin votos aún'}
                                      >
                                        <Box
                                          onClick={() => handleVotarEncuesta(msg, opt.id)}
                                          sx={{
                                            p: 1,
                                            borderRadius: 1.5,
                                            border: yoVote ? '1.5px solid #1D3557' : '1px solid #cbd5e1',
                                            bgcolor: yoVote ? 'rgba(29, 53, 87, 0.05)' : '#ffffff',
                                            cursor: msg.encuesta.cerrada ? 'default' : 'pointer',
                                            transition: 'all 0.15s',
                                            '&:hover': !msg.encuesta.cerrada
                                              ? { borderColor: '#457B9D', bgcolor: '#f8fafc' }
                                              : {}
                                          }}
                                        >
                                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.4 }}>
                                            <Typography variant="body2" fontWeight={yoVote ? 700 : 500} sx={{ fontSize: '0.83rem', color: '#1D3557' }}>
                                              {yoVote && '✓ '}
                                              {opt.texto}
                                            </Typography>
                                            <Typography variant="caption" fontWeight="700" color="#457B9D">
                                              {pct}% ({cant})
                                            </Typography>
                                          </Box>
                                          <LinearProgress
                                            variant="determinate"
                                            value={pct}
                                            sx={{
                                              height: 6,
                                              borderRadius: 1,
                                              bgcolor: '#e2e8f0',
                                              '& .MuiLinearProgress-bar': {
                                                bgcolor: yoVote ? '#1D3557' : '#457B9D'
                                              }
                                            }}
                                          />
                                        </Box>
                                      </Tooltip>
                                    );
                                  })}
                                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, fontSize: '0.7rem' }}>
                                    Total de votos emitidos: {totalVotos}
                                  </Typography>
                                </Box>
                              );
                            })()}
                          </Paper>
                        )}

                        {/* TARJETA DE EVENTO ADJUNTO (SI PROVIENE DEL CALENDARIO) */}
                        {msg.eventoAdjunto && (
                          <Paper
                            elevation={0}
                            sx={{
                              mt: 1,
                              p: 1.5,
                              maxWidth: 420,
                              borderRadius: '0 8px 8px 0',
                              border: '1px solid #cbd5e1',
                              borderLeft: `4px solid ${
                                CATEGORIAS_EVENTO[msg.eventoAdjunto.categoria]?.dot || '#1D3557'
                              }`,
                              bgcolor: '#f8fafc',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 1.5
                            }}
                          >
                            <Box>
                              <Typography variant="subtitle2" fontWeight="bold" color="#1D3557">
                                {msg.eventoAdjunto.titulo}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                📅 {msg.eventoAdjunto.fechaInicio}
                              </Typography>
                            </Box>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => setSeccionActiva('calendario')}
                              sx={{ textTransform: 'none', borderRadius: 1.5, fontSize: '0.73rem', flexShrink: 0 }}
                            >
                              Ver Calendario
                            </Button>
                          </Paper>
                        )}

                        {/* TARJETA INTERACTIVA DE VIDEOLLAMADA GOOGLE MEET */}
                        {msg.meetAdjunto && (
                          <Paper
                            elevation={0}
                            sx={{
                              mt: 1,
                              p: 1.5,
                              maxWidth: 460,
                              borderRadius: '0 10px 10px 0',
                              border: '1px solid #a7f3d0',
                              borderLeft: '4px solid #0f9d58',
                              bgcolor: '#f0fdf4',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: 1.5
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                              <Box
                                sx={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 2,
                                  bgcolor: '#0f9d58',
                                  color: '#ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}
                              >
                                <Video size={18} />
                              </Box>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="subtitle2" fontWeight="800" color="#065f46" noWrap>
                                  {msg.meetAdjunto.titulo || 'Sala de Videollamada Google Meet'}
                                </Typography>
                                <Typography variant="caption" color="#047857" sx={{ display: 'block' }}>
                                  Google Meet Oficial • Código:{' '}
                                  <strong>{msg.meetAdjunto.meetingCode || 'meet.google.com'}</strong>
                                </Typography>
                              </Box>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Tooltip title="Copiar enlace de la sala">
                                <IconButton
                                  size="small"
                                  onClick={() => handleCopiarEnlaceMeet(msg.meetAdjunto.meetingUri)}
                                  sx={{
                                    border: '1px solid #86efac',
                                    bgcolor: '#ffffff',
                                    color: '#065f46',
                                    '&:hover': { bgcolor: '#dcfce7' }
                                  }}
                                >
                                  <Copy size={14} />
                                </IconButton>
                              </Tooltip>
                              <Button
                                size="small"
                                variant="contained"
                                startIcon={<ExternalLink size={13} />}
                                onClick={() =>
                                  window.open(
                                    obtenerUrlMeetConCuenta(msg.meetAdjunto.meetingUri),
                                    '_blank',
                                    'noopener,noreferrer'
                                  )
                                }
                                sx={{
                                  textTransform: 'none',
                                  borderRadius: 1.5,
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  bgcolor: '#0f9d58',
                                  '&:hover': { bgcolor: '#0b8043' }
                                }}
                              >
                                Unirse a Meet
                              </Button>
                            </Box>
                          </Paper>
                        )}

                        {/* TARJETA DE TAREA DE PROYECTO ADJUNTA */}
                        {msg.tareaAdjunta && (
                          <Paper
                            elevation={0}
                            sx={{
                              mt: 1,
                              p: 1.5,
                              maxWidth: 440,
                              borderRadius: '0 8px 8px 0',
                              border: '1px solid #cbd5e1',
                              borderLeft: '4px solid #1D3557',
                              bgcolor: '#f8fafc',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 1.5
                            }}
                          >
                            <Box>
                              <Typography variant="subtitle2" fontWeight="bold" color="#1D3557">
                                📋 {msg.tareaAdjunta.titulo}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                {msg.tareaAdjunta.proyectoNombre}{' '}
                                {msg.tareaAdjunta.fechaLimite ? `• Vence: ${msg.tareaAdjunta.fechaLimite}` : ''}
                              </Typography>
                            </Box>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => setSeccionActiva('proyectos')}
                              sx={{ textTransform: 'none', borderRadius: 1.5, fontSize: '0.73rem', flexShrink: 0 }}
                            >
                              Ver en Proyectos
                            </Button>
                          </Paper>
                        )}

                        {/* TARJETA DE RECURSO DE GOOGLE DRIVE ADJUNTO */}
                        {msg.driveAdjunto && (
                          <Paper
                            elevation={0}
                            sx={{
                              mt: 1,
                              p: 1.5,
                              maxWidth: 440,
                              borderRadius: '0 8px 8px 0',
                              border: '1px solid #bfdbfe',
                              borderLeft: '4px solid #2563eb',
                              bgcolor: '#eff6ff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 1.5
                            }}
                          >
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="subtitle2" fontWeight="bold" color="#1e3a8a" noWrap>
                                📁 {msg.driveAdjunto.titulo}
                              </Typography>
                              <Typography variant="caption" color="#1d4ed8" sx={{ display: 'block' }}>
                                Google Drive • {msg.driveAdjunto.categoria || 'Documento compartido'}
                              </Typography>
                            </Box>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => {
                                setDrivePreviewItem(msg.driveAdjunto);
                                setSeccionActiva('drive');
                              }}
                              sx={{
                                textTransform: 'none',
                                borderRadius: 1.5,
                                fontSize: '0.73rem',
                                bgcolor: '#2563eb',
                                flexShrink: 0
                              }}
                            >
                              Vista Previa Drive
                            </Button>
                          </Paper>
                        )}

                        {/* ARCHIVOS ADJUNTOS E IMÁGENES */}
                        {msg.adjuntos?.length > 0 && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                            {msg.adjuntos.map((adj, idxAdj) => {
                              const esImagen = (adj.tipo || '').startsWith('image/');
                              return esImagen ? (
                                <Box
                                  key={idxAdj}
                                  component="a"
                                  href={adj.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  sx={{
                                    display: 'block',
                                    maxWidth: 260,
                                    borderRadius: 2,
                                    overflow: 'hidden',
                                    border: '1px solid #e2e8f0'
                                  }}
                                >
                                  <img
                                    src={adj.url}
                                    alt={adj.nombre}
                                    style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }}
                                  />
                                </Box>
                              ) : (
                                <Paper
                                  key={idxAdj}
                                  component="a"
                                  href={adj.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  elevation={0}
                                  sx={{
                                    p: 1,
                                    px: 1.5,
                                    borderRadius: 2,
                                    border: '1px solid #e2e8f0',
                                    bgcolor: '#f8fafc',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    textDecoration: 'none',
                                    color: '#1D3557',
                                    '&:hover': { bgcolor: '#f1f5f9' }
                                  }}
                                >
                                  <FileText size={16} color="#457B9D" />
                                  <Typography variant="caption" fontWeight="bold" noWrap sx={{ maxWidth: 180 }}>
                                    {adj.nombre}
                                  </Typography>
                                  <Download size={14} color="#64748b" />
                                </Paper>
                              );
                            })}
                          </Box>
                        )}

                        {/* BARRA DE REACCIONES Y BOTÓN DE RESPUESTAS EN HILO */}
                        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
                          {reaccionesEntries.map(([emoji, listaEmails]) => {
                            const yoReaccione = (listaEmails || []).includes(currentUserEmail);
                            return (
                              <Tooltip key={emoji} title={(listaEmails || []).join(', ')}>
                                <Chip
                                  label={`${emoji} ${(listaEmails || []).length}`}
                                  size="small"
                                  onClick={() => handleToggleReaccion(msg, emoji)}
                                  sx={{
                                    height: 22,
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    bgcolor: yoReaccione ? 'rgba(29, 53, 87, 0.12)' : '#f1f5f9',
                                    color: yoReaccione ? '#1D3557' : '#334155',
                                    border: yoReaccione ? '1px solid #457B9D' : '1px solid #e2e8f0'
                                  }}
                                />
                              </Tooltip>
                            );
                          })}

                          {msg.respuestasCount > 0 && (
                            <Button
                              size="small"
                              startIcon={<MessageSquare size={13} />}
                              endIcon={<ChevronRight size={13} />}
                              onClick={() => {
                                setMensajeHiloPadre(msg);
                                setPanelDerecho('hilo');
                              }}
                              sx={{
                                textTransform: 'none',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: '#457B9D',
                                py: 0.2,
                                px: 1,
                                borderRadius: 1.5,
                                '&:hover': { bgcolor: 'rgba(69, 123, 157, 0.08)' }
                              }}
                            >
                              {msg.respuestasCount}{' '}
                              {msg.respuestasCount === 1 ? 'respuesta en hilo' : 'respuestas en hilo'}
                            </Button>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  );
                })
              )}
            </Box>

            {/* COMPOSITOR DE MENSAJES ENRIQUECIDO (ESTILO SLACK) */}
            <Box sx={{ p: { xs: 1.25, sm: 2 }, pt: 0.5, bgcolor: '#ffffff', position: 'relative' }}>
              {/* INDICADOR "ESTÁ ESCRIBIENDO..." EN TIEMPO REAL */}
              {usuariosEscribiendo.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5, px: 0.5 }}>
                  <Typography variant="caption" sx={{ color: '#457B9D', fontWeight: 700, fontSize: '0.74rem' }}>
                    ✍️{' '}
                    {usuariosEscribiendo.map((u) => u.nombre).join(', ')}{' '}
                    {usuariosEscribiendo.length === 1 ? 'está escribiendo...' : 'están escribiendo...'}
                  </Typography>
                </Box>
              )}

              {/* PALETA FLOTANTE DE COMANDOS SLASH (/) */}
              {mostrarMenuSlash && (
                <Paper
                  elevation={4}
                  sx={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 16,
                    right: 16,
                    mb: 0.5,
                    p: 1,
                    borderRadius: '0 10px 10px 0',
                    border: '1px solid #cbd5e1',
                    borderLeft: '4px solid #1D3557',
                    bgcolor: '#ffffff',
                    zIndex: 25
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1, pb: 0.5 }}>
                    <Typography variant="caption" fontWeight="800" color="#1D3557">
                      ⚡ COMANDOS RÁPIDOS DE WORKSPACE
                    </Typography>
                    <IconButton size="small" onClick={() => setMostrarMenuSlash(false)}>
                      <X size={13} />
                    </IconButton>
                  </Box>
                  <Divider sx={{ mb: 0.5 }} />
                  {SLASH_COMMANDS.map((item) => (
                    <Box
                      key={item.cmd}
                      onClick={() => {
                        if (item.cmd === '/tarea') {
                          setTextoMensaje('/tarea ');
                          setMostrarMenuSlash(false);
                        } else {
                          ejecutarComandoSlash(item.cmd);
                        }
                      }}
                      sx={{
                        p: 0.75,
                        px: 1,
                        borderRadius: 1.5,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                        '&:hover': { bgcolor: '#f1f5f9' }
                      }}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight="800" color="#1D3557" sx={{ fontSize: '0.8rem' }}>
                          {item.ejemplo}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                          {item.desc}
                        </Typography>
                      </Box>
                      <Chip label={item.cmd} size="small" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }} />
                    </Box>
                  ))}
                </Paper>
              )}

              {archivosSubiendo && (
                <LinearProgress variant="determinate" value={progresoSubida} sx={{ mb: 1, borderRadius: 1 }} />
              )}

              {/* BARRA DE GRABACIÓN DE NOTA DE VOZ ACTIVA */}
              {grabandoAudio && (
                <Paper
                  elevation={0}
                  sx={{
                    mb: 1,
                    p: 1,
                    px: 1.5,
                    borderRadius: '0 8px 8px 0',
                    border: '1px solid rgba(185, 47, 50, 0.35)',
                    borderLeft: '4px solid #B92F32',
                    bgcolor: 'rgba(185, 47, 50, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1.5
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: '#B92F32'
                      }}
                    />
                    <Typography variant="body2" fontWeight="800" color="#B92F32" sx={{ fontSize: '0.82rem' }}>
                      Grabando nota de voz... {Math.floor(segundosGrabacion / 60)}:
                      {String(segundosGrabacion % 60).padStart(2, '0')}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Button
                      size="small"
                      onClick={cancelarGrabacionAudio}
                      sx={{ textTransform: 'none', color: '#64748b', fontSize: '0.76rem', fontWeight: 600 }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<Send size={13} />}
                      onClick={finalizarYEnviarAudio}
                      sx={{
                        textTransform: 'none',
                        bgcolor: '#B92F32',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        borderRadius: 1.5,
                        '&:hover': { bgcolor: '#9e2528' }
                      }}
                    >
                      Enviar nota de voz
                    </Button>
                  </Box>
                </Paper>
              )}

              {adjuntosPendientes.length > 0 && (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                  {adjuntosPendientes.map((a, idx) => (
                    <Chip
                      key={idx}
                      label={a.nombre}
                      size="small"
                      onDelete={() =>
                        setAdjuntosPendientes((prev) => prev.filter((_, i) => i !== idx))
                      }
                      sx={{ bgcolor: '#eff6ff', color: '#1e40af', fontWeight: 600 }}
                    />
                  ))}
                </Box>
              )}

              <Paper
                elevation={0}
                sx={{
                  borderRadius: 2.5,
                  border: '1px solid #cbd5e1',
                  overflow: 'hidden',
                  '&:focus-within': {
                    borderColor: '#1D3557',
                    boxShadow: '0 0 0 2px rgba(29, 53, 87, 0.08)'
                  }
                }}
              >
                {/* BARRA DE FORMATO RÁPIDO Y HERRAMIENTAS DE SLACK */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 1,
                    py: 0.4,
                    bgcolor: '#f8fafc',
                    borderBottom: '1px solid #f1f5f9',
                    flexWrap: 'wrap',
                    gap: 0.5
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <Tooltip title="Negrita (*texto*)">
                      <IconButton size="small" onClick={() => insertarFormatoEnComposer('*')}>
                        <Bold size={14} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Cursiva (_texto_)">
                      <IconButton size="small" onClick={() => insertarFormatoEnComposer('_')}>
                        <Italic size={14} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Código (`código`)">
                      <IconButton size="small" onClick={() => insertarFormatoEnComposer('`')}>
                        <Code size={14} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Cita jurídica (> texto)">
                      <IconButton
                        size="small"
                        onClick={() =>
                          setTextoMensaje((prev) => `${prev}${prev ? '\n' : ''}> Cita o extracto`)
                        }
                      >
                        <Quote size={14} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Lista con viñetas">
                      <IconButton
                        size="small"
                        onClick={() =>
                          setTextoMensaje((prev) => `${prev}${prev ? '\n' : ''}• `)
                        }
                      >
                        <ListIcon size={14} />
                      </IconButton>
                    </Tooltip>

                    <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />

                    <Tooltip title="Mencionar a un colega (@)">
                      <IconButton
                        size="small"
                        onClick={(e) => setAnchorMencionComposer(e.currentTarget)}
                      >
                        <AtSign size={14} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Insertar emoji">
                      <IconButton
                        size="small"
                        onClick={(e) => setAnchorEmojiComposer(e.currentTarget)}
                      >
                        <Smile size={14} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Adjuntar archivo o documento">
                      <IconButton
                        size="small"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={archivosSubiendo}
                      >
                        <Paperclip size={14} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={grabandoAudio ? 'Detener grabación' : 'Grabar nota de voz (Clip de audio)'}>
                      <IconButton
                        size="small"
                        onClick={grabandoAudio ? finalizarYEnviarAudio : iniciarGrabacionAudio}
                        sx={{ color: grabandoAudio ? '#B92F32' : 'inherit' }}
                      >
                        {grabandoAudio ? <Square size={14} /> : <Mic size={14} />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Crear encuesta o votación rápida">
                      <IconButton size="small" onClick={() => setModalEncuestaOpen(true)}>
                        <BarChart2 size={14} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Comandos rápidos (/)">
                      <IconButton
                        size="small"
                        onClick={() => setMostrarMenuSlash(!mostrarMenuSlash)}
                        sx={{ color: mostrarMenuSlash ? '#1D3557' : 'inherit' }}
                      >
                        <Zap size={14} />
                      </IconButton>
                    </Tooltip>

                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      hidden
                      onChange={handleSeleccionarArchivos}
                    />
                  </Box>

                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem', pr: 0.5, display: { xs: 'none', sm: 'block' } }}>
                    Escribe <strong>/</strong> para comandos • <strong>Enter</strong> para enviar
                  </Typography>
                </Box>

                {/* INPUT DE TEXTO Y BOTÓN ENVIAR */}
                <Box sx={{ display: 'flex', alignItems: 'flex-end', p: 1, gap: 1 }}>
                  <TextField
                    placeholder={`Enviar mensaje a ${canalActivo?.tipo === 'dm' ? '' : '#'}${obtenerTituloCanal(canalActivo)}...`}
                    multiline
                    maxRows={4}
                    fullWidth
                    variant="standard"
                    value={textoMensaje}
                    onChange={(e) => notificarEscritura(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleEnviarMensaje(false);
                      }
                    }}
                    slotProps={{
                      input: {
                        disableUnderline: true,
                        sx: { fontSize: '0.88rem', px: 0.5 }
                      }
                    }}
                  />

                  <IconButton
                    onClick={() => handleEnviarMensaje(false)}
                    disabled={!textoMensaje.trim() && adjuntosPendientes.length === 0}
                    sx={{
                      bgcolor:
                        textoMensaje.trim() || adjuntosPendientes.length > 0
                          ? '#1D3557'
                          : '#f1f5f9',
                      color:
                        textoMensaje.trim() || adjuntosPendientes.length > 0
                          ? '#ffffff'
                          : '#94a3b8',
                      borderRadius: 2,
                      width: 34,
                      height: 34,
                      '&:hover': { bgcolor: '#122238' }
                    }}
                  >
                    <Send size={16} />
                  </IconButton>
                </Box>
              </Paper>

              {/* MENÚ DE MENCIONES @ */}
              <Menu
                anchorEl={anchorMencionComposer}
                open={Boolean(anchorMencionComposer)}
                onClose={() => setAnchorMencionComposer(null)}
              >
                {usuariosEquipo.map((u) => (
                  <MenuItem
                    key={u.email}
                    onClick={() => {
                      const tag = `@${u.nombre.replace(/\s+/g, '')} `;
                      setTextoMensaje((prev) => `${prev}${tag}`);
                      setAnchorMencionComposer(null);
                    }}
                    sx={{ fontSize: '0.83rem' }}
                  >
                    <strong>@{u.nombre}</strong>&nbsp;({u.rol})
                  </MenuItem>
                ))}
              </Menu>

              {/* MENÚ DE EMOJIS RÁPIDOS */}
              <Menu
                anchorEl={anchorEmojiComposer}
                open={Boolean(anchorEmojiComposer)}
                onClose={() => setAnchorEmojiComposer(null)}
              >
                <Box sx={{ display: 'flex', gap: 0.5, p: 1 }}>
                  {['👍', '❤️', '⚖️', '✅', '🙏', '🔥', '👀', '🎉', '📌', '🚨'].map((em) => (
                    <IconButton
                      key={em}
                      size="small"
                      onClick={() => {
                        setTextoMensaje((prev) => `${prev}${em}`);
                        setAnchorEmojiComposer(null);
                      }}
                    >
                      {em}
                    </IconButton>
                  ))}
                </Box>
              </Menu>
            </Box>
          </Box>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* 3. PANEL LATERAL DERECHO: HILOS, FIJADOS, GUARDADOS O CANVAS        */}
        {/* ------------------------------------------------------------------- */}
        {seccionActiva === 'chat' && panelDerecho && (
          <Box
            sx={{
              width: { xs: '100%', sm: 360 },
              position: { xs: 'absolute', md: 'relative' },
              right: 0,
              top: 0,
              bottom: 0,
              zIndex: 15,
              bgcolor: '#f8fafc',
              borderLeft: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              height: '100%'
            }}
          >
            {/* CABECERA DEL PANEL DERECHO */}
            <Box
              sx={{
                px: 2,
                py: 1.5,
                bgcolor: '#ffffff',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <Typography variant="subtitle2" fontWeight="800" color="#1D3557">
                {panelDerecho === 'hilo' && '💬 Hilo de conversación'}
                {panelDerecho === 'fijados' && '📌 Mensajes Fijados en el Canal'}
                {panelDerecho === 'guardados' && '🔖 Elementos Guardados (Para más tarde)'}
                {panelDerecho === 'canvas' && `📝 Canvas de #${obtenerTituloCanal(canalActivo)}`}
              </Typography>
              <IconButton size="small" onClick={() => setPanelDerecho(null)}>
                <X size={17} />
              </IconButton>
            </Box>

            {panelDerecho === 'hilo' && mensajeHiloPadre ? (
              <>
                <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: '1px solid #cbd5e1', bgcolor: '#ffffff' }}>
                    <Typography variant="caption" fontWeight="bold" color="#1D3557">
                      {mensajeHiloPadre.autorNombre} • {formatearHoraMensaje(mensajeHiloPadre)}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {renderizarTextoRico(mensajeHiloPadre.texto)}
                    </Typography>
                  </Paper>

                  <Divider>
                    <Typography variant="caption" color="text.secondary">
                      {respuestasHiloActivo.length} respuesta(s)
                    </Typography>
                  </Divider>

                  {respuestasHiloActivo.map((rep) => (
                    <Box key={rep.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: '#1D3557' }}>
                        {(rep.autorNombre || 'U').charAt(0).toUpperCase()}
                      </Avatar>
                      <Paper
                        elevation={0}
                        sx={{ p: 1.25, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#ffffff', flexGrow: 1 }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" fontWeight="bold" color="#1D3557">
                            {rep.autorNombre}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                            {formatearHoraMensaje(rep)}
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ mt: 0.3, fontSize: '0.84rem' }}>
                          {renderizarTextoRico(rep.texto)}
                        </Typography>
                      </Paper>
                    </Box>
                  ))}
                </Box>

                <Box sx={{ p: 1.5, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 1 }}>
                  <TextField
                    size="small"
                    placeholder="Responder al hilo..."
                    fullWidth
                    value={textoRespuestaHilo}
                    onChange={(e) => setTextoRespuestaHilo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleEnviarMensaje(true);
                      }
                    }}
                  />
                  <IconButton
                    onClick={() => handleEnviarMensaje(true)}
                    disabled={!textoRespuestaHilo.trim()}
                    sx={{ bgcolor: '#1D3557', color: '#ffffff', borderRadius: 2, '&:hover': { bgcolor: '#122238' } }}
                  >
                    <Send size={15} />
                  </IconButton>
                </Box>
              </>
            ) : panelDerecho === 'canvas' ? (
              /* PANEL DE CANVAS COLABORATIVO DEL CANAL */
              <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 2, gap: 1.5, overflowY: 'auto' }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    borderRadius: '0 8px 8px 0',
                    border: '1px solid #cbd5e1',
                    borderLeft: '4px solid #1D3557',
                    bgcolor: '#ffffff'
                  }}
                >
                  <Typography variant="caption" fontWeight="800" color="#1D3557" sx={{ display: 'block' }}>
                    NOTA COLABORATIVA DEL CANAL
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Registra aquí acuerdos del caso, enlaces de expedientes, minutas o listas de verificación compartidas con todo el canal.
                  </Typography>
                </Paper>

                <TextField
                  multiline
                  minRows={14}
                  maxRows={22}
                  fullWidth
                  value={canvasTexto}
                  onChange={(e) => setCanvasTexto(e.target.value)}
                  placeholder="Escribe las notas colaborativas del canal..."
                  sx={{
                    bgcolor: '#ffffff',
                    '& .MuiOutlinedInput-root': {
                      fontSize: '0.85rem',
                      lineHeight: 1.6,
                      fontFamily: '"Inter", sans-serif'
                    }
                  }}
                />

                {canalActivo?.canvasActualizadoPor && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                    Última edición por <strong>{canalActivo.canvasActualizadoPor}</strong>
                  </Typography>
                )}

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  {canvasGuardadoOk ? (
                    <Chip
                      icon={<CheckCircle2 size={14} />}
                      label="Canvas sincronizado"
                      size="small"
                      color="success"
                      sx={{ fontWeight: 700, fontSize: '0.72rem' }}
                    />
                  ) : (
                    <span />
                  )}
                  <Button
                    variant="contained"
                    disabled={guardandoCanvas}
                    onClick={handleGuardarCanvas}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: 2,
                      bgcolor: '#1D3557',
                      '&:hover': { bgcolor: '#122238' }
                    }}
                  >
                    {guardandoCanvas ? 'Guardando...' : 'Guardar Canvas'}
                  </Button>
                </Box>
              </Box>
            ) : panelDerecho === 'guardados' ? (
              /* PANEL PERSONAL DE ELEMENTOS GUARDADOS ("PARA MÁS TARDE") */
              <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {mensajesGuardados.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 5, px: 2 }}>
                    <Bookmark size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                    <Typography variant="subtitle2" fontWeight="700" color="text.secondary">
                      No tienes elementos guardados
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      Usa el ícono de marcador 🔖 en cualquier mensaje para guardarlo en tu lista personal.
                    </Typography>
                  </Box>
                ) : (
                  mensajesGuardados.map((item) => (
                    <Paper
                      key={item.id}
                      elevation={0}
                      sx={{
                        p: 1.5,
                        borderRadius: '0 8px 8px 0',
                        border: '1px solid #cbd5e1',
                        borderLeft: '4px solid #B92F32',
                        bgcolor: '#ffffff'
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Chip
                          label={`#${item.canalNombre || item.canalId}`}
                          size="small"
                          onClick={() => {
                            setCanalActivoId(item.canalId);
                            setSeccionActiva('chat');
                          }}
                          sx={{
                            height: 20,
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            bgcolor: 'rgba(29, 53, 87, 0.08)',
                            color: '#1D3557',
                            cursor: 'pointer'
                          }}
                        />
                        <Tooltip title="Quitar de Guardados">
                          <IconButton
                            size="small"
                            onClick={() => deleteDoc(doc(db, 'workspace_guardados', item.id))}
                          >
                            <X size={13} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      <Typography variant="caption" fontWeight="bold" color="#1D3557" sx={{ display: 'block' }}>
                        {item.autorNombre}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.4, fontSize: '0.83rem', color: '#334155' }}>
                        {renderizarTextoRico(item.texto)}
                      </Typography>
                    </Paper>
                  ))
                )}
              </Box>
            ) : (
              /* LISTA DE MENSAJES FIJADOS */
              <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {mensajesFijados.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 4 }}>
                    No hay mensajes fijados en este canal.
                  </Typography>
                ) : (
                  mensajesFijados.map((m) => (
                    <Paper
                      key={m.id}
                      elevation={0}
                      sx={{
                        p: 1.5,
                        borderRadius: '0 8px 8px 0',
                        border: '1px solid #fde68a',
                        borderLeft: '4px solid #f59e0b',
                        bgcolor: '#fffbeb'
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" fontWeight="bold" color="#92400e">
                          {m.autorNombre}
                        </Typography>
                        <IconButton size="small" onClick={() => handleTogglePin(m)}>
                          <X size={13} />
                        </IconButton>
                      </Box>
                      <Typography variant="body2" sx={{ mt: 0.5, fontSize: '0.84rem' }}>
                        {renderizarTextoRico(m.texto)}
                      </Typography>
                    </Paper>
                  ))
                )}
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* ===================================================================== */}
      {/* MODAL CREAR ENCUESTA / VOTACIÓN EN EL CANAL                           */}
      {/* ===================================================================== */}
      <Dialog open={modalEncuestaOpen} onClose={() => setModalEncuestaOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#1D3557' }}>
          📊 Crear Encuesta o Votación
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Pregunta o tema a votar"
            placeholder="Ej: ¿Qué fecha prefieren para la reunión de estrategia?"
            size="small"
            fullWidth
            value={encuestaForm.pregunta}
            onChange={(e) => setEncuestaForm((p) => ({ ...p, pregunta: e.target.value }))}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Typography variant="caption" fontWeight="bold" color="text.secondary">
              OPCIONES DE RESPUESTA
            </Typography>
            {encuestaForm.opciones.map((op, idx) => (
              <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder={`Opción ${idx + 1}`}
                  value={op}
                  onChange={(e) => {
                    const nuevas = [...encuestaForm.opciones];
                    nuevas[idx] = e.target.value;
                    setEncuestaForm((p) => ({ ...p, opciones: nuevas }));
                  }}
                />
                {encuestaForm.opciones.length > 2 && (
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() =>
                      setEncuestaForm((p) => ({
                        ...p,
                        opciones: p.opciones.filter((_, i) => i !== idx)
                      }))
                    }
                  >
                    <X size={15} />
                  </IconButton>
                )}
              </Box>
            ))}
            {encuestaForm.opciones.length < 6 && (
              <Button
                size="small"
                startIcon={<Plus size={14} />}
                onClick={() =>
                  setEncuestaForm((p) => ({ ...p, opciones: [...p.opciones, ''] }))
                }
                sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 600 }}
              >
                Añadir opción
              </Button>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalEncuestaOpen(false)} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleCrearEncuesta}
            disabled={
              !encuestaForm.pregunta.trim() ||
              encuestaForm.opciones.filter((o) => o.trim()).length < 2
            }
            sx={{ textTransform: 'none', bgcolor: '#1D3557', fontWeight: 700 }}
          >
            Publicar Encuesta
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===================================================================== */}
      {/* MODAL CREAR NUEVO CANAL (ABIERTO O PRIVADO POR MIEMBROS)              */}
      {/* ===================================================================== */}
      <Dialog
        open={modalCanalOpen}
        onClose={() => setModalCanalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                bgcolor: 'rgba(29, 53, 87, 0.08)',
                color: '#1D3557',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {nuevoCanalForm.esPrivado ? <Lock size={19} color="#b45309" /> : <Hash size={19} />}
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight="800" color="#1D3557">
                Crear Nuevo Canal
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Elige si será abierto a todo el equipo o cerrado solo para miembros específicos
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={() => setModalCanalOpen(false)}>
            <X size={18} />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Nombre del canal"
            placeholder="ej: caso-corte-idh, comision-tres-miembros"
            size="small"
            fullWidth
            value={nuevoCanalForm.nombre}
            onChange={(e) => setNuevoCanalForm((p) => ({ ...p, nombre: e.target.value }))}
          />
          <TextField
            label="Descripción o propósito"
            placeholder="¿De qué se habla en este canal?"
            size="small"
            fullWidth
            multiline
            rows={2}
            value={nuevoCanalForm.descripcion}
            onChange={(e) => setNuevoCanalForm((p) => ({ ...p, descripcion: e.target.value }))}
          />

          {/* SELECTOR VISUAL DE VISIBILIDAD: ABIERTO VS PRIVADO */}
          <Box>
            <Typography variant="caption" fontWeight="800" color="#1D3557" sx={{ display: 'block', mb: 0.75 }}>
              TIPO DE ACCESO AL CANAL
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25 }}>
              <Paper
                elevation={0}
                onClick={() => setNuevoCanalForm((p) => ({ ...p, esPrivado: false }))}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  cursor: 'pointer',
                  border: !nuevoCanalForm.esPrivado ? '2px solid #1D3557' : '1px solid #cbd5e1',
                  bgcolor: !nuevoCanalForm.esPrivado ? 'rgba(29, 53, 87, 0.05)' : '#ffffff',
                  transition: 'all 0.15s'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Globe size={16} color="#1D3557" />
                  <Typography variant="body2" fontWeight="800" color="#1D3557">
                    Canal Abierto
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.35 }}>
                  Visible y accesible para todos los miembros autorizados del equipo IIRESODH.
                </Typography>
              </Paper>

              <Paper
                elevation={0}
                onClick={() => setNuevoCanalForm((p) => ({ ...p, esPrivado: true }))}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  cursor: 'pointer',
                  border: nuevoCanalForm.esPrivado ? '2px solid #b45309' : '1px solid #cbd5e1',
                  bgcolor: nuevoCanalForm.esPrivado ? '#fffbeb' : '#ffffff',
                  transition: 'all 0.15s'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Lock size={16} color="#b45309" />
                  <Typography variant="body2" fontWeight="800" color="#92400e">
                    Privado (Por miembros)
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.35 }}>
                  Solo para las personas que elijas (ej. 3 miembros). Nadie más lo verá en sus canales.
                </Typography>
              </Paper>
            </Box>
          </Box>

          {nuevoCanalForm.esPrivado && (
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: 1
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" fontWeight="800" color="#1D3557">
                  SELECCIONA A LOS INTEGRANTES DEL CANAL PRIVADO
                </Typography>
                <Chip
                  label={`Total en el canal: ${
                    Array.from(new Set([...nuevoCanalForm.miembros, currentUserEmail])).length
                  } miembro(s)`}
                  size="small"
                  sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, bgcolor: '#fef3c7', color: '#92400e' }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                Tú (<strong>{currentUserName}</strong>) quedas incluido automáticamente como creador. Marca a los demás colegas que formarán parte del canal:
              </Typography>

              <Box
                sx={{
                  maxHeight: 200,
                  overflowY: 'auto',
                  bgcolor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 1.5,
                  divideY: '1px solid #f1f5f9'
                }}
              >
                {usuariosEquipo
                  .filter((u) => u.email.toLowerCase() !== currentUserEmail)
                  .map((u) => {
                    const emailLow = u.email.toLowerCase();
                    const checked = nuevoCanalForm.miembros.includes(emailLow);
                    return (
                      <MenuItem
                        key={emailLow}
                        dense
                        onClick={() => {
                          setNuevoCanalForm((p) => {
                            const existe = p.miembros.includes(emailLow);
                            return {
                              ...p,
                              miembros: existe
                                ? p.miembros.filter((m) => m !== emailLow)
                                : [...p.miembros, emailLow]
                            };
                          });
                        }}
                        sx={{ py: 0.5 }}
                      >
                        <Checkbox checked={checked} size="small" sx={{ py: 0.25 }} />
                        <ListItemText
                          primary={u.nombre}
                          secondary={`${u.email} • ${u.rol}`}
                          primaryTypographyProps={{ fontSize: '0.82rem', fontWeight: checked ? 700 : 500 }}
                          secondaryTypographyProps={{ fontSize: '0.7rem' }}
                        />
                      </MenuItem>
                    );
                  })}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalCanalOpen(false)} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleCrearCanal}
            disabled={!nuevoCanalForm.nombre.trim()}
            sx={{ textTransform: 'none', bgcolor: '#1D3557', fontWeight: 'bold', borderRadius: 2 }}
          >
            {nuevoCanalForm.esPrivado ? 'Crear Canal Privado 🔒' : 'Crear Canal Abierto'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===================================================================== */}
      {/* MODAL GESTIONAR CANAL, MIEMBROS Y PRIVACIDAD                          */}
      {/* ===================================================================== */}
      <Dialog
        open={modalGestionCanalOpen && Boolean(canalEnGestion)}
        onClose={() => setModalGestionCanalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        {canalEnGestion && (() => {
          const puedeEditar = puedeGestionarCanal(canalEnGestion);
          const puedeEliminar = puedeBorrarCanal(canalEnGestion);
          const totalMiembrosPrivados = Array.from(
            new Set([
              ...(editCanalForm.miembros || []),
              (canalEnGestion.creadoPor || currentUserEmail).toLowerCase()
            ].filter(Boolean))
          );

          return (
            <>
              <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 2,
                      bgcolor: editCanalForm.esPrivado ? '#fef3c7' : 'rgba(29, 53, 87, 0.08)',
                      color: editCanalForm.esPrivado ? '#b45309' : '#1D3557',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {editCanalForm.esPrivado ? <Lock size={18} /> : <Hash size={18} />}
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="800" color="#1D3557">
                      Canal #{canalEnGestion.nombre}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {puedeEditar
                        ? 'Configuración de acceso, miembros autorizados y administración del canal'
                        : 'Información y miembros con acceso a este canal'}
                    </Typography>
                  </Box>
                </Box>
                <IconButton size="small" onClick={() => setModalGestionCanalOpen(false)}>
                  <X size={18} />
                </IconButton>
              </DialogTitle>

              <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Descripción o propósito del canal"
                  size="small"
                  fullWidth
                  multiline
                  rows={2}
                  disabled={!puedeEditar}
                  value={editCanalForm.descripcion}
                  onChange={(e) => setEditCanalForm((p) => ({ ...p, descripcion: e.target.value }))}
                />

                {/* VISIBILIDAD DEL CANAL */}
                {puedeEditar && canalEnGestion.id !== 'general' ? (
                  <Box>
                    <Typography variant="caption" fontWeight="800" color="#1D3557" sx={{ display: 'block', mb: 0.75 }}>
                      PRIVACIDAD DEL CANAL
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25 }}>
                      <Paper
                        elevation={0}
                        onClick={() => setEditCanalForm((p) => ({ ...p, esPrivado: false }))}
                        sx={{
                          p: 1.25,
                          borderRadius: 2,
                          cursor: 'pointer',
                          border: !editCanalForm.esPrivado ? '2px solid #1D3557' : '1px solid #cbd5e1',
                          bgcolor: !editCanalForm.esPrivado ? 'rgba(29, 53, 87, 0.05)' : '#ffffff'
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Globe size={15} color="#1D3557" />
                          <Typography variant="body2" fontWeight="800" color="#1D3557">
                            Abierto a todos
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          Todo el equipo puede verlo y participar.
                        </Typography>
                      </Paper>

                      <Paper
                        elevation={0}
                        onClick={() => setEditCanalForm((p) => ({ ...p, esPrivado: true }))}
                        sx={{
                          p: 1.25,
                          borderRadius: 2,
                          cursor: 'pointer',
                          border: editCanalForm.esPrivado ? '2px solid #b45309' : '1px solid #cbd5e1',
                          bgcolor: editCanalForm.esPrivado ? '#fffbeb' : '#ffffff'
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Lock size={15} color="#b45309" />
                          <Typography variant="body2" fontWeight="800" color="#92400e">
                            Privado (Solo miembros)
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          Solo accesible para los miembros seleccionados.
                        </Typography>
                      </Paper>
                    </Box>
                  </Box>
                ) : (
                  <Alert severity={editCanalForm.esPrivado ? 'warning' : 'info'} sx={{ py: 0.5 }}>
                    {editCanalForm.esPrivado
                      ? `Este es un canal privado cerrado para ${totalMiembrosPrivados.length} miembro(s).`
                      : 'Este canal está abierto para todos los miembros autorizados del Instituto.'}
                  </Alert>
                )}

                {/* LISTA DE MIEMBROS SI ES PRIVADO */}
                {editCanalForm.esPrivado && (
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="caption" fontWeight="800" color="#1D3557">
                        MIEMBROS CON ACCESO A ESTE CANAL ({totalMiembrosPrivados.length})
                      </Typography>
                      <Chip
                        label={`${totalMiembrosPrivados.length} integrante(s)`}
                        size="small"
                        sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, bgcolor: '#fef3c7', color: '#92400e' }}
                      />
                    </Box>

                    <Box
                      sx={{
                        maxHeight: 220,
                        overflowY: 'auto',
                        bgcolor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: 1.5
                      }}
                    >
                      {usuariosEquipo.map((u) => {
                        const emailLow = u.email.toLowerCase();
                        const esCreador = emailLow === (canalEnGestion.creadoPor || '').toLowerCase();
                        const checked = totalMiembrosPrivados.includes(emailLow);
                        if (!puedeEditar && !checked) return null;

                        return (
                          <MenuItem
                            key={emailLow}
                            dense
                            disabled={!puedeEditar || esCreador}
                            onClick={() => {
                              if (!puedeEditar || esCreador) return;
                              setEditCanalForm((p) => {
                                const existe = p.miembros.includes(emailLow);
                                return {
                                  ...p,
                                  miembros: existe
                                    ? p.miembros.filter((m) => m !== emailLow)
                                    : [...p.miembros, emailLow]
                                };
                              });
                            }}
                            sx={{ py: 0.5 }}
                          >
                            {puedeEditar && <Checkbox checked={checked} disabled={esCreador} size="small" sx={{ py: 0.25 }} />}
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                  <span>{u.nombre}</span>
                                  {esCreador && (
                                    <Chip
                                      label="Creador"
                                      size="small"
                                      sx={{ height: 17, fontSize: '0.62rem', fontWeight: 700 }}
                                    />
                                  )}
                                </Box>
                              }
                              secondary={`${u.email} • ${u.rol}`}
                              primaryTypographyProps={{ fontSize: '0.82rem', fontWeight: checked ? 700 : 500 }}
                              secondaryTypographyProps={{ fontSize: '0.7rem' }}
                            />
                          </MenuItem>
                        );
                      })}
                    </Box>
                  </Box>
                )}
              </DialogContent>

              <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
                <Box>
                  {puedeEliminar && (
                    <Button
                      color="error"
                      variant="outlined"
                      size="small"
                      startIcon={<Trash2 size={15} />}
                      onClick={() => setConfirmDeleteCanalOpen(true)}
                      sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                    >
                      Eliminar canal
                    </Button>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button onClick={() => setModalGestionCanalOpen(false)} sx={{ textTransform: 'none' }}>
                    Cerrar
                  </Button>
                  {puedeEditar && (
                    <Button
                      variant="contained"
                      disabled={guardandoGestionCanal}
                      onClick={handleGuardarGestionCanal}
                      sx={{ textTransform: 'none', bgcolor: '#1D3557', fontWeight: 700, borderRadius: 2 }}
                    >
                      {guardandoGestionCanal ? 'Guardando...' : 'Guardar Cambios'}
                    </Button>
                  )}
                </Box>
              </DialogActions>
            </>
          );
        })()}
      </Dialog>

      {/* ===================================================================== */}
      {/* MODAL CONFIRMAR ELIMINACIÓN PERMANENTE DE CANAL                       */}
      {/* ===================================================================== */}
      <Dialog
        open={confirmDeleteCanalOpen && Boolean(canalEnGestion)}
        onClose={() => !eliminandoCanal && setConfirmDeleteCanalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#B92F32', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Trash2 size={20} /> ¿Eliminar canal #{canalEnGestion?.nombre}?
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
            Estás a punto de eliminar permanentemente el canal{' '}
            <strong>#{canalEnGestion?.nombre}</strong> y todo su historial de mensajes. Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setConfirmDeleteCanalOpen(false)}
            disabled={eliminandoCanal}
            sx={{ textTransform: 'none' }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={eliminandoCanal}
            startIcon={eliminandoCanal ? <CircularProgress size={15} color="inherit" /> : <Trash2 size={15} />}
            onClick={handleConfirmarEliminarCanal}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
          >
            {eliminandoCanal ? 'Eliminando...' : 'Sí, eliminar canal'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===================================================================== */}
      {/* MODAL SALA INSTANTÁNEA DE GOOGLE MEET (FUERA DE CANALES / EXTERNA)    */}
      {/* ===================================================================== */}
      <Dialog
        open={modalMeetExternoOpen}
        onClose={() => setModalMeetExternoOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: 2,
                bgcolor: 'rgba(15, 157, 88, 0.12)',
                color: '#0f9d58',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Video size={20} />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight="800" color="#1D3557">
                Sala Instantánea de Google Meet
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Crea una sala oficial (@iiresodh.org) para reuniones externas, clientes, peritos o equipo
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={() => setModalMeetExternoOpen(false)}>
            <X size={18} />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Asunto o nombre de la reunión"
            placeholder="Ej: Entrevista con víctimas, Reunión con perito, Coordinación externa..."
            size="small"
            fullWidth
            value={meetExternoForm.titulo}
            onChange={(e) => setMeetExternoForm((p) => ({ ...p, titulo: e.target.value }))}
          />

          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: meetExternoForm.meetingUri ? '#f0fdf4' : '#f8fafc',
              border: meetExternoForm.meetingUri ? '1px solid #86efac' : '1px dashed #cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5
            }}
          >
            {!meetExternoForm.meetingUri ? (
              <Box sx={{ textAlign: 'center', py: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Genera un enlace único de Google Meet donde tu cuenta institucional{' '}
                  <strong>{currentUserEmail}</strong> será anfitriona (Host).
                </Typography>
                <Button
                  variant="contained"
                  disabled={creandoMeetExterno}
                  startIcon={
                    creandoMeetExterno ? <CircularProgress size={16} color="inherit" /> : <Video size={17} />
                  }
                  onClick={handleGenerarMeetExterno}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: 2,
                    bgcolor: '#0f9d58',
                    '&:hover': { bgcolor: '#0b8043' }
                  }}
                >
                  {creandoMeetExterno ? 'Creando sala en Google Workspace...' : 'Generar enlace oficial de Google Meet'}
                </Button>
              </Box>
            ) : (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                  <Box>
                    <Typography variant="caption" fontWeight="800" color="#065f46">
                      ENLACE OFICIAL GENERADO
                    </Typography>
                    <Typography variant="body2" fontWeight="800" color="#1D3557" sx={{ wordBreak: 'break-all' }}>
                      {meetExternoForm.meetingUri}
                    </Typography>
                    {meetExternoForm.meetingCode && (
                      <Typography variant="caption" color="text.secondary">
                        Código de acceso: <strong>{meetExternoForm.meetingCode}</strong>
                      </Typography>
                    )}
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleGenerarMeetExterno}
                    disabled={creandoMeetExterno}
                    sx={{ textTransform: 'none', fontSize: '0.73rem', borderRadius: 1.5 }}
                  >
                    Generar otra
                  </Button>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<ExternalLink size={15} />}
                    onClick={() =>
                      window.open(
                        obtenerUrlMeetConCuenta(meetExternoForm.meetingUri),
                        '_blank',
                        'noopener,noreferrer'
                      )
                    }
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: 1.5,
                      bgcolor: '#0f9d58',
                      '&:hover': { bgcolor: '#0b8043' }
                    }}
                  >
                    Entrar a la Sala Meet
                  </Button>

                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Copy size={14} />}
                    onClick={() =>
                      handleCopiarEnlaceMeet(
                        meetExternoForm.meetingUri,
                        'Enlace copiado. Listo para enviar por WhatsApp, correo o chat.'
                      )
                    }
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: 1.5,
                      borderColor: '#0f9d58',
                      color: '#065f46',
                      bgcolor: '#ffffff'
                    }}
                  >
                    Copiar enlace para invitados
                  </Button>
                </Box>

                <Divider sx={{ my: 0.5 }} />

                {/* OPCIÓN PARA COMPARTIR TAMBIÉN EN UN CANAL DEL WORKSPACE */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <FormControl size="small" sx={{ minWidth: 210, flexGrow: 1 }}>
                    <InputLabel>Compartir también en un canal (Opcional)</InputLabel>
                    <Select
                      label="Compartir también en un canal (Opcional)"
                      value={meetExternoForm.compartirCanalId}
                      onChange={(e) =>
                        setMeetExternoForm((p) => ({ ...p, compartirCanalId: e.target.value }))
                      }
                      sx={{ bgcolor: '#ffffff' }}
                    >
                      {canales
                        .filter((c) => c.tipo !== 'dm')
                        .map((c) => (
                          <MenuItem key={c.id} value={c.id}>
                            #{c.nombre}
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<Send size={14} />}
                    onClick={handleCompartirMeetExternoEnCanal}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: 1.5,
                      bgcolor: '#1D3557',
                      height: 40
                    }}
                  >
                    Publicar en canal
                  </Button>
                </Box>
              </>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalMeetExternoOpen(false)} sx={{ textTransform: 'none' }}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={meetToast.open}
        autoHideDuration={4000}
        onClose={() => setMeetToast((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={meetToast.severity}
          variant="filled"
          onClose={() => setMeetToast((s) => ({ ...s, open: false }))}
          sx={{ borderRadius: 2 }}
        >
          {meetToast.text}
        </Alert>
      </Snackbar>
    </Box>
  );
}
