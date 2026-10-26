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
  InputAdornment
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
  MoreVertical,
  Edit3,
  Trash2,
  X,
  Check,
  FileText,
  Download,
  Users,
  Sparkles,
  Bold,
  Italic,
  Code,
  ChevronRight,
  Circle,
  Menu as MenuIcon,
  FolderKanban,
  HardDrive
} from 'lucide-react';
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import {
  ref as rtdbRef,
  onValue,
  onDisconnect,
  update as rtdbUpdate,
  serverTimestamp as rtdbServerTimestamp
} from 'firebase/database';
import { db, rtdb, storage } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import CalendarioHibridoPanel, { CATEGORIAS_EVENTO } from './CalendarioHibridoPanel';
import ProyectosKanbanPanel from './ProyectosKanbanPanel';
import GoogleDriveWorkspacePanel, { detectarTipoDrivePorUrl } from './GoogleDriveWorkspacePanel';

const emailToRtdbKey = (email = '') => email.toLowerCase().replace(/[.#$[\]/]/g, '_');

const EMOJIS_RAPIDOS = ['👍', '❤️', '⚖️', '✅', '🙏', '🔥', '👀'];

const ESTADOS_USUARIO = [
  { id: 'disponible', emoji: '🟢', texto: 'Disponible', color: '#22c55e' },
  { id: 'audiencia', emoji: '⚖️', texto: 'En audiencia judicial', color: '#dc2626' },
  { id: 'reunion', emoji: '📅', texto: 'En reunión', color: '#f59e0b' },
  { id: 'enfoque', emoji: '🎯', texto: 'Redactando escrito / Enfoque', color: '#3b82f6' },
  { id: 'ausente', emoji: '🌴', texto: 'Ausente', color: '#94a3b8' }
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

  // Navegación principal interna ('chat' | 'calendario')
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

  // Mensajes del canal activo
  const [mensajes, setMensajes] = useState([]);
  const [loadingMensajes, setLoadingMensajes] = useState(false);
  const [busquedaEnCanal, setBusquedaEnCanal] = useState('');
  const [mostrarBuscadorCanal, setMostrarBuscadorCanal] = useState(false);

  // Compositor de mensaje principal
  const [textoMensaje, setTextoMensaje] = useState('');
  const [archivosSubiendo, setArchivosSubiendo] = useState(false);
  const [progresoSubida, setProgresoSubida] = useState(0);
  const [adjuntosPendientes, setAdjuntosPendientes] = useState([]);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Menús flotantes del compositor (Emojis y @Menciones)
  const [anchorEmojiComposer, setAnchorEmojiComposer] = useState(null);
  const [anchorMencionComposer, setAnchorMencionComposer] = useState(null);
  const [anchorEstadoUsuario, setAnchorEstadoUsuario] = useState(null);

  // Edición de mensaje inline
  const [editandoMensajeId, setEditandoMensajeId] = useState(null);
  const [textoEdicion, setTextoEdicion] = useState('');

  // Panel lateral derecho ('hilo' | 'fijados' | 'miembros' | null)
  const [panelDerecho, setPanelDerecho] = useState(null);
  const [mensajeHiloPadre, setMensajeHiloPadre] = useState(null);
  const [textoRespuestaHilo, setTextoRespuestaHilo] = useState('');

  // Modal de creación de nuevo canal
  const [modalCanalOpen, setModalCanalOpen] = useState(false);
  const [nuevoCanalForm, setNuevoCanalForm] = useState({
    nombre: '',
    descripcion: '',
    esPrivado: false,
    miembros: []
  });

  // Señal para abrir modal de nuevo evento en el calendario pre-vinculado al canal
  const [signalNuevoEvento, setSignalNuevoEvento] = useState(0);
  // Item de Google Drive seleccionado para abrir en el visor embebido
  const [drivePreviewItem, setDrivePreviewItem] = useState(null);

  // =========================================================================
  // 1. CARGAR USUARIOS AUTORIZADOS Y PRESENCIA NATIVA EN REALTIME DATABASE
  // =========================================================================
  useEffect(() => {
    const unsubUsers = onSnapshot(
      collection(db, 'usuarios_autorizados'),
      (snap) => {
        // Excluir siempre la cuenta de superadministración webmaster@iiresodh.org de la mensajería
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

    // Escuchar todos los estados de presencia en tiempo real desde Firebase Realtime Database
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
          // 1. Registrar desconexión automática en el servidor de Google (onDisconnect)
          await onDisconnect(miPresenciaRtdbRef).update({
            email: currentUserEmail,
            enLinea: false,
            ultimaConexionMs: rtdbServerTimestamp()
          });

          // 2. Marcar al usuario como en línea inmediatamente
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

  // =========================================================================
  // 2. ESCUCHAR Y SEMBRAR CANALES INSTITUCIONALES
  // =========================================================================
  useEffect(() => {
    const q = query(collection(db, 'workspace_canales'));
    const unsub = onSnapshot(
      q,
      async (snap) => {
        if (snap.empty) {
          // Sembrar canales por defecto la primera vez
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
        // Filtrar canales privados donde el usuario tiene acceso (o Superadmin)
        const visibles = docs.filter((c) => {
          if (c.tipo === 'dm') {
            return (c.participantes || []).includes(currentUserEmail);
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
      } catch (e) {
        // Silencioso
      }
    };
    marcarLeido();
  }, [canalActivoId, mensajes.length, currentUserEmail]);

  // =========================================================================
  // 3. ESCUCHAR MENSAJES DEL CANAL ACTIVO EN TIEMPO REAL
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

  // Auto-scroll al final cuando llegan mensajes nuevos al canal principal
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajes.length, canalActivoId]);

  // Mantener sincronizado el mensaje padre del hilo si cambia en tiempo real
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

  // Mensajes principales (que no son respuesta de hilo) y respuestas del hilo activo
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
  // 4. ACCIONES DE CANALES Y MENSAJES DIRECTOS (1 A 1)
  // =========================================================================
  const abrirMensajeDirecto = async (colega) => {
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

  const handleCrearCanal = async () => {
    const slug = nuevoCanalForm.nombre
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '');

    if (!slug) return;

    const miembrosFinal = Array.from(
      new Set([...(nuevoCanalForm.miembros || []), currentUserEmail])
    );

    await setDoc(doc(db, 'workspace_canales', slug), {
      nombre: slug,
      descripcion: nuevoCanalForm.descripcion.trim() || `Canal temático #${slug}`,
      tipo: 'canal',
      esPrivado: nuevoCanalForm.esPrivado,
      miembros: nuevoCanalForm.esPrivado ? miembrosFinal : [],
      orden: 50,
      creadoPor: currentUserEmail,
      creadoEn: serverTimestamp(),
      ultimoMensajeAt: serverTimestamp(),
      ultimoMensajeTexto: `Canal #${slug} creado por ${currentUserName}`
    });

    setModalCanalOpen(false);
    setNuevoCanalForm({ nombre: '', descripcion: '', esPrivado: false, miembros: [] });
    setCanalActivoId(slug);
    setSeccionActiva('chat');
  };

  // =========================================================================
  // 5. SUBIDA DE ARCHIVOS A FIREBASE STORAGE Y ENVÍO DE MENSAJES
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

  const handleEnviarMensaje = async (esHilo = false) => {
    const texto = esHilo ? textoRespuestaHilo.trim() : textoMensaje.trim();
    const adjuntos = esHilo ? [] : adjuntosPendientes;

    if (!texto && adjuntos.length === 0) return;
    if (!canalActivoId) return;

    if (esHilo) {
      setTextoRespuestaHilo('');
    } else {
      setTextoMensaje('');
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
  // 6. HELPERS DE FORMATO Y PRESENCIA
  // =========================================================================
  const miPresencia = presenciaMap[currentUserEmail] || {};
  const miEstadoActual =
    ESTADOS_USUARIO.find((e) => e.id === miPresencia.estadoId) || ESTADOS_USUARIO[0];

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

  // Formatear texto con soporte para *negrita*, _cursiva_, `código`, enlaces y @menciones
  const renderizarTextoRico = (texto = '') => {
    if (!texto) return null;
    const lineas = texto.split('\n');

    return lineas.map((linea, idxLinea) => {
      // Tokenizar menciones, enlaces, código y negritas
      const partes = linea.split(/(@[\w.-]+|\*[^*]+\*|`[^`]+`|https?:\/\/[^\s]+)/g);
      return (
        <React.Fragment key={idxLinea}>
          {partes.map((parte, i) => {
            if (parte.startsWith('@') && parte.length > 1) {
              return (
                <Box
                  component="span"
                  key={i}
                  sx={{
                    bgcolor: 'rgba(37, 99, 235, 0.12)',
                    color: '#1d4ed8',
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
            if (parte.startsWith('`') && parte.endsWith('`') && parte.length > 2) {
              return (
                <Box
                  component="code"
                  key={i}
                  sx={{
                    bgcolor: '#f1f5f9',
                    color: '#be123c',
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
                  style={{ color: '#2563eb', textDecoration: 'underline', wordBreak: 'break-all' }}
                >
                  {parte}
                </a>
              );
            }
            return parte;
          })}
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
    if (!busquedaSidebar.trim()) return usuariosEquipo;
    const term = busquedaSidebar.toLowerCase();
    return usuariosEquipo.filter(
      (u) => u.nombre.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
    );
  }, [usuariosEquipo, busquedaSidebar]);

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
              borderRadius: '16px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 12px 32px -4px rgba(15, 35, 60, 0.10)'
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
          bgcolor: '#0f233c',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          flexShrink: 0
        }}
      >
        {/* IZQUIERDA: BRANDING Y PESTAÑAS UNIFICADAS (CHAT + CALENDARIO) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
          <IconButton
            size="small"
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            sx={{ color: '#ffffff', display: { xs: 'inline-flex', md: 'none' } }}
          >
            <MenuIcon size={20} />
          </IconButton>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: 1.5,
                bgcolor: '#c5a880',
                color: '#0f233c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '900',
                fontSize: '0.85rem'
              }}
            >
              II
            </Box>
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
                color: seccionActiva === 'chat' ? '#0f233c' : 'rgba(255,255,255,0.85)',
                bgcolor: seccionActiva === 'chat' ? '#c5a880' : 'transparent',
                '&:hover': {
                  bgcolor: seccionActiva === 'chat' ? '#d4b892' : 'rgba(255,255,255,0.12)'
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
                color: seccionActiva === 'proyectos' ? '#0f233c' : 'rgba(255,255,255,0.85)',
                bgcolor: seccionActiva === 'proyectos' ? '#c5a880' : 'transparent',
                '&:hover': {
                  bgcolor: seccionActiva === 'proyectos' ? '#d4b892' : 'rgba(255,255,255,0.12)'
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
                color: seccionActiva === 'calendario' ? '#0f233c' : 'rgba(255,255,255,0.85)',
                bgcolor: seccionActiva === 'calendario' ? '#c5a880' : 'transparent',
                '&:hover': {
                  bgcolor: seccionActiva === 'calendario' ? '#d4b892' : 'rgba(255,255,255,0.12)'
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
                color: seccionActiva === 'drive' ? '#0f233c' : 'rgba(255,255,255,0.85)',
                bgcolor: seccionActiva === 'drive' ? '#c5a880' : 'transparent',
                '&:hover': {
                  bgcolor: seccionActiva === 'drive' ? '#d4b892' : 'rgba(255,255,255,0.12)'
                }
              }}
            >
              Google Drive
            </Button>
          </Box>
        </Box>

        {/* DERECHA: ESTADO DE PRESENCIA DEL USUARIO Y MODO PANTALLA COMPLETA */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Cambiar tu estado en el espacio de trabajo">
            <Chip
              onClick={(e) => setAnchorEstadoUsuario(e.currentTarget)}
              label={`${miEstadoActual.emoji} ${miEstadoActual.texto}`}
              size="small"
              sx={{
                bgcolor: 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.75rem',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' }
              }}
            />
          </Tooltip>

          <Menu
            anchorEl={anchorEstadoUsuario}
            open={Boolean(anchorEstadoUsuario)}
            onClose={() => setAnchorEstadoUsuario(null)}
          >
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="caption" fontWeight="bold" color="text.secondary">
                ESTADO DE DISPONIBILIDAD
              </Typography>
            </Box>
            <Divider />
            {ESTADOS_USUARIO.map((est) => (
              <MenuItem
                key={est.id}
                selected={miEstadoActual.id === est.id}
                onClick={() => handleCambiarEstado(est)}
                sx={{ fontSize: '0.85rem', gap: 1 }}
              >
                <span>{est.emoji}</span>
                <span>{est.texto}</span>
              </MenuItem>
            ))}
          </Menu>

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
              color: isFullscreen ? '#0f233c' : '#ffffff',
              bgcolor: isFullscreen ? '#fbbf24' : 'rgba(255,255,255,0.12)',
              border: isFullscreen ? 'none' : '1px solid rgba(255,255,255,0.2)',
              '&:hover': {
                bgcolor: isFullscreen ? '#f59e0b' : 'rgba(255,255,255,0.22)'
              }
            }}
          >
            {isFullscreen ? 'Volver al Hub (Esc)' : 'Expandir'}
          </Button>
        </Box>
      </Box>

      {/* ===================================================================== */}
      {/* CUERPO PRINCIPAL: SIDEBAR + ÁREA CENTRAL + PANEL DE HILO              */}
      {/* ===================================================================== */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden', position: 'relative' }}>
        {/* ------------------------------------------------------------------- */}
        {/* 1. BARRA LATERAL IZQUIERDA (CANALES, BÚSQUEDA Y MENSAJES DIRECTOS)  */}
        {/* ------------------------------------------------------------------- */}
        <Box
          sx={{
            width: 265,
            bgcolor: '#152c4e',
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
          {/* BUSCADOR DE CANALES Y COLEGAS */}
          <Box sx={{ p: 1.5 }}>
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
                    bgcolor: 'rgba(15, 35, 60, 0.7)',
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
                sx={{ color: '#94a3b8', letterSpacing: 0.6, fontSize: '0.7rem' }}
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
              return (
                <Box
                  key={canal.id}
                  onClick={() => {
                    setCanalActivoId(canal.id);
                    setSeccionActiva('chat');
                    setPanelDerecho(null);
                    setMobileSidebarOpen(false);
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 1.25,
                    py: 0.75,
                    mb: 0.3,
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    bgcolor: activo ? '#2563eb' : 'transparent',
                    color: activo ? '#ffffff' : noLeido ? '#ffffff' : '#cbd5e1',
                    fontWeight: activo || noLeido ? 700 : 500,
                    '&:hover': {
                      bgcolor: activo ? '#2563eb' : 'rgba(255,255,255,0.07)'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
                    {canal.esPrivado ? (
                      <Lock size={15} style={{ flexShrink: 0, opacity: 0.85 }} />
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

                  {noLeido && (
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: '#38bdf8',
                        flexShrink: 0
                      }}
                    />
                  )}
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
                color: '#94a3b8',
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
                sx={{ color: '#94a3b8', letterSpacing: 0.6, fontSize: '0.7rem' }}
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
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    bgcolor: activo ? '#2563eb' : 'transparent',
                    color: activo ? '#ffffff' : '#cbd5e1',
                    '&:hover': {
                      bgcolor: activo ? '#2563eb' : 'rgba(255,255,255,0.07)'
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
                          border: '1.5px solid #152c4e'
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
                          bgcolor: '#38bdf8'
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
              usuariosEquipo={usuariosEquipo}
              canalesDisponibles={canales}
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
              canalesDisponibles={canales}
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {canalActivo?.tipo === 'dm' ? (
                    <Users size={18} color="#1a365d" />
                  ) : canalActivo?.esPrivado ? (
                    <Lock size={18} color="#1a365d" />
                  ) : (
                    <Hash size={19} color="#1a365d" />
                  )}
                  <Typography variant="subtitle1" fontWeight="800" color="#0f233c" noWrap>
                    {obtenerTituloCanal(canalActivo)}
                  </Typography>
                  {canalActivo?.tipo === 'dm' && (
                    <Chip
                      label="Mensaje Directo"
                      size="small"
                      sx={{ height: 20, fontSize: '0.68rem', bgcolor: '#f1f5f9', fontWeight: 600 }}
                    />
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
                    sx={{ color: mostrarBuscadorCanal ? '#2563eb' : '#64748b' }}
                  >
                    <Search size={18} />
                  </IconButton>
                </Tooltip>

                <Tooltip title={`Mensajes fijados (${mensajesFijados.length})`}>
                  <IconButton
                    size="small"
                    onClick={() => setPanelDerecho(panelDerecho === 'fijados' ? null : 'fijados')}
                    sx={{ color: panelDerecho === 'fijados' ? '#2563eb' : '#64748b' }}
                  >
                    <Badge badgeContent={mensajesFijados.length} color="primary">
                      <Pin size={17} />
                    </Badge>
                  </IconButton>
                </Tooltip>

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
                    color: '#1a365d',
                    display: { xs: 'none', sm: 'inline-flex' }
                  }}
                >
                  Agendar Evento
                </Button>
              </Box>
            </Box>

            {/* FEED DE MENSAJES */}
            <Box
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
                      bgcolor: 'rgba(26, 54, 93, 0.06)',
                      color: '#1a365d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 1.5
                    }}
                  >
                    {canalActivo?.tipo === 'dm' ? <Users size={26} /> : <Hash size={26} />}
                  </Box>
                  <Typography variant="subtitle1" fontWeight="800" color="#0f233c">
                    Este es el comienzo de {canalActivo?.tipo === 'dm' ? '' : '#'}{obtenerTituloCanal(canalActivo)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {canalActivo?.descripcion ||
                      'Envía un mensaje, comparte documentos del expediente o menciona a un colega con @.'}
                  </Typography>
                </Box>
              ) : (
                mensajesPrincipales.map((msg) => {
                  const esAutor = msg.autorEmail === currentUserEmail;
                  const puedeBorrar = esAutor || userRole === 'Superadmin' || userRole === 'Admin';
                  const reaccionesEntries = Object.entries(msg.reacciones || {});

                  return (
                    <Box
                      key={msg.id}
                      sx={{
                        position: 'relative',
                        display: 'flex',
                        gap: 1.5,
                        p: 1.25,
                        borderRadius: 2,
                        bgcolor: msg.fijado ? 'rgba(245, 158, 11, 0.05)' : 'transparent',
                        borderLeft: msg.fijado ? '3px solid #f59e0b' : '3px solid transparent',
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
                        <Tooltip title={msg.fijado ? 'Desfijar mensaje' : 'Fijar mensaje'}>
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
                          bgcolor: '#1a365d',
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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="subtitle2" fontWeight="800" color="#0f233c">
                            {msg.autorNombre}
                          </Typography>
                          {msg.autorRol && (
                            <Chip
                              label={msg.autorRol}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                bgcolor: 'rgba(26, 54, 93, 0.07)',
                                color: '#1a365d'
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
                                sx={{ textTransform: 'none', bgcolor: '#1a365d', fontSize: '0.75rem' }}
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
                                CATEGORIAS_EVENTO[msg.eventoAdjunto.categoria]?.dot || '#1a365d'
                              }`,
                              bgcolor: '#f8fafc',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 1.5
                            }}
                          >
                            <Box>
                              <Typography variant="subtitle2" fontWeight="bold" color="#0f233c">
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
                              borderLeft: '4px solid #1a365d',
                              bgcolor: '#f8fafc',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 1.5
                            }}
                          >
                            <Box>
                              <Typography variant="subtitle2" fontWeight="bold" color="#0f233c">
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
                                    color: '#0f233c',
                                    '&:hover': { bgcolor: '#f1f5f9' }
                                  }}
                                >
                                  <FileText size={16} color="#2563eb" />
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
                                    bgcolor: yoReaccione ? 'rgba(37, 99, 235, 0.12)' : '#f1f5f9',
                                    color: yoReaccione ? '#1d4ed8' : '#334155',
                                    border: yoReaccione ? '1px solid #93c5fd' : '1px solid #e2e8f0'
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
                                color: '#2563eb',
                                py: 0.2,
                                px: 1,
                                borderRadius: 1.5,
                                '&:hover': { bgcolor: 'rgba(37, 99, 235, 0.08)' }
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
              <div ref={messagesEndRef} />
            </Box>

            {/* COMPOSITOR DE MENSAJES ENRIQUECIDO (ESTILO SLACK) */}
            <Box sx={{ p: { xs: 1.25, sm: 2 }, pt: 0.5, bgcolor: '#ffffff' }}>
              {archivosSubiendo && <LinearProgress variant="determinate" value={progresoSubida} sx={{ mb: 1, borderRadius: 1 }} />}

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
                    borderColor: '#1a365d',
                    boxShadow: '0 0 0 2px rgba(26, 54, 93, 0.08)'
                  }
                }}
              >
                {/* BARRA DE FORMATO RÁPIDO */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 1,
                    py: 0.4,
                    bgcolor: '#f8fafc',
                    borderBottom: '1px solid #f1f5f9'
                  }}
                >
                  <Tooltip title="Negrita (*texto*)">
                    <IconButton size="small" onClick={() => insertarFormatoEnComposer('*')}>
                      <Bold size={14} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Código (`código`)">
                    <IconButton size="small" onClick={() => insertarFormatoEnComposer('`')}>
                      <Code size={14} />
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
                  <Tooltip title="Adjuntar archivo o imagen">
                    <IconButton
                      size="small"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={archivosSubiendo}
                    >
                      <Paperclip size={14} />
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

                {/* INPUT DE TEXTO Y BOTÓN ENVIAR */}
                <Box sx={{ display: 'flex', alignItems: 'flex-end', p: 1, gap: 1 }}>
                  <TextField
                    placeholder={`Enviar mensaje a ${canalActivo?.tipo === 'dm' ? '' : '#'}${obtenerTituloCanal(canalActivo)}...`}
                    multiline
                    maxRows={4}
                    fullWidth
                    variant="standard"
                    value={textoMensaje}
                    onChange={(e) => setTextoMensaje(e.target.value)}
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
                          ? '#059669'
                          : '#f1f5f9',
                      color:
                        textoMensaje.trim() || adjuntosPendientes.length > 0
                          ? '#ffffff'
                          : '#94a3b8',
                      borderRadius: 2,
                      width: 34,
                      height: 34,
                      '&:hover': { bgcolor: '#047857' }
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
        {/* 3. PANEL LATERAL DERECHO: HILOS DE CONVERSACIÓN O MENSAJES FIJADOS  */}
        {/* ------------------------------------------------------------------- */}
        {seccionActiva === 'chat' && panelDerecho && (
          <Box
            sx={{
              width: { xs: '100%', sm: 340 },
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
              <Typography variant="subtitle2" fontWeight="800" color="#0f233c">
                {panelDerecho === 'hilo' ? '💬 Hilo de conversación' : '📌 Mensajes Fijados'}
              </Typography>
              <IconButton size="small" onClick={() => setPanelDerecho(null)}>
                <X size={17} />
              </IconButton>
            </Box>

            {panelDerecho === 'hilo' && mensajeHiloPadre ? (
              <>
                <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {/* MENSAJE PADRE */}
                  <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: '1px solid #cbd5e1', bgcolor: '#ffffff' }}>
                    <Typography variant="caption" fontWeight="bold" color="#1a365d">
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

                  {/* RESPUESTAS DEL HILO */}
                  {respuestasHiloActivo.map((rep) => (
                    <Box key={rep.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: '#1a365d' }}>
                        {(rep.autorNombre || 'U').charAt(0).toUpperCase()}
                      </Avatar>
                      <Paper
                        elevation={0}
                        sx={{ p: 1.25, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#ffffff', flexGrow: 1 }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" fontWeight="bold" color="#0f233c">
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

                {/* INPUT DE RESPUESTA AL HILO */}
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
                    sx={{ bgcolor: '#1a365d', color: '#ffffff', borderRadius: 2, '&:hover': { bgcolor: '#0f233c' } }}
                  >
                    <Send size={15} />
                  </IconButton>
                </Box>
              </>
            ) : (
              /* LISTA DE MENSAJES FIJADOS */
              <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {mensajesFijados.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 4 }}>
                    No hay mensajes fijados en este canal.
                  </Typography>
                ) : (
                  mensajesFijados.map((m) => (
                    <Paper key={m.id} elevation={0} sx={{ p: 1.5, borderRadius: 2, border: '1px solid #fde68a', bgcolor: '#fffbeb' }}>
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
      {/* MODAL CREAR NUEVO CANAL                                               */}
      {/* ===================================================================== */}
      <Dialog open={modalCanalOpen} onClose={() => setModalCanalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', color: '#1a365d' }}>Crear Nuevo Canal</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Nombre del canal"
            placeholder="ej: caso-corte-idh"
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
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="body2" fontWeight="bold">
                Canal Privado 🔒
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Solo visible para los miembros seleccionados
              </Typography>
            </Box>
            <Switch
              checked={nuevoCanalForm.esPrivado}
              onChange={(e) => setNuevoCanalForm((p) => ({ ...p, esPrivado: e.target.checked }))}
            />
          </Box>

          {nuevoCanalForm.esPrivado && (
            <FormControl size="small" fullWidth>
              <InputLabel>Miembros con acceso</InputLabel>
              <Select
                multiple
                value={nuevoCanalForm.miembros}
                onChange={(e) =>
                  setNuevoCanalForm((p) => ({
                    ...p,
                    miembros: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value
                  }))
                }
                input={<OutlinedInput label="Miembros con acceso" />}
                renderValue={(sel) => `${sel.length} seleccionado(s)`}
              >
                {usuariosEquipo.map((u) => (
                  <MenuItem key={u.email} value={u.email}>
                    <Checkbox size="small" checked={nuevoCanalForm.miembros.indexOf(u.email) > -1} />
                    <ListItemText primary={u.nombre} secondary={u.email} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
            sx={{ bgcolor: '#1a365d', textTransform: 'none', fontWeight: 'bold' }}
          >
            Crear Canal
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
